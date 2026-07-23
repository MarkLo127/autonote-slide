"""非同步任務管理（Phase 2：記憶體版；Phase 3 再換 SQLite 快取）。

上傳後立即回傳 doc_id，背景執行緒跑 pipeline 並更新進度，前端輪詢 /status、/result。
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from ..core.config import Settings
from .pipeline import run_pipeline


@dataclass
class Job:
    doc_id: str
    status: str = "queued"        # queued | processing | done | error
    progress: int = 0
    message: str = ""
    error: Optional[str] = None
    result: Optional[dict] = None


class JobManager:
    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self) -> Job:
        doc_id = uuid.uuid4().hex[:16]
        job = Job(doc_id=doc_id)
        with self._lock:
            self._jobs[doc_id] = job
        return job

    def get(self, doc_id: str) -> Optional[Job]:
        return self._jobs.get(doc_id)

    def run_async(self, job: Job, pdf_path: Path, settings: Settings,
                  do_summary: bool = True, do_translate: bool = True,
                  do_wordcloud: bool = True, do_report: bool = True,
                  cache_key: str | None = None) -> None:
        """在背景執行緒跑 pipeline，逐事件更新 job 狀態；完成後寫入快取。"""
        def _worker():
            job.status = "processing"
            for event in run_pipeline(pdf_path, settings, do_summary, do_translate,
                                      do_wordcloud, do_report, doc_id=job.doc_id):
                job.progress = event.get("progress", job.progress)
                job.message = event.get("message", job.message)
                if event["type"] == "result":
                    job.result = event.get("data")
                    job.status = "done"
                    if job.result is not None:
                        from .store import get_store

                        get_store().finish(job.doc_id, job.result)
                        if cache_key:
                            from .cache import get_cache

                            get_cache().put(cache_key, job.result)
                elif event["type"] == "error":
                    job.error = event.get("message")
                    job.status = "error"
                    from .store import get_store

                    get_store().fail(job.doc_id, job.error or "error")

        threading.Thread(target=_worker, daemon=True).start()

    def seed_done(self, result: dict) -> Job:
        """快取命中：直接建立一個已完成的 job。"""
        job = self.create()
        job.status = "done"
        job.progress = 100
        job.message = "快取命中"
        job.result = result
        return job


manager = JobManager()
