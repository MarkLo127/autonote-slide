from pathlib import Path
import fitz  # PyMuPDF
import pytesseract
from langdetect import detect
import re
from typing import List, Dict
from dotenv import load_dotenv
import os

load_dotenv()
OCR_LANG = os.getenv("OCR_LANG", "chi_tra+eng")

def _clean_text(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip()
    return t

def _need_ocr(page: "fitz.Page") -> bool:
    # 若此頁文字極少，當作掃描影像頁需要 OCR
    text = page.get_text().strip()
    return len(text) < 20

def _ocr_page(page: "fitz.Page") -> str:
    pix = page.get_pixmap(dpi=200)
    import PIL.Image
    img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return pytesseract.image_to_string(img, lang=OCR_LANG)

def read_pdf_to_paragraphs(pdf_path: Path) -> Dict:
    doc = fitz.open(str(pdf_path))
    paragraphs: List[Dict] = []
    full_text_parts: List[str] = []

    for i, page in enumerate(doc):
        page_no = i + 1
        if _need_ocr(page):
            text = _ocr_page(page)
        else:
            text = page.get_text("text")
        text = text.replace("\r", "\n")
        # 粗略用空行切段
        raw_paras = [p for p in re.split(r"\n\s*\n", text) if _clean_text(p)]
        for idx, p in enumerate(raw_paras, start=1):
            pid = f"p{page_no}_{idx}"
            clean = _clean_text(p)
            paragraphs.append({"id": pid, "page": page_no, "text": clean})
            full_text_parts.append(clean)

    full_text = "\n".join(full_text_parts)
    # 嘗試語言檢測（僅供參考）
    try:
        lang = detect(full_text[:1000])
    except Exception:
        lang = "unknown"

    return {"paragraphs": paragraphs, "full_text": full_text, "lang": lang}
