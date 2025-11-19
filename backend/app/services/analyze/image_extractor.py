"""圖片提取工具 - 從 PDF 頁面提取圖片並進行基本過濾"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import fitz  # PyMuPDF


@dataclass
class ExtractedImage:
    """提取的圖片資訊"""
    page_number: int
    image_index: int
    image_bytes: bytes
    width: int
    height: int
    size_kb: float
    
    def is_significant(
        self,
        min_width: int = 200,
        min_height: int = 150,
        min_size_kb: float = 10.0
    ) -> bool:
        """
        判斷是否為重要圖片（非小圖示）
        
        Args:
            min_width: 最小寬度（像素）
            min_height: 最小高度（像素）
            min_size_kb: 最小檔案大小（KB）
            
        Returns:
            True 如果圖片符合重要性標準
        """
        return (
            self.width >= min_width and
            self.height >= min_height and
            self.size_kb >= min_size_kb
        )


def extract_images_from_page(page: fitz.Page, page_number: int) -> List[ExtractedImage]:
    """
    從 PDF 頁面提取所有圖片
    
    Args:
        page: PyMuPDF 頁面對象
        page_number: 頁碼（1-indexed）
        
    Returns:
        提取的圖片列表
    """
    images = []
    
    try:
        image_list = page.get_images()
    except Exception:
        return images
    
    for img_index, img in enumerate(image_list):
        try:
            xref = img[0]
            base_image = page.parent.extract_image(xref)
            
            if not base_image:
                continue
            
            img_bytes = base_image["image"]
            width = base_image.get("width", 0)
            height = base_image.get("height", 0)
            
            images.append(ExtractedImage(
                page_number=page_number,
                image_index=img_index,
                image_bytes=img_bytes,
                width=width,
                height=height,
                size_kb=len(img_bytes) / 1024
            ))
        except Exception:
            # 某些圖片可能無法提取，跳過
            continue
    
    return images


def filter_significant_images(
    images: List[ExtractedImage],
    min_width: int = 200,
    min_height: int = 150,
    min_size_kb: float = 10.0,
    max_count: int = 5
) -> List[ExtractedImage]:
    """
    過濾出重要的圖片
    
    Args:
        images: 所有提取的圖片
        min_width: 最小寬度
        min_height: 最小高度
        min_size_kb: 最小檔案大小
        max_count: 最多保留幾張圖片
        
    Returns:
        過濾後的重要圖片列表
    """
    significant = [
        img for img in images
        if img.is_significant(min_width, min_height, min_size_kb)
    ]
    
    # 按圖片大小排序（大圖優先）
    significant.sort(key=lambda x: x.size_kb, reverse=True)
    
    return significant[:max_count]
