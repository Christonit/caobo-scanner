"""
Suplidores (suppliers) feature module.

Handles:
  - AI-powered extraction of unique supplier records from receipt/invoice PDFs
    or images via the /scan-suplidores endpoint.
  - Export to the official Carga Masiva Suplidores .xls template
    via /download-suplidores-carga-masiva.
  - Legacy plain-xlsx download (platform-native format) via
    /download-suplidores-template.

Register the router in server.py:
    from suplidores_server import router as suplidores_router
    app.include_router(suplidores_router)
"""
import asyncio
import io
import json
import os
import re
from pathlib import Path
from typing import Optional

import google.generativeai as genai
import openpyxl
from dotenv import load_dotenv
from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from shared_utils import (
    _is_retryable_error,
    _strip_markdown_fences,
    gemini_semaphore,
    generate_inference_content,
    get_thinking_level_models,
    render_pdf_to_images,
    resolve_inference_model,
)
from token_usage import (
    merge_usage_records,
    record_usage_from_response,
    resolve_thinking_level,
)
from xls_template import fill_suplidores_xls_template


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_BASE_DIR = Path(__file__).parent

_env_path = _BASE_DIR / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Default when the client does not send a thinking-level `model`.
SUPLIDOR_MODEL = os.getenv(
    "SUPLIDOR_MODEL",
    get_thinking_level_models()["rapido"],
)


# ---------------------------------------------------------------------------
# Catalog constants
# ---------------------------------------------------------------------------

TIPO_DE_FACTURA_OPTIONS_SUPLIDOR = [
    "Formal",
    "Informal",
    "Internacional",
    "Pagos al exterior",
]

# Pages processed per Gemini call when scanning a large PDF.
SUPLIDOR_BATCH_SIZE = 5
# Upper bound on PDF pages to scan (large ledger-style documents may have hundreds).
SUPLIDOR_MAX_PAGES = 500


# ---------------------------------------------------------------------------
# Gemini prompt
# ---------------------------------------------------------------------------

SUPLIDORES_BATCH_PROMPT = """\
Eres un contador experto radicado en República Dominicana. \
Analiza TODAS las imágenes de facturas/recibos adjuntas y extrae TODOS los SUPLIDORES \
(proveedores que emiten los documentos) únicos que encuentres.

Cada imagen tiene un número de página absoluto del documento (indicado abajo). \
Úsalo para reportar en qué página aparece cada suplidor.

Para cada suplidor extrae:
- nombre: nombre o razón social (máx. 255 caracteres).
- documento: SOLO DÍGITOS del RNC / Cédula / Pasaporte, sin guiones ni espacios \
  (ej: "101-70217-6" → "101702176"). Máximo 20 caracteres. Si no aparece, devuelve "".
- tipo_de_factura: EXACTAMENTE uno de: Formal, Informal, Internacional, Pagos al exterior.
  Regla: RNC + NCF formal → "Formal"; sin NCF formal → "Informal"; \
  suplidor extranjero → "Internacional" o "Pagos al exterior".
- score: entero 1, 2 o 3 de confianza en esta extracción:
  + 3 = muy seguro (nombre y documento claros y legibles)
  + 2 = algo seguro (algún campo borroso o incompleto)
  + 1 = poco seguro (datos dudosos o casi ilegibles)
- pagina: número de página absoluto (entero) de la imagen donde aparece este suplidor.

Devuelve un JSON con la clave "suplidores" que contenga un array:
{"suplidores": [{"nombre": "...", "documento": "...", "tipo_de_factura": "...", "score": 3, "pagina": 1}, ...]}
Si no encuentras ningún suplidor, devuelve {"suplidores": []}.
No incluyas texto fuera del JSON.
"""


def _clean_business_rules(rules: Optional[list]) -> list[dict]:
    """Normalize free-form business-rule context for the suplidores prompt."""
    if not rules:
        return []
    cleaned = []
    for entry in rules:
        if not isinstance(entry, dict):
            continue
        rule_type = str(entry.get("rule_type", "") or "").strip()
        if not rule_type:
            continue
        cleaned.append({
            "rule_type": rule_type,
            "rule_value": str(entry.get("rule_value", "") or "").strip(),
            "description": str(entry.get("description", "") or "").strip(),
        })
    return cleaned


def _parse_business_rules_param(raw: Optional[str]) -> list[dict]:
    if not raw or not str(raw).strip():
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return _clean_business_rules(parsed)


def _build_suplidores_business_rules_block(business_rules: list[dict]) -> str:
    if not business_rules:
        return ""
    lines = []
    for rule in business_rules:
        label = rule["rule_type"]
        if rule.get("rule_value"):
            label += f" ({rule['rule_value']})"
        if rule.get("description"):
            lines.append(f"  - {label}: {rule['description']}")
        else:
            lines.append(f"  - {label}")
    return (
        "\n\nADICIONAL - Reglas de negocio de la organización "
        "(contexto para ayudarte a identificar y clasificar suplidores; "
        "NO son valores fijos que debas copiar literalmente):\n"
        + "\n".join(lines)
        + "\n"
    )


def _clamp_score(raw) -> int:
    """Normalize model score to 1–3; default 2 when missing/invalid."""
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return 2
    if n < 1:
        return 1
    if n > 3:
        return 3
    return n


def _build_suplidores_prompt(
    business_rules: Optional[list[dict]] = None,
    page_start: int = 1,
    page_count: int = 1,
) -> str:
    """
    Build the batch prompt including absolute page labels for each image
    and optional org business rules.
    """
    page_lines = []
    for i in range(page_count):
        page_num = page_start + i
        page_lines.append(
            f"  - Imagen {i + 1} = página {page_num} del documento"
        )
    pages_block = (
        "\n\nPáginas de este lote (usa estos números en el campo 'pagina'):\n"
        + "\n".join(page_lines)
        + "\n"
    )
    return (
        SUPLIDORES_BATCH_PROMPT
        + pages_block
        + _build_suplidores_business_rules_block(business_rules or [])
    )


# ---------------------------------------------------------------------------
# Template / output paths
# ---------------------------------------------------------------------------

# Official Carga Masiva Suplidores template (BIFF8 .xls with dropdowns).
SUPLIDORES_TEMPLATE_XLS_SOURCE = _BASE_DIR / "assets/templates/template-suplidores.xls"

# Output path for the filled template returned by /download-suplidores-carga-masiva.
SUPLIDORES_OUTPUT_XLS = _BASE_DIR / "suplidores_output.xls"


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _get_tipo_documento(documento: str) -> str:
    """Classify a cleaned documento string as RNC, CEDULA, or PASAPORTE."""
    d = (documento or "").strip()
    if not d:
        return ""
    if len(d) == 9 and d.isdigit():
        return "RNC"
    if len(d) == 11 and d.isdigit():
        return "CEDULA"
    return "PASAPORTE"


def _extract_suplidores_from_batch(
    images: list,
    batch_num: int,
    model_name: str,
    spend_ctx: Optional[dict] = None,
    business_rules: Optional[list[dict]] = None,
    page_start: int = 1,
) -> tuple[list[dict], Optional[dict]]:
    """
    Send a batch of PIL images to Gemini and return (raw suplidor dicts,
    usage_record). Returns ([], None) on any failure.

    page_start: absolute 1-based page number of the first image in this batch.
    """
    import time

    page_count = len(images)
    page_end = page_start + page_count - 1
    parts = [
        _build_suplidores_prompt(
            business_rules,
            page_start=page_start,
            page_count=page_count,
        )
    ] + images
    ctx = spend_ctx or {}
    level = ctx.get("thinking_level") or resolve_thinking_level(None, model_name)

    for attempt in range(3):
        try:
            print(
                f"[INFO] [suplidor-batch-{batch_num}] calling Gemini "
                f"(attempt {attempt + 1}/3, model={model_name}, "
                f"images={len(images)}, pages={page_start}-{page_end})"
            )
            response = generate_inference_content(
                model_name,
                parts,
                thinking_level=level,
                max_output_tokens=1536,
                temperature=0.1,
            )
            usage_record = record_usage_from_response(
                response,
                model=model_name,
                source="suplidores_batch",
                thinking_level=level,
                organization_id=ctx.get("organization_id"),
                user_id=ctx.get("user_id"),
                client_id=ctx.get("client_id"),
                metadata={"batch_num": batch_num, "images": len(images)},
            )
            raw = _strip_markdown_fences(response.text or "")
            data = json.loads(raw)
            rows = data.get("suplidores", [])
            if not isinstance(rows, list):
                rows = []

            result = []
            for row in rows:
                nombre = str(row.get("nombre", "") or "").strip()[:255]
                documento = re.sub(r"\D", "", str(row.get("documento", "") or ""))[:20]
                tipo = str(row.get("tipo_de_factura", "") or "").strip()
                if tipo not in TIPO_DE_FACTURA_OPTIONS_SUPLIDOR:
                    tipo = ""
                score = _clamp_score(row.get("score"))
                try:
                    pagina = int(row.get("pagina") or page_start)
                except (TypeError, ValueError):
                    pagina = page_start
                if pagina < page_start or pagina > page_end:
                    pagina = page_start
                if nombre:
                    result.append({
                        "nombre": nombre,
                        "documento": documento,
                        "tipo_de_factura": tipo,
                        "score": score,
                        "pagina": pagina,
                    })
            print(f"[DEBUG] [suplidor-batch-{batch_num}] found {len(result)} suplidores")
            return result, usage_record

        except Exception as e:
            print(f"[ERROR] [suplidor-batch-{batch_num}] attempt {attempt + 1}: {e}")
            if attempt < 2 and _is_retryable_error(e):
                time.sleep(2 ** attempt)

    return [], None


def extract_suplidores_from_file(
    file_content: bytes,
    filename: str,
    model_name: Optional[str] = None,
    spend_ctx: Optional[dict] = None,
    business_rules: Optional[list[dict]] = None,
) -> dict:
    """
    Render all pages of a PDF (or a single image) and process them in batches
    through Gemini to extract every unique suplidor in the document.

    model_name: optional client-selected model (thinking level). Falls back
    to SUPLIDOR_MODEL when omitted or not whitelisted.

    business_rules: optional org-level Anotaciones del Negocio fed into each
    Gemini batch prompt.

    Returns:
        {
            "page_count": int,
            "suplidores": [...],
            "usage": {...} | None,
        }
    """
    if not GEMINI_API_KEY:
        return {"page_count": 0, "suplidores": [], "usage": None}

    level = (spend_ctx or {}).get("thinking_level")
    model_id = resolve_inference_model(
        model_name, default=SUPLIDOR_MODEL, thinking_level=level,
    )

    ext = Path(filename).suffix.lower() if filename else ""
    if ext == ".pdf":
        all_images = render_pdf_to_images(file_content, max_pages=SUPLIDOR_MAX_PAGES)
    else:
        from PIL import Image
        try:
            img = Image.open(io.BytesIO(file_content))
            img.load()
            all_images = [img]
        except Exception as e:
            print(f"[ERROR] [scan-suplidores] Could not open image {filename}: {e}")
            return {"page_count": 0, "suplidores": [], "usage": None}

    page_count = len(all_images)
    print(
        f"[INFO] [scan-suplidores] '{filename}': {page_count} page(s) to process "
        f"(model={model_id})"
    )

    if not all_images:
        return {"page_count": 0, "suplidores": [], "usage": None}

    rules = business_rules or []
    all_rows: list[dict] = []
    usages: list[dict] = []
    for i in range(0, len(all_images), SUPLIDOR_BATCH_SIZE):
        batch = all_images[i: i + SUPLIDOR_BATCH_SIZE]
        batch_num = i // SUPLIDOR_BATCH_SIZE + 1
        page_start = i + 1  # 1-based absolute page of first image in batch
        rows, usage = _extract_suplidores_from_batch(
            batch,
            batch_num,
            model_id,
            spend_ctx=spend_ctx,
            business_rules=rules,
            page_start=page_start,
        )
        all_rows.extend(rows)
        if usage:
            usages.append(usage)

    # Deduplicate: prefer the first occurrence of each (documento OR nombre) key.
    # Keep the higher score when merging duplicates.
    seen_docs: set[str] = set()
    seen_names: set[str] = set()
    unique: list[dict] = []
    for row in all_rows:
        doc_key = row["documento"].lower() if row["documento"] else ""
        name_key = row["nombre"].lower()
        if doc_key:
            if doc_key in seen_docs:
                # Upgrade score on existing match if this one is higher.
                for existing in unique:
                    if existing["documento"].lower() == doc_key:
                        if row["score"] > existing["score"]:
                            existing["score"] = row["score"]
                            existing["pagina"] = row["pagina"]
                        break
                continue
            seen_docs.add(doc_key)
        else:
            if name_key in seen_names:
                for existing in unique:
                    if not existing["documento"] and existing["nombre"].lower() == name_key:
                        if row["score"] > existing["score"]:
                            existing["score"] = row["score"]
                            existing["pagina"] = row["pagina"]
                        break
                continue
            seen_names.add(name_key)

        unique.append({
            "nombre": row["nombre"],
            "documento": row["documento"],
            "tipo_de_documento": _get_tipo_documento(row["documento"]),
            "tipo_de_factura": row["tipo_de_factura"],
            "score": row["score"],
            "pagina": row["pagina"],
        })

    print(
        f"[INFO] [scan-suplidores] '{filename}': {len(unique)} unique suplidor(es) "
        f"from {page_count} page(s)"
    )
    return {
        "page_count": page_count,
        "suplidores": unique,
        "usage": merge_usage_records(usages),
    }


# ---------------------------------------------------------------------------
# Template export helpers
# ---------------------------------------------------------------------------

def prepare_suplidores_export_row(s: dict) -> dict:
    """
    Normalize a suplidor dict to the shape expected by fill_suplidores_xls_template.
    Only documento, nombre, and tipo_de_factura are mandatory; direccion and
    provincia are optional and default to "".
    """
    return {
        "documento": re.sub(r"\D", "", str(s.get("documento", "") or ""))[:20],
        "nombre": str(s.get("nombre", "") or "").strip()[:255],
        "tipo_de_factura": str(s.get("tipo_de_factura", "") or "").strip(),
        "direccion": str(s.get("direccion", "") or "").strip(),
        "provincia": str(s.get("provincia", "") or "").strip(),
    }


def _fill_suplidores_template_xls(suplidores: list) -> Path:
    """
    Write SUPLIDORES_OUTPUT_XLS by filling the official Carga Masiva Suplidores
    template with the given (already-or-not-yet-normalized) suplidor rows.

    The template's dropdowns, named ranges, and Nomencladores sheet are
    preserved verbatim (see xls_template.fill_suplidores_xls_template).
    """
    if not SUPLIDORES_TEMPLATE_XLS_SOURCE.exists():
        raise FileNotFoundError(
            f"Suplidores template not found: {SUPLIDORES_TEMPLATE_XLS_SOURCE}"
        )
    rows = [prepare_suplidores_export_row(s) for s in suplidores]
    return fill_suplidores_xls_template(
        SUPLIDORES_TEMPLATE_XLS_SOURCE,
        SUPLIDORES_OUTPUT_XLS,
        rows,
    )


# ---------------------------------------------------------------------------
# APIRouter
# ---------------------------------------------------------------------------

router = APIRouter()


@router.post("/scan-suplidores")
async def scan_suplidores(
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
    thinking_level: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    business_rules: Optional[str] = Form(None),
):
    """
    Extract all unique suplidores from a PDF (all pages, batched) or image.

    model: optional Gemini/Gemma model id from the UI thinking-level selector.
    Whitelisted values only; falls back to SUPLIDOR_MODEL.

    thinking_level / user_id / organization_id / client_id: optional spend
    attribution for api_token_usage persistence.

    business_rules: optional JSON-encoded array of {rule_type, rule_value,
    description} (org-level Anotaciones del Negocio).

    Returns:
        {
            "page_count": int,
            "suplidores": [
                {"nombre", "documento", "tipo_de_documento", "tipo_de_factura"},
                ...
            ],
            "usage": {...} | null,
        }
    """
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg"}
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Supported: PDF, PNG, JPG, JPEG.",
        )

    file_content = await file.read()
    level = resolve_thinking_level(thinking_level, model)
    model_id = resolve_inference_model(
        model, default=SUPLIDOR_MODEL, thinking_level=level,
    )
    spend_ctx = {
        "thinking_level": level,
        "user_id": (user_id or "").strip() or None,
        "organization_id": (organization_id or "").strip() or None,
        "client_id": (client_id or "").strip() or None,
    }
    business_rules_list = _parse_business_rules_param(business_rules)
    print(
        f"[INFO] [/scan-suplidores] Received '{file.filename}' "
        f"({len(file_content)} bytes, model={model_id}, level={level}, "
        f"rules={len(business_rules_list)})"
    )

    async with gemini_semaphore:
        result = await asyncio.to_thread(
            extract_suplidores_from_file,
            file_content,
            file.filename,
            model_id,
            spend_ctx,
            business_rules_list,
        )

    return result


@router.post("/download-suplidores-carga-masiva")
async def download_suplidores_carga_masiva(suplidores: list = Body(...)):
    """
    Fill the official Carga Masiva Suplidores .xls template with the given
    supplier rows and return it as a downloadable file.

    Request body: JSON array of suplidor objects. Mandatory fields per row:
      - documento      (str) – RNC / Cédula / Pasaporte digits only
      - nombre         (str) – supplier name / razón social
      - tipo_de_factura (str) – one of: Formal | Informal | Internacional | Pagos al exterior

    Optional:
      - direccion  (str)
      - provincia  (str)

    The returned file preserves the template's dropdowns, named ranges, and
    the Nomencladores sheet so the destination accounting system accepts it.
    """
    if not suplidores:
        raise HTTPException(status_code=400, detail="No suplidores provided.")

    try:
        out_path = await asyncio.to_thread(_fill_suplidores_template_xls, suplidores)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[ERROR] [/download-suplidores-carga-masiva] {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating suplidores template: {e}",
        )

    return FileResponse(
        path=out_path,
        filename="suplidores_carga_masiva.xls",
        media_type="application/vnd.ms-excel",
    )


@router.post("/download-suplidores-template")
async def download_suplidores_template(suplidores: list = Body(...)):
    """
    Generate and return a plain Excel (.xlsx) with the platform-native suplidor
    upload format: Documento | Nombre | Tipo de Factura.

    Use /download-suplidores-carga-masiva instead when you need the official
    Carga Masiva .xls template with its dropdowns intact.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Suplidores"
    ws.append(["Documento", "Nombre", "Tipo de Factura"])

    for s in suplidores:
        ws.append([
            s.get("documento", ""),
            s.get("nombre", ""),
            s.get("tipo_de_factura", ""),
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=suplidores.xlsx"},
    )
