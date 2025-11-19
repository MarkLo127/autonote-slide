"""Heuristics for classifying parsed pages before summarisation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ClassifiedPage:
    page_number: int
    text: str
    classification: str
    skip_reason: Optional[str]


SKIP_CLASS_LABELS = {"toc", "pure_image", "blank", "cover", "photo_page", "reference"}


def _line_tokens(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _is_probably_cover(text: str, page_number: int) -> bool:
    if page_number != 1:
        return False
    lines = _line_tokens(text)
    if not lines:
        return True
    if len(lines) <= 4 and any(keyword in lines[0] for keyword in {"報告", "企畫", "簡報", "計畫", "Proposal", "Report"}):
        return True
    return False


def _is_probably_blank(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    alnum = [ch for ch in stripped if ch.isalnum()]
    return len(alnum) <= 4


def _is_probably_pure_image(text: str) -> bool:
    """檢測純圖片頁（沒有文字）"""
    stripped = text.strip()
    if not stripped:
        return True
    # 文字極少（<10個字元）也視為純圖片
    return len(stripped) < 10


def _is_probably_photo_page(text: str) -> bool:
    """檢測照片頁（人物照、建築照、風景照）"""
    lines = _line_tokens(text)
    if not lines:
        return False
    
    # 只有少量文字（1-3行）且包含照片相關詞彙
    if len(lines) <= 3:
        photo_keywords = {
            "照片", "攝影", "圖片", "photo", "image", 
            "人物", "建築", "風景", "景觀",
            "portrait", "architecture", "landscape",
            "figure", "fig.", "圖"
        }
        text_lower = text.lower()
        if any(keyword in text_lower for keyword in photo_keywords):
            return True
    
    # 文字很少但不是純空白
    return len(text.strip()) < 30 and len(lines) <= 2


def _is_probably_reference(text: str) -> bool:
    """檢測參考文獻頁"""
    lines = _line_tokens(text)
    if not lines:
        return False
    
    ref_keywords = {"參考文獻", "references", "bibliography", "引用"}
    has_keyword = any(any(keyword in line.lower() for keyword in ref_keywords) for line in lines[:3])
    
    if has_keyword:
        return True
    
    # 檢測是否有很多類似引用格式的行
    import re
    citation_pattern = r"\[\d+\]|^\d+\.\s|\(\d{4}\)"
    citation_hits = sum(1 for line in lines if re.search(citation_pattern, line))
    
    return citation_hits >= max(3, len(lines) // 2)


def _is_probably_toc(text: str) -> bool:
    import re

    lines = _line_tokens(text)
    if not lines:
        return False
    toc_hits = sum(1 for line in lines if re.search(r"\.{2,}\s*\d+$", line) or re.search(r"\s\d+$", line))
    keywords = {"目錄", "目录", "contents", "content"}
    has_keyword = any(any(keyword in line.lower() for keyword in keywords) for line in lines[:6])
    return has_keyword and toc_hits >= max(2, len(lines) // 3)


def classify_page(page_number: int, text: str) -> ClassifiedPage:
    stripped = text.strip()

    # 優先檢查空白和純圖片（最常見）
    if _is_probably_blank(stripped):
        return ClassifiedPage(
            page_number,
            stripped,
            "blank",
            "〈本頁跳過（空白/水印）〉無可辨識文字或數據，略過本頁摘要。",
        )

    if _is_probably_pure_image(stripped):
        return ClassifiedPage(
            page_number,
            stripped,
            "pure_image",
            "〈本頁跳過（純圖片）〉僅含圖片且無可辨識數據，暫不生成文字重點。",
        )

    # 檢查照片頁（人物照、建築照、風景照）
    if _is_probably_photo_page(stripped):
        return ClassifiedPage(
            page_number,
            stripped,
            "photo_page",
            "〈本頁跳過（照片頁）〉本頁為照片或圖片展示頁，無需摘要。",
        )

    # 檢查目錄
    if _is_probably_toc(stripped):
        return ClassifiedPage(
            page_number,
            stripped,
            "toc",
            "〈本頁跳過（目錄）〉本頁僅列出章節與頁碼參考，無實質內容可供摘要。",
        )

    # 檢查封面（第一頁）
    if _is_probably_cover(stripped, page_number):
        return ClassifiedPage(
            page_number,
            stripped,
            "cover",
            "〈本頁跳過（封面）〉僅顯示封面資訊或水印，無需抽取重點。",
        )

    # 檢查參考文獻
    if _is_probably_reference(stripped):
        return ClassifiedPage(
            page_number,
            stripped,
            "reference",
            "〈本頁跳過（參考文獻）〉本頁為引用文獻列表，無需摘要。",
        )

    return ClassifiedPage(page_number, stripped, "normal", None)
