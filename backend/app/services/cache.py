"""結果快取（SQLite，依 PDF hash + 變體去重）。Phase 3。

同一份 PDF 且同樣的翻譯器/語向/功能組合，直接回傳既有結果，免重算。
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path


class ResultCache:
    def __init__(self, db_path: str | Path):
        self.db_path = str(db_path)
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _conn(self) -> sqlite3.Connection:
        # 每次操作開新連線，避免跨執行緒共用問題
        return sqlite3.connect(self.db_path, timeout=10)

    def _init(self) -> None:
        with self._conn() as c:
            c.execute(
                "CREATE TABLE IF NOT EXISTS result_cache ("
                "key TEXT PRIMARY KEY, result TEXT NOT NULL, created_at REAL NOT NULL)"
            )

    @staticmethod
    def make_key(pdf_hash: str, translator: str, target_lang: str, features: str) -> str:
        feats = ",".join(sorted(f.strip() for f in features.split(",") if f.strip()))
        return f"{pdf_hash}|{translator}|{target_lang}|{feats}"

    def get(self, key: str) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT result FROM result_cache WHERE key=?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key: str, result: dict) -> None:
        with self._conn() as c:
            c.execute(
                "INSERT OR REPLACE INTO result_cache(key, result, created_at) VALUES (?,?,?)",
                (key, json.dumps(result, ensure_ascii=False), time.time()),
            )


_cache: ResultCache | None = None


def get_cache() -> ResultCache:
    global _cache
    if _cache is None:
        from ..core.config import settings

        _cache = ResultCache(settings.storage_dir / "cache.db")
    return _cache
