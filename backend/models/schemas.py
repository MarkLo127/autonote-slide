from pydantic import BaseModel
from typing import List, Optional

class TextRequest(BaseModel):
    text: str

class Theme(BaseModel):
    # 預設主題名稱（可不填，若提供將先載入預設，再用下面欄位覆蓋）
    preset_name: Optional[str] = None
    # 版面比例："16:9" 或 "4:3"
    ratio: Optional[str] = "16:9"
    # 色彩（HEX）
    bg_color: Optional[str] = None        # 背景，例如 "#0B1221"
    title_color: Optional[str] = None
    body_color: Optional[str] = None
    accent_color: Optional[str] = None
    # 字型與大小
    title_font: Optional[str] = None
    body_font: Optional[str] = None
    title_size: Optional[int] = None      # pt
    body_size: Optional[int] = None       # pt
    # 其他裝飾
    logo_path: Optional[str] = None       # 可放在 storage/assets/ 下
    footer_text: Optional[str] = None
    bg_image_path: Optional[str] = None

class SlideRequest(BaseModel):
    title: Optional[str] = None
    points: List[str]
    theme: Optional[Theme] = None

class Paragraph(BaseModel):
    id: str
    page: int
    text: str

class ProcessResult(BaseModel):
    ok: bool
    pdf_path: str
    paragraphs: List[Paragraph]
    summary: dict
    keywords: dict
    slides_pptx_path: str
    slides_pdf_path: str
