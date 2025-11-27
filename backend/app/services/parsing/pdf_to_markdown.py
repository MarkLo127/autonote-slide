"""PDF to Markdown converter service using pymupdf4llm.

This module provides functionality to convert PDF files to Markdown format,
preserving document structure for better LLM understanding.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

import pymupdf4llm

logger = logging.getLogger(__name__)


def convert_pdf_to_markdown(
    pdf_path: str,
    write_images: bool = True,
    image_path: Optional[str] = None,
    page_chunks: bool = True
) -> List[dict]:
    """
    將 PDF 轉換為 Markdown 格式
    
    Args:
        pdf_path: PDF 檔案路徑
        write_images: 是否儲存圖片到磁碟（預設 True）
        image_path: 圖片儲存路徑（可選，預設使用 PDF 同級目錄）
        page_chunks: 是否返回逐頁的字典列表（預設 True）
        
    Returns:
        頁面資料列表，每個元素包含:
        - page: 頁碼
        - text: Markdown 格式的內容
        - metadata: 頁面元數據（如果有）
        
    Raises:
        FileNotFoundError: PDF 檔案不存在
        Exception: PDF 轉換失敗
    """
    try:
        # 確認檔案存在
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF 檔案不存在: {pdf_path}")
        
        logger.info(f"開始轉換 PDF 到 Markdown: {pdf_path}")
        
        # 設定圖片儲存路徑
        if write_images and image_path is None:
            # 預設儲存在 PDF 同級目錄的 images 子目錄
            image_path = str(pdf_file.parent / "images")
        
        # 使用 pymupdf4llm 轉換
        # page_chunks=True 會返回每頁的字典列表
        result = pymupdf4llm.to_markdown(
            str(pdf_path),
            write_images=write_images,
            image_path=image_path,
            page_chunks=page_chunks
        )
        
        # 處理結果
        if page_chunks:
            # 返回格式: [{"page": 1, "text": "...", "metadata": {...}}, ...]
            pages = []
            for idx, chunk in enumerate(result, start=1):
                if isinstance(chunk, dict):
                    # pymupdf4llm 返回的字典格式
                    pages.append({
                        "page_number": chunk.get("page", idx),
                        "markdown": chunk.get("text", ""),
                        "metadata": chunk.get("metadata", {})
                    })
                else:
                    # 如果是字串格式（某些版本可能直接返回文字）
                    pages.append({
                        "page_number": idx,
                        "markdown": str(chunk),
                        "metadata": {}
                    })
            
            logger.info(f"成功轉換 {len(pages)} 頁 PDF 到 Markdown")
            return pages
        else:
            # 如果 page_chunks=False，返回整個文檔的 Markdown
            logger.info("成功轉換整個 PDF 到 Markdown")
            return [{
                "page_number": 1,
                "markdown": result,
                "metadata": {}
            }]
            
    except FileNotFoundError as e:
        logger.error(f"PDF 檔案不存在: {e}")
        raise
    except Exception as e:
        logger.error(f"PDF 轉 Markdown 失敗: {e}", exc_info=True)
        raise Exception(f"PDF 轉換失敗: {str(e)}") from e


def convert_pdf_to_markdown_simple(pdf_path: str) -> str:
    """
    簡化版本：將整個 PDF 轉換為單一 Markdown 字串
    
    Args:
        pdf_path: PDF 檔案路徑
        
    Returns:
        Markdown 格式的文字內容
        
    Raises:
        Exception: 轉換失敗
    """
    try:
        logger.info(f"簡化轉換 PDF 到 Markdown: {pdf_path}")
        
        # 不儲存圖片，直接返回文字
        result = pymupdf4llm.to_markdown(
            pdf_path,
            write_images=False,
            page_chunks=False
        )
        
        logger.info("成功轉換 PDF 到 Markdown（簡化模式）")
        return result
        
    except Exception as e:
        logger.error(f"PDF 轉 Markdown 失敗（簡化模式）: {e}", exc_info=True)
        raise Exception(f"PDF 轉換失敗: {str(e)}") from e
