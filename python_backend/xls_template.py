"""
Fill the official Carga Masiva template (.xls) IN PLACE instead of recreating it.

The template `Plantilla_Importar_Gastos.xls` is a legacy BIFF8 (.xls) workbook
that ships with data-validation dropdowns (Tipo de Suplidor, Tipo de Gasto,
Forma de Pago, Retenciones...) backed by named ranges that point at the
`Nomencladores` sheet. The destination accounting system relies on that exact
structure; if we regenerate the workbook from scratch (e.g. with xlwt) those
dropdowns and named ranges are lost and the import "just does not work".

There is no pure-Python library that can write a BIFF8 .xls while preserving
data validations, so instead of rebuilding the file we edit the raw BIFF record
stream of the template: we keep every record verbatim (SST, named ranges,
DVAL/DV data-validation records, styles, the whole Nomencladores sheet) and only
inject cell-value records for the receipt rows into the `Listado de Gastos`
sheet. The result is byte-for-byte the original template plus our data rows.

Approach:
  * read the raw `Workbook` OLE stream (via xlrd's compound-doc reader),
  * parse it into (record_id, payload) tuples,
  * in the target worksheet substream: drop the placeholder blank rows (row >= 1)
    plus the optional INDEX/DBCELL offset tables, update DIMENSIONS, and insert
    LABEL/NUMBER cell records for each receipt row,
  * recompute the BOUNDSHEET stream offsets (they shift when we resize the
    first sheet) and re-serialize,
  * wrap the new stream back into an OLE2 container (via xlwt's CompoundDoc).
"""
import struct
from pathlib import Path

import xlrd
from xlrd.compdoc import CompDoc
from xlwt.CompoundDoc import XlsDoc
from xlwt.UnicodeUtils import upack2


# --- BIFF record ids -------------------------------------------------------
BOF = 0x0809
EOF = 0x000A
BOUNDSHEET = 0x0085
DIMENSIONS = 0x0200
WINDOW2 = 0x023E
INDEX = 0x020B
DBCELL = 0x00D7
ROW = 0x0208
LABEL = 0x0204
NUMBER = 0x0203

# Fallback ROW tail (height_options, unused, unused, options) used only when
# the template has no existing data row to copy the format from. 0x8000 in
# height_options means "default row height"; 0x0100 in options is the
# "always 1" bit every BIFF8 writer sets.
_DEFAULT_ROW_TAIL = struct.pack("<3HL", 0x8000, 0x0000, 0x0000, 0x00000100)

# Records that begin with a 2-byte row index and describe cell/row content.
# We strip these for rows >= 1 (keeping the header row) before injecting data.
ROW_SCOPED_RECORDS = frozenset({
    0x0208,  # ROW
    0x0201,  # BLANK
    0x00BE,  # MULBLANK
    0x027E,  # RK
    0x00BD,  # MULRK
    0x0203,  # NUMBER
    0x0204,  # LABEL
    0x00FD,  # LABELSST
    0x0205,  # BOOLERR
    0x0006,  # FORMULA
    0x00D6,  # RSTRING
})
# Optional performance/offset tables; we drop them so we never have to keep
# their byte offsets in sync after resizing the cell table.
DROP_ALWAYS_RECORDS = frozenset({INDEX, DBCELL})


def _parse_records(stream: bytes) -> list:
    """Split a BIFF stream into a list of mutable [record_id, payload] items."""
    records = []
    i, n = 0, len(stream)
    while i + 4 <= n:
        rid, size = struct.unpack("<HH", stream[i:i + 4])
        if rid == 0 and size == 0:
            break  # trailing sector padding
        payload = stream[i + 4:i + 4 + size]
        records.append([rid, payload])
        i += 4 + size
    return records


def _serialize(records: list) -> bytes:
    return b"".join(struct.pack("<HH", rid, len(p)) + p for rid, p in records)


def _find_substreams(records: list) -> list:
    """Return (start_idx, end_idx) inclusive for each top-level BOF..EOF block."""
    subs = []
    depth = 0
    start = None
    for idx, (rid, _) in enumerate(records):
        if rid == BOF:
            if depth == 0:
                start = idx
            depth += 1
        elif rid == EOF and depth > 0:
            depth -= 1
            if depth == 0:
                subs.append((start, idx))
    return subs


def _boundsheet_name(payload: bytes) -> str:
    """Decode the sheet name from a BIFF8 BOUNDSHEET payload."""
    cch = payload[6]
    grbit = payload[7]
    raw = payload[8:]
    if grbit & 0x01:
        return raw[:cch * 2].decode("utf-16-le", "replace")
    return raw[:cch].decode("latin-1", "replace")


def _label_record(row: int, col: int, xf: int, text: str) -> list:
    return [LABEL, struct.pack("<3H", row, col, xf) + upack2(text)]


def _number_record(row: int, col: int, xf: int, value: float) -> list:
    return [NUMBER, struct.pack("<3Hd", row, col, xf, float(value))]


def _row_record(row_idx: int, first_col: int, last_col: int, tail: bytes) -> list:
    """Build a ROW record reusing the template's own height/options tail."""
    return [ROW, struct.pack("<3H", row_idx, first_col, last_col + 1) + tail]


def _read_template_layout(template_path: Path, field_mappings: dict):
    """
    Inspect the template with xlrd to discover, for the first worksheet:
      - its name,
      - a {field: [column_index,...]} map derived from the header row,
      - a {column_index: xf_index} map (reusing the template's own cell
        formatting so injected data keeps the template's look),
      - the header column count.
    """
    book = xlrd.open_workbook(str(template_path), formatting_info=True)
    sheet = book.sheet_by_index(0)

    header_to_col = {}
    for col in range(sheet.ncols):
        value = sheet.cell_value(0, col)
        if isinstance(value, str) and value.strip():
            header_to_col.setdefault(value.lower().strip(), col)

    data_columns = {}
    for field, aliases in field_mappings.items():
        cols = []
        for alias in aliases:
            col = header_to_col.get(alias.lower().strip())
            if col is not None and col not in cols:
                cols.append(col)
        if cols:
            data_columns[field] = cols

    # Reuse the xf of the first data row (row index 1) so injected cells inherit
    # the template's column formatting; fall back to the default "Normal" xf.
    xf_by_col = {}
    for col in range(sheet.ncols):
        xf = None
        if sheet.nrows > 1:
            try:
                xf = sheet.cell_xf_index(1, col)
            except Exception:
                xf = None
        xf_by_col[col] = xf if xf else 15

    return sheet.name, data_columns, xf_by_col, sheet.ncols


def fill_xls_template(
    template_path: Path,
    out_path: Path,
    rows: list,
    field_mappings: dict,
    text_fields,
    numeric_fields,
    int_fields,
) -> Path:
    """
    Write `out_path` as a copy of the template `.xls` with `rows` filled into the
    first worksheet, preserving every dropdown, named range and other sheet.

    `rows` must already be normalized (see server.prepare_export_row). Text
    fields are written as inline string cells, numeric fields as number cells,
    and integer id fields only when present.
    """
    template_path = Path(template_path)
    out_path = Path(out_path)
    text_fields = set(text_fields)
    numeric_fields = set(numeric_fields)
    int_fields = set(int_fields)

    target_name, data_columns, xf_by_col, header_cols = _read_template_layout(
        template_path, field_mappings
    )

    raw = template_path.read_bytes()
    doc = CompDoc(raw)
    stream = doc.get_named_stream("Workbook") or doc.get_named_stream("Book")
    if stream is None:
        raise ValueError("Template .xls has no Workbook/Book stream")

    records = _parse_records(bytes(stream))
    subs = _find_substreams(records)
    if len(subs) < 2:
        raise ValueError("Template .xls has no worksheet substreams")

    boundsheet_idxs = [
        i for i in range(subs[0][0], subs[0][1] + 1) if records[i][0] == BOUNDSHEET
    ]

    # Pick the worksheet substream matching the target sheet name (default: the
    # first worksheet). BOUNDSHEET order matches worksheet-substream order.
    target_ordinal = 0
    for ordinal, bi in enumerate(boundsheet_idxs):
        if _boundsheet_name(records[bi][1]).lower().strip() == target_name.lower().strip():
            target_ordinal = ordinal
            break
    sheet_start, sheet_end = subs[1 + target_ordinal]

    # Capture an existing data-row ROW record's tail (height_options, unused,
    # unused, options) so injected rows keep the template's row formatting.
    # Without emitting our own ROW records, strict readers (e.g. Apple
    # Numbers) never learn these rows exist and silently drop their cells.
    row_tail = _DEFAULT_ROW_TAIL
    for idx in range(sheet_start, sheet_end + 1):
        rid, payload = records[idx]
        if rid == ROW and len(payload) >= 16:
            row_num = struct.unpack("<H", payload[:2])[0]
            if row_num == 1:
                row_tail = payload[6:16]
                break

    # Build the injected row + cell records (rows start at worksheet row index 1).
    max_used_col = header_cols - 1
    row_cells = []
    for offset, data in enumerate(rows):
        row_idx = 1 + offset
        cells_for_row = []
        for field, cols in data_columns.items():
            value = data.get(field)
            for col in cols:
                xf = xf_by_col.get(col, 15)
                if field in text_fields:
                    text = "" if value is None else str(value)
                    if text == "":
                        continue
                    cells_for_row.append(_label_record(row_idx, col, xf, text))
                elif field in numeric_fields:
                    cells_for_row.append(_number_record(row_idx, col, xf, value or 0.0))
                elif field in int_fields:
                    if value is None:
                        continue
                    cells_for_row.append(_number_record(row_idx, col, xf, value))
                else:
                    if value in (None, ""):
                        continue
                    cells_for_row.append(_label_record(row_idx, col, xf, str(value)))
                if col > max_used_col:
                    max_used_col = col
        row_cells.append((row_idx, cells_for_row))

    new_cells = []
    for row_idx, cells_for_row in row_cells:
        new_cells.append(_row_record(row_idx, 0, max_used_col, row_tail))
        new_cells.extend(cells_for_row)

    # Rewrite the target worksheet substream:
    #   * drop INDEX/DBCELL and every cell/row record for rows >= 1,
    #   * update DIMENSIONS to the new used range,
    #   * insert the new cell records right before WINDOW2 (i.e. after the
    #     header row's cells and before the sheet's view/validation records).
    rebuilt = []
    window2_local = None  # index within `rebuilt` of the first WINDOW2 record
    for idx in range(sheet_start, sheet_end + 1):
        rid, payload = records[idx]

        if rid in DROP_ALWAYS_RECORDS:
            continue
        if rid in ROW_SCOPED_RECORDS and len(payload) >= 2:
            row = struct.unpack("<H", payload[:2])[0]
            if row >= 1:
                continue

        if rid == DIMENSIONS and len(payload) >= 14:
            first_row, _last_row, first_col, last_col = struct.unpack("<2L2H", payload[:12])
            last_row = len(rows) + 1  # exclusive index (header + data rows)
            last_col = max(last_col, max_used_col + 1)
            payload = struct.pack("<2L3H", first_row, last_row, first_col, last_col, 0)

        if rid == WINDOW2 and window2_local is None:
            window2_local = len(rebuilt)

        rebuilt.append([rid, payload])

    insert_at = window2_local if window2_local is not None else max(len(rebuilt) - 1, 0)
    rebuilt[insert_at:insert_at] = new_cells

    # Stitch the streams back together: globals + rebuilt target + other sheets.
    new_records = []
    for si, (s_start, s_end) in enumerate(subs):
        if si == 1 + target_ordinal:
            new_records.extend(rebuilt)
        else:
            new_records.extend(records[s_start:s_end + 1])
        # Preserve anything between substreams (there normally isn't any).
        if si + 1 < len(subs):
            gap_start = s_end + 1
            gap_end = subs[si + 1][0]
            if gap_end > gap_start:
                new_records.extend(records[gap_start:gap_end])
    # Preserve any leading records before the first substream (none expected).
    if subs[0][0] > 0:
        new_records = records[:subs[0][0]] + new_records

    # Recompute BOUNDSHEET stream offsets: resizing the first sheet shifts the
    # byte position of every later sheet's BOF. lbPlyPos is the first 4 bytes.
    subs_after = _find_substreams(new_records)
    sheet_starts = [s[0] for s in subs_after[1:]]
    boundsheet_idxs_after = [
        i for i in range(subs_after[0][0], subs_after[0][1] + 1)
        if new_records[i][0] == BOUNDSHEET
    ]

    pos = 0
    offset_of_record = {}
    for idx, (_, payload) in enumerate(new_records):
        offset_of_record[idx] = pos
        pos += 4 + len(payload)

    for k, bi in enumerate(boundsheet_idxs_after):
        if k >= len(sheet_starts):
            break
        payload = bytearray(new_records[bi][1])
        struct.pack_into("<I", payload, 0, offset_of_record[sheet_starts[k]])
        new_records[bi][1] = bytes(payload)

    out_stream = _serialize(new_records)
    XlsDoc().save(str(out_path), out_stream)
    return out_path
