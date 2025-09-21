from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from models.schemas import ProcessResult, SlideRequest, TextRequest
from services.convert import save_upload, convert_to_pdf
from services.read_pdf import read_pdf_to_paragraphs
from services.summarize import make_summary
from services.keywords import make_keywords
from services.slides import make_slides, list_theme_presets
from utils.paths import ensure_dirs, outputs_dir

app = FastAPI(title="AI Doc Agent Backend", version="1.1.0")

# 靜態檔案：讓前端可直接取用輸出
app.mount("/outputs", StaticFiles(directory=str(outputs_dir)), name="outputs")

@app.on_event("startup")
def _startup():
    ensure_dirs()

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    saved_path = save_upload(file)
    return {"ok": True, "saved_path": str(saved_path)}

@app.post("/api/convert")
async def convert(file: UploadFile = File(None), path: str = Form(None)):
    if file is not None:
        src = save_upload(file)
    elif path:
        src = Path(path)
    else:
        return JSONResponse({"ok": False, "error": "no file or path"}, status_code=400)
    pdf_path = convert_to_pdf(src)
    return {"ok": True, "pdf_path": str(pdf_path)}

@app.post("/api/summarize", response_model=dict)
async def summarize(req: TextRequest):
    summary = make_summary(req.text)
    return {"ok": True, "summary": summary}

@app.post("/api/keywords", response_model=dict)
async def keywords(req: TextRequest):
    kws = make_keywords(req.text)
    return {"ok": True, "keywords": kws}

@app.get("/api/themes")
async def themes():
    """列出可用預設主題名稱與摘要（給前端做下拉選單）。"""
    return {"ok": True, "presets": list_theme_presets()}

@app.post("/api/slides", response_model=dict)
async def slides(req: SlideRequest):
    pptx_path, pdf_path = make_slides(
        req.title or "Auto Slides",
        req.points,
        preset_name=req.theme.preset_name if req.theme else None,
        theme_overrides=(req.theme.dict() if req.theme else None)
    )
    return {"ok": True, "pptx_path": str(pptx_path), "pdf_path": str(pdf_path)}

@app.post("/api/process", response_model=ProcessResult)
async def process(
    file: UploadFile = File(None),
    path: str = Form(None),
    theme_preset: str = Form(None),
    footer_text: str = Form(None)
):
    # 1) 取得來源
    if file is not None:
        src = save_upload(file)
    elif path:
        src = Path(path)
    else:
        return JSONResponse({"ok": False, "error": "no file or path"}, status_code=400)

    # 2) 轉 PDF
    pdf_path = convert_to_pdf(src)

    # 3) 讀取 PDF（含必要時 OCR）
    doc = read_pdf_to_paragraphs(pdf_path)

    # 4) 摘要 & 關鍵字
    summary = make_summary(doc["full_text"], paragraphs=doc["paragraphs"])  # 附段落幫助回標
    keywords = make_keywords(doc["full_text"], paragraphs=doc["paragraphs"])  # 同上

    # 5) 產生簡報（以摘要重點為主），可指定主題
    points = [s.get("point") if isinstance(s, dict) else str(s) for s in summary.get("points", [])]
    overrides = {"footer_text": footer_text} if footer_text else None
    pptx_path, slides_pdf_path = make_slides(
        "Auto Slides", points, preset_name=theme_preset, theme_overrides=overrides
    )

    return {
        "ok": True,
        "pdf_path": str(pdf_path),
        "paragraphs": doc["paragraphs"],
        "summary": summary,
        "keywords": keywords,
        "slides_pptx_path": str(pptx_path),
        "slides_pdf_path": str(slides_pdf_path)
    }
