"""
Token usage + cost accounting for Gemini/Gemma API calls.

Pricing is per *thinking speed* (rapido / moderado / profundo), USD per
1,000,000 tokens, loaded from ENV:

  TOKEN_COST_RAPIDO_INPUT_PER_1M=…
  TOKEN_COST_RAPIDO_OUTPUT_PER_1M=…
  TOKEN_COST_RAPIDO_CACHED_INPUT_PER_1M=…   # optional

  TOKEN_COST_MODERADO_INPUT_PER_1M=…
  TOKEN_COST_MODERADO_OUTPUT_PER_1M=…

  TOKEN_COST_PROFUNDO_INPUT_PER_1M=…
  TOKEN_COST_PROFUNDO_OUTPUT_PER_1M=…

Which model belongs to which thinking speed is also ENV-driven (see
shared_utils.get_thinking_level_models):

  THINKING_LEVEL_RAPIDO_MODEL=gemini-3.1-flash-lite
  THINKING_LEVEL_MODERADO_MODEL=gemini-3.5-flash-lite
  THINKING_LEVEL_PROFUNDO_MODEL=gemini-3.6-flash

  THINKING_BUDGET_MODERADO=1024

Missing cost vars default to 0.

Model context-window limits below were pulled from Gemini ModelService
(list_models) — input_token_limit / output_token_limit. They are NOT prices.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional, TypedDict

from shared_utils import (
    THINKING_LEVELS,
    get_allowed_inference_models,
    get_model_to_thinking_level,
)

# Context-window limits from Gemini list_models() (2026-07-22).
# Refresh with fetch_model_token_limits() if Google changes them.
MODEL_TOKEN_LIMITS: dict[str, dict[str, int]] = {
    "gemini-3.1-flash-lite": {
        "input_token_limit": 1_048_576,
        "output_token_limit": 65_536,
    },
    "gemini-3.5-flash-lite": {
        "input_token_limit": 1_048_576,
        "output_token_limit": 65_536,
    },
    "gemini-3.6-flash": {
        "input_token_limit": 1_048_576,
        "output_token_limit": 65_536,
    },
    # Older / alias ids still listed by the API for some keys.
    "gemini-2.5-flash-lite": {
        "input_token_limit": 1_048_576,
        "output_token_limit": 65_536,
    },
    "gemini-3-flash-preview": {
        "input_token_limit": 1_048_576,
        "output_token_limit": 65_536,
    },
    "gemini-flash-lite-latest": {
        "input_token_limit": 1_048_576,
        "output_token_limit": 65_536,
    },
}

_MILLION = Decimal("1000000")
_COST_QUANT = Decimal("0.00000001")  # 8 decimal places, matches numeric(18,8)


class LevelRates(TypedDict):
    input: float
    output: float
    cachedInput: float


class UsageCounts(TypedDict, total=False):
    promptTokens: int
    completionTokens: int
    cachedTokens: int


def resolve_thinking_level(
    thinking_level: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """
    Prefer an explicit thinking_level; otherwise derive it from the model id
    via ENV mapping (THINKING_LEVEL_*_MODEL). Falls back to 'moderado'.
    """
    candidate = (thinking_level or "").strip().lower()
    if candidate in THINKING_LEVELS:
        return candidate
    model_id = (model or "").strip()
    mapped = get_model_to_thinking_level().get(model_id)
    if mapped:
        return mapped
    return "moderado"


def _env_decimal(key: str) -> Decimal:
    raw = (os.getenv(key) or "").strip()
    if not raw:
        return Decimal("0")
    try:
        value = Decimal(raw)
    except Exception:
        print(f"[WARNING] [token-usage] Invalid {key}={raw!r}; using 0")
        return Decimal("0")
    if value < 0:
        print(f"[WARNING] [token-usage] Negative {key}={raw!r}; using 0")
        return Decimal("0")
    return value


def get_rates_for_level(thinking_level: str) -> LevelRates:
    """Load {input, output, cachedInput} USD/1M rates for a thinking speed."""
    level = resolve_thinking_level(thinking_level)
    prefix = level.upper()
    return {
        "input": float(_env_decimal(f"TOKEN_COST_{prefix}_INPUT_PER_1M")),
        "output": float(_env_decimal(f"TOKEN_COST_{prefix}_OUTPUT_PER_1M")),
        "cachedInput": float(
            _env_decimal(f"TOKEN_COST_{prefix}_CACHED_INPUT_PER_1M")
        ),
    }


def get_pricing_table() -> dict[str, LevelRates]:
    """
    Build the pricing table keyed by thinking speed from ENV.

      {
        "rapido": { "input": …, "output": …, "cachedInput": … },
        "moderado": { … },
        "profundo": { … },
      }
    """
    return {level: get_rates_for_level(level) for level in THINKING_LEVELS}


def get_model_token_limits(model: Optional[str] = None) -> dict:
    """
    Return cached input/output token limits for one model, or the full table.
    """
    if model is None:
        return dict(MODEL_TOKEN_LIMITS)
    return dict(MODEL_TOKEN_LIMITS.get((model or "").strip(), {}))


def fetch_model_token_limits(
    models: Optional[set[str]] = None,
) -> dict[str, dict[str, int]]:
    """
    Call Gemini ModelService.list_models and return
    {model: {input_token_limit, output_token_limit}} for the requested ids
    (defaults to ENV-mapped thinking-level models).
    """
    import google.generativeai as genai

    wanted = models or set(get_allowed_inference_models())
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY is not configured")

    out: dict[str, dict[str, int]] = {}
    for model in genai.list_models():
        full = model.name or ""
        short = full.split("/", 1)[-1] if full else ""
        if short not in wanted:
            continue
        in_lim = getattr(model, "input_token_limit", None)
        out_lim = getattr(model, "output_token_limit", None)
        out[short] = {
            "input_token_limit": int(in_lim) if in_lim is not None else 0,
            "output_token_limit": int(out_lim) if out_lim is not None else 0,
        }
    return out


def calculate_call_cost(
    model: str,
    usage: UsageCounts | dict[str, Any],
    *,
    thinking_level: Optional[str] = None,
) -> float:
    """
    Price a single API call from per-thinking-speed ENV rates.

    Resolves model → thinking level via THINKING_LEVEL_*_MODEL (or an
    explicit thinking_level), then applies TOKEN_COST_{LEVEL}_*_PER_1M.

    Mirrors:

      function calculateCallCost(level, usage) {
        const rates = PRICING_TABLE[level];
        const uncachedInput = usage.promptTokens - (usage.cachedTokens || 0);
        const inputCost = (uncachedInput / 1_000_000) * rates.input;
        const cachedCost = ((usage.cachedTokens || 0) / 1_000_000) * rates.cachedInput;
        const outputCost = (usage.completionTokens / 1_000_000) * rates.output;
        return inputCost + cachedCost + outputCost;
      }
    """
    level = resolve_thinking_level(thinking_level, model)
    rates = get_rates_for_level(level)

    prompt_tokens = _as_nonneg_int(
        usage.get("promptTokens", usage.get("input_tokens", 0))
    )
    completion_tokens = _as_nonneg_int(
        usage.get("completionTokens", usage.get("output_tokens", 0))
    )
    cached_tokens = _as_nonneg_int(
        usage.get("cachedTokens", usage.get("cached_tokens", 0))
    )
    if cached_tokens > prompt_tokens:
        cached_tokens = prompt_tokens

    uncached_input = prompt_tokens - cached_tokens
    input_cost = (Decimal(uncached_input) / _MILLION) * Decimal(str(rates["input"]))
    cached_cost = (Decimal(cached_tokens) / _MILLION) * Decimal(
        str(rates["cachedInput"])
    )
    output_cost = (Decimal(completion_tokens) / _MILLION) * Decimal(
        str(rates["output"])
    )
    total = (input_cost + cached_cost + output_cost).quantize(
        _COST_QUANT, rounding=ROUND_HALF_UP
    )
    return float(total)


def calculate_call_cost_breakdown(
    model: str,
    usage: UsageCounts | dict[str, Any],
    *,
    thinking_level: Optional[str] = None,
) -> dict[str, float]:
    """Like calculate_call_cost, but also returns the rates applied."""
    level = resolve_thinking_level(thinking_level, model)
    rates = get_rates_for_level(level)
    cost = calculate_call_cost(model, usage, thinking_level=level)
    return {
        "thinking_level": level,
        "input_cost_per_1m": rates["input"],
        "output_cost_per_1m": rates["output"],
        "cached_input_cost_per_1m": rates["cachedInput"],
        "cost_usd": cost,
    }


def _as_nonneg_int(value: Any) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, n)


def extract_usage_from_response(response: Any) -> dict[str, int]:
    """Pull prompt / output / cached / total token counts from a Gemini response."""
    usage = getattr(response, "usage_metadata", None)
    input_tokens = _as_nonneg_int(
        getattr(usage, "prompt_token_count", None) if usage else None
    )
    output_tokens = _as_nonneg_int(
        getattr(usage, "candidates_token_count", None) if usage else None
    )
    cached_tokens = _as_nonneg_int(
        getattr(usage, "cached_content_token_count", None) if usage else None
    )
    total_tokens = _as_nonneg_int(
        getattr(usage, "total_token_count", None) if usage else None
    )
    if total_tokens == 0 and (input_tokens or output_tokens):
        total_tokens = input_tokens + output_tokens
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cached_tokens": cached_tokens,
        "total_tokens": total_tokens,
    }


def build_usage_record(
    *,
    response: Any = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    cached_tokens: Optional[int] = None,
    model: str,
    thinking_level: Optional[str] = None,
    source: str,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Build a serializable usage dict with token breakdown + cost.

    Prefer explicit token counts; otherwise read them from `response`.
    Cost is priced by thinking speed via calculate_call_cost / ENV rates.
    """
    if response is not None and input_tokens is None and output_tokens is None:
        counts = extract_usage_from_response(response)
        input_tokens = counts["input_tokens"]
        output_tokens = counts["output_tokens"]
        total_tokens = counts["total_tokens"]
        cached_tokens = counts["cached_tokens"]

    in_tok = _as_nonneg_int(input_tokens)
    out_tok = _as_nonneg_int(output_tokens)
    cached_tok = _as_nonneg_int(cached_tokens)
    tot_tok = _as_nonneg_int(total_tokens)
    if tot_tok == 0 and (in_tok or out_tok):
        tot_tok = in_tok + out_tok

    model_id = (model or "").strip()
    level = resolve_thinking_level(thinking_level, model_id)
    breakdown = calculate_call_cost_breakdown(
        model_id,
        {
            "promptTokens": in_tok,
            "completionTokens": out_tok,
            "cachedTokens": cached_tok,
        },
        thinking_level=level,
    )
    limits = get_model_token_limits(model_id)

    meta = dict(metadata) if isinstance(metadata, dict) else {}
    if cached_tok:
        meta["cached_tokens"] = cached_tok
    if limits:
        meta.setdefault("input_token_limit", limits.get("input_token_limit"))
        meta.setdefault("output_token_limit", limits.get("output_token_limit"))

    return {
        "thinking_level": level,
        "model": model_id,
        "source": (source or "unknown")[:64],
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "total_tokens": tot_tok,
        "cached_tokens": cached_tok,
        "input_cost_per_1m": breakdown["input_cost_per_1m"],
        "output_cost_per_1m": breakdown["output_cost_per_1m"],
        "cached_input_cost_per_1m": breakdown["cached_input_cost_per_1m"],
        "cost_usd": breakdown["cost_usd"],
        "metadata": meta,
    }


def merge_usage_records(records: list[dict]) -> Optional[dict]:
    """Sum token counts / cost across multiple API calls (e.g. suplidor batches)."""
    usable = [r for r in records if isinstance(r, dict)]
    if not usable:
        return None
    first = usable[0]
    merged = {
        "thinking_level": first.get("thinking_level", "moderado"),
        "model": first.get("model", ""),
        "source": first.get("source", "unknown"),
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "cached_tokens": 0,
        "input_cost_per_1m": first.get("input_cost_per_1m", 0),
        "output_cost_per_1m": first.get("output_cost_per_1m", 0),
        "cached_input_cost_per_1m": first.get("cached_input_cost_per_1m", 0),
        "cost_usd": 0.0,
        "metadata": {
            "calls": len(usable),
            **(first.get("metadata") or {}),
        },
    }
    for r in usable:
        merged["input_tokens"] += _as_nonneg_int(r.get("input_tokens"))
        merged["output_tokens"] += _as_nonneg_int(r.get("output_tokens"))
        merged["total_tokens"] += _as_nonneg_int(r.get("total_tokens"))
        merged["cached_tokens"] += _as_nonneg_int(r.get("cached_tokens"))
        merged["cost_usd"] += float(r.get("cost_usd") or 0)
    merged["cost_usd"] = float(
        Decimal(str(merged["cost_usd"])).quantize(_COST_QUANT, rounding=ROUND_HALF_UP)
    )
    return merged


def _supabase_config() -> tuple[Optional[str], Optional[str]]:
    url = (os.getenv("SUPABASE_URL") or os.getenv("NUXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = (
        os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("NUXT_SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    ).strip()
    if not url or not key:
        return None, None
    return url, key


def persist_usage(
    usage: Optional[dict],
    *,
    organization_id: Optional[str],
    user_id: Optional[str],
    client_id: Optional[str] = None,
) -> bool:
    """
    Insert a usage row into public.api_token_usage.

    Requires SUPABASE_URL + secret key ENV and both organization_id and
    user_id. Failures are logged and never raised (spend tracking must not
    break receipt processing).
    """
    if not usage:
        return False
    org = (organization_id or "").strip()
    actor = (user_id or "").strip()
    if not org or not actor:
        print(
            "[DEBUG] [token-usage] Skipping persist: "
            "organization_id and user_id are required"
        )
        return False

    base_url, secret = _supabase_config()
    if not base_url or not secret:
        print(
            "[DEBUG] [token-usage] Skipping persist: "
            "SUPABASE_URL / SUPABASE_SECRET_KEY not configured"
        )
        return False

    meta = dict(usage.get("metadata") or {})
    if usage.get("cached_tokens"):
        meta["cached_tokens"] = usage["cached_tokens"]
    if usage.get("cached_input_cost_per_1m") is not None:
        meta["cached_input_cost_per_1m"] = usage["cached_input_cost_per_1m"]

    payload = {
        "organization_id": org,
        "actor_id": actor,
        "client_id": (client_id or "").strip() or None,
        "thinking_level": usage["thinking_level"],
        "model": usage["model"],
        "source": usage["source"],
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "total_tokens": usage["total_tokens"],
        "input_cost_per_1m": usage["input_cost_per_1m"],
        "output_cost_per_1m": usage["output_cost_per_1m"],
        "cost_usd": usage["cost_usd"],
        "metadata": meta,
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/rest/v1/api_token_usage",
        data=body,
        method="POST",
        headers={
            "apikey": secret,
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if 200 <= getattr(resp, "status", 200) < 300:
                print(
                    f"[INFO] [token-usage] Persisted {usage['source']} "
                    f"tokens={usage['total_tokens']} cost_usd={usage['cost_usd']} "
                    f"model={usage['model']} actor={actor[:8]}…"
                )
                return True
            print(
                f"[WARNING] [token-usage] Unexpected status "
                f"{getattr(resp, 'status', '?')} persisting usage"
            )
            return False
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        print(f"[WARNING] [token-usage] Persist HTTP {e.code}: {detail}")
        return False
    except Exception as e:
        print(f"[WARNING] [token-usage] Persist failed: {e}")
        return False


def record_usage_from_response(
    response: Any,
    *,
    model: str,
    source: str,
    thinking_level: Optional[str] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    client_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    persist: bool = True,
) -> dict:
    """Build a usage record from a Gemini response and optionally persist it."""
    usage = build_usage_record(
        response=response,
        model=model,
        thinking_level=thinking_level,
        source=source,
        metadata=metadata,
    )
    print(
        f"[INFO] [token-usage] {source} model={usage['model']} "
        f"level={usage['thinking_level']} "
        f"input={usage['input_tokens']} output={usage['output_tokens']} "
        f"cached={usage.get('cached_tokens', 0)} "
        f"total={usage['total_tokens']} cost_usd={usage['cost_usd']}"
    )
    if persist:
        persist_usage(
            usage,
            organization_id=organization_id,
            user_id=user_id,
            client_id=client_id,
        )
    return usage
