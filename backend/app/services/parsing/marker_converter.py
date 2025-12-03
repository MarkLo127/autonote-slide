"""Marker PDF to Markdown converter service.

This module provides high-accuracy PDF to Markdown conversion using the Marker library,
with enhanced support for tables, images, mathematical formulas, and complex layouts.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

# Lazy import Marker to avoid loading models at import time
_marker_models = None


def _get_marker_models():
    """Lazy load Marker models to improve startup time."""
    global _marker_models
    if _marker_models is None:
        try:
            from marker.models import load_all_models
            logger.info("Loading Marker models (this may take a while on first run)...")
            _marker_models = load_all_models()
            logger.info("Marker models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Marker models: {e}", exc_info=True)
            raise RuntimeError(f"Marker models loading failed: {str(e)}") from e
    return _marker_models


def convert_pdf_to_markdown_marker(
    pdf_path: str,
    image_path: Optional[str] = None,
    extract_images: bool = True,
    use_gpu: bool = False,
) -> List[dict]:
    """
    使用 Marker 將 PDF 轉換為 Markdown 格式
    
    Marker 提供更高精度的轉換，特別適合：
    - 包含複雜表格的文檔
    - 包含數學公式的科學論文
    - 包含圖表和圖片的報告
    
    Args:
        pdf_path: PDF 檔案路徑
        image_path: 圖片儲存路徑（可選）
        extract_images: 是否提取並儲存圖片（預設 True）
        use_gpu: 是否使用 GPU 加速（預設 False）
        
    Returns:
        頁面資料列表，每個元素包含:
        - page_number: 頁碼
        - markdown: Markdown 格式的內容
        - metadata: 頁面元數據
        
    Raises:
        FileNotFoundError: PDF 檔案不存在
        RuntimeError: Marker 模型載入失敗
        Exception: PDF 轉換失敗
    """
    try:
        # 確認檔案存在
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            raise FileNotFoundError(f"PDF 檔案不存在: {pdf_path}")
        
        logger.info(f"開始使用 Marker 轉換 PDF: {pdf_path}")
        
        # 設定圖片儲存路徑
        if extract_images and image_path is None:
            image_path = str(pdf_file.parent / "images")
        
        # 確保圖片目錄存在
        if extract_images and image_path:
            os.makedirs(image_path, exist_ok=True)
        
        # 載入 Marker 模型
        try:
            models = _get_marker_models()
        except Exception as e:
            logger.error(f"Marker 模型載入失敗，無法使用 Marker 進行轉換: {e}")
            raise RuntimeError(f"Marker 不可用: {str(e)}") from e
        
        # 執行轉換
        try:
            from marker.convert import convert_single_pdf
            
            # convert_single_pdf 返回: (full_text, images, metadata)
            full_text, images_dict, out_meta = convert_single_pdf(
                str(pdf_path),
                models,
                max_pages=None,  # 轉換所有頁面
                langs=None,  # 自動偵測語言
                batch_multiplier=1,
            )
            
            logger.info(f"Marker 轉換完成，提取了 {len(images_dict)} 張圖片")
            
            # 儲存圖片
            if extract_images and image_path and images_dict:
                _save_extracted_images(images_dict, image_path)
            
            # 解析成逐頁格式
            pages = _parse_markdown_to_pages(full_text, out_meta)
            
            logger.info(f"成功使用 Marker 轉換 {len(pages)} 頁 PDF")
            return pages
            
        except Exception as e:
            logger.error(f"Marker 轉換執行失敗: {e}", exc_info=True)
            raise Exception(f"Marker PDF 轉換失敗: {str(e)}") from e
            
    except FileNotFoundError as e:
        logger.error(f"PDF 檔案不存在: {e}")
        raise
    except RuntimeError as e:
        # Marker 不可用的情況
        logger.error(f"Marker 運行時錯誤: {e}")
        raise
    except Exception as e:
        logger.error(f"PDF 轉 Markdown 失敗（Marker）: {e}", exc_info=True)
        raise Exception(f"PDF 轉換失敗: {str(e)}") from e


def _save_extracted_images(images_dict: Dict[str, Any], image_path: str) -> None:
    """儲存 Marker 提取的圖片到指定目錄。
    
    Args:
        images_dict: Marker 返回的圖片字典
        image_path: 圖片儲存目錄
    """
    try:
        from PIL import Image
        import io
        
        os.makedirs(image_path, exist_ok=True)
        
        for img_name, img_data in images_dict.items():
            try:
                # Marker 返回的圖片可能是 PIL Image 或 bytes
                if isinstance(img_data, bytes):
                    img = Image.open(io.BytesIO(img_data))
                else:
                    img = img_data
                
                # 儲存圖片
                img_save_path = os.path.join(image_path, img_name)
                img.save(img_save_path)
                logger.debug(f"已儲存圖片: {img_save_path}")
                
            except Exception as e:
                logger.warning(f"儲存圖片 {img_name} 失敗: {e}")
                
    except Exception as e:
        logger.error(f"批次儲存圖片失敗: {e}", exc_info=True)


def _parse_markdown_to_pages(markdown_text: str, metadata: Dict) -> List[dict]:
    """將 Marker 返回的完整 Markdown 文本解析為逐頁格式。
    
    Marker 預設返回整份文檔的 Markdown，這個函數將其分割為逐頁格式
    以匹配現有系統的資料結構。
    
    Args:
        markdown_text: 完整的 Markdown 文本
        metadata: Marker 返回的元數據
        
    Returns:
        頁面資料列表
    """
    try:
        # Marker 在 Markdown 中使用 "---" 分隔頁面
        # 或者我們可以根據內容長度平均分配
        
        # 檢查元數據中是否有頁數資訊
        total_pages = metadata.get('pages', 1) if metadata else 1
        
        # 嘗試按分隔符分割
        page_separators = ['\n---\n', '\n***\n', '\n___\n']
        pages_content = None
        
        for separator in page_separators:
            if separator in markdown_text:
                pages_content = markdown_text.split(separator)
                break
        
        # 如果沒有找到分隔符，將整個文本作為單一內容，並根據長度估算分頁
        if not pages_content or len(pages_content) == 1:
            # 估算每頁長度並分割
            avg_chars_per_page = len(markdown_text) // max(total_pages, 1)
            if avg_chars_per_page > 0 and total_pages > 1:
                pages_content = []
                for i in range(total_pages):
                    start = i * avg_chars_per_page
                    end = (i + 1) * avg_chars_per_page if i < total_pages - 1 else len(markdown_text)
                    pages_content.append(markdown_text[start:end])
            else:
                pages_content = [markdown_text]
        
        # 構建頁面資料
        pages = []
        for idx, content in enumerate(pages_content, start=1):
            pages.append({
                "page_number": idx,
                "markdown": content.strip(),
                "metadata": {
                    "source": "marker",
                    "total_pages": len(pages_content)
                }
            })
        
        return pages
        
    except Exception as e:
        logger.error(f"解析 Markdown 為頁面格式失敗: {e}", exc_info=True)
        # 降級：返回整個文本作為單一頁面
        return [{
            "page_number": 1,
            "markdown": markdown_text,
            "metadata": {"source": "marker", "parse_error": str(e)}
        }]


def is_marker_available() -> bool:
    """檢查 Marker 是否可用。
    
    Returns:
        True 如果 Marker 可以使用，False 否則
    """
    try:
        import marker
        return True
    except ImportError:
        return False
