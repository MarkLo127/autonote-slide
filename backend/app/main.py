from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, uuid, shutil, json

from .config import settings
from .services.convert import convert_to_pdf
from .services.pdf_text import extract_paragraphs
from .services.summarize import make_summary
from .services.keywords import make_keywords
from .services.slides import make_slides
from .services.mindmap import make_mindmap
from .services.utils import save_upload, write_json, bundle_zip, job_dir
from .services.ai import set_request_llm
from starlette.requests import Request

app = FastAPI(title="AI Agent Backend", version="1.0.0")

@app.middleware("http")
async def llm_header_middleware(request: Request, call_next):
    api_key = request.headers.get("X-LLM-API-Key")
    base_url = request.headers.get("X-LLM-Base-Url")
    set_request_llm(api_key, base_url)
    resp = await call_next(request)
    return resp

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def api_summarize(job_id: str, pdf_path: str):
    paras, mapping = extract_paragraphs(pdf_path)
    summary = make_summary(paras)
    map_path = os.path.join(job_dir(job_id), "paragraphs.json")
    sum_path = os.path.join(job_dir(job_id), "summary.json")
    write_json(map_path, mapping)
    write_json(sum_path, summary)
    return {"job_id": job_id, "mapping_json": map_path, "summary_json": sum_path}

@app.post("/keywords")
def api_keywords(job_id: str, pdf_path: str, mapping_json: str):
    with open(mapping_json, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    paras = [p["text"] for p in mapping["items"]]
    kw = make_keywords(paras)
    kw_path = os.path.join(job_dir(job_id), "keywords.json")
    write_json(kw_path, kw)
    return {"job_id": job_id, "keywords_json": kw_path}

@app.post("/slides")
def api_slides(job_id: str, summary_json: str):
    with open(summary_json, "r", encoding="utf-8") as f:
        summary = json.load(f)
    out_pptx = os.path.join(job_dir(job_id), "slides.pptx")
    out_pdf  = os.path.join(job_dir(job_id), "slides.pdf")
    make_slides(summary, out_pptx, out_pdf)
    return {"job_id": job_id, "slides_pptx": out_pptx, "slides_pdf": out_pdf}

@app.post("/mindmap")
def api_mindmap(job_id: str, summary_json: str, keywords_json: str):
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
    # 自動判斷 mime（瀏覽器下載）
    return FileResponse(path)
