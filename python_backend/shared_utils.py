"""
Shared utility functions and singletons used by both server.py (gastos) and
suplidores_server.py (suplidores).

Keeping them here prevents circular imports: neither server module needs to
import from the other; both import from this module instead.
"""
import asyncio
import re
from pathlib import Path


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


def _is_retryable_error(error: Exception) -> bool:
    error_str = str(error).lower()
    return (
        "429" in error_str or "rate" in error_str or "limit" in error_str
        or "quota" in error_str or "resource" in error_str
        or "500" in error_str or "502" in error_str or "503" in error_str
        or "timeout" in error_str or "empty response" in error_str
    )
