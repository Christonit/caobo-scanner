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

Para cada suplidor extrae:
- nombre: nombre o razón social (máx. 255 caracteres).
- documento: SOLO DÍGITOS del RNC / Cédula / Pasaporte, sin guiones ni espacios \
  (ej: "101-70217-6" → "101702176"). Máximo 20 caracteres. Si no aparece, devuelve "".
- tipo_de_factura: EXACTAMENTE uno de: Formal, Informal, Internacional, Pagos al exterior.
  Regla: RNC + NCF formal → "Formal"; sin NCF formal → "Informal"; \
  suplidor extranjero → "Internacional" o "Pagos al exterior".

Devuelve un JSON con la clave "suplidores" que contenga un array:
{"suplidores": [{"nombre": "...", "documento": "...", "tipo_de_factura": "..."}, ...]}
Si no encuentras ningún suplidor, devuelve {"suplidores": []}.
No incluyas texto fuera del JSON.
"""


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
) -> tuple[list[dict], Optional[dict]]:
    """
    Send a batch of PIL images to Gemini and return (raw suplidor dicts,
    usage_record). Returns ([], None) on any failure.
    """
    import time

    parts = [SUPLIDORES_BATCH_PROMPT] + images
    ctx = spend_ctx or {}
    level = ctx.get("thinking_level") or resolve_thinking_level(None, model_name)

    for attempt in range(3):
        try:
            print(
                f"[INFO] [suplidor-batch-{batch_num}] calling Gemini "
                f"(attempt {attempt + 1}/3, model={model_name}, "
                f"images={len(images)})"
            )
            response = generate_inference_content(
                model_name,
                parts,
                thinking_level=level,
                max_output_tokens=1024,
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
                if nombre:
                    result.append({
                        "nombre": nombre,
                        "documento": documento,
                        "tipo_de_factura": tipo,
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
) -> dict:
    """
    Render all pages of a PDF (or a single image) and process them in batches
    through Gemini to extract every unique suplidor in the document.

    model_name: optional client-selected model (thinking level). Falls back
    to SUPLIDOR_MODEL when omitted or not whitelisted.

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

    all_rows: list[dict] = []
    usages: list[dict] = []
    for i in range(0, len(all_images), SUPLIDOR_BATCH_SIZE):
        batch = all_images[i: i + SUPLIDOR_BATCH_SIZE]
        batch_num = i // SUPLIDOR_BATCH_SIZE + 1
        rows, usage = _extract_suplidores_from_batch(
            batch, batch_num, model_id, spend_ctx=spend_ctx,
        )
        all_rows.extend(rows)
        if usage:
            usages.append(usage)

    # Deduplicate: prefer the first occurrence of each (documento OR nombre) key.
    seen_docs: set[str] = set()
    seen_names: set[str] = set()
    unique: list[dict] = []
    for row in all_rows:
        doc_key = row["documento"].lower() if row["documento"] else ""
        name_key = row["nombre"].lower()
        if doc_key:
            if doc_key in seen_docs:
                continue
            seen_docs.add(doc_key)
        else:
            if name_key in seen_names:
                continue
            seen_names.add(name_key)

        unique.append({
            "nombre": row["nombre"],
            "documento": row["documento"],
            "tipo_de_documento": _get_tipo_documento(row["documento"]),
            "tipo_de_factura": row["tipo_de_factura"],
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
):
    """
    Extract all unique suplidores from a PDF (all pages, batched) or image.

    model: optional Gemini/Gemma model id from the UI thinking-level selector.
    Whitelisted values only; falls back to SUPLIDOR_MODEL.

    thinking_level / user_id / organization_id / client_id: optional spend
    attribution for api_token_usage persistence.

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
    print(
        f"[INFO] [/scan-suplidores] Received '{file.filename}' "
        f"({len(file_content)} bytes, model={model_id}, level={level})"
    )

    async with gemini_semaphore:
        result = await asyncio.to_thread(
            extract_suplidores_from_file,
            file_content,
            file.filename,
            model_id,
            spend_ctx,
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
