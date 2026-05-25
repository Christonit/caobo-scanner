"""
FastAPI server for processing receipts/invoices with Gemini AI
"""
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import hashlib
import json
import os
from pathlib import Path
from typing import List, Optional, Tuple
import openpyxl
from datetime import datetime
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv


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
OUTPUT_FILE = DATA_DIR / "output.xlsx"

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
# - BATCH calls (/upload-batch) keep gemma-3-12b-it because the per-batch payload
#   includes many images at once and the older model has been validated for
#   that prompt shape.
INDIVIDUAL_MODEL = "gemma-4-26b"
BATCH_MODEL = "gemma-3-12b-it"


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
        headers = ["Documento", "Tipo de Suplidor", "Tipo de Gasto", "Descripcion", "Fecha", "Monto en Servicios"]
        
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
        
        column_widths = {'A': 20, 'B': 18, 'C': 18, 'D': 35, 'E': 15, 'F': 20}
        for col_letter, width in column_widths.items():
            ws.column_dimensions[col_letter].width = width
        
        ws.auto_filter.ref = "A1:F1"
        
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


SYSTEM_PROMPT = """Tu eres un contador educado y radicado en republica dominicana, te encargas de procesar recibos de pago y facturas de proveedores para luego ingresarlos en el sistema de contabilidad.

    Tu tarea es extraer la siguiente informacion del recibo/factura y retornarla en formato JSON para ser utilizado en el sistema de contabilidad:

    - documento: El RNC (Registro Nacional del Contribuyente) del suplidor. Es un numero de 9 u 11 digitos que identifica al negocio. Puede aparecer etiquetado como "RNC", "NIF" o "Cedula" en el recibo/factura.

    - ncf: El NCF (Numero de Comprobante Fiscal). Es un codigo alfanumerico que empieza con una letra (B, E, etc.) seguido de 11 digitos. Ejemplo: E310001987518, B0100014525. Siempre debe tener el formato LETRA + 11 NUMEROS.

    - tipo_de_suplidor: Si la factura tiene RNC y NCF, es "Gasto Formal". Si no tiene NCF formal, es "Gasto Informal".

    - tipo_de_gasto: Analiza el contenido de la factura y clasifica segun estos tipos:
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

    - descripcion: Una breve descripcion del concepto de la compra (ej: "COMPRA", "GASOLINA", "MATERIALES", etc.)

    - fecha: La fecha de la factura en formato D/MM/YYYY (ej: 1/11/2025). Buscar en la parte superior o inferior del recibo.

    - monto_en_bienes: El subtotal antes de impuestos si hay ITBIS/SELECTIVO. Si no hay impuestos, usar el total. Este es el monto principal de la compra.

    - itbis: El monto del ITBIS (18%). Buscar cerca del total, etiquetado como "ITBIS", "IVA" o "18%". Valor numerico sin simbolo. Normalmente aparece al final del recibo/factura antes del total, si no aparece, dejar en 0.

    - selectivo: Impuesto selectivo o % LEY si aplica. Normalmente para combustibles y bebidas. Normalmente aparece al final del recibo/factura antes del total, si no aparece, dejar en 0.

    - metodo_de_pago: Identificar como:
    + EFECTIVO
    + CHEQUES/TRANSFERENCIAS/DEPÓSITO
    + TARJETA CRÉDITO/DÉBITO
    + COMPRA A CREDITO
    + PERMUTA
    + NOTA DE CREDITO
    + MIXTO

    - score: Asigna un score de 1 a 3 para calificar que tan seguro estas de la informacion extraida. 3 = muy seguro, 2 = algo seguro, 1 = poco seguro.

    Retornar la informacion en formato JSON con las siguientes claves: documento, ncf, tipo_de_suplidor, tipo_de_gasto, descripcion, fecha, monto_en_bienes, itbis, selectivo, metodo_de_pago, score.
    """


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


def _normalize_extracted(extracted: dict, filename: str) -> dict:
    """Normalize a single extracted-data dict to our expected shape."""
    def _num(value):
        if value in (None, ""):
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            try:
                return float(str(value).replace(",", ""))
            except (TypeError, ValueError):
                return 0.0

    return {
        "documento": extracted.get("documento", "") or "",
        "ncf": extracted.get("ncf", "") or "",
        "tipo_de_suplidor": extracted.get("tipo_de_suplidor", "") or "",
        "tipo_de_gasto": extracted.get("tipo_de_gasto", "") or "",
        "descripcion": extracted.get("descripcion", "") or "",
        "fecha": extracted.get("fecha", "") or "",
        "monto_en_bienes": _num(extracted.get("monto_en_bienes")),
        "itbis": _num(extracted.get("itbis")),
        "selectivo": _num(extracted.get("selectivo")),
        "metodo_de_pago": extracted.get("metodo_de_pago", "") or "",
        "filename": filename,
        "score": extracted.get("score", 0) or 0,
    }


def _empty_extracted(filename: str, descripcion: str = "") -> dict:
    """Return an empty/default extracted-data dict for failed processing."""
    return {
        "documento": "",
        "ncf": "",
        "tipo_de_suplidor": "",
        "tipo_de_gasto": "",
        "descripcion": descripcion,
        "fecha": "",
        "monto_en_bienes": 0.0,
        "itbis": 0.0,
        "selectivo": 0.0,
        "metodo_de_pago": "",
        "filename": filename,
        "score": 0,
    }


def _is_retryable_error(error: Exception) -> bool:
    error_str = str(error).lower()
    return (
        "429" in error_str or "rate" in error_str or "limit" in error_str
        or "quota" in error_str or "resource" in error_str
        or "500" in error_str or "502" in error_str or "503" in error_str
        or "timeout" in error_str or "empty response" in error_str
    )


def process_with_gemini(file_content: bytes, filename: str, max_retries: int = 3) -> dict:
    """
    Process file with Gemini AI using gemini-2.5-flash model
    Extracts receipt/invoice data according to Dominican Republic accounting standards
    Includes retry logic for rate limiting and transient errors
    """
    import io
    import time
    import re
    from PIL import Image

    # Check if API key is configured
    if not GEMINI_API_KEY:
        print(f"[ERROR] Cannot process {filename}: GEMINI_API_KEY not configured")
        return _empty_extracted(filename, descripcion="ERROR: API key not configured")

    last_error = None

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel(INDIVIDUAL_MODEL)
            file_extension = Path(filename).suffix.lower() if filename else ''

            if file_extension in ['.png', '.jpg', '.jpeg']:
                image = Image.open(io.BytesIO(file_content))
                prompt = f"{SYSTEM_PROMPT}\n\nExtrae la informacion del recibo/factura en la imagen y retorna SOLO un objeto JSON valido sin texto adicional, sin markdown, sin explicaciones."
                response = model.generate_content([prompt, image])

            elif file_extension == '.pdf':
                raise ValueError("PDF processing requires additional setup. Please convert PDF to image first.")
            else:
                raise ValueError(f"Unsupported file type: {file_extension}")

            if not response or not hasattr(response, 'text') or not response.text:
                raise ValueError("Empty response from Gemini API")

            response_text = _strip_markdown_fences(response.text)

            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
                if json_match:
                    extracted_data = json.loads(json_match.group())
                else:
                    raise ValueError(f"Could not parse JSON from response")

            return _normalize_extracted(extracted_data, filename)

        except Exception as e:
            last_error = e
            if _is_retryable_error(e) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            elif not _is_retryable_error(e):
                break

    print(f"[ERROR] Gemini processing failed for {filename}: {last_error}")
    return _empty_extracted(filename)


def process_batch_with_gemini(
    files: List[Tuple[bytes, str]],
    max_retries: int = 3,
) -> List[dict]:
    """
    Process MULTIPLE image files with Gemini AI in a SINGLE API call.

    files: list of (file_content, filename) tuples (only image types: png/jpg/jpeg).
    Returns a list of normalized extracted-data dicts in the same order as input.
    Falls back to per-file processing if the batch call cannot be parsed back into
    the expected number of items.
    """
    import io
    import time
    import re
    from PIL import Image

    if not files:
        return []

    if not GEMINI_API_KEY:
        print("[ERROR] Cannot process batch: GEMINI_API_KEY not configured")
        return [_empty_extracted(fn, descripcion="ERROR: API key not configured")
                for _, fn in files]

    # Open all images up front so we can fail fast on corrupt ones.
    images: List[Optional["Image.Image"]] = []
    for content, filename in files:
        try:
            images.append(Image.open(io.BytesIO(content)))
        except Exception as e:
            print(f"[ERROR] Failed to open image {filename}: {e}")
            images.append(None)

    batch_prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"IMPORTANTE - Procesamiento por lotes: Te voy a enviar {len(files)} "
        f"imagenes de recibos/facturas numeradas en orden. Debes procesar CADA "
        f"imagen y retornar un ARRAY JSON con EXACTAMENTE {len(files)} elementos, "
        f"uno por cada imagen, en el MISMO ORDEN en que se envian.\n\n"
        f"Cada elemento del array debe ser un objeto JSON con las claves: "
        f"documento, ncf, tipo_de_suplidor, tipo_de_gasto, descripcion, fecha, "
        f"monto_en_bienes, itbis, selectivo, metodo_de_pago, score.\n\n"
        f"Retorna SOLO el array JSON, sin texto adicional, sin markdown, sin "
        f"explicaciones."
    )

    last_error: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel(BATCH_MODEL)

            # Interleave labels + images so Gemini knows which image is which.
            content_parts: list = [batch_prompt]
            for i, ((_, filename), image) in enumerate(zip(files, images), start=1):
                content_parts.append(f"\n--- Imagen #{i} ({filename}) ---")
                if image is not None:
                    content_parts.append(image)

            response = model.generate_content(content_parts)

            if not response or not hasattr(response, 'text') or not response.text:
                raise ValueError("Empty response from Gemini API")

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

            # Pad / truncate to match input length so caller indexing is safe.
            results: List[dict] = []
            for i, (_, filename) in enumerate(files):
                if i < len(parsed) and isinstance(parsed[i], dict):
                    results.append(_normalize_extracted(parsed[i], filename))
                else:
                    results.append(_empty_extracted(filename))
            return results

        except Exception as e:
            last_error = e
            if _is_retryable_error(e) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            elif not _is_retryable_error(e):
                break

    print(f"[ERROR] Gemini batch processing failed: {last_error}")
    # Fall back to per-file processing so a single bad image doesn't fail the whole batch.
    print(f"[INFO] Falling back to per-file processing for {len(files)} files")
    return [process_with_gemini(content, filename) for content, filename in files]


def populate_excel_template(data: dict):
    """Populate Excel template with extracted data."""
    import shutil
    from openpyxl.utils import get_column_letter
    
    template_path = ensure_template_xlsx()
    if not template_path or not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {template_path}")
    
    try:
        shutil.copy2(template_path, OUTPUT_FILE)
        wb = openpyxl.load_workbook(OUTPUT_FILE)
        
        ws = wb["Listado de Gastos"] if "Listado de Gastos" in wb.sheetnames else wb.active
        
        # Build column mapping from header row
        column_map = {}
        for col_idx in range(1, ws.max_column + 1):
            header = ws.cell(row=1, column=col_idx).value
            if header:
                column_map[str(header).lower().strip()] = col_idx
        
        # Field mappings: data field -> possible column headers in template
        field_mappings = {
            "documento": ["documento", "rnc", "nif", "ruc"],
            "ncf": ["ncf", "ncf afectado", "comprobante fiscal"],
            "tipo_de_suplidor": ["tipo de suplidor", "tipo suplidor"],
            "tipo_de_gasto": ["tipo de gasto", "tipo gasto"],
            "descripcion": ["decripcion", "descripcion", "concepto", "detalle"],
            "fecha": ["fecha", "date", "fecha factura"],
            "monto_en_bienes": ["monto en bienes", "monto bienes"],
            "itbis": ["itbis", "impuesto 1", "iva"],
            "selectivo": ["selectivo", "impuesto 2", "% ley"],
            "metodo_de_pago": ["forma de pago", "metodo de pago", "forma pago"],
        }
        
        data_columns = {}
        for field, possible_headers in field_mappings.items():
            for header_name in possible_headers:
                if header_name in column_map:
                    data_columns[field] = column_map[header_name]
                    break
        
        # Find first empty row
        row = 2
        while row <= ws.max_row and ws.cell(row=row, column=1).value is not None:
            row += 1
        
        # Populate text fields
        if "documento" in data_columns:
            ws.cell(row=row, column=data_columns["documento"], value=data.get("documento", ""))
        if "ncf" in data_columns:
            ws.cell(row=row, column=data_columns["ncf"], value=data.get("ncf", ""))
        if "tipo_de_suplidor" in data_columns:
            ws.cell(row=row, column=data_columns["tipo_de_suplidor"], value=data.get("tipo_de_suplidor", ""))
        if "tipo_de_gasto" in data_columns:
            ws.cell(row=row, column=data_columns["tipo_de_gasto"], value=data.get("tipo_de_gasto", ""))
        if "descripcion" in data_columns:
            ws.cell(row=row, column=data_columns["descripcion"], value=data.get("descripcion", ""))
        if "fecha" in data_columns:
            ws.cell(row=row, column=data_columns["fecha"], value=data.get("fecha", ""))
        if "metodo_de_pago" in data_columns:
            ws.cell(row=row, column=data_columns["metodo_de_pago"], value=data.get("metodo_de_pago", ""))
        
        # Populate numeric fields
        for field in ["monto_en_bienes", "itbis", "selectivo"]:
            if field in data_columns:
                val = data.get(field, 0)
                if isinstance(val, str):
                    try:
                        val = float(val.replace(",", ""))
                    except ValueError:
                        val = 0.0
                ws.cell(row=row, column=data_columns[field], value=float(val) if val else 0.0)
        
        # Update auto-filter
        max_col_letter = get_column_letter(ws.max_column)
        ws.auto_filter.ref = f"A1:{max_col_letter}{max(row, ws.max_row)}"
        
        wb.save(OUTPUT_FILE)
        return OUTPUT_FILE
        
    except Exception as e:
        print(f"[ERROR] Excel processing failed: {e}")
        raise


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Receipt Processing API is running"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process a receipt/invoice file (supports: PDF, PNG, JPG, JPEG)"""
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
        
        # Process with Gemini (rate limited to 5 concurrent)
        async with gemini_semaphore:
            extracted_data = await asyncio.to_thread(process_with_gemini, file_content, file.filename)
        
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
async def upload_batch(files: List[UploadFile] = File(...)):
    """
    Upload and process MULTIPLE receipt/invoice files in a SINGLE Gemini API call.

    Accepts up to ~10 image files (PNG/JPG/JPEG). PDFs are not supported in batch mode
    and will be returned with status="error" in the per-file results.

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

    allowed_extensions = {'.pdf', '.png', '.jpg', '.jpeg'}
    image_extensions = {'.png', '.jpg', '.jpeg'}

    # Read each upload and classify it. Pending entries will be sent to Gemini.
    entries: list = []
    for upload in files:
        filename = upload.filename or "unknown"
        ext = Path(filename).suffix.lower()

        if ext not in allowed_extensions:
            entries.append({
                "filename": filename,
                "status": "error",
                "message": f"Unsupported file type: {ext or 'unknown'}",
            })
            continue

        try:
            content = await upload.read()
        except Exception as e:
            entries.append({
                "filename": filename,
                "status": "error",
                "message": f"Failed to read upload: {e}",
            })
            continue

        if ext not in image_extensions:
            entries.append({
                "filename": filename,
                "status": "error",
                "message": "PDF processing is not supported in batch mode",
            })
            continue

        entries.append({
            "filename": filename,
            "content": content,
            "hash": calculate_file_hash(content),
            "status": "pending",
        })

    batch_inputs: List[Tuple[bytes, str]] = [
        (e["content"], e["filename"]) for e in entries if e["status"] == "pending"
    ]

    extracted_results: List[dict] = []
    if batch_inputs:
        # Reuse the same semaphore to coordinate concurrency with single uploads.
        async with gemini_semaphore:
            extracted_results = await asyncio.to_thread(process_batch_with_gemini, batch_inputs)

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

    return {
        "status": "success",
        "count": len(response_results),
        "results": response_results,
    }


def regenerate_excel_from_data(files_data: list):
    """Regenerate Excel file from edited data. Score is excluded from export."""
    import shutil
    from openpyxl.utils import get_column_letter
    
    template_path = ensure_template_xlsx()
    if not template_path or not template_path.exists():
        raise FileNotFoundError(f"Template file not found: {template_path}")
    
    try:
        shutil.copy2(template_path, OUTPUT_FILE)
        wb = openpyxl.load_workbook(OUTPUT_FILE)
        ws = wb["Listado de Gastos"] if "Listado de Gastos" in wb.sheetnames else wb.active
        
        # Build column mapping
        column_map = {}
        for col_idx in range(1, ws.max_column + 1):
            header = ws.cell(row=1, column=col_idx).value
            if header:
                column_map[str(header).lower().strip()] = col_idx
        
        # Field mappings: data field -> possible column headers in template
        field_mappings = {
            "documento": ["documento", "rnc", "nif", "ruc"],
            "ncf": ["ncf", "ncf afectado", "comprobante fiscal"],
            "tipo_de_suplidor": ["tipo de suplidor", "tipo suplidor"],
            "tipo_de_gasto": ["tipo de gasto", "tipo gasto"],
            "descripcion": ["decripcion", "descripcion", "concepto", "detalle"],
            "fecha": ["fecha", "date", "fecha factura"],
            "monto_en_bienes": ["monto en bienes", "monto bienes"],
            "itbis": ["itbis", "impuesto 1", "iva"],
            "selectivo": ["selectivo", "impuesto 2", "% ley"],
            "metodo_de_pago": ["forma de pago", "metodo de pago", "forma pago"],
        }
        
        data_columns = {}
        for field, possible_headers in field_mappings.items():
            for header_name in possible_headers:
                if header_name in column_map:
                    data_columns[field] = column_map[header_name]
                    break
        
        # Clear existing data (except header row), skip merged cells
        from openpyxl.cell.cell import MergedCell
        for row in range(2, ws.max_row + 1):
            for col in range(1, ws.max_column + 1):
                cell = ws.cell(row=row, column=col)
                if not isinstance(cell, MergedCell):
                    cell.value = None
        
        # Populate with all file data
        current_row = 2
        for file_data in files_data:
            # Text fields
            if "documento" in data_columns:
                ws.cell(row=current_row, column=data_columns["documento"], value=file_data.get("documento", ""))
            if "ncf" in data_columns:
                ws.cell(row=current_row, column=data_columns["ncf"], value=file_data.get("ncf", ""))
            if "tipo_de_suplidor" in data_columns:
                ws.cell(row=current_row, column=data_columns["tipo_de_suplidor"], value=file_data.get("tipo_de_suplidor", ""))
            if "tipo_de_gasto" in data_columns:
                ws.cell(row=current_row, column=data_columns["tipo_de_gasto"], value=file_data.get("tipo_de_gasto", ""))
            if "descripcion" in data_columns:
                ws.cell(row=current_row, column=data_columns["descripcion"], value=file_data.get("descripcion", ""))
            if "fecha" in data_columns:
                ws.cell(row=current_row, column=data_columns["fecha"], value=file_data.get("fecha", ""))
            if "metodo_de_pago" in data_columns:
                ws.cell(row=current_row, column=data_columns["metodo_de_pago"], value=file_data.get("metodo_de_pago", ""))
            
            # Numeric fields
            for field in ["monto_en_bienes", "itbis", "selectivo"]:
                if field in data_columns:
                    val = file_data.get(field, 0)
                    if isinstance(val, str):
                        try:
                            val = float(val.replace(",", ""))
                        except ValueError:
                            val = 0.0
                    ws.cell(row=current_row, column=data_columns[field], value=float(val) if val else 0.0)
            
            current_row += 1
        
        max_col_letter = get_column_letter(ws.max_column)
        ws.auto_filter.ref = f"A1:{max_col_letter}{max(current_row - 1, 1)}"
        
        wb.save(OUTPUT_FILE)
        return OUTPUT_FILE
        
    except Exception as e:
        print(f"[ERROR] Regenerating Excel failed: {e}")
        raise


@app.post("/download")
async def download_excel_post(files_data: Optional[list] = Body(None)):
    """Download Excel file. If files_data provided, regenerates with edited data."""
    if files_data:
        regenerate_excel_from_data(files_data)
    
    if not OUTPUT_FILE.exists():
        raise HTTPException(status_code=404, detail="No processed file available")
    
    return FileResponse(
        path=OUTPUT_FILE,
        filename="processed_receipts.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/download")
async def download_excel_get():
    """Download the processed Excel file."""
    if not OUTPUT_FILE.exists():
        raise HTTPException(status_code=404, detail="No processed file available")
    
    return FileResponse(
        path=OUTPUT_FILE,
        filename="processed_receipts.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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

