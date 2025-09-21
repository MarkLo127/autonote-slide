# backend/app/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, uuid, json

from .config import settings
from .services.convert import convert_to_pdf
from .services.pdf_text import extract_paragraphs
from .services.summarize import make_summary
from .services.keywords import make_keywords
from .services.slides import make_slides
from .services.mindmap import make_mindmap
from .services.utils import save_upload, write_json, bundle_zip, job_dir
from .services.ai import set_request_llm

app = FastAPI(title="AI Agent Backend", version="1.0.0")

# ====== CORS ======
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # 允許自訂 Headers
)

# ====== 讓前端以 Header 傳入 LLM Key/BaseURL（每請求套用）======
@app.middleware("http")
async def llm_header_middleware(request: Request, call_next):
    api_key = request.headers.get("X-LLM-API-Key")
    base_url = request.headers.get("X-LLM-Base-Url") or request.headers.get("X-LLM-Base-URL")
    set_request_llm(api_key, base_url)
    return await call_next(request)

# ====== Schemas ======
class ProcessResponse(BaseModel):
    job_id: str
    pdf_path: str
    mapping_json: str
    summary_json: str
    keywords_json: str
    slides_pptx: str
    slides_pdf: str
    mindmap_pdf: str
    bundle_zip: str

class SummarizeIn(BaseModel):
    job_id: str
    pdf_path: str

class KeywordsIn(BaseModel):
    job_id: str
    pdf_path: str
    mapping_json: str

class SlidesIn(BaseModel):
    job_id: str
    summary_json: str

class MindmapIn(BaseModel):
    job_id: str
    summary_json: str
    keywords_json: str

# 小工具：相容 query/form/json 三種輸入
async def _coerce_json(request: Request) -> dict:
    data = {}
    # 1) JSON
    try:
        data = await request.json()
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    # 2) FORM
    try:
        form = await request.form()
        if form:
            return dict(form)
    except Exception:
        pass
    # 3) QUERY
    return dict(request.query_params)

# ====== Endpoints ======
@app.get("/health")
def health():
    return {"ok": True, "model": settings.LLM_MODEL, "base_url": settings.LLM_BASE_URL or "openai-default"}

@app.post("/convert")
async def api_convert(file: UploadFile = File(...)):
    jid = str(uuid.uuid4())[:8]
    outdir = job_dir(jid)
    os.makedirs(outdir, exist_ok=True)
    src_path = await save_upload(file, outdir)
    pdf_path = convert_to_pdf(src_path, outdir)
    return {"job_id": jid, "pdf_path": pdf_path}

@app.post("/summarize")
async def api_summarize(request: Request):
    data = await _coerce_json(request)
    if not data.get("job_id") or not data.get("pdf_path"):
        raise HTTPException(status_code=422, detail="job_id and pdf_path are required")
    job_id = data["job_id"]
    pdf_path = data["pdf_path"]

    paras, mapping = extract_paragraphs(pdf_path)
    summary = make_summary(paras)
    map_path = os.path.join(job_dir(job_id), "paragraphs.json")
    sum_path = os.path.join(job_dir(job_id), "summary.json")
    write_json(map_path, mapping)
    write_json(sum_path, summary)
    return {"job_id": job_id, "mapping_json": map_path, "summary_json": sum_path}

@app.post("/keywords")
async def api_keywords(request: Request):
    data = await _coerce_json(request)
    for k in ("job_id", "pdf_path", "mapping_json"):
        if not data.get(k):
            raise HTTPException(status_code=422, detail=f"{k} is required")
    job_id = data["job_id"]
    mapping_json = data["mapping_json"]

    with open(mapping_json, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    paras = [p["text"] for p in mapping["items"]]
    kw = make_keywords(paras)
    kw_path = os.path.join(job_dir(job_id), "keywords.json")
    write_json(kw_path, kw)
    return {"job_id": job_id, "keywords_json": kw_path}

@app.post("/slides")
async def api_slides(request: Request):
    data = await _coerce_json(request)
    for k in ("job_id", "summary_json"):
        if not data.get(k):
            raise HTTPException(status_code=422, detail=f"{k} is required")
    job_id = data["job_id"]
    summary_json = data["summary_json"]

    with open(summary_json, "r", encoding="utf-8") as f:
        summary = json.load(f)
    out_pptx = os.path.join(job_dir(job_id), "slides.pptx")
    out_pdf  = os.path.join(job_dir(job_id), "slides.pdf")
    make_slides(summary, out_pptx, out_pdf)
    return {"job_id": job_id, "slides_pptx": out_pptx, "slides_pdf": out_pdf}

@app.post("/mindmap")
async def api_mindmap(request: Request):
    data = await _coerce_json(request)
    for k in ("job_id", "summary_json", "keywords_json"):
        if not data.get(k):
            raise HTTPException(status_code=422, detail=f"{k} is required")
    job_id = data["job_id"]
    summary_json = data["summary_json"]
    keywords_json = data["keywords_json"]

    with open(summary_json, "r", encoding="utf-8") as f:
        summary = json.load(f)
    with open(keywords_json, "r", encoding="utf-8") as f:
        kw = json.load(f)
    out_pdf = os.path.join(job_dir(job_id), "mindmap.pdf")
    make_mindmap(summary, kw, out_pdf)
    return {"job_id": job_id, "mindmap_pdf": out_pdf}

@app.post("/process", response_model=ProcessResponse)
async def api_process(file: UploadFile = File(...)):
    jid = str(uuid.uuid4())[:8]
    outdir = job_dir(jid)
    os.makedirs(outdir, exist_ok=True)

    # 1) Save & Convert
    src_path = await save_upload(file, outdir)
    pdf_path = convert_to_pdf(src_path, outdir)

    # 2) Parse PDF → paragraphs + mapping
    paras, mapping = extract_paragraphs(pdf_path)
    map_path = os.path.join(outdir, "paragraphs.json")
    write_json(map_path, mapping)

    # 3) Summary
    summary = make_summary(paras)
    sum_path = os.path.join(outdir, "summary.json")
    write_json(sum_path, summary)

    # 4) Keywords
    kw = make_keywords(paras)
    kw_path = os.path.join(outdir, "keywords.json")
    write_json(kw_path, kw)

    # 5) Slides (pptx + pdf)
    slides_pptx = os.path.join(outdir, "slides.pptx")
    slides_pdf  = os.path.join(outdir, "slides.pdf")
    make_slides(summary, slides_pptx, slides_pdf)

    # 6) Mind map (pdf)
    mindmap_pdf = os.path.join(outdir, "mindmap.pdf")
    make_mindmap(summary, kw, mindmap_pdf)

    # 7) Bundle
    bundle_path = os.path.join(outdir, f"{jid}_bundle.zip")
    bundle_zip(outdir, bundle_path)

    return ProcessResponse(
        job_id=jid,
        pdf_path=pdf_path,
        mapping_json=map_path,
        summary_json=sum_path,
        keywords_json=kw_path,
        slides_pptx=slides_pptx,
        slides_pdf=slides_pdf,
        mindmap_pdf=mindmap_pdf,
        bundle_zip=bundle_path,
    )

@app.get("/download/{job_id}")
def download_bundle(job_id: str):
    outdir = job_dir(job_id)
    bundle = os.path.join(outdir, f"{job_id}_bundle.zip")
    if not os.path.exists(bundle):
        raise HTTPException(status_code=404, detail="Bundle not found")
    return FileResponse(bundle, media_type="application/zip", filename=f"{job_id}_bundle.zip")

@app.get("/file/{job_id}/{fname:path}")
def get_file(job_id: str, fname: str):
    base = job_dir(job_id)
    path = os.path.join(base, fname)
    if not os.path.abspath(path).startswith(os.path.abspath(base)) or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
