from __future__ import annotations
import io
from typing import Optional

from pypdf import PdfReader
from docx import Document  # python-docx


def _read_pdf(data: bytes) -> str:
    buf = io.BytesIO(data)
    reader = PdfReader(buf)
    texts = []
    for page in reader.pages:
        t = page.extract_text() or ""
        texts.append(t)
    return "\n\n".join(texts)


def _read_docx(data: bytes) -> str:
    buf = io.BytesIO(data)
    doc = Document(buf)
    texts = []
    for p in doc.paragraphs:
        if p.text:
            texts.append(p.text)
    return "\n".join(texts)


def _read_txt(data: bytes) -> str:
    # Best-effort decoding
    for enc in ("utf-8", "utf-16", "big5", "cp950", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="ignore")


def extract_text(data: bytes, filename: str, content_type: Optional[str]) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf") or (content_type and "pdf" in content_type):
        return _read_pdf(data)
    if name.endswith(".docx") or (content_type and "word" in content_type):
        return _read_docx(data)
    if name.endswith(".md"):
        return _read_txt(data)
    if name.endswith(".txt") or content_type and "text" in (content_type or ""):
        return _read_txt(data)
    # Fallback best-effort
    return _read_txt(data)