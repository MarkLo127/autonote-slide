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
    r"^\s*(references|bibliography|table of contents|contents|acknowledge?ments?"
    r"|參考文獻|參考資料|目錄|目次|致謝|誌謝)\s*$",
    re.IGNORECASE,
)
_TOC_LEADER = re.compile(r".*\.{4,}\s*\d+\s*$")          # 目錄點引線「... 12」
_REF_ENTRY = re.compile(r"^\s*\[\d+\]\s")                 # 參考文獻條目「[34] ...」
_PAGE_NUM = re.compile(r"^\s*\d+\s*$")                    # 純頁碼行

# CJK（中日韓）字元：這些語言不以空白斷詞，長度判斷必須逐字計
_CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]")


_HAN = re.compile(r"[㐀-䶿一-鿿豈-﫿]")   # 漢字（中文／日文漢字）
_KANA = re.compile(r"[぀-ヿ]")                            # 假名（日文專屬）
_HANGUL = re.compile(r"[가-힯ᄀ-ᇿ]")             # 諺文（韓文專屬）


def _dense_len(text: str) -> int:
    return sum(1 for c in text if not c.isspace())


def cjk_ratio(text: str) -> float:
    """CJK 字元佔非空白字元的比例，用來判斷是否為中日韓文件。"""
    dense = _dense_len(text)
    return len(_CJK.findall(text)) / dense if dense else 0.0


def script_language(text: str) -> str | None:
    """純用字元集判斷 CJK 語言，判不出來回 None。

    langdetect 對中英混排（技術文件、履歷）常誤判——實測把中文履歷判成 ko，
    使關鍵字走英文分支、jieba 完全沒被呼叫。字元集判斷是確定性的，故優先採用。
    """
    dense = _dense_len(text)
    if not dense:
        return None
    han = len(_HAN.findall(text))
    kana = len(_KANA.findall(text))
    hangul = len(_HANGUL.findall(text))
    if kana / dense >= 0.02:                       # 有假名即為日文（日文必然夾雜假名）
        return "ja"
    if hangul > han and hangul / dense >= 0.05:
        return "ko"
    if han / dense >= 0.05:
        return "zh"
    return None


def _is_sentence_like(s: str) -> bool:
    """語言無關的「成句」判斷：CJK 逐字計（≥8 字），拉丁語系按空白斷詞（≥5 詞）。"""
    cjk = len(_CJK.findall(s))
    if cjk >= 8:
        return True
    return len(s.split()) >= 5


def _content_lines(text: str) -> list[str]:
    """去掉明確的垃圾行（純頁碼、目錄點引線、參考文獻條目、單字元殘渣）。"""
    out = []
    for line in text.splitlines():
        s = line.strip()
        if not s or _PAGE_NUM.match(s) or _TOC_LEADER.match(s) or _REF_ENTRY.match(s):
            continue
        if len(s) < 2:
            continue
        out.append(s)
    return out


def _prose_lines(text: str) -> list[str]:
    """回傳看起來像「句子」的行（字數足夠、非碎片/目錄/參考）。"""
    return [s for s in _content_lines(text) if _is_sentence_like(s)]


def is_meaningful_page(text: str) -> bool:
    """有效頁需：夠長、非參考/目錄標題、且含足夠成句內容（濾掉圖表/公式碎片頁）。"""
    stripped = text.strip()
    is_cjk = cjk_ratio(stripped) >= 0.2
    # CJK 資訊密度高（一字一詞）且版面常把整句拆成短行，兩道門檻都須放寬，
    # 否則整份中文文件會被全數濾掉。
    if len(stripped) < (60 if is_cjk else 120):
        return False
    head = stripped.splitlines()[0] if stripped.splitlines() else ""
    if _SKIP_PATTERNS.match(head):
        return False
    prose = _prose_lines(stripped)
    # 成句行太少（多為圖說/圖表 token/目錄），或成句內容佔比過低 → 視為無效
    if len(prose) < 3:
        return False
    if len(" ".join(prose)) < len(stripped) * (0.2 if is_cjk else 0.35):
        return False
    return True


def clean_page_text(text: str) -> str:
    """去掉目錄點引線、純頁碼、參考文獻條目與零碎短行。

    CJK 版面常把一句話拆成數個短行（也常以短行承載標題與欄位），
    只留「成句」的行會把大半內容丟掉，故中日韓文件僅濾明確垃圾行。
    """
    lines = _content_lines(text) if cjk_ratio(text) >= 0.2 else _prose_lines(text)
    return "\n".join(lines)


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
