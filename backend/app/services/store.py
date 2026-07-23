"""文件歷史持久化（SQLite）。存每次分析的紀錄與結果，供列表、查看、刪除。

與 cache.py 不同：cache 依「內容 hash + 變體」去重運算；store 依 doc_id 記錄每次上傳，
是使用者可見的歷史。存 volume（storage/documents.db），重啟不掉。
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path


class DocumentStore:
    def __init__(self, db_path: str | Path):
        self.db_path = str(db_path)
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path, timeout=10)

    def _init(self) -> None:
        with self._conn() as c:
            c.execute(
                "CREATE TABLE IF NOT EXISTS documents ("
                "doc_id TEXT PRIMARY KEY, filename TEXT, created_at REAL, "
                "status TEXT, total_pages INTEGER DEFAULT 0, "
                "has_report INTEGER DEFAULT 0, result TEXT, error TEXT)"
            )

    def create(self, doc_id: str, filename: str) -> None:
        with self._conn() as c:
            c.execute(
                "INSERT OR REPLACE INTO documents(doc_id, filename, created_at, status) "
                "VALUES (?,?,?,?)",
                (doc_id, filename, time.time(), "processing"),
            )

    def finish(self, doc_id: str, result: dict) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE documents SET status='done', total_pages=?, has_report=?, result=? "
                "WHERE doc_id=?",
                (
                    int(result.get("total_pages", 0)),
                    1 if result.get("report_pdf_url") else 0,
                    json.dumps(result, ensure_ascii=False),
                    doc_id,
                ),
            )

    def fail(self, doc_id: str, error: str) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE documents SET status='error', error=? WHERE doc_id=?",
                (error, doc_id),
            )

    def get(self, doc_id: str) -> dict | None:
        with self._conn() as c:
            c.row_factory = sqlite3.Row
            row = c.execute("SELECT * FROM documents WHERE doc_id=?", (doc_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["result"] = json.loads(d["result"]) if d["result"] else None
        return d

    def list(self, limit: int = 200) -> list[dict]:
        """歷史清單（不含笨重的 result 欄位）。"""
        with self._conn() as c:
            c.row_factory = sqlite3.Row
            rows = c.execute(
                "SELECT doc_id, filename, created_at, status, total_pages, has_report, error "
                "FROM documents ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete(self, doc_id: str) -> bool:
        with self._conn() as c:
            cur = c.execute("DELETE FROM documents WHERE doc_id=?", (doc_id,))
            return cur.rowcount > 0


_store: DocumentStore | None = None


def get_store() -> DocumentStore:
    global _store
    if _store is None:
        from ..core.config import settings

        _store = DocumentStore(settings.storage_dir / "documents.db")
    return _store
