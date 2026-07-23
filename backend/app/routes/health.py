"""健康檢查：含下游推理端點就緒狀態。"""
from __future__ import annotations

from fastapi import APIRouter

from ..core.config import settings
from ..services.llm import LLMClient

router = APIRouter()


@router.get("/healthz")
def healthz():
    status = {"service": "ok", "summarize_endpoint": settings.summarize_url}
    try:
        models = LLMClient(settings.summarize_url, settings.model).ping()
        status["summarize"] = "ok"
        status["models"] = models
    except Exception as e:  # noqa: BLE001
        status["summarize"] = f"unreachable: {e}"
    return status
