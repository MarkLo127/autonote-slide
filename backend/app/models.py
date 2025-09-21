from pydantic import BaseModel
from typing import List, Dict, Any

class Paragraph(BaseModel):
    page: int
    para: int
    text: str

class Mapping(BaseModel):
    items: List[Paragraph]

class SummaryPoint(BaseModel):
    title: str
    para_refs: List[Dict[str, int]]  # [{"page":1,"para":2}, ...]
    bullets: List[str]

class SummaryResult(BaseModel):
    language: str
    points: List[SummaryPoint]

class KeywordsResult(BaseModel):
    language: str
    global_keywords: List[str]
    per_paragraph: List[List[str]]  # index-aligned with paragraphs
