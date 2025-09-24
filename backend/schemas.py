from pydantic import BaseModel
from typing import List, Dict

class Mindmap(BaseModel):
    root: Dict
    mermaid: str

class AnalyzeResponse(BaseModel):
    summary: str
    keywords: List[str]
    mindmap: Mindmap