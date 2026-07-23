"""API 資料模型（Pydantic）。"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class Mode(str, Enum):
    summary_first = "summary_first"
    translate_first = "translate_first"


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    error = "error"


class DocumentCreated(BaseModel):
    doc_id: str


class DocumentSummary(BaseModel):
    doc_id: str
    filename: str
    created_at: float
    status: str
    total_pages: int = 0
    has_report: bool = False
    error: Optional[str] = None


class StatusResponse(BaseModel):
    status: JobStatus
    progress: int = 0
    message: str = ""
    error: Optional[str] = None


class Segment(BaseModel):
    index: int
    original: str
    translated: Optional[str] = None
    summary: Optional[str] = None


class GlobalSummary(BaseModel):
    conclusion: str = ""
    data: str = ""
    risk: str = ""
    action: str = ""
    raw: str = ""


class ResultResponse(BaseModel):
    doc_id: str
    language: str = "en"
    total_pages: int = 0
    segments: list[Segment] = []
    global_summary: Optional[GlobalSummary] = None
    keywords: list[str] = []
    wordcloud_image_url: Optional[str] = None  # Phase 4
    report_pdf_url: Optional[str] = None        # Phase 4


class ProgressEvent(BaseModel):
    type: str  # "progress" | "result" | "error"
    progress: int = 0
    message: str = ""
    data: Optional[Any] = None
