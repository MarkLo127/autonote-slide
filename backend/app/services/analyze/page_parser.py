"""Utilities for splitting different document types into page-wise text blocks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from backend.app.utils.text_clean import normalize_text
from .image_extractor import extract_images_from_page, filter_significant_images


@dataclass
class PageContent:
    page_number: int
    text: str
    image_count: int = 0  # 該頁分析的圖片數量


def _parse_pdf(path: str, vision_analyzer=None, vision_settings=None) -> List[PageContent]:
    """
    解析 PDF，可選擇性使用 Vision API 分析圖片
    
    Args:
        path: PDF 檔案路徑
        vision_analyzer: VisionAnalyzer 實例（可選）
        vision_settings: Vision 配置（從 LLMSettings 提取）
        
    Returns:
        頁面內容列表
    """
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    pages: List[PageContent] = []
    
    for idx, page in enumerate(doc, start=1):
        try:
            text = page.get_text() or ""
        except Exception:
            text = ""
        
        image_count = 0
        
        # 如果啟用 Vision，提取並分析圖片
        if vision_analyzer and vision_settings:
            try:
                # 提取圖片
                all_images = extract_images_from_page(page, idx)
                
                # 過濾重要圖片
                significant_images = filter_significant_images(
                    all_images,
                    min_width=vision_settings.get('min_image_width', 200),
                    min_height=vision_settings.get('min_image_height', 150),
                    min_size_kb=vision_settings.get('min_image_size_kb', 10.0),
                    max_count=vision_settings.get('max_images_per_page', 5)
                )
                
                if significant_images:
                    # 同步分析圖片（在 async 上下文中調用）
                    import asyncio
                    
                    # 如果在異步上下文中
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        # 如果沒有事件循環，創建一個
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    # 分析圖片
                    descriptions = loop.run_until_complete(
                        vision_analyzer.analyze_multiple_images(
                            significant_images,
                            context=text[:500],
                            page_number=idx
                        )
                    )
                    
                    # 將圖片描述添加到文字中
                    if descriptions:
                        text += "\n\n=== 頁面圖片內容 ===\n"
                        for i, desc in enumerate(descriptions, 1):
                            if desc and desc.strip():
                                text += f"\n[圖片 {i}]: {desc.strip()}\n"
                        image_count = len(descriptions)
                        
            except Exception as e:
                # Vision 分析失敗不應該影響整體處理
                pass
        
        pages.append(PageContent(
            page_number=idx,
            text=normalize_text(text),
            image_count=image_count
        ))
    
    doc.close()
    return pages


def parse_pages(
    path: str,
    extension: str,
    vision_analyzer=None,
    vision_settings: Optional[dict] = None
) -> List[PageContent]:
    """
    解析文檔頁面
    
    Args:
        path: 文檔路徑
        extension: 文件副檔名
        vision_analyzer: VisionAnalyzer 實例（可選）
        vision_settings: Vision 配置字典（可選）
        
    Returns:
        頁面內容列表
    """
    ext = extension.lower()
    if ext == ".pdf":
        pages = _parse_pdf(path, vision_analyzer, vision_settings)
    else:
        raise ValueError(f"不支援的副檔名: {ext}，目前僅支援 PDF 格式")

    return pages
