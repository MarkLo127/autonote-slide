"""文件 API：上傳 → (串流 | 非同步輪詢) → 結果；歷史列表 / 查看 / 刪除。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from ..core.config import settings
from ..models.schemas import DocumentCreated, DocumentSummary, ResultResponse, StatusResponse
from ..services.cache import get_cache
from ..services.jobs import manager
from ..services.pipeline import run_pipeline
from ..services.store import get_store

router = APIRouter()


def _save_upload(file: UploadFile) -> tuple[str, Path]:
    raw = file.file.read()
    if not raw:
        raise HTTPException(400, "空檔案")
    if len(raw) > settings.max_body_mb * 1024 * 1024:
        raise HTTPException(413, f"檔案超過 {settings.max_body_mb}MB 上限")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(415, "僅支援 PDF")

    digest = hashlib.sha256(raw).hexdigest()[:16]
    upload_dir = settings.storage_dir / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / f"{digest}.pdf"
    path.write_bytes(raw)
    return digest, path


@router.post("/documents")
def create_document(
    file: UploadFile = File(...),
    features: str = Form("summary,translate,wordcloud,report"),
    stream: int = Query(0, description="1=直接回 NDJSON 串流；0=回 doc_id 供輪詢"),
    refresh: int = Query(0, description="1=略過快取、強制重新分析並覆寫結果"),
):
    do_summary = "summary" in features
    do_translate = "translate" in features
    do_wordcloud = "wordcloud" in features
    do_report = "report" in features
    filename = file.filename or "document.pdf"
    digest, path = _save_upload(file)

    cache = get_cache()
    store = get_store()
    cache_key = cache.make_key(digest, settings.translator, settings.target_lang, features)
    cached = None if refresh else cache.get(cache_key)

    if stream:
        job = manager.create()  # 串流也給 doc_id，供報告下載
        store.create(job.doc_id, filename)

        def gen():
            if cached is not None:
                job.result = cached
                job.status = "done"
                store.finish(job.doc_id, cached)
                yield json.dumps({"type": "result", "progress": 100,
                                  "message": "快取命中", "data": cached}, ensure_ascii=False) + "\n"
                return
            for event in run_pipeline(path, settings, do_summary, do_translate,
                                      do_wordcloud, do_report, doc_id=job.doc_id):
                if event["type"] == "result" and event.get("data") is not None:
                    job.result = event["data"]
                    job.status = "done"
                    cache.put(cache_key, job.result)
                    store.finish(job.doc_id, job.result)
                elif event["type"] == "error":
                    store.fail(job.doc_id, event.get("message", "error"))
                yield json.dumps(event, ensure_ascii=False) + "\n"

        return StreamingResponse(gen(), media_type="application/x-ndjson")

    if cached is not None:
        job = manager.seed_done(cached)
        store.create(job.doc_id, filename)
        store.finish(job.doc_id, cached)
        return DocumentCreated(doc_id=job.doc_id)

    job = manager.create()
    store.create(job.doc_id, filename)
    manager.run_async(job, path, settings, do_summary, do_translate,
                      do_wordcloud, do_report, cache_key=cache_key)
    return DocumentCreated(doc_id=job.doc_id)


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents():
    """歷史清單（新到舊）。"""
    return [DocumentSummary(**r) for r in get_store().list()]


@router.get("/documents/{doc_id}/status", response_model=StatusResponse)
def get_status(doc_id: str):
    job = manager.get(doc_id)
    if job:  # 進行中或本次 session 的即時狀態
        return StatusResponse(status=job.status, progress=job.progress,
                              message=job.message, error=job.error)
    rec = get_store().get(doc_id)  # 過去的（含重啟後）
    if not rec:
        raise HTTPException(404, "查無此 doc_id")
    prog = 100 if rec["status"] == "done" else 0
    return StatusResponse(status=rec["status"], progress=prog,
                          message=rec["status"], error=rec.get("error"))


@router.get("/documents/{doc_id}/result", response_model=ResultResponse)
def get_result(doc_id: str):
    job = manager.get(doc_id)
    if job and job.result is not None:
        return ResultResponse(doc_id=doc_id, **job.result)
    rec = get_store().get(doc_id)  # 從持久化歷史讀
    if not rec:
        raise HTTPException(404, "查無此 doc_id")
    if rec["status"] == "error":
        raise HTTPException(500, rec.get("error") or "處理失敗")
    if rec["status"] != "done" or not rec.get("result"):
        raise HTTPException(409, f"尚未完成（status={rec['status']}）")
    return ResultResponse(doc_id=doc_id, **rec["result"])


@router.get("/documents/{doc_id}/report.pdf")
def get_report(doc_id: str):
    path = settings.storage_dir / "reports" / f"{doc_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "報告尚未產生或不存在")
    return FileResponse(str(path), media_type="application/pdf", filename=f"{doc_id}.pdf")


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """刪除歷史紀錄與其 PDF 報告。"""
    ok = get_store().delete(doc_id)
    if not ok:
        raise HTTPException(404, "查無此 doc_id")
    report = settings.storage_dir / "reports" / f"{doc_id}.pdf"
    report.unlink(missing_ok=True)
    return {"deleted": doc_id}
