from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.analyze import router as analyze_router

app = FastAPI(title="AI Agent Backend", version="0.1.0")

# CORS (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True}

# Mount main router
app.include_router(analyze_router, prefix="/api")