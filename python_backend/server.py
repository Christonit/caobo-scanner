"""
FastAPI server for processing receipts/invoices with Gemini AI
"""
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import hashlib
import json
import os
from pathlib import Path
import re
from typing import List, Optional, Tuple
import openpyxl
from datetime import date, datetime, time
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

from xls_template import fill_xls_template


# Allowed catalog values from the Carga Masiva "Nomencladores" sheet.
TIPO_DE_SUPLIDOR_OPTIONS = [
    "Gasto Formal",
    "Gasto Informal",
    "Genérico",
    "Gasto Menor",
    "Pagos al exterior",
    "Norma 07-2007",
    "DGA",
    "Decreto 139-98",
]

TIPO_DE_GASTO_OPTIONS = [
    "01-Gasto de personal",
    "02-Gastos por trabajos, servicios y suministros",
    "03-Arrendamientos",
    "04-Gastos de activo fijo",
    "05-Gastos de representación",
    "06-Otras deducciones administrativas",
    "07-Gastos financieros",
    "08-Gastos extraordinarios",
    "09-Compras y gastos que forman gastos de la venta",
    "10-Adquisicion de activos",
    "11-Gastos de seguros",
]

# NCF series that require "NCF Afectado" (credit/debit notes).
NCF_AFECTADO_REQUIRED_PREFIXES = ("B03", "B04")


BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR

env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"[INFO] Loaded .env from: {env_path}")
else:
    load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("[WARNING] GEMINI_API_KEY not set. AI features will not work.")
    print("[WARNING] Create a .env file with GEMINI_API_KEY=your_key")
else:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="Receipt Processing API")

# CORS: allow the Nuxt frontend (and any local dev origin) to call the API.
# In production, set ALLOWED_ORIGINS to a comma-separated list of trusted URLs.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = (
    ["*"] if allowed_origins_env.strip() == "*"
    else [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HISTORY_FILE = DATA_DIR / "history.json"
TEMPLATE_FILE = BASE_DIR / "template.xls"
TEMPLATE_XLSX = DATA_DIR / "template_converted.xlsx"
# Authoritative Carga Masiva template. We FILL this file (preserving its
# dropdowns / data-validation named ranges / Nomencladores sheet) instead of
# recreating it, because the destination system rejects a rebuilt workbook.
TEMPLATE_XLS_SOURCE = BASE_DIR / "Plantilla_Importar_Gastos.xls"
if not TEMPLATE_XLS_SOURCE.exists():
    TEMPLATE_XLS_SOURCE = TEMPLATE_FILE
# Internal working copy stays .xlsx (openpyxl); downloadable export is .xls
# because destination systems (e.g. Carga Masiva) reject .xlsx uploads.
OUTPUT_FILE = DATA_DIR / "output.xlsx"
OUTPUT_XLS = DATA_DIR / "output.xls"

print(f"[INFO] Base directory: {BASE_DIR}")
print(f"[INFO] Data directory: {DATA_DIR}")
print(f"[INFO] Template file: {TEMPLATE_FILE}")

# Ensure history file exists
if not HISTORY_FILE.exists():
    with open(HISTORY_FILE, 'w') as f:
        json.dump([], f)

# Rate limiting for Gemini API (5 requests per minute)
# Using a semaphore to limit concurrent requests
GEMINI_MAX_CONCURRENT = 5
gemini_semaphore = asyncio.Semaphore(GEMINI_MAX_CONCURRENT)

# Model selection.
# - INDIVIDUAL calls (single-file /upload, retry, reevaluate) use gemma-4-26b
#   (15 RPM on the free tier) so the UI can comfortably allow up to ~15 manual
#   actions per minute.
# - BATCH calls (/upload-batch, used by "Process All Files") use gemini-3.5-flash
#   which handles many images per generate_content call well. NOTE: it is
#   capped at 5 RPM on the free tier, so the frontend tracks batch requests
#   in its own localStorage bucket and disables the button after 5 calls/min.
INDIVIDUAL_MODEL = "gemma-4-26b"
BATCH_MODEL = "gemini-3.1-flash-lite"


def calculate_file_hash(file_content: bytes) -> str:
    """Calculate MD5 hash of file content"""
    return hashlib.md5(file_content).hexdigest()


def load_history() -> list:
    """Load processing history from JSON file"""
    try:
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_history(history: list):
    """Save processing history to JSON file"""
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)


def check_duplicate(file_hash: str) -> bool:
    """Check if file hash exists in history"""
    history = load_history()
    return any(entry.get('hash') == file_hash for entry in history)


def create_template_xlsx(xlsx_path: Path):
    """Create a template .xlsx file that matches the original template structure."""
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    try:
        wb = openpyxl.Workbook()
        wb.remove(wb.active)
        
        ws = wb.create_sheet(title="Listado de Gastos")
        headers = ["Nombre", "Documento", "Tipo de Suplidor", "Tipo de Gasto", "Descripcion", "Fecha", "Monto en Servicios"]
        
        yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
        bold_font = Font(bold=True)
        thin_border = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )
        center_align = Alignment(horizontal='center', vertical='center')
        
        for col_idx, header in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.fill = yellow_fill
            cell.font = bold_font
            cell.border = thin_border
            cell.alignment = center_align
        
        column_widths = {'A': 20, 'B': 20, 'C': 18, 'D': 18, 'E': 35, 'F': 15, 'G': 20}
        for col_letter, width in column_widths.items():
            ws.column_dimensions[col_letter].width = width
        
        ws.auto_filter.ref = "A1:G1"
        
        ws2 = wb.create_sheet(title="Nomencladores")
        ws2.cell(row=1, column=1, value="Tipo de Suplidor")
        ws2.cell(row=1, column=2, value="Tipo de Gasto")
        
        wb.save(xlsx_path)
        return True
        
    except Exception as e:
        print(f"[ERROR] Creating template failed: {e}")
        return False


def ensure_template_xlsx():
    """Ensure we have a .xlsx template file."""
    if TEMPLATE_XLSX.exists():
        return TEMPLATE_XLSX
    
    xlsx_template = BASE_DIR / "template.xlsx"
    if xlsx_template.exists():
        return xlsx_template
    
    if create_template_xlsx(TEMPLATE_XLSX):
        return TEMPLATE_XLSX
    return None


def convert_xlsx_to_xls(xlsx_path: Path, xls_path: Path) -> Path:
    """Convert an .xlsx workbook to Excel 97-2003 .xls (BIFF8)."""
    import xlwt
    from openpyxl.utils import get_column_letter

    wb_in = openpyxl.load_workbook(xlsx_path, data_only=True)
    wb_out = xlwt.Workbook(encoding="utf-8")

    date_style = xlwt.XFStyle()
    date_style.num_format_str = "D/MM/YYYY"

    for sheet_name in wb_in.sheetnames:
        ws_in = wb_in[sheet_name]
        ws_out = wb_out.add_sheet(sheet_name[:31])

        max_row = ws_in.max_row or 1
        max_col = min(ws_in.max_column or 1, 256)

        skip_cells = set()
        for merged_range in ws_in.merged_cells.ranges:
            min_r, min_c = merged_range.min_row, merged_range.min_col
            for r in range(merged_range.min_row, merged_range.max_row + 1):
                for c in range(merged_range.min_col, merged_range.max_col + 1):
                    if (r, c) != (min_r, min_c):
                        skip_cells.add((r, c))

        for row_idx in range(1, max_row + 1):
            for col_idx in range(1, max_col + 1):
                if (row_idx, col_idx) in skip_cells:
                    continue
                value = ws_in.cell(row=row_idx, column=col_idx).value
                if value is None:
                    continue
                r, c = row_idx - 1, col_idx - 1
                if isinstance(value, datetime):
                    ws_out.write(r, c, value, date_style)
                elif isinstance(value, date):
                    ws_out.write(r, c, datetime.combine(value, time.min), date_style)
                elif isinstance(value, (int, float, bool)):
                    ws_out.write(r, c, value)
                else:
                    ws_out.write(r, c, str(value))

        for col_idx in range(1, max_col + 1):
            dim = ws_in.column_dimensions.get(get_column_letter(col_idx))
            if dim and dim.width:
                ws_out.col(col_idx - 1).width = int(min(float(dim.width), 60) * 256)

        for merged_range in ws_in.merged_cells.ranges:
            if merged_range.max_col > 256:
                continue
            ws_out.merge(
                merged_range.min_row - 1,
                merged_range.max_row - 1,
                merged_range.min_col - 1,
                merged_range.max_col - 1,
            )

    wb_out.save(str(xls_path))
    print(f"[INFO] Converted {xlsx_path.name} -> {xls_path.name}")
    return xls_path


def save_workbook_as_xls(wb, xlsx_path: Path = OUTPUT_FILE, xls_path: Path = OUTPUT_XLS) -> Path:
    """Persist the openpyxl workbook as .xlsx, then emit a downloadable .xls copy."""
    wb.save(xlsx_path)
    return convert_xlsx_to_xls(xlsx_path, xls_path)


SYSTEM_PROMPT = """Tu eres un contador educado y radicado en republica dominicana, te encargas de procesar recibos de pago y facturas de proveedores para luego ingresarlos en el sistema de contabilidad.

    Tu tarea es extraer la siguiente informacion del recibo/factura y retornarla en formato JSON para ser utilizado en el sistema de contabilidad:

    - nombre: El nombre o razon social del suplidor/proveedor que emite la factura (quien vende, no quien compra). Normalmente aparece en la parte superior del recibo/factura, junto al logo o encabezado. Texto abierto, maximo 255 caracteres.

    - documento: El RNC/cedula del suplidor. SOLO digitos, sin guiones ni caracteres especiales (ej: "101702176", "00200078964", "987356102"). Si aparece como "101-70217-6", devolver "101702176".

    - ncf: El NCF (Numero de Comprobante Fiscal). Es un codigo alfanumerico que empieza con una letra (B, E, etc.) seguido de digitos. Ejemplo: E310001987518, B0100014525.

    - ncf_afectado: NCF modificado/afectado cuando el comprobante es nota de credito (B03) o nota de debito (B04). Maximo 11 caracteres. Si el NCF NO es B03/B04, dejar "".

    - tipo_de_suplidor: Debe ser EXACTAMENTE uno de estos valores:
    Gasto Formal
    Gasto Informal
    Genérico
    Gasto Menor
    Pagos al exterior
    Norma 07-2007
    DGA
    Decreto 139-98
    Regla: si la factura tiene RNC y NCF formal, usar "Gasto Formal"; si no tiene NCF formal, "Gasto Informal".

    - tipo_de_gasto: Debe ser EXACTAMENTE uno de estos valores:
    01-Gasto de personal
    02-Gastos por trabajos, servicios y suministros
    03-Arrendamientos
    04-Gastos de activo fijo
    05-Gastos de representación
    06-Otras deducciones administrativas
    07-Gastos financieros
    08-Gastos extraordinarios
    09-Compras y gastos que forman gastos de la venta
    10-Adquisicion de activos
    11-Gastos de seguros

    - descripcion: Descripcion del tipo de operacion (ej: "COMPRA", "GASOLINA", "MATERIALES"). Obligatoria. Maximo 200 caracteres.

    - fecha: Fecha de la transaccion como TEXTO en formato DD/MM/AAAA con dia y mes siempre de 2 digitos (ej: "08/06/2026", "01/11/2025"). Nunca uses "8/06/2026".

    - monto_en_servicios: Monto de la operacion correspondiente a servicios (float). Si la factura es solo bienes, usar 0. Obligatorio.

    - monto_en_bienes: Monto de la operacion correspondiente a bienes / subtotal antes de impuestos si hay ITBIS/SELECTIVO. Si no hay impuestos, usar el total de bienes. Si la factura es solo servicios, usar 0. Obligatorio.

    - itbis: El monto del ITBIS (18%). Buscar cerca del total, etiquetado como "ITBIS", "IVA" o "18%". Valor numerico sin simbolo. Si no aparece, dejar en 0.

    - selectivo: Impuesto selectivo o % LEY si aplica. Normalmente para combustibles y bebidas. Si no aparece, dejar en 0.

    - moneda: Codigo ISO de 3 letras (ej: "DOP", "USD", "EUR"). Si no se especifica, asume "DOP".

    - metodo_de_pago: Identificar como uno de:
    + EFECTIVO
    + CHEQUES/TRANSFERENCIAS/DEPÓSITO
    + TARJETA CRÉDITO/DÉBITO
    + COMPRA A CREDITO
    + PERMUTA
    + NOTA DE CREDITO
    + MIXTO

    - score: Asigna un score de 1 a 3 para calificar que tan seguro estas de la informacion extraida. 3 = muy seguro, 2 = algo seguro, 1 = poco seguro.

    Retornar la informacion en formato JSON con las siguientes claves: nombre, documento, ncf, ncf_afectado, tipo_de_suplidor, tipo_de_gasto, descripcion, fecha, monto_en_servicios, monto_en_bienes, itbis, selectivo, moneda, metodo_de_pago, score.
    """


def _num(value) -> float:
    """Parse a numeric value, treating blanks as 0.0."""
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        try:
            return float(str(value).replace(",", ""))
        except (TypeError, ValueError):
            return 0.0


def _normalize_documento(value) -> str:
    """Documento must be digits only (no dashes/spaces). Preserves leading zeros."""
    if value is None:
        return ""
    return re.sub(r"\D", "", str(value))


def _normalize_fecha(value) -> str:
    """Normalize date to DD/MM/AAAA text. Accepts common separators and ISO dates."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    # Already DD/MM/YYYY or D/M/YYYY
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$", text)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 2000
        try:
            return date(year, month, day).strftime("%d/%m/%Y")
        except ValueError:
            return text

    # ISO YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(year, month, day).strftime("%d/%m/%Y")
        except ValueError:
            return text

    return text


def _normalize_catalog_value(value: str, options: list[str]) -> str:
    """Return the canonical catalog option, matching case-insensitively / by prefix code."""
    text = (value or "").strip()
    if not text:
        return ""

    lowered = text.lower()
    for option in options:
        if option.lower() == lowered:
            return option

    # Allow "02" or "02-..." style matches for tipo de gasto.
    code_match = re.match(r"^(\d{2})", text)
    if code_match:
        code = code_match.group(1)
        for option in options:
            if option.startswith(code + "-"):
                return option

    # Soft contains match (e.g. "gasto formal" inside a longer phrase).
    for option in options:
        if option.lower() in lowered or lowered in option.lower():
            return option

    return text


def _normalize_ncf_afectado(value, ncf: str = "") -> str:
    """Optional; max 11 chars. Required by template when NCF is B03/B04."""
    text = re.sub(r"\s+", "", str(value or "")).upper()
    return text[:11]


def _to_int_or_none(value) -> Optional[int]:
    """Best-effort int cast; blank/invalid values become None (not 0)."""
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _parse_catalog_param(raw: Optional[str], param_name: str) -> Optional[list]:
    """Parse a JSON-encoded catalog form field, tolerating blank/invalid input."""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[WARNING] Could not parse '{param_name}' as JSON: {e}")
        return None
    if not isinstance(parsed, list):
        print(f"[WARNING] '{param_name}' expected a JSON array, got {type(parsed).__name__}")
        return None
    return parsed


def _clean_catalog(catalog: Optional[list]) -> list[dict]:
    """
    Normalize a per-client Concepto/Tipo de Pago catalog (from client_documents
    -> document_attributes) to a list of {document_type, document_id, description}.
    Entries without a usable document_id are dropped since they can't be
    written to the export.
    """
    if not catalog:
        return []
    cleaned = []
    for entry in catalog:
        if not isinstance(entry, dict):
            continue
        label = str(entry.get("document_type", "") or "").strip()
        doc_id = _to_int_or_none(entry.get("document_id"))
        if not label or doc_id is None:
            continue
        cleaned.append({
            "document_type": label,
            "document_id": doc_id,
            "description": str(entry.get("description", "") or "").strip(),
        })
    return cleaned


def _match_catalog_label(label: str, catalog: list[dict]) -> Tuple[str, Optional[int]]:
    """
    Match free text (usually returned by the LLM) against a dynamic per-client
    catalog of {document_type, document_id}. Returns (matched_label, document_id),
    falling back to (original_text, None) when nothing matches.
    """
    text = (label or "").strip()
    if not text or not catalog:
        return text, None

    lowered = text.lower()
    for entry in catalog:
        if entry["document_type"].lower() == lowered:
            return entry["document_type"], entry["document_id"]

    for entry in catalog:
        entry_lower = entry["document_type"].lower()
        if entry_lower in lowered or lowered in entry_lower:
            return entry["document_type"], entry["document_id"]

    return text, None


def _build_catalog_prompt_block(concepto_catalog: list[dict], tipo_de_pago_catalog: list[dict]) -> str:
    """
    Build the dynamic, per-client portion of the extraction prompt describing
    the Concepto / Tipo de Pago options available for this specific client.
    Returns "" when neither catalog has usable entries.
    """
    def _format_options(catalog: list[dict]) -> str:
        return "\n".join(
            f"    - {c['document_type']}" + (f" ({c['description']})" if c["description"] else "")
            for c in catalog
        )

    blocks = []
    if concepto_catalog:
        blocks.append(
            "- concepto: Clasifica el gasto segun el CONCEPTO contable especifico "
            "de este cliente. Debe ser EXACTAMENTE uno de estos valores (copia el "
            "texto tal cual, sin agregar nada):\n"
            f"{_format_options(concepto_catalog)}\n"
            "    Si ninguno aplica claramente, deja el valor como cadena vacia \"\"."
        )
    if tipo_de_pago_catalog:
        blocks.append(
            "- tipo_de_pago_erp: Clasifica la forma de pago/registro contable de "
            "este gasto para este cliente especifico. Debe ser EXACTAMENTE uno de "
            "estos valores (copia el texto tal cual, sin agregar nada):\n"
            f"{_format_options(tipo_de_pago_catalog)}\n"
            "    Si ninguno aplica claramente, deja el valor como cadena vacia \"\"."
        )

    if not blocks:
        return ""

    return (
        "\n\nADICIONAL - Catalogos especificos de este cliente (dinamicos, "
        "varian por cliente, NO uses conocimiento general para esto):\n"
        + "\n".join(blocks)
        + "\n\nIncluye 'concepto' y 'tipo_de_pago_erp' como claves adicionales "
        "en el JSON de salida (usa cadena vacia \"\" si no aplica ninguna)."
    )


def prepare_export_row(data: dict) -> dict:
    """
    Normalize a receipt dict to Carga Masiva template rules before writing Excel.
    Safe to call on both freshly extracted and user-edited payloads.
    """
    ncf = str(data.get("ncf", "") or "").strip().upper()
    nombre = str(data.get("nombre", "") or "").strip()[:255]
    descripcion = str(data.get("descripcion", "") or "").strip()[:200]
    ncf_afectado = _normalize_ncf_afectado(data.get("ncf_afectado", ""), ncf)

    if (
        any(ncf.startswith(prefix) for prefix in NCF_AFECTADO_REQUIRED_PREFIXES)
        and not ncf_afectado
    ):
        print(
            f"[WARNING] NCF {ncf} requires NCF Afectado (B03/B04) but none was provided"
        )

    return {
        "nombre": nombre,
        "documento": _normalize_documento(data.get("documento", "")),
        "ncf": ncf,
        "ncf_afectado": ncf_afectado,
        "tipo_de_suplidor": _normalize_catalog_value(
            str(data.get("tipo_de_suplidor", "") or ""), TIPO_DE_SUPLIDOR_OPTIONS
        ),
        "tipo_de_gasto": _normalize_catalog_value(
            str(data.get("tipo_de_gasto", "") or ""), TIPO_DE_GASTO_OPTIONS
        ),
        "descripcion": descripcion,
        "fecha": _normalize_fecha(data.get("fecha", "")),
        "monto_en_servicios": _num(data.get("monto_en_servicios")),
        "monto_en_bienes": _num(data.get("monto_en_bienes")),
        "itbis": _num(data.get("itbis")),
        "selectivo": _num(data.get("selectivo")),
        "moneda": str(data.get("moneda", "") or "").strip().upper(),
        "metodo_de_pago": str(data.get("metodo_de_pago", "") or "").strip(),
        "concepto_id": _to_int_or_none(data.get("concepto_id")),
        "tipo_de_pago_id": _to_int_or_none(data.get("tipo_de_pago_id")),
        "filename": data.get("filename", "") or "",
        "score": data.get("score", 0) or 0,
    }


# Template header aliases (headers are matched lowercased + stripped).
# Note: the official template misspells "Decripcion" and trailing-spaces some headers.
EXCEL_FIELD_MAPPINGS = {
    "nombre": ["nombre", "nombre del proveedor", "nombre del suplidor", "proveedor", "suplidor"],
    "documento": ["documento", "rnc", "nif", "ruc"],
    "ncf": ["ncf", "comprobante fiscal"],
    "ncf_afectado": ["ncf afectado", "nfc afectado"],
    "tipo_de_suplidor": ["tipo de suplidor", "tipo suplidor"],
    "tipo_de_gasto": ["tipo de gasto", "tipo gasto"],
    "descripcion": ["decripcion", "descripcion", "concepto", "detalle"],
    "fecha": ["fecha", "date", "fecha factura"],
    "monto_en_servicios": ["monto en servicios", "monto servicios"],
    "monto_en_bienes": ["monto en bienes", "monto bienes"],
    "itbis": ["itbis", "impuesto 1", "iva"],
    "selectivo": ["selectivo", "impuesto 2", "% ley"],
    "moneda": ["moneda", "currency", "divisa"],
    "metodo_de_pago": ["forma de pago", "metodo de pago", "forma pago"],
    "concepto_id": ["concepto id"],
    "tipo_de_pago_id": ["tipo de pago id", "tipo pago id"],
}

EXCEL_TEXT_FIELDS = [
    "nombre", "documento", "ncf", "ncf_afectado", "tipo_de_suplidor", "tipo_de_gasto",
    "descripcion", "fecha", "moneda", "metodo_de_pago",
]
EXCEL_NUMERIC_FIELDS = ["monto_en_servicios", "monto_en_bienes", "itbis", "selectivo"]
EXCEL_INT_FIELDS = ["concepto_id", "tipo_de_pago_id"]


def _build_data_columns(ws) -> dict:
    """Map logical fields to 1-based template column indices from the header row."""
    column_map = {}
    for col_idx in range(1, (ws.max_column or 0) + 1):
        header = ws.cell(row=1, column=col_idx).value
        if header:
            column_map[str(header).lower().strip()] = col_idx

    data_columns = {}
    for field, possible_headers in EXCEL_FIELD_MAPPINGS.items():
        cols = []
        for header_name in possible_headers:
            col = column_map.get(header_name.lower().strip())
            if col is not None and col not in cols:
                cols.append(col)
        if cols:
            data_columns[field] = cols
    return data_columns


def _write_excel_row(ws, row: int, data: dict, data_columns: dict):
    """Write one normalized receipt row into the template sheet."""
    prepared = prepare_export_row(data)

    for field in EXCEL_TEXT_FIELDS:
        for col in data_columns.get(field, []):
            ws.cell(row=row, column=col, value=prepared.get(field, ""))

    for field in EXCEL_NUMERIC_FIELDS:
        cols = data_columns.get(field, [])
        if not cols:
            continue
        val = float(prepared.get(field, 0.0) or 0.0)
        for col in cols:
            ws.cell(row=row, column=col, value=val)

    # Integer ERP ids (Concepto Id / Tipo de Pago Id) resolved from the
    # client-specific catalog. Left blank (None) when nothing matched, rather
    # than defaulting to 0, since 0 can be a legitimate ERP id.
    for field in EXCEL_INT_FIELDS:
        cols = data_columns.get(field, [])
        if not cols:
            continue
        val = prepared.get(field)
        for col in cols:
            ws.cell(row=row, column=col, value=val)


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


def _normalize_extracted(
    extracted: dict,
    filename: str,
    concepto_catalog: Optional[list[dict]] = None,
    tipo_de_pago_catalog: Optional[list[dict]] = None,
) -> dict:
    """
    Normalize a single extracted-data dict to our expected shape. When
    per-client catalogs are provided, resolves the LLM's free-text
    'concepto' / 'tipo_de_pago_erp' picks into their ERP integer ids
    (concepto_id / tipo_de_pago_id) via _match_catalog_label.
    """
    _, concepto_id = _match_catalog_label(
        str(extracted.get("concepto", "") or ""), concepto_catalog or []
    )
    _, tipo_de_pago_id = _match_catalog_label(
        str(extracted.get("tipo_de_pago_erp", "") or ""), tipo_de_pago_catalog or []
    )
    prepared = prepare_export_row({
        **extracted,
        "concepto_id": concepto_id,
        "tipo_de_pago_id": tipo_de_pago_id,
        "filename": filename,
        "score": extracted.get("score", 0) or 0,
    })
    return prepared


def _empty_extracted(filename: str, descripcion: str = "") -> dict:
    """Return an empty/default extracted-data dict for failed processing."""
    return prepare_export_row({
        "descripcion": descripcion,
        "filename": filename,
        "score": 0,
    })


def _is_retryable_error(error: Exception) -> bool:
    error_str = str(error).lower()
    return (
        "429" in error_str or "rate" in error_str or "limit" in error_str
        or "quota" in error_str or "resource" in error_str
        or "500" in error_str or "502" in error_str or "503" in error_str
        or "timeout" in error_str or "empty response" in error_str
    )


# Maximum number of pages to render from a single PDF. Receipts are almost
# always 1-2 pages; the cap keeps payloads small and within model context.
PDF_MAX_PAGES = 5
# Rasterization DPI for PDF pages. ~150 DPI is a good balance between OCR
# quality and payload size for invoice text.
PDF_RENDER_DPI = 150


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


def process_with_gemini(
    file_content: bytes,
    filename: str,
    max_retries: int = 3,
    concepto_catalog: Optional[list[dict]] = None,
    tipo_de_pago_catalog: Optional[list[dict]] = None,
) -> dict:
    """
    Process a single file (image or PDF) with the individual Gemma model.
    Extracts receipt/invoice data according to Dominican Republic accounting
    standards. PDFs are rasterized to images first so vision-only models
    (Gemma) can process them. Includes retry logic for rate limiting and
    transient errors.

    concepto_catalog / tipo_de_pago_catalog: optional per-client lists of
    {document_type, document_id, description} (already cleaned via
    _clean_catalog) used to classify the receipt into that client's Concepto
    / Tipo de Pago ERP ids dynamically.
    """
    import time
    import re

    catalog_block = _build_catalog_prompt_block(
        concepto_catalog or [], tipo_de_pago_catalog or []
    )

    print(
        f"[INFO] [GEMINI-SINGLE] Starting processing for '{filename}' "
        f"({len(file_content)} bytes, model={INDIVIDUAL_MODEL})"
    )

    # Check if API key is configured
    if not GEMINI_API_KEY:
        print(f"[ERROR] [GEMINI-SINGLE] Cannot process {filename}: GEMINI_API_KEY not configured")
        return _empty_extracted(filename, descripcion="ERROR: API key not configured")

    file_extension = Path(filename).suffix.lower() if filename else ""
    if file_extension not in (".png", ".jpg", ".jpeg", ".pdf"):
        print(f"[ERROR] [GEMINI-SINGLE] Unsupported file type: {file_extension}")
        return _empty_extracted(
            filename, descripcion=f"Unsupported file type: {file_extension}"
        )

    page_images = load_file_as_images(file_content, filename)
    print(f"[DEBUG] [GEMINI-SINGLE] '{filename}': loaded {len(page_images)} page image(s)")
    if not page_images:
        print(f"[ERROR] [GEMINI-SINGLE] '{filename}': no page images produced, aborting before calling Gemini")
        return _empty_extracted(
            filename,
            descripcion=(
                "Could not render PDF pages"
                if file_extension == ".pdf"
                else "Could not open image"
            ),
        )

    if file_extension == ".pdf" and len(page_images) > 1:
        prompt = (
            f"{SYSTEM_PROMPT}{catalog_block}\n\n"
            f"NOTA: Te envio {len(page_images)} paginas de un mismo recibo/"
            f"factura en PDF. Trata las paginas como un solo documento y "
            f"retorna SOLO un objeto JSON valido sin texto adicional, sin "
            f"markdown, sin explicaciones."
        )
    else:
        prompt = (
            f"{SYSTEM_PROMPT}{catalog_block}\n\nExtrae la informacion del "
            f"recibo/factura en la imagen y retorna SOLO un objeto JSON "
            f"valido sin texto adicional, sin markdown, sin explicaciones."
        )

    last_error = None

    for attempt in range(max_retries):
        try:
            print(
                f"[INFO] [GEMINI-SINGLE] '{filename}': calling Gemini "
                f"(attempt {attempt + 1}/{max_retries}, model={INDIVIDUAL_MODEL}, "
                f"images={len(page_images)}, prompt_chars={len(prompt)})"
            )
            model = genai.GenerativeModel(INDIVIDUAL_MODEL)
            response = model.generate_content([prompt, *page_images])
            print(f"[DEBUG] [GEMINI-SINGLE] '{filename}': received response from Gemini API")

            if not response or not hasattr(response, "text") or not response.text:
                raise ValueError("Empty response from Gemini API")

            print(
                f"[DEBUG] [GEMINI-SINGLE] '{filename}': raw response "
                f"({len(response.text)} chars): {response.text[:500]!r}"
            )

            response_text = _strip_markdown_fences(response.text)

            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(
                    r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL
                )
                if json_match:
                    extracted_data = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse JSON from response")

            normalized = _normalize_extracted(
                extracted_data, filename,
                concepto_catalog=concepto_catalog,
                tipo_de_pago_catalog=tipo_de_pago_catalog,
            )
            is_empty = not any(
                normalized.get(k) for k in
                ("nombre", "documento", "ncf", "tipo_de_suplidor", "fecha")
            )
            print(
                f"[INFO] [GEMINI-SINGLE] '{filename}': success, score="
                f"{normalized.get('score')}, empty_fields={is_empty}"
            )
            if is_empty:
                print(
                    f"[WARNING] [GEMINI-SINGLE] '{filename}': Gemini returned a "
                    f"parseable but essentially empty result - the image content "
                    f"may be blank/unreadable, or the file sent doesn't match "
                    f"what was expected."
                )
            return normalized

        except Exception as e:
            last_error = e
            print(
                f"[ERROR] [GEMINI-SINGLE] '{filename}': attempt {attempt + 1}/"
                f"{max_retries} failed: {e}"
            )
            if _is_retryable_error(e) and attempt < max_retries - 1:
                print(f"[INFO] [GEMINI-SINGLE] '{filename}': retryable error, backing off before retry")
                time.sleep(2 ** attempt)
            elif not _is_retryable_error(e):
                break

    print(f"[ERROR] [GEMINI-SINGLE] Gemini processing failed for {filename}: {last_error}")
    return _empty_extracted(filename)


def process_batch_with_gemini(
    files: List[Tuple[bytes, str]],
    max_retries: int = 3,
    concepto_catalog: Optional[list[dict]] = None,
    tipo_de_pago_catalog: Optional[list[dict]] = None,
) -> List[dict]:
    """
    Process MULTIPLE files (images and/or PDFs) with the batch Gemini model in
    a SINGLE API call.

    files: list of (file_content, filename) tuples. Supports png/jpg/jpeg and
    pdf - PDFs are rasterized to images on the fly. Each file becomes ONE entry
    in the result list, even if its PDF spans multiple pages.

    concepto_catalog / tipo_de_pago_catalog: optional per-client lists of
    {document_type, document_id, description} used to classify every
    document in the batch into that client's Concepto / Tipo de Pago ERP ids.

    Returns a list of normalized extracted-data dicts in the same order as
    input. Falls back to per-file processing if the batch call cannot be parsed
    back into the expected number of items.
    """
    import time
    import re

    if not files:
        return []

    print(
        f"[INFO] [GEMINI-BATCH] Starting batch of {len(files)} file(s) "
        f"(model={BATCH_MODEL}): {[fn for _, fn in files]}"
    )

    if not GEMINI_API_KEY:
        print("[ERROR] [GEMINI-BATCH] Cannot process batch: GEMINI_API_KEY not configured")
        return [_empty_extracted(fn, descripcion="ERROR: API key not configured")
                for _, fn in files]

    # Render each file to its page-image list up front so we can fail fast on
    # unreadable files and so the per-document prompt knows the page counts.
    per_file_images: List[list] = []
    for content, filename in files:
        images = load_file_as_images(content, filename)
        per_file_images.append(images)
        if not images:
            print(
                f"[WARNING] [GEMINI-BATCH] '{filename}': produced 0 page images "
                f"({len(content)} bytes) - this document will yield an empty "
                f"result even though the batch call itself may succeed."
            )

    total_images = sum(len(p) for p in per_file_images)
    print(
        f"[DEBUG] [GEMINI-BATCH] Loaded {total_images} total page image(s) "
        f"across {len(files)} document(s)"
    )

    # Describe each document in the batch (filename + page count) so the model
    # understands when several images belong to the same multi-page PDF.
    doc_summary_lines = []
    for i, ((_, filename), pages) in enumerate(zip(files, per_file_images), start=1):
        doc_summary_lines.append(
            f"  - Documento #{i}: {filename} ({len(pages)} pagina(s))"
        )

    catalog_block = _build_catalog_prompt_block(
        concepto_catalog or [], tipo_de_pago_catalog or []
    )
    batch_keys = (
        "nombre, documento, ncf, ncf_afectado, tipo_de_suplidor, tipo_de_gasto, "
        "descripcion, fecha, monto_en_servicios, monto_en_bienes, itbis, "
        "selectivo, moneda, metodo_de_pago, score"
    )
    if concepto_catalog:
        batch_keys += ", concepto"
    if tipo_de_pago_catalog:
        batch_keys += ", tipo_de_pago_erp"

    batch_prompt = (
        f"{SYSTEM_PROMPT}{catalog_block}\n\n"
        f"IMPORTANTE - Procesamiento por lotes: Te voy a enviar {len(files)} "
        f"documentos de recibos/facturas. Algunos pueden ser PDFs con varias "
        f"paginas; trata cada documento como UNA unidad y retorna UN solo "
        f"objeto JSON por documento.\n\n"
        f"Documentos en este lote:\n" + "\n".join(doc_summary_lines) + "\n\n"
        f"Debes retornar un ARRAY JSON con EXACTAMENTE {len(files)} elementos, "
        f"uno por cada documento, en el MISMO ORDEN en que se envian.\n\n"
        f"Cada elemento del array debe ser un objeto JSON con las claves: "
        f"{batch_keys}.\n\n"
        f"Retorna SOLO el array JSON, sin texto adicional, sin markdown, sin "
        f"explicaciones."
    )

    last_error: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel(BATCH_MODEL)

            # Build the content list: prompt + per-document blocks. Each
            # document gets a header followed by ALL its page images.
            content_parts: list = [batch_prompt]
            for i, ((_, filename), pages) in enumerate(
                zip(files, per_file_images), start=1
            ):
                content_parts.append(
                    f"\n--- Documento #{i}: {filename} "
                    f"({len(pages)} pagina(s)) ---"
                )
                for page_idx, page_image in enumerate(pages, start=1):
                    if len(pages) > 1:
                        content_parts.append(
                            f"Pagina {page_idx} de {len(pages)}:"
                        )
                    content_parts.append(page_image)

            image_part_count = sum(1 for p in content_parts if not isinstance(p, str))
            print(
                f"[INFO] [GEMINI-BATCH] Calling Gemini (attempt {attempt + 1}/"
                f"{max_retries}, model={BATCH_MODEL}, content_parts="
                f"{len(content_parts)}, image_parts={image_part_count}, "
                f"prompt_chars={len(batch_prompt)})"
            )

            response = model.generate_content(content_parts)
            print(f"[DEBUG] [GEMINI-BATCH] Received response from Gemini API")

            if not response or not hasattr(response, 'text') or not response.text:
                raise ValueError("Empty response from Gemini API")

            print(
                f"[DEBUG] [GEMINI-BATCH] Raw response ({len(response.text)} chars): "
                f"{response.text[:800]!r}"
            )

            response_text = _strip_markdown_fences(response.text)

            try:
                parsed = json.loads(response_text)
            except json.JSONDecodeError:
                array_match = re.search(r'\[.*\]', response_text, re.DOTALL)
                if array_match:
                    parsed = json.loads(array_match.group())
                else:
                    raise ValueError("Could not parse JSON array from batch response")

            if isinstance(parsed, dict):
                parsed = [parsed]

            if not isinstance(parsed, list):
                raise ValueError(f"Expected JSON array from batch, got {type(parsed).__name__}")

            if len(parsed) != len(files):
                print(
                    f"[WARNING] [GEMINI-BATCH] Expected {len(files)} results but "
                    f"Gemini returned {len(parsed)} - padding/truncating to match. "
                    f"Some entries will be empty."
                )

            # Pad / truncate to match input length so caller indexing is safe.
            results: List[dict] = []
            for i, (_, filename) in enumerate(files):
                if i < len(parsed) and isinstance(parsed[i], dict):
                    normalized = _normalize_extracted(
                        parsed[i], filename,
                        concepto_catalog=concepto_catalog,
                        tipo_de_pago_catalog=tipo_de_pago_catalog,
                    )
                    is_empty = not any(
                        normalized.get(k) for k in
                        ("nombre", "documento", "ncf", "tipo_de_suplidor", "fecha")
                    )
                    if is_empty:
                        print(
                            f"[WARNING] [GEMINI-BATCH] '{filename}': result #{i} is "
                            f"essentially empty (score={normalized.get('score')}) - "
                            f"check if its {len(per_file_images[i])} page image(s) "
                            f"were readable."
                        )
                    results.append(normalized)
                else:
                    print(
                        f"[ERROR] [GEMINI-BATCH] '{filename}': no matching entry "
                        f"at index {i} in Gemini's response array, using empty result"
                    )
                    results.append(_empty_extracted(filename))
            print(f"[INFO] [GEMINI-BATCH] Batch completed: {len(results)} result(s)")
            return results

        except Exception as e:
            last_error = e
            print(
                f"[ERROR] [GEMINI-BATCH] Attempt {attempt + 1}/{max_retries} "
                f"failed: {e}"
            )
            if _is_retryable_error(e) and attempt < max_retries - 1:
                print("[INFO] [GEMINI-BATCH] Retryable error, backing off before retry")
                time.sleep(2 ** attempt)
            elif not _is_retryable_error(e):
                break

    print(f"[ERROR] [GEMINI-BATCH] Gemini batch processing failed: {last_error}")
    # Fall back to per-file processing so a single bad image doesn't fail the whole batch.
    print(f"[INFO] [GEMINI-BATCH] Falling back to per-file processing for {len(files)} files")
    return [
        process_with_gemini(
            content, filename,
            concepto_catalog=concepto_catalog,
            tipo_de_pago_catalog=tipo_de_pago_catalog,
        )
        for content, filename in files
    ]


def _fill_template_xls(rows: list) -> Path:
    """
    Write OUTPUT_XLS by filling the official Carga Masiva template with the
    given (already normalized) receipt rows. The template's dropdowns, named
    ranges and Nomencladores sheet are preserved verbatim (see xls_template).
    """
    if not TEMPLATE_XLS_SOURCE.exists():
        raise FileNotFoundError(f"Template file not found: {TEMPLATE_XLS_SOURCE}")
    prepared = [prepare_export_row(r) for r in rows]
    return fill_xls_template(
        TEMPLATE_XLS_SOURCE,
        OUTPUT_XLS,
        prepared,
        EXCEL_FIELD_MAPPINGS,
        EXCEL_TEXT_FIELDS,
        EXCEL_NUMERIC_FIELDS,
        EXCEL_INT_FIELDS,
    )


def populate_excel_template(data: dict):
    """Fill the template with a single extracted receipt (fresh export)."""
    try:
        return _fill_template_xls([data])
    except Exception as e:
        print(f"[ERROR] Excel processing failed: {e}")
        raise


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Receipt Processing API is running"}


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    concepto_catalog: Optional[str] = Form(None),
    tipo_de_pago_catalog: Optional[str] = Form(None),
):
    """
    Upload and process a receipt/invoice file (supports: PDF, PNG, JPG, JPEG).

    concepto_catalog / tipo_de_pago_catalog: optional JSON-encoded arrays of
    {document_type, document_id, description} for the client currently being
    scanned (see client_documents / document_attributes). When provided, the
    LLM is asked to classify the document into one of these ERP-specific
    options and the matching ERP id is written to Concepto Id / Tipo de Pago
    Id in the export.
    """
    try:
        allowed_extensions = {'.pdf', '.png', '.jpg', '.jpeg'}
        file_extension = Path(file.filename).suffix.lower() if file.filename else ''
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Supported formats: PDF, PNG, JPG, JPEG."
            )
        
        file_content = await file.read()
        file_hash = calculate_file_hash(file_content)
        print(
            f"[INFO] [/upload] Received '{file.filename}' "
            f"({len(file_content)} bytes, content_type={file.content_type}, "
            f"hash={file_hash[:8]})"
        )

        concepto_list = _clean_catalog(_parse_catalog_param(concepto_catalog, "concepto_catalog"))
        tipo_de_pago_list = _clean_catalog(
            _parse_catalog_param(tipo_de_pago_catalog, "tipo_de_pago_catalog")
        )
        
        # Process with Gemini (rate limited to 5 concurrent)
        async with gemini_semaphore:
            extracted_data = await asyncio.to_thread(
                process_with_gemini, file_content, file.filename,
                concepto_catalog=concepto_list,
                tipo_de_pago_catalog=tipo_de_pago_list,
            )
        
        print(f"[INFO] [/upload] '{file.filename}' processed, score={extracted_data.get('score')}")
        populate_excel_template(extracted_data)
        
        # Save to history
        history = load_history()
        history.append({
            "hash": file_hash,
            "filename": file.filename,
            "processed_at": datetime.now().isoformat(),
            "data": extracted_data
        })
        save_history(history)
        
        return {
            "status": "success",
            "message": f"File {file.filename} processed successfully",
            "data": extracted_data,
            "hash": file_hash
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Upload failed for {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/upload-batch")
async def upload_batch(
    files: List[UploadFile] = File(...),
    concepto_catalog: Optional[str] = Form(None),
    tipo_de_pago_catalog: Optional[str] = Form(None),
):
    """
    Upload and process MULTIPLE receipt/invoice files in a SINGLE Gemini API call.

    Accepts up to ~10 files. Supported formats: PNG / JPG / JPEG / PDF. PDFs are
    rasterized to images (one image per page, capped at PDF_MAX_PAGES) and all
    pages of a PDF are still represented as ONE entry in the response.

    concepto_catalog / tipo_de_pago_catalog: optional JSON-encoded arrays of
    {document_type, document_id, description} for the client currently being
    scanned. Applied to every file in the batch.

    Returns:
        {
            "status": "success",
            "results": [
                {"status": "success", "filename": "...", "hash": "...", "data": {...}},
                {"status": "error",   "filename": "...", "message": "..."},
                ...
            ]
        }
    Results are in the same order as the uploaded files.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    print(f"[INFO] [/upload-batch] Received request with {len(files)} file(s)")

    allowed_extensions = {'.pdf', '.png', '.jpg', '.jpeg'}

    # Read each upload and classify it. Pending entries will be sent to Gemini.
    entries: list = []
    for upload in files:
        filename = upload.filename or "unknown"
        ext = Path(filename).suffix.lower()

        if ext not in allowed_extensions:
            print(f"[WARNING] [/upload-batch] '{filename}': unsupported extension '{ext}', skipping")
            entries.append({
                "filename": filename,
                "status": "error",
                "message": f"Unsupported file type: {ext or 'unknown'}",
            })
            continue

        try:
            content = await upload.read()
        except Exception as e:
            print(f"[ERROR] [/upload-batch] '{filename}': failed to read upload body: {e}")
            entries.append({
                "filename": filename,
                "status": "error",
                "message": f"Failed to read upload: {e}",
            })
            continue

        print(
            f"[INFO] [/upload-batch] '{filename}': read {len(content)} bytes "
            f"(content_type={upload.content_type})"
        )
        if len(content) == 0:
            print(
                f"[WARNING] [/upload-batch] '{filename}': uploaded file is 0 "
                f"bytes - the browser may have sent an empty body for this file."
            )

        entries.append({
            "filename": filename,
            "content": content,
            "hash": calculate_file_hash(content),
            "status": "pending",
        })

    batch_inputs: List[Tuple[bytes, str]] = [
        (e["content"], e["filename"]) for e in entries if e["status"] == "pending"
    ]

    print(
        f"[INFO] [/upload-batch] {len(batch_inputs)}/{len(files)} file(s) "
        f"eligible for Gemini processing"
    )

    concepto_list = _clean_catalog(_parse_catalog_param(concepto_catalog, "concepto_catalog"))
    tipo_de_pago_list = _clean_catalog(
        _parse_catalog_param(tipo_de_pago_catalog, "tipo_de_pago_catalog")
    )

    extracted_results: List[dict] = []
    if batch_inputs:
        # Reuse the same semaphore to coordinate concurrency with single uploads.
        async with gemini_semaphore:
            extracted_results = await asyncio.to_thread(
                process_batch_with_gemini, batch_inputs,
                concepto_catalog=concepto_list,
                tipo_de_pago_catalog=tipo_de_pago_list,
            )

    history = load_history()
    response_results: list = []
    extracted_idx = 0

    for entry in entries:
        if entry["status"] == "pending":
            if extracted_idx < len(extracted_results):
                data = extracted_results[extracted_idx]
            else:
                data = _empty_extracted(entry["filename"])
            extracted_idx += 1

            try:
                populate_excel_template(data)
            except Exception as e:
                print(f"[ERROR] Excel populate failed for {entry['filename']}: {e}")

            history.append({
                "hash": entry["hash"],
                "filename": entry["filename"],
                "processed_at": datetime.now().isoformat(),
                "data": data,
            })

            response_results.append({
                "status": "success",
                "filename": entry["filename"],
                "hash": entry["hash"],
                "data": data,
            })
        else:
            response_results.append({
                "status": entry["status"],
                "filename": entry["filename"],
                "message": entry.get("message", "Unknown error"),
            })

    save_history(history)

    print(
        f"[INFO] [/upload-batch] Responding with {len(response_results)} "
        f"result(s): "
        f"{[(r['filename'], r['status']) for r in response_results]}"
    )

    return {
        "status": "success",
        "count": len(response_results),
        "results": response_results,
    }


def regenerate_excel_from_data(files_data: list):
    """Regenerate the export by filling the template with edited data.

    Score is excluded from export. The template is filled (not recreated) so
    its dropdowns / data validations remain intact for the destination system.
    """
    try:
        return _fill_template_xls(files_data or [])
    except Exception as e:
        print(f"[ERROR] Regenerating Excel failed: {e}")
        raise


@app.post("/download")
async def download_excel_post(files_data: Optional[list] = Body(None)):
    """Download Excel file as .xls. If files_data provided, regenerates with edited data."""
    if files_data:
        regenerate_excel_from_data(files_data)
    
    if not OUTPUT_XLS.exists():
        if OUTPUT_FILE.exists():
            convert_xlsx_to_xls(OUTPUT_FILE, OUTPUT_XLS)
        else:
            raise HTTPException(status_code=404, detail="No processed file available")
    
    return FileResponse(
        path=OUTPUT_XLS,
        filename="processed_receipts.xls",
        media_type="application/vnd.ms-excel",
    )


@app.get("/download")
async def download_excel_get():
    """Download the processed Excel file as .xls."""
    if not OUTPUT_XLS.exists():
        if OUTPUT_FILE.exists():
            convert_xlsx_to_xls(OUTPUT_FILE, OUTPUT_XLS)
        else:
            raise HTTPException(status_code=404, detail="No processed file available")
    
    return FileResponse(
        path=OUTPUT_XLS,
        filename="processed_receipts.xls",
        media_type="application/vnd.ms-excel",
    )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    reload_enabled = os.getenv("RELOAD", "true").lower() != "false"

    print(f"[INFO] Starting server on {host}:{port} (reload={reload_enabled})")

    if reload_enabled:
        uvicorn.run("server:app", host=host, port=port, reload=True, reload_dirs=[str(BASE_DIR)])
    else:
        uvicorn.run(app, host=host, port=port, reload=False)

