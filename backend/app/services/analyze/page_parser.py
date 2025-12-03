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


def _parse_pdf(path: str, vision_analyzer=None, vision_settings=None, use_markdown: bool = True) -> List[PageContent]:
    """
    解析 PDF，可選擇性使用 Markdown 轉換和 Vision API 分析圖片
    
    Args:
        path: PDF 檔案路徑
        vision_analyzer: VisionAnalyzer 實例（可選）
        vision_settings: Vision 配置（從 LLMSettings 提取）
        use_markdown: 是否使用 Markdown 轉換（預設 True）
        
    Returns:
        頁面內容列表
    """
    import fitz  # PyMuPDF
    import logging
    
    logger = logging.getLogger(__name__)
    pages: List[PageContent] = []
    
    # 嘗試使用 Markdown 轉換
    markdown_pages = {}
    if use_markdown:
        try:
            # 檢查使用哪個 PDF 解析引擎
            from backend.app.core.config import PDF_PARSER_ENGINE
            
            parser_engine = PDF_PARSER_ENGINE.lower()
            logger.info(f"使用 PDF 解析引擎: {parser_engine}")
            
            # 根據配置選擇解析引擎
            if parser_engine == "marker":
                # 嘗試使用 Marker 轉換
                try:
                    from backend.app.services.parsing.marker_converter import (
                        convert_pdf_to_markdown_marker,
                        is_marker_available
                    )
                    
                    if not is_marker_available():
                        logger.warning("Marker 未安裝，降級使用 pymupdf4llm")
                        raise ImportError("Marker not available")
                    
                    logger.info(f"正在使用 Marker 將 PDF 轉換為 Markdown: {path}")
                    md_result = convert_pdf_to_markdown_marker(
                        pdf_path=path,
                        extract_images=False,  # 不儲存圖片，Vision 會處理
                    )
                    # 建立頁碼到 Markdown 的映射
                    for page_data in md_result:
                        page_num = page_data.get("page_number", 0)
                        markdown_pages[page_num] = page_data.get("markdown", "")
                    logger.info(f"Marker 成功轉換 {len(markdown_pages)} 頁 PDF")
                    
                except Exception as e:
                    # Marker 失敗時降級到 pymupdf4llm
                    logger.warning(f"Marker 轉換失敗，降級使用 pymupdf4llm: {e}")
                    parser_engine = "pymupdf4llm"
            
            # 使用 pymupdf4llm（預設或降級）
            if parser_engine == "pymupdf4llm":
                from backend.app.services.parsing.pdf_to_markdown import convert_pdf_to_markdown
                logger.info(f"正在使用 pymupdf4llm 將 PDF 轉換為 Markdown: {path}")
                md_result = convert_pdf_to_markdown(
                    pdf_path=path,
                    write_images=False,  # 不儲存圖片，因為 Vision 會處理
                    page_chunks=True     # 逐頁轉換
                )
                # 建立頁碼到 Markdown 的映射
                for page_data in md_result:
                    page_num = page_data.get("page_number", 0)
                    markdown_pages[page_num] = page_data.get("markdown", "")
                logger.info(f"pymupdf4llm 成功轉換 {len(markdown_pages)} 頁 PDF")
                
        except Exception as e:
            logger.warning(f"Markdown 轉換失敗，將使用原始文字提取: {e}")
            markdown_pages = {}

    
    doc = fitz.open(path)
    
    for idx, page in enumerate(doc, start=1):
        # 優先使用 Markdown 內容，否則使用原始文字
        if idx in markdown_pages and markdown_pages[idx].strip():
            text = markdown_pages[idx]
            logger.debug(f"第 {idx} 頁使用 Markdown 內容")
        else:
            try:
                text = page.get_text() or ""
                logger.debug(f"第 {idx} 頁使用原始文字提取")
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
                logger.warning(f"第 {idx} 頁圖片分析失敗: {e}")
        
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
