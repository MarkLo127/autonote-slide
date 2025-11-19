from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, PlainTextResponse
import os

from backend.app.routes import analyze, health
from backend.app.core.config import ASSETS_DIR, ASSETS_MOUNT, STATIC_DIR, STATIC_MOUNT

APP_VERSION = "1.0.0"


def _build_allowed_origins() -> list[str]:
    """Build CORS allow list from env.

    - ALLOWED_ORIGINS=*         -> ["*"]
    - ALLOWED_ORIGINS=a,b,c     -> ["a", "b", "c"]
    """
    raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


# ===== FastAPI Application =====
app = FastAPI(
    title="AutoNoteSlide API",
    description=(
        "AutoNote&Slide：支援 PDF 文件上傳，自動完成分頁摘要、"
        "全局重點彙整、關鍵字抽取、文字雲生成的文件分析 API 服務。\\n\\n"
        "此檔案負責：CORS 設定、靜態資源掛載與上傳大小限制 middleware。"  # 可在說明文件中作為系統架構的一部分介紹
    ),
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ===== CORS 設定 =====
allowed_origins = _build_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 靜態資源掛載 =====
if os.path.isdir(STATIC_DIR):
    app.mount(STATIC_MOUNT, StaticFiles(directory=STATIC_DIR), name="storage")

if os.path.isdir(ASSETS_DIR):
    # 字型與示意圖片等資源
    app.mount(ASSETS_MOUNT, StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/")
async def root() -> RedirectResponse:
    """導向 Swagger UI，方便開發與展示 API。"""
    return RedirectResponse("/docs")


# ===== 上傳大小限制 =====
_MAX_MB = int(os.getenv("MAX_BODY_MB", "50"))
MAX_BODY = _MAX_MB * 1024 * 1024  # bytes


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """簡單的上傳大小限制 middleware。

    若 content-length 超過 MAX_BODY，直接回傳 413。
    這段邏輯也可以在技術文件中當作「基本安全控制」的範例。
    """
    try:
        content_length = int(request.headers.get("content-length") or 0)
    except ValueError:
        content_length = 0

    if content_length > MAX_BODY:
        return PlainTextResponse(f"Payload too large (> {_MAX_MB} MB)", status_code=413)

    return await call_next(request)


# ===== 掛載路由 =====
app.include_router(health.router)
app.include_router(analyze.router)
