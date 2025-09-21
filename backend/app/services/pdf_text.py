from typing import List, Tuple, Dict, Any
from pypdf import PdfReader

def _split_paragraphs(text: str) -> List[str]:
    # Normalize line breaks, split on blank lines
    chunks = []
    buf = []
    for line in (text or "").splitlines():
        if line.strip() == "":
            if buf:
                chunks.append(" ".join(buf).strip())
                buf = []
        else:
            buf.append(line.strip())
    if buf:
        chunks.append(" ".join(buf).strip())
    # Fallback: if nothing split, return whole text
    return [c for c in chunks if c] or ([text.strip()] if text else [])

def extract_paragraphs(pdf_path: str) -> Tuple[List[str], Dict[str, Any]]:
    reader = PdfReader(pdf_path)
    all_paras: List[str] = []
    mapping_items = []
    for pi, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        paras = _split_paragraphs(text)
        for pj, para in enumerate(paras, start=1):
            mapping_items.append({"page": pi, "para": pj, "text": para})
            all_paras.append(para)
    mapping = {"items": mapping_items, "total": len(mapping_items)}
    return all_paras, mapping
