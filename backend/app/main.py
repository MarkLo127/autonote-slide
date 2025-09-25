from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.routes import analyze, health
from backend.app.core.config import STATIC_MOUNT, STATIC_DIR

app = FastAPI(title="Doc Insight API", version="0.1.0")

# CORS（必要時改成你的前端網域）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 對外提供 /static → storage/
app.mount(STATIC_MOUNT, StaticFiles(directory=STATIC_DIR), name="static")

# 掛載路由
app.include_router(health.router)
app.include_router(analyze.router)
