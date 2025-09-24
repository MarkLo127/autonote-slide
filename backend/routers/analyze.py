from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from ..services.parsers import extract_text
from ..services.llm import OpenAIChatClient
from ..services.mindmap import build_mindmap_from_outline
from ..schemas import AnalyzeResponse

router = APIRouter(tags=["analyze"])

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(..., description="上傳 PDF / DOCX / TXT / MD 檔案"),
    api_key: str = Form(..., description="LLM API Key (必填)"),
    base_url: Optional[str] = Form(None, description="可選的 OpenAI 相容 base URL"),
    model: Optional[str] = Form("gpt-4o-mini", description="模型名稱，可自訂"),
    language: Optional[str] = Form("zh", description="輸出語言：zh 或 en"),
):
    # 1) 安全檢查
    if not api_key:
        raise HTTPException(status_code=422, detail="api_key 是必填項")
    if not file.filename:
        raise HTTPException(status_code=400, detail="請提供檔案")

    # 2) 讀檔 & 擷取純文字
    try:
        raw_bytes = await file.read()
        text = extract_text(raw_bytes, file.filename, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"讀檔失敗: {e}")
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="未能從檔案中擷取有效文字")

    # 3) LLM 處理
    client = OpenAIChatClient(api_key=api_key, base_url=base_url, model=model)

    try:
        summary = client.summarize(text, language=language)
        keywords = client.keywords(text, language=language)
        outline = client.outline(text, language=language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 呼叫失敗: {e}")

    # 4) 產生 Mindmap（Mermaid + JSON）
    mindmap = build_mindmap_from_outline(outline, language=language)

    return JSONResponse(
        content={
            "summary": summary,
            "keywords": keywords,
            "mindmap": mindmap,
        }
    )


