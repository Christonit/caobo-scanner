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
from typing import Optional
import openpyxl
from datetime import datetime
import pandas as pd
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Gemini API key from environment variable
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set. Please create a .env file in python_backend/ with GEMINI_API_KEY=your_key")

genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="Receipt Processing API")

# CORS middleware to allow requests from Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = Path(__file__).parent
HISTORY_FILE = BASE_DIR / "history.json"
# Try python_backend first, then root directory
TEMPLATE_FILE = BASE_DIR / "template.xls" if (BASE_DIR / "template.xls").exists() else BASE_DIR.parent / "template.xls"
TEMPLATE_XLSX = BASE_DIR / "template_converted.xlsx"  # Converted version for openpyxl
OUTPUT_FILE = BASE_DIR / "output.xlsx"

# Ensure history file exists
if not HISTORY_FILE.exists():
    with open(HISTORY_FILE, 'w') as f:
        json.dump([], f)

# Rate limiting for Gemini API (5 requests per minute)
# Using a semaphore to limit concurrent requests
GEMINI_MAX_CONCURRENT = 5
gemini_semaphore = asyncio.Semaphore(GEMINI_MAX_CONCURRENT)


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

    system_prompt = """Tu eres un contador educado y radicado en republica dominicana, te encargas de procesar recibos de pago y facturas de proveedores para luego ingresarlos en el sistema de contabilidad.

    Tu tarea es extraer la siguiente informacion del recibo/factura y retornarla en formato JSON para ser utilizado en el sistema de contabilidad:

    - Documento: El numero de documento del recibo/factura. Lo puedes como el valor que tiene "NIF" como label en el recibo/factura. Puede aparecer tanto en la parte superior del recibo/factura como al final del recibo/factura.

    - Tipo de Suplidor: El tipo de suplidor del recibo/factura. Si la factura tiene RNC, es Gasto Formal el valor. Puedes encontrar el RNC identificado como "NCF" en el recibo/factura.

    - Tipo de Gasto: puede ser de estos tipos
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

    - Fecha,  debe ser en formato D/MM/YYYY, ej: 1/11/2025. Lo puedes encotrar en la parte superior del recibo/factura o al final del recibo/factura, siempre viene en format "DD/MM/YYYY HH:MM:SS" o "DD-MM-YYYY HH:MM:SS".
   
   - ITBIS(opcional): El ITBIS del recibo/factura. Lo puedes encontrar al final del recibo/factura, siempre viene en format "ITBIS 18%". A veces hay ITBIS como puede que no haya.

   - SELECTIVO (opcional): Puede aparecer en el recibo/factura como % LEY o Selectivo. 

   MONTO: Extraerlo del campo que aparece como subtotal en el recibo/factura cuando o si hay ITBIS o SELECTIVO. Si no hay ITBIS o SELECTIVO, extraerlo del campo que aparece como total en el recibo/factura.

   - metodo de pago: Identificar el metodo de pago en el recibo/factura. Puede ser de estos tipos:
    + EFECTIVO
    + CHEQUES/TRANSFERENCIAS/DEPÓSITO
    + TARJETA CRÉDITO/DÉBITO
    + COMPRA A CREDITO
    + PERMUTA
    + NOTA DE CREDITO
    + MIXTO

    Tambien, analiza profunda bien y asigna un score de 1 a 3 para calificar que tan seguro es que la informacion extraida es correcta. 3 siendo la mas segura y 1 siendo la menos segura.
    Retornar la informacion en formato JSON con las siguientes claves: documento, tipo_de_suplidor, tipo_de_gasto, fecha, monto_en_servicios, itbis, selectivo, metodo_de_pago, score.
    """
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            file_extension = Path(filename).suffix.lower() if filename else ''
            
            if file_extension in ['.png', '.jpg', '.jpeg']:
                image = Image.open(io.BytesIO(file_content))
                prompt = f"{system_prompt}\n\nExtrae la informacion del recibo/factura en la imagen y retorna SOLO un objeto JSON valido sin texto adicional, sin markdown, sin explicaciones."
                response = model.generate_content([prompt, image])
                
            elif file_extension == '.pdf':
                raise ValueError("PDF processing requires additional setup. Please convert PDF to image first.")
            else:
                raise ValueError(f"Unsupported file type: {file_extension}")
            
            if not response or not hasattr(response, 'text') or not response.text:
                raise ValueError("Empty response from Gemini API")
            
            response_text = response.text.strip()
            
            # Clean up markdown code blocks
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            elif response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            # Parse JSON
            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
                if json_match:
                    extracted_data = json.loads(json_match.group())
                else:
                    raise ValueError(f"Could not parse JSON from response")
            
            return {
                "documento": extracted_data.get("documento", ""),
                "tipo_de_suplidor": extracted_data.get("tipo_de_suplidor", ""),
                "tipo_de_gasto": extracted_data.get("tipo_de_gasto", ""),
                "fecha": extracted_data.get("fecha", ""),
                "monto_en_servicios": float(extracted_data.get("monto_en_servicios", 0)) if extracted_data.get("monto_en_servicios") else 0.0,
                "itbis": float(extracted_data.get("itbis", 0)) if extracted_data.get("itbis") else 0.0,
                "selectivo": float(extracted_data.get("selectivo", 0)) if extracted_data.get("selectivo") else 0.0,
                "metodo_de_pago": extracted_data.get("metodo_de_pago", ""),
                "filename": filename,
                "score": extracted_data.get("score", 0)
            }
            
        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            is_retryable = (
                "429" in error_str or "rate" in error_str or "limit" in error_str or
                "quota" in error_str or "resource" in error_str or
                "500" in error_str or "502" in error_str or "503" in error_str or
                "timeout" in error_str or "empty response" in error_str
            )
            
            if is_retryable and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
            elif not is_retryable:
                break
    
    # All retries failed
    print(f"[ERROR] Gemini processing failed for {filename}: {last_error}")
    
    return {
        "documento": "",
        "tipo_de_suplidor": "",
        "tipo_de_gasto": "",
        "fecha": "",
        "monto_en_servicios": 0.0,
        "itbis": 0.0,
        "selectivo": 0.0,
        "metodo_de_pago": "",
        "filename": filename,
        "score": 0
    }


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
        
        field_mappings = {
            "documento": ["documento", "file", "archivo", "nombre archivo", "nif"],
            "tipo_de_suplidor": ["tipo de suplidor", "tipo suplidor", "suplidor tipo"],
            "tipo_de_gasto": ["tipo de gasto", "tipo gasto"],
            "fecha": ["fecha", "date", "fecha factura"],
            "monto_en_servicios": ["monto en servicios", "monto", "total", "amount", "importe", "valor", "subtotal"],
            "itbis": ["itbis", "tax", "impuesto", "iva", "itbis facturado"],
            "selectivo": ["selectivo", "% ley"],
            "metodo_de_pago": ["metodo de pago", "metodo pago", "pago"],
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
        
        # Populate data
        if "documento" in data_columns:
            ws.cell(row=row, column=data_columns["documento"], value=data.get("documento", "") or data.get("filename", ""))
        if "tipo_de_suplidor" in data_columns:
            ws.cell(row=row, column=data_columns["tipo_de_suplidor"], value=data.get("tipo_de_suplidor", ""))
        if "tipo_de_gasto" in data_columns:
            ws.cell(row=row, column=data_columns["tipo_de_gasto"], value=data.get("tipo_de_gasto", ""))
        if "fecha" in data_columns:
            ws.cell(row=row, column=data_columns["fecha"], value=data.get("fecha", ""))
        
        for field in ["monto_en_servicios", "itbis", "selectivo"]:
            if field in data_columns:
                val = data.get(field, 0)
                if isinstance(val, str):
                    try:
                        val = float(val.replace(",", ""))
                    except ValueError:
                        val = 0.0
                ws.cell(row=row, column=data_columns[field], value=float(val))
        
        if "metodo_de_pago" in data_columns:
            ws.cell(row=row, column=data_columns["metodo_de_pago"], value=data.get("metodo_de_pago", ""))
        
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
        
        field_mappings = {
            "documento": ["documento", "file", "archivo", "nombre archivo", "nif"],
            "tipo_de_suplidor": ["tipo de suplidor", "tipo suplidor", "suplidor tipo"],
            "tipo_de_gasto": ["tipo de gasto", "tipo gasto"],
            "fecha": ["fecha", "date", "fecha factura"],
            "monto_en_servicios": ["monto en servicios", "monto", "total", "amount", "importe", "valor", "subtotal"],
            "itbis": ["itbis", "tax", "impuesto", "iva", "itbis facturado"],
            "selectivo": ["selectivo", "% ley"],
            "metodo_de_pago": ["metodo de pago", "metodo pago", "pago"],
        }
        
        data_columns = {}
        for field, possible_headers in field_mappings.items():
            for header_name in possible_headers:
                if header_name in column_map:
                    data_columns[field] = column_map[header_name]
                    break
        
        # Clear existing data
        for row in range(2, ws.max_row + 1):
            for col in range(1, ws.max_column + 1):
                ws.cell(row=row, column=col).value = None
        
        # Populate with all file data
        current_row = 2
        for file_data in files_data:
            if "documento" in data_columns:
                ws.cell(row=current_row, column=data_columns["documento"], value=file_data.get("documento", "") or file_data.get("filename", ""))
            if "tipo_de_suplidor" in data_columns:
                ws.cell(row=current_row, column=data_columns["tipo_de_suplidor"], value=file_data.get("tipo_de_suplidor", ""))
            if "tipo_de_gasto" in data_columns:
                ws.cell(row=current_row, column=data_columns["tipo_de_gasto"], value=file_data.get("tipo_de_gasto", ""))
            if "fecha" in data_columns:
                ws.cell(row=current_row, column=data_columns["fecha"], value=file_data.get("fecha", ""))
            
            for field in ["monto_en_servicios", "itbis", "selectivo"]:
                if field in data_columns:
                    val = file_data.get(field, 0)
                    if isinstance(val, str):
                        try:
                            val = float(val.replace(",", ""))
                        except ValueError:
                            val = 0.0
                    ws.cell(row=current_row, column=data_columns[field], value=float(val))
            
            if "metodo_de_pago" in data_columns:
                ws.cell(row=current_row, column=data_columns["metodo_de_pago"], value=file_data.get("metodo_de_pago", ""))
            
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
    reload_enabled = os.getenv("RELOAD", "true").lower() != "false"
    
    if reload_enabled:
        uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True, reload_dirs=[str(BASE_DIR)])
    else:
        uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)

