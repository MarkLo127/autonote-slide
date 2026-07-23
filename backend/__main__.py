"""`python -m backend` 啟動 gateway。"""
from __future__ import annotations

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=bool(os.environ.get("RELOAD")),
    )
