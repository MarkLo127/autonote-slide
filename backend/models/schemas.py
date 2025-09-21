from pydantic import BaseModel
from typing import List, Optional

class TextRequest(BaseModel):
    text: str
    # 可選：也能在 /api/summarize 時帶 LLM 覆蓋
    llm_baseurl: Optional[str] = None
    llm_apikey: Optional[str] = None
    llm_model: Optional[str] = None

class Theme(BaseModel):
    preset_name: Optional[str] = None
    ratio: Optional[str] = "16:9"
    bg_color: Optional[str] = None
    title_color: Optional[str] = None
    body_color: Optional[str] = None
    accent_color: Optional[str] = None
    title_font: Optional[str] = None
    body_font: Optional[str] = None
    title_size: Optional[int] = None
    body_size: Optional[int] = None
    logo_path: Optional[str] = None
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
