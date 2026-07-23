"""FastAPI 應用入口 — PDF 摘要+翻譯 gateway（完全本地、無 API Key）。"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routes import documents, health

app = FastAPI(title="AutoNote PDF 摘要+翻譯 Gateway", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(documents.router)


@app.get("/")
def root():
    return {
        "service": "autonote-gateway",
        "version": "2.0.0",
        "mode": "local-only",
        "translator": settings.translator,
        "target_lang": settings.target_lang,
    }
