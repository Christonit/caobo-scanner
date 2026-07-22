"""
Shared utility functions and singletons used by both server.py (gastos) and
suplidores_server.py (suplidores).

Keeping them here prevents circular imports: neither server module needs to
import from the other; both import from this module instead.
"""
import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Inference model selection (thinking levels from the frontend)
# ---------------------------------------------------------------------------

THINKING_LEVELS = ("rapido", "moderado", "profundo")

# Defaults when ENV is unset. Override with THINKING_LEVEL_*_MODEL.
# Rapido → Flash Lite (structured JSON)
# Moderado → 3.5 Flash Lite (thinking budget)
# Profundo → 3.6 Flash (deep)
_DEFAULT_THINKING_LEVEL_MODELS: dict[str, str] = {
    "rapido": "gemini-3.1-flash-lite",
    "moderado": "gemini-3.5-flash-lite",
    "profundo": "gemini-3.6-flash",
}


def get_thinking_level_models() -> dict[str, str]:
    """
    Map thinking speed → model id from ENV (with hardcoded defaults).

      THINKING_LEVEL_RAPIDO_MODEL=gemini-3.1-flash-lite
      THINKING_LEVEL_MODERADO_MODEL=gemini-3.5-flash-lite
      THINKING_LEVEL_PROFUNDO_MODEL=gemini-3.6-flash
    """
    out: dict[str, str] = {}
    for level, default in _DEFAULT_THINKING_LEVEL_MODELS.items():
        key = f"THINKING_LEVEL_{level.upper()}_MODEL"
        raw = (os.getenv(key) or "").strip()
        out[level] = raw or default
    return out


def get_model_to_thinking_level() -> dict[str, str]:
    """Inverse of get_thinking_level_models() (first level wins on duplicates)."""
    inverse: dict[str, str] = {}
    for level, model_id in get_thinking_level_models().items():
        inverse.setdefault(model_id, level)
    return inverse


def get_allowed_inference_models() -> frozenset[str]:
    return frozenset(get_thinking_level_models().values())


# Snapshot at import time for callers that still import the frozenset directly.
# Prefer get_allowed_inference_models() so ENV changes are visible after reload.
ALLOWED_INFERENCE_MODELS = get_allowed_inference_models()
DEFAULT_INFERENCE_MODEL = get_thinking_level_models()["moderado"]


def resolve_inference_model(
    model: Optional[str],
    default: str = DEFAULT_INFERENCE_MODEL,
    thinking_level: Optional[str] = None,
) -> str:
    """
    Resolve the Gemini model id for a request.

    Prefer an explicit thinking_level → ENV model mapping (so the UI selector
    stays authoritative even when the client sends a stale/hardcoded model id).
    Otherwise accept a whitelisted client-supplied model id.
    Falls back to `default` when missing or not allowed.
    """
    level = (thinking_level or "").strip().lower()
    if level in THINKING_LEVELS:
        return get_thinking_level_models()[level]

    allowed = get_allowed_inference_models()
    candidate = (model or "").strip()
    if candidate in allowed:
        return candidate
    fallback = (default or "").strip() or DEFAULT_INFERENCE_MODEL
    return fallback if fallback in allowed else DEFAULT_INFERENCE_MODEL


# ---------------------------------------------------------------------------
# PDF rasterisation settings
# ---------------------------------------------------------------------------

# Maximum number of pages to render from a single PDF.
PDF_MAX_PAGES = 5
# Rasterization DPI for PDF pages.
PDF_RENDER_DPI = 150


# ---------------------------------------------------------------------------
# Gemini rate-limiting (shared across gastos and suplidores routes)
# ---------------------------------------------------------------------------

GEMINI_MAX_CONCURRENT = 5
gemini_semaphore = asyncio.Semaphore(GEMINI_MAX_CONCURRENT)


# ---------------------------------------------------------------------------
# PDF / image loading
# ---------------------------------------------------------------------------

def render_pdf_to_images(pdf_bytes: bytes, max_pages: int = PDF_MAX_PAGES) -> list:
    """
    Render a PDF byte buffer to a list of PIL.Image pages.

    Uses PyMuPDF (imports as `pymupdf` on recent versions, `fitz` historically).
    Returns at most `max_pages` images. Returns an empty list if PyMuPDF is
    unavailable or the PDF can't be opened.
    """
    import io
    from PIL import Image

    try:
        try:
            import pymupdf  # PyMuPDF >= 1.24
        except ImportError:  # pragma: no cover - older PyMuPDF
            import fitz as pymupdf  # type: ignore

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        print(f"[ERROR] [PDF] Could not open PDF ({len(pdf_bytes)} bytes): {e}")
        return []

    images: list = []
    try:
        page_count = min(doc.page_count, max_pages)
        print(
            f"[DEBUG] [PDF] Opened PDF: {doc.page_count} page(s) total, "
            f"rasterizing {page_count} (max_pages={max_pages})"
        )
        zoom = PDF_RENDER_DPI / 72.0  # 72 is PDF's base DPI
        matrix = pymupdf.Matrix(zoom, zoom)
        for page_index in range(page_count):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            png_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(png_bytes))
            images.append(img)
            print(
                f"[DEBUG] [PDF] Rendered page {page_index + 1}/{page_count}: "
                f"{img.size[0]}x{img.size[1]}px, {len(png_bytes)} bytes"
            )
            if len(png_bytes) < 3000:
                print(
                    f"[WARNING] [PDF] Page {page_index + 1} rendered suspiciously "
                    f"small ({len(png_bytes)} bytes) - it may be blank."
                )
    except Exception as e:
        print(f"[ERROR] [PDF] Failed while rasterizing PDF: {e}")
    finally:
        try:
            doc.close()
        except Exception:
            pass

    return images


def load_file_as_images(file_content: bytes, filename: str) -> list:
    """
    Load a single uploaded file into a list of PIL.Image objects ready for
    a vision model.

    - PNG / JPG / JPEG -> single-element list with the decoded image
    - PDF              -> one image per rendered page (capped at PDF_MAX_PAGES)
    - Anything else    -> empty list (caller treats as unsupported)
    """
    import io
    from PIL import Image

    ext = Path(filename).suffix.lower() if filename else ""
    print(
        f"[DEBUG] [LOAD] {filename}: {len(file_content)} bytes, "
        f"detected extension '{ext}'"
    )
    if ext in (".png", ".jpg", ".jpeg"):
        try:
            img = Image.open(io.BytesIO(file_content))
            img.load()  # force-decode now so corrupt/truncated images fail here
            print(
                f"[DEBUG] [LOAD] {filename}: decoded image "
                f"{img.size[0]}x{img.size[1]}px, mode={img.mode}"
            )
            if len(file_content) < 3000:
                print(
                    f"[WARNING] [LOAD] {filename} is suspiciously small "
                    f"({len(file_content)} bytes) - it may be blank/corrupt."
                )
            return [img]
        except Exception as e:
            print(f"[ERROR] [LOAD] Failed to open image {filename}: {e}")
            return []
    if ext == ".pdf":
        return render_pdf_to_images(file_content)
    print(f"[WARNING] [LOAD] {filename}: unsupported extension '{ext}'")
    return []


# ---------------------------------------------------------------------------
# Gemini response helpers
# ---------------------------------------------------------------------------

def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` fences that Gemini sometimes adds."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _json_rank(value: Any) -> tuple:
    """
    Rank parsed JSON candidates. Prefer non-empty lists (batch), then
    non-empty dicts (single), over empty / scalar junk Gemma sometimes emits
    before the real payload (causes `Extra data: ... char 2` on `[]` / `{}`).
    """
    if isinstance(value, list):
        return (3, len(value), sum(1 for x in value if isinstance(x, dict)))
    if isinstance(value, dict):
        return (2, len(value), 0)
    return (0, 0, 0)


def _parse_json_loose(text: str) -> Any:
    """
    Parse model JSON, tolerating markdown fences and trailing/leading junk.

    Gemma often returns a tiny complete value first (`[]` / `{}`) then the
    real payload; strict `json.loads` fails with Extra data. Scan for the
    best object/array via raw_decode instead.
    """
    cleaned = _strip_markdown_fences(text or "")
    if not cleaned:
        raise ValueError("Empty JSON response")

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()
    best: Any = None
    best_rank = (-1, -1, -1)
    for i, ch in enumerate(cleaned):
        if ch not in "{[":
            continue
        try:
            obj, _end = decoder.raw_decode(cleaned, i)
        except json.JSONDecodeError:
            continue
        rank = _json_rank(obj)
        if rank > best_rank:
            best = obj
            best_rank = rank

    if best is None:
        raise ValueError("Could not parse JSON from response")
    return best


def _is_retryable_error(error: Exception) -> bool:
    error_str = str(error).lower()
    return (
        "429" in error_str or "rate" in error_str or "limit" in error_str
        or "quota" in error_str or "resource exhausted" in error_str
        or "resource_exhausted" in error_str
        or "500" in error_str or "502" in error_str or "503" in error_str
        or "timeout" in error_str or "empty response" in error_str
    )


# ---------------------------------------------------------------------------
# Inference generation (structured JSON + optional thinking budget)
# ---------------------------------------------------------------------------

def _env_int(key: str, default: int) -> int:
    raw = (os.getenv(key) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        print(f"[WARNING] Invalid {key}={raw!r}; using {default}")
        return default


def thinking_config_for_level(thinking_level: Optional[str]) -> Optional[dict]:
    """
    Build Gemini thinkingConfig for a UI thinking speed.

    - rapido: no thinking config (structured JSON only; keep it fast)
    - moderado: thinkingBudget from THINKING_BUDGET_MODERADO (default 1024)
    - profundo: optional THINKING_BUDGET_PROFUNDO, else none
    """
    level = (thinking_level or "").strip().lower()
    if level == "moderado":
        return {"thinkingBudget": _env_int("THINKING_BUDGET_MODERADO", 1024)}
    if level == "profundo":
        raw = (os.getenv("THINKING_BUDGET_PROFUNDO") or "").strip()
        if raw:
            try:
                return {"thinkingBudget": int(raw)}
            except ValueError:
                print(f"[WARNING] Invalid THINKING_BUDGET_PROFUNDO={raw!r}")
        return None
    return None


def _part_to_rest(part: Any) -> dict:
    """Convert a str or PIL.Image into a Gemini REST `Part`."""
    if isinstance(part, str):
        return {"text": part}

    # Duck-type PIL.Image
    if hasattr(part, "save") and hasattr(part, "mode"):
        import base64
        import io

        buf = io.BytesIO()
        img = part
        if getattr(img, "mode", None) not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(buf, format="PNG")
        return {
            "inline_data": {
                "mime_type": "image/png",
                "data": base64.b64encode(buf.getvalue()).decode("ascii"),
            }
        }

    raise TypeError(f"Unsupported content part type: {type(part)!r}")


class _UsageMetadataView:
    """SDK-compatible view over REST usageMetadata (snake_case attrs)."""

    def __init__(self, data: Optional[dict] = None):
        data = data or {}
        self.prompt_token_count = data.get("promptTokenCount")
        self.candidates_token_count = data.get("candidatesTokenCount")
        self.total_token_count = data.get("totalTokenCount")
        self.cached_content_token_count = data.get("cachedContentTokenCount")
        self.thoughts_token_count = data.get("thoughtsTokenCount")


class InferenceResponse:
    """Minimal stand-in for google.generativeai GenerateContentResponse."""

    def __init__(self, text: str, usage_metadata: Optional[dict] = None):
        self.text = text
        self.usage_metadata = _UsageMetadataView(usage_metadata)


def generate_inference_content(
    model_id: str,
    parts: list,
    *,
    thinking_level: Optional[str] = None,
    max_output_tokens: int = 4096,
    temperature: float = 0.1,
    timeout_s: int = 180,
) -> InferenceResponse:
    """
    Call Gemini generateContent with structured JSON output.

    Always sets responseMimeType=application/json (structured output).
    For moderado, also sends thinkingBudget (see thinking_config_for_level).

    Uses the REST API so thinkingConfig works with google-generativeai 0.8.
    """
    import urllib.error
    import urllib.request

    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    level = (thinking_level or "").strip().lower()
    if level not in THINKING_LEVELS:
        from_model = get_model_to_thinking_level().get((model_id or "").strip())
        level = from_model or "moderado"

    thinking_cfg = thinking_config_for_level(level)
    # Thinking tokens count against maxOutputTokens — leave headroom.
    budget = 0
    if thinking_cfg and "thinkingBudget" in thinking_cfg:
        budget = max(0, int(thinking_cfg["thinkingBudget"]))
    effective_max = max_output_tokens + budget

    generation_config: dict[str, Any] = {
        "responseMimeType": "application/json",
        "maxOutputTokens": effective_max,
        "temperature": temperature,
    }
    if thinking_cfg:
        generation_config["thinkingConfig"] = thinking_cfg

    body = {
        "contents": [
            {
                "role": "user",
                "parts": [_part_to_rest(p) for p in parts],
            }
        ],
        "generationConfig": generation_config,
    }

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_id}:generateContent?key={api_key}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"Gemini HTTP {e.code}: {detail}") from e

    candidates = payload.get("candidates") or []
    if not candidates:
        raise ValueError("Empty response from Gemini API")

    text_parts: list[str] = []
    for part in (candidates[0].get("content") or {}).get("parts") or []:
        if part.get("thought"):
            continue
        if part.get("text"):
            text_parts.append(part["text"])
    text = "".join(text_parts)
    if not text.strip():
        finish = candidates[0].get("finishReason")
        raise ValueError(
            f"Empty response from Gemini API (finishReason={finish})"
        )

    return InferenceResponse(text=text, usage_metadata=payload.get("usageMetadata"))
