"""純文字處理：PDF 擷取、分段、斷句、頁面分類、OpenCC 繁體保底（皆不需 AI）。"""
from __future__ import annotations

import re
from pathlib import Path

# ── OpenCC s2t 繁體保底（延遲載入單例）──
_OPENCC = None


def to_traditional(text: str) -> str:
    global _OPENCC
    if _OPENCC is None:
        import opencc

        _OPENCC = opencc.OpenCC("s2t")
    return _OPENCC.convert(text)


# ── PDF 擷取（含掃描頁 OCR fallback）──
def extract_pages(pdf_path: str | Path, ocr: bool = True,
                  ocr_min_chars: int = 40, ocr_dpi: int = 200) -> list[str]:
    """逐頁抽文字；某頁文字量過少（掃描/圖片頁）時 render 成圖用 RapidOCR 補。"""
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    pages: list[str] = []
    for page in doc:
        text = page.get_text("text").strip()
        if ocr and len(text) < ocr_min_chars:
            from .ocr import ocr_png

            png = page.get_pixmap(dpi=ocr_dpi).tobytes("png")
            ocr_text = ocr_png(png)
            if len(ocr_text) > len(text):
                text = ocr_text
        pages.append(text)
    doc.close()
    return pages


# ── 頁面分類 / 文字清理：濾掉封面、目錄、參考文獻、圖表碎片頁 ──
_SKIP_PATTERNS = re.compile(
    r"^\s*(references|bibliography|table of contents|contents|acknowledge?ments?)\s*$",
    re.IGNORECASE,
)
_TOC_LEADER = re.compile(r".*\.{4,}\s*\d+\s*$")          # 目錄點引線「... 12」
_REF_ENTRY = re.compile(r"^\s*\[\d+\]\s")                 # 參考文獻條目「[34] ...」
_PAGE_NUM = re.compile(r"^\s*\d+\s*$")                    # 純頁碼行


def _prose_lines(text: str) -> list[str]:
    """回傳看起來像「句子」的行（字數足夠、非碎片/目錄/參考）。"""
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s or _PAGE_NUM.match(s) or _TOC_LEADER.match(s) or _REF_ENTRY.match(s):
            continue
        if len(s.split()) >= 5:  # 5 字以上才算成句
            out.append(s)
    return out


def is_meaningful_page(text: str) -> bool:
    """有效頁需：夠長、非參考/目錄標題、且含足夠成句內容（濾掉圖表/公式碎片頁）。"""
    stripped = text.strip()
    if len(stripped) < 120:
        return False
    head = stripped.splitlines()[0] if stripped.splitlines() else ""
    if _SKIP_PATTERNS.match(head):
        return False
    prose = _prose_lines(stripped)
    # 成句行太少（多為圖說/圖表 token/目錄），或成句內容佔比過低 → 視為無效
    if len(prose) < 3:
        return False
    if len(" ".join(prose)) < len(stripped) * 0.35:
        return False
    return True


def clean_page_text(text: str) -> str:
    """保留成句內容，去掉目錄點引線、純頁碼、參考文獻條目與零碎短行。"""
    return "\n".join(_prose_lines(text))


# ── 分段 ──
def chunk_pages(pages: list[str], max_chars: int) -> list[str]:
    chunks: list[str] = []
    buf = ""
    for page in pages:
        if not page:
            continue
        if buf and len(buf) + len(page) > max_chars:
            chunks.append(buf)
            buf = page
        else:
            buf = f"{buf}\n\n{page}" if buf else page
    if buf:
        chunks.append(buf)
    return chunks


_SENT_SPLIT = re.compile(r"(?<=[.!?。！？])\s+")


def split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts.extend(s.strip() for s in _SENT_SPLIT.split(line) if s.strip())
    return parts
