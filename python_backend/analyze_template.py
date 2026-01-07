"""
Script to analyze template.xls and generate instructions for server.py
This will read the template and extract all formatting, structure, filters, etc.
"""
import pandas as pd
from pathlib import Path
import openpyxl
from openpyxl.styles import Font, Fill, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import json

BASE_DIR = Path(__file__).parent
TEMPLATE_FILE = BASE_DIR.parent / "template.xls"
OUTPUT_ANALYSIS = BASE_DIR / "template_analysis.json"

def analyze_template():
    """Analyze the template file and extract all structure information"""
    if not TEMPLATE_FILE.exists():
        print(f"ERROR: Template file not found: {TEMPLATE_FILE}")
        return None
    
    temp_xlsx = BASE_DIR / "temp_template_analysis.xlsx"
    
    try:
        xls_file = pd.ExcelFile(TEMPLATE_FILE, engine='xlrd')
        sheet_names = xls_file.sheet_names
        
        wb_output = openpyxl.Workbook()
        if len(sheet_names) > 0:
            wb_output.remove(wb_output.active)
        
        analysis = {
            "template_path": str(TEMPLATE_FILE),
            "sheets": {},
            "column_mapping": {},
            "formatting": {},
            "filters": {},
            "instructions": []
        }
        
        for sheet_name in sheet_names:
            df = pd.read_excel(TEMPLATE_FILE, sheet_name=sheet_name, engine='xlrd', header=None)
            ws_output = wb_output.create_sheet(title=sheet_name)
            
            for row_idx, row in df.iterrows():
                for col_idx, value in enumerate(row, start=1):
                    if pd.notna(value):
                        ws_output.cell(row=row_idx + 1, column=col_idx, value=value)
            
            analysis["sheets"][sheet_name] = analyze_sheet_with_openpyxl(ws_output, sheet_name)
        
        wb_output.save(temp_xlsx)
        wb = openpyxl.load_workbook(temp_xlsx)
        
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            analysis["sheets"][sheet_name].update(get_detailed_formatting(ws, sheet_name))
        
        main_sheet = analysis["sheets"].get("Listado de Gastos", {})
        analysis["column_mapping"] = generate_column_mapping(main_sheet.get("headers", {}))
        analysis["instructions"] = generate_instructions(analysis)
        
        with open(OUTPUT_ANALYSIS, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"✓ Analysis saved to: {OUTPUT_ANALYSIS}")
        return analysis
        
    except Exception as e:
        print(f"ERROR: {e}")
        return None


def analyze_sheet_with_openpyxl(ws, sheet_name):
    """Analyze a worksheet to extract structure"""
    analysis = {
        "name": sheet_name,
        "max_row": ws.max_row,
        "max_column": ws.max_column,
        "headers": {},
        "data_start_row": None,
        "frozen_panes": ws.freeze_panes,
    }
    
    # Find header row (usually row 1, but check for yellow background or bold)
    header_row = 1
    for row_idx in range(1, min(ws.max_row + 1, 5)):
        cell = ws.cell(row=row_idx, column=1)
        if cell.value and isinstance(cell.value, str):
            # Check if this looks like a header row
            fill = cell.fill
            font = cell.font
            if (fill and fill.start_color and fill.start_color.rgb and 
                'FFFF' in str(fill.start_color.rgb).upper()) or font.bold:
                header_row = row_idx
                analysis["data_start_row"] = row_idx + 1
                break
    
    # Extract headers
    for col_idx in range(1, ws.max_column + 1):
        cell = ws.cell(row=header_row, column=col_idx)
        if cell.value:
            analysis["headers"][col_idx] = str(cell.value).strip()
    
    if not analysis["data_start_row"]:
        analysis["data_start_row"] = header_row + 1
    
    return analysis


def get_detailed_formatting(ws, sheet_name):
    """Get detailed formatting information from a worksheet"""
    formatting = {
        "header_row": None,
        "header_formatting": {},
        "column_widths": {},
        "row_heights": {},
        "cell_formats": {},
        "filters": {},
    }
    
    # Find header row
    header_row = 1
    for row_idx in range(1, min(ws.max_row + 1, 5)):
        cell = ws.cell(row=row_idx, column=1)
        if cell.value:
            fill = cell.fill
            if fill and fill.start_color:
                # Check for yellow (common header color)
                rgb = str(fill.start_color.rgb or '').upper()
                if 'FFFF' in rgb or 'FFEB' in rgb:
                    header_row = row_idx
                    break
    
    formatting["header_row"] = header_row
    
    # Analyze header row formatting
    for col_idx in range(1, ws.max_column + 1):
        cell = ws.cell(row=header_row, column=col_idx)
        if cell.value:
            cell_format = {
                "font": {
                    "name": cell.font.name,
                    "size": cell.font.size,
                    "bold": cell.font.bold,
                    "color": str(cell.font.color.rgb) if cell.font.color and cell.font.color.rgb else None,
                },
                "fill": {
                    "patternType": cell.fill.patternType if cell.fill else None,
                    "fgColor": str(cell.fill.fgColor.rgb) if cell.fill and cell.fill.fgColor and cell.fill.fgColor.rgb else None,
                },
                "alignment": {
                    "horizontal": cell.alignment.horizontal if cell.alignment else None,
                    "vertical": cell.alignment.vertical if cell.alignment else None,
                },
            }
            formatting["header_formatting"][col_idx] = cell_format
    
    # Get column widths
    for col_idx in range(1, ws.max_column + 1):
        col_letter = get_column_letter(col_idx)
        width = ws.column_dimensions[col_letter].width
        if width:
            formatting["column_widths"][col_idx] = width
    
    # Check for auto filters
    if ws.auto_filter.ref:
        formatting["filters"]["enabled"] = True
        formatting["filters"]["range"] = str(ws.auto_filter.ref)
    else:
        formatting["filters"]["enabled"] = False
    
    return formatting


def generate_column_mapping(headers):
    """Generate mapping from our data fields to template columns"""
    mapping = {}
    
    # Our data fields
    our_fields = {
        "date": ["fecha", "date", "fecha de", "fecha del"],
        "vendor": ["proveedor", "vendor", "suplidor", "supplier"],
        "description": ["descripcion", "description", "desc"],
        "total": ["monto", "total", "amount", "monto en servicios"],
        "tax": ["impuesto", "tax", "iva"],
        "filename": ["archivo", "filename", "file", "documento"],
    }
    
    # Find matching columns
    for field, keywords in our_fields.items():
        for col_idx, header_text in headers.items():
            header_lower = header_text.lower()
            if any(keyword in header_lower for keyword in keywords):
                mapping[field] = {
                    "column": col_idx,
                    "header": header_text,
                    "column_letter": get_column_letter(col_idx),
                }
                break
    
    return mapping


def generate_instructions(analysis):
    """Generate code instructions for server.py"""
    instructions = []
    main_sheet_name = "Listado de Gastos"
    
    if main_sheet_name not in analysis["sheets"]:
        return ["ERROR: Main sheet 'Listado de Gastos' not found in template"]
    
    main_sheet = analysis["sheets"][main_sheet_name]
    column_mapping = analysis["column_mapping"]
    
    instructions.append(f"Template: {analysis['template_path']}")
    instructions.append(f"Sheet: '{main_sheet_name}', data starts at row {main_sheet.get('data_start_row', 2)}")
    
    if column_mapping:
        for field, col_info in column_mapping.items():
            instructions.append(f"  {field} -> Column {col_info['column']}")
    
    return instructions


if __name__ == "__main__":
    analyze_template()

