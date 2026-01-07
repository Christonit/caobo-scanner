"""
FastAPI server for processing receipts/invoices with Gemini AI
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
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
    """
    Create a template .xlsx file that matches the original template structure.
    Template structure:
    - Sheet 1: "Listado de Gastos" with columns: Documento, Tipo de Suplidor, Tipo de Gasto, Descripcion, Fecha, Monto en Servicios
    - Sheet 2: "Nomencladores" (for dropdowns/lookups)
    """
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    print(f"[EXCEL] Creating template at: {xlsx_path}")
    
    try:
        wb = openpyxl.Workbook()
        
        # Remove default sheet
        wb.remove(wb.active)
        
        # Create main sheet "Listado de Gastos"
        ws = wb.create_sheet(title="Listado de Gastos")
        
        # Define headers
        headers = ["Documento", "Tipo de Suplidor", "Tipo de Gasto", "Descripcion", "Fecha", "Monto en Servicios"]
        
        # Define styles
        yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
        bold_font = Font(bold=True)
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        center_align = Alignment(horizontal='center', vertical='center')
        
        # Write headers with formatting
        for col_idx, header in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.fill = yellow_fill
            cell.font = bold_font
            cell.border = thin_border
            cell.alignment = center_align
        
        # Set column widths
        column_widths = {'A': 20, 'B': 18, 'C': 18, 'D': 35, 'E': 15, 'F': 20}
        for col_letter, width in column_widths.items():
            ws.column_dimensions[col_letter].width = width
        
        # Apply auto-filter
        ws.auto_filter.ref = "A1:F1"
        
        # Create second sheet "Nomencladores"
        ws2 = wb.create_sheet(title="Nomencladores")
        ws2.cell(row=1, column=1, value="Tipo de Suplidor")
        ws2.cell(row=1, column=2, value="Tipo de Gasto")
        
        # Save template
        wb.save(xlsx_path)
        print(f"[EXCEL] Template created successfully: {xlsx_path}")
        return True
        
    except Exception as e:
        print(f"[EXCEL] ERROR creating template: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[EXCEL] Traceback:\n{traceback.format_exc()}")
        return False


def ensure_template_xlsx():
    """
    Ensure we have a .xlsx template file.
    Priority:
    1. Use existing template_converted.xlsx (created by convert_template.py)
    2. Use template.xlsx if it exists
    3. Create a new template programmatically as fallback
    """
    print(f"[EXCEL] Checking for template...")
    
    # Check if we have the converted template (created by convert_template.py)
    if TEMPLATE_XLSX.exists():
        print(f"[EXCEL] Found converted template: {TEMPLATE_XLSX}")
        return TEMPLATE_XLSX
    
    # Check if there's a .xlsx version in the directory
    xlsx_template = BASE_DIR / "template.xlsx"
    if xlsx_template.exists():
        print(f"[EXCEL] Found .xlsx template: {xlsx_template}")
        return xlsx_template
    
    # No converted template found - try to create one
    print(f"[EXCEL] No converted template found.")
    print(f"[EXCEL] To convert the original template.xls, run:")
    print(f"[EXCEL]   cd python_backend && source venv/bin/activate && python convert_template.py")
    print(f"[EXCEL] Creating fallback template programmatically...")
    
    if create_template_xlsx(TEMPLATE_XLSX):
        return TEMPLATE_XLSX
    else:
        print(f"[EXCEL] ERROR: Failed to create template")
        return None


def process_with_gemini(file_content: bytes, filename: str) -> dict:
    """
    Process file with Gemini AI using gemini-2.5-flash model
    Extracts receipt/invoice data according to Dominican Republic accounting standards
    """
    import io
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
    
    try:
        print(f"[GEMINI] Processing file: {filename}")
        
        # Initialize the model with gemini-2.5-flash
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Handle different file types
        file_extension = Path(filename).suffix.lower() if filename else ''
        
        if file_extension in ['.png', '.jpg', '.jpeg']:
            # Process image files
            print(f"[GEMINI] Processing as image file")
            image = Image.open(io.BytesIO(file_content))
            
            # Create the prompt
            prompt = f"{system_prompt}\n\nExtrae la informacion del recibo/factura en la imagen y retorna SOLO un objeto JSON valido sin texto adicional, sin markdown, sin explicaciones."
            
            # Generate content with the image
            print(f"[GEMINI] Sending request to Gemini API...")
            response = model.generate_content([prompt, image])
            print(f"[GEMINI] Received response from Gemini")
            
        elif file_extension == '.pdf':
            # For PDFs, we need to convert to images first
            # For now, we'll use a workaround by trying to extract text
            print(f"[GEMINI] Processing as PDF file")
            # Note: Gemini 2.5 Flash may support PDFs directly, but we'll handle it as text extraction
            # For full PDF support, you might need pdf2image or similar
            raise ValueError("PDF processing requires additional setup. Please convert PDF to image first.")
            
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
        
        # Extract and parse JSON from response
        response_text = response.text.strip()
        print(f"[GEMINI] Raw response: {response_text[:200]}...")  # Log first 200 chars
        
        # Clean up the response - remove markdown code blocks if present
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
            print(f"[GEMINI] Successfully parsed JSON response")
        except json.JSONDecodeError as e:
            print(f"[GEMINI] JSON parsing error: {str(e)}")
            print(f"[GEMINI] Attempting to extract JSON from response...")
            # Try to find JSON object in the response
            import re
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
            if json_match:
                extracted_data = json.loads(json_match.group())
            else:
                raise ValueError(f"Could not parse JSON from response: {response_text[:500]}")
        
        # Ensure all required fields are present with defaults
        result = {
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
        
        print(f"[GEMINI] Successfully extracted data: {result}")
        return result
        
    except Exception as e:
        print(f"[GEMINI] Error processing with Gemini: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[GEMINI] Traceback:\n{traceback.format_exc()}")
        
        # Return fallback data on error
        return {
            "documento": "",
            "tipo_de_suplidor": "",
            "tipo_de_gasto": "",
            "fecha": datetime.now().strftime("%d/%m/%Y"),
            "monto_en_servicios": 0.0,
            "itbis": 0.0,
            "selectivo": 0.0,
            "metodo_de_pago": "",
            "filename": filename
        }


def populate_excel_template(data: dict):
    """
    Populate Excel template with extracted data, preserving template structure.
    Dynamically finds columns by header names to support any template structure.
    """
    import shutil
    from openpyxl.utils import get_column_letter
    
    print(f"[EXCEL] Starting Excel population with data: {data}")
    print(f"[EXCEL] OUTPUT_FILE path: {OUTPUT_FILE}")
    print(f"[EXCEL] TEMPLATE_FILE path: {TEMPLATE_FILE}")
    
    # Ensure we have a .xlsx version of the template
    template_path = ensure_template_xlsx()
    
    if not template_path or not template_path.exists():
        print(f"[EXCEL] ERROR: Template not available at {template_path}")
        raise FileNotFoundError(f"Template file not found: {template_path}")
    
    try:
        # Step 1: Copy template to output file (preserves all formatting, sheets, filters, etc.)
        print(f"[EXCEL] Copying template from {template_path} to {OUTPUT_FILE}...")
        shutil.copy2(template_path, OUTPUT_FILE)
        print(f"[EXCEL] Template copied successfully")
        
        # Step 2: Load the copied file (which is now our working file)
        print(f"[EXCEL] Loading copied template...")
        wb = openpyxl.load_workbook(OUTPUT_FILE)
        print(f"[EXCEL] Template loaded. Sheets: {wb.sheetnames}")
        
        # Step 3: Get the specific sheet "Listado de Gastos"
        if "Listado de Gastos" in wb.sheetnames:
            ws = wb["Listado de Gastos"]
            print(f"[EXCEL] Using sheet: 'Listado de Gastos'")
        else:
            # Fallback to first sheet if name doesn't match
            ws = wb.active
            print(f"[EXCEL] WARNING: 'Listado de Gastos' not found, using active sheet: {ws.title}")
        
        print(f"[EXCEL] Sheet dimensions: {ws.max_row} rows x {ws.max_column} columns")
        
        # Step 4: Build column mapping from header row
        # Read all headers from row 1
        column_map = {}
        print(f"[EXCEL] Reading headers from row 1...")
        for col_idx in range(1, ws.max_column + 1):
            header = ws.cell(row=1, column=col_idx).value
            if header:
                header_lower = str(header).lower().strip()
                column_map[header_lower] = col_idx
                print(f"  Column {get_column_letter(col_idx)} ({col_idx}): '{header}'")
        
        # Define field mappings (our data field -> possible header names)
        # Map Gemini response fields to Excel column headers
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
        
        # Find matching columns for each field
        data_columns = {}
        for field, possible_headers in field_mappings.items():
            for header_name in possible_headers:
                if header_name in column_map:
                    data_columns[field] = column_map[header_name]
                    print(f"[EXCEL] Mapped '{field}' -> Column {get_column_letter(column_map[header_name])} ('{header_name}')")
                    break
        
        # Step 5: Find first empty row (data starts at row 2, row 1 is header)
        row = 2
        while row <= ws.max_row and ws.cell(row=row, column=1).value is not None:
            row += 1
        
        print(f"[EXCEL] Will insert data at row: {row}")
        
        # Step 6: Populate with data according to discovered column mapping
        print(f"[EXCEL] Populating row {row} with data...")
        
        # Map Gemini response fields to Excel columns
        if "documento" in data_columns:
            # Use documento from Gemini, fallback to filename
            value = data.get("documento", "") or data.get("filename", "")
            ws.cell(row=row, column=data_columns["documento"], value=value)
        
        if "tipo_de_suplidor" in data_columns:
            ws.cell(row=row, column=data_columns["tipo_de_suplidor"], value=data.get("tipo_de_suplidor", ""))
        
        if "tipo_de_gasto" in data_columns:
            ws.cell(row=row, column=data_columns["tipo_de_gasto"], value=data.get("tipo_de_gasto", ""))
        
        if "fecha" in data_columns:
            ws.cell(row=row, column=data_columns["fecha"], value=data.get("fecha", ""))
        
        if "monto_en_servicios" in data_columns:
            monto = data.get("monto_en_servicios", 0)
            if isinstance(monto, str):
                try:
                    monto = float(monto.replace(",", ""))
                except ValueError:
                    monto = 0.0
            ws.cell(row=row, column=data_columns["monto_en_servicios"], value=float(monto))
        
        if "itbis" in data_columns:
            itbis = data.get("itbis", 0)
            if isinstance(itbis, str):
                try:
                    itbis = float(itbis.replace(",", ""))
                except ValueError:
                    itbis = 0.0
            ws.cell(row=row, column=data_columns["itbis"], value=float(itbis))
        
        if "selectivo" in data_columns:
            selectivo = data.get("selectivo", 0)
            if isinstance(selectivo, str):
                try:
                    selectivo = float(selectivo.replace(",", ""))
                except ValueError:
                    selectivo = 0.0
            ws.cell(row=row, column=data_columns["selectivo"], value=float(selectivo))
        
        if "metodo_de_pago" in data_columns:
            ws.cell(row=row, column=data_columns["metodo_de_pago"], value=data.get("metodo_de_pago", ""))
        
        print(f"[EXCEL] Data populated successfully")
        
        # Step 7: Update auto-filter range to include new row (use ALL columns)
        print(f"[EXCEL] Updating auto-filter range...")
        max_col_letter = get_column_letter(ws.max_column)
        max_data_row = max(row, ws.max_row)
        ws.auto_filter.ref = f"A1:{max_col_letter}{max_data_row}"
        print(f"[EXCEL] Auto-filter range: A1:{max_col_letter}{max_data_row}")
        
        # Step 7: Save the modified copy
        print(f"[EXCEL] Saving to output file: {OUTPUT_FILE}")
        wb.save(OUTPUT_FILE)
        print(f"[EXCEL] File saved successfully with {len(wb.sheetnames)} sheet(s)")
        return OUTPUT_FILE
        
    except Exception as e:
        print(f"[EXCEL] ERROR processing template: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[EXCEL] Traceback:\n{traceback.format_exc()}")
        raise


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Receipt Processing API is running"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload and process a receipt/invoice file (supports: PDF, PNG, JPG, JPEG)
    """
    print(f"[UPLOAD] Starting upload for file: {file.filename}")
    print(f"[UPLOAD] File content type: {file.content_type}")
    
    try:
        # Validate file type
        print(f"[UPLOAD] Validating file type...")
        allowed_extensions = {'.pdf', '.png', '.jpg', '.jpeg'}
        file_extension = Path(file.filename).suffix.lower() if file.filename else ''
        print(f"[UPLOAD] File extension: '{file_extension}'")
        
        if file_extension not in allowed_extensions:
            print(f"[UPLOAD] ERROR: Unsupported file extension: {file_extension}")
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Supported formats: PDF, PNG, JPG, JPEG. Received: {file_extension or 'unknown'}"
            )
        
        print(f"[UPLOAD] File type validation passed")
        
        # Read file content
        print(f"[UPLOAD] Reading file content...")
        file_content = await file.read()
        print(f"[UPLOAD] File content read: {len(file_content)} bytes")
        
        # Calculate hash
        print(f"[UPLOAD] Calculating file hash...")
        file_hash = calculate_file_hash(file_content)
        print(f"[UPLOAD] File hash: {file_hash}")
        
        # # Check for duplicates
        # print(f"[UPLOAD] Checking for duplicates...")
        # if check_duplicate(file_hash):
        #     print(f"[UPLOAD] File is a duplicate, returning duplicate status")
        #     return {
        #         "status": "duplicate",
        #         "message": f"File {file.filename} has already been processed",
        #         "hash": file_hash
        #     }
        # print(f"[UPLOAD] No duplicate found, proceeding with processing")
        
        # Process with Gemini (stub for now)
        print(f"[UPLOAD] Processing with Gemini...")
        extracted_data = process_with_gemini(file_content, file.filename)
        print(f"[UPLOAD] Gemini processing complete. Extracted data: {extracted_data}")
        
        # Populate Excel template
        print(f"[UPLOAD] Populating Excel template...")
        excel_file = populate_excel_template(extracted_data)
        print(f"[UPLOAD] Excel template populated. Output file: {excel_file}")
        
        # Add to history
        print(f"[UPLOAD] Saving to history...")
        history = load_history()
        history.append({
            "hash": file_hash,
            "filename": file.filename,
            "processed_at": datetime.now().isoformat(),
            "data": extracted_data
        })
        save_history(history)
        print(f"[UPLOAD] History saved successfully")
        
        print(f"[UPLOAD] SUCCESS: File {file.filename} processed successfully")
        return {
            "status": "success",
            "message": f"File {file.filename} processed successfully",
            "data": extracted_data,
            "hash": file_hash
        }
        
    except HTTPException as e:
        print(f"[UPLOAD] HTTPException raised: {e.status_code} - {e.detail}")
        raise
    except Exception as e:
        print(f"[UPLOAD] EXCEPTION: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[UPLOAD] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.get("/download")
async def download_excel():
    """
    STUB: Download the processed Excel file
    """
    if not OUTPUT_FILE.exists():
        raise HTTPException(status_code=404, detail="No processed file available")
    
    return FileResponse(
        path=OUTPUT_FILE,
        filename="processed_receipts.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Enable reload in development (when running directly, not in production)
    # Set RELOAD=false environment variable to disable
    reload_enabled = os.getenv("RELOAD", "true").lower() != "false"
    
    print(f"Starting server with reload={'enabled' if reload_enabled else 'disabled'}")
    
    if reload_enabled:
        # Use import string for reload to work properly
        uvicorn.run(
            "server:app",  # Import string format: "module:variable"
            host="127.0.0.1", 
            port=8000,
            reload=True,
            reload_dirs=[str(BASE_DIR)]
        )
    else:
        # Direct app object when reload is disabled
        uvicorn.run(
            app, 
            host="127.0.0.1", 
            port=8000,
            reload=False
        )

