"""集中設定：全部可用環境變數覆寫。完全本地、無任何 API Key。"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


@dataclass
class Settings:
    # 推理端點（Qwen2.5，OpenAI 相容；llama-server / Ollama 皆可）
    summarize_url: str = field(default_factory=lambda: _env("SUMMARIZE_URL", "http://localhost:11434/v1"))
    model: str = field(default_factory=lambda: _env("SUMMARIZE_MODEL", "qwen3.5:4b"))

    # 翻譯：qwen（技術文，一模兩用）| nllb（通用/多語）
    translator: str = field(default_factory=lambda: _env("TRANSLATOR", "qwen"))
    target_lang: str = field(default_factory=lambda: _env("TARGET_LANG", "zho_Hant"))
    src_lang: str = field(default_factory=lambda: _env("SRC_LANG", "eng_Latn"))

    # NLLB（僅 translator=nllb 時使用）
    nllb_ct2_dir: str = field(default_factory=lambda: _env("NLLB_CT2_DIR", "models/nllb-200-distilled-600m-ct2"))
    nllb_tokenizer: str = field(default_factory=lambda: _env("NLLB_TOKENIZER", "facebook/nllb-200-distilled-600M"))
    nllb_device: str = field(default_factory=lambda: _env("NLLB_DEVICE", "cpu"))

    # 分段
    max_chunk_chars: int = field(default_factory=lambda: _env_int("MAX_CHUNK_CHARS", 6000))

    # 服務
    allowed_origins: str = field(default_factory=lambda: _env("ALLOWED_ORIGINS", "*"))
    max_body_mb: int = field(default_factory=lambda: _env_int("MAX_BODY_MB", 50))
    storage_dir: Path = field(default_factory=lambda: Path(_env("STORAGE_DIR", "storage")))

    @property
    def font_path(self) -> str:
        """Noto Sans TC 字型（文字雲與 PDF 報告的中文顯示用）。"""
        base = Path(__file__).resolve().parents[2]  # backend/
        return str(base / "assets/fonts/Noto_Sans_TC/static/NotoSansTC-Regular.ttf")

    @property
    def use_opencc(self) -> bool:
        # 目標為正體中文時，對 LLM 中文輸出做 OpenCC s2t 保底
        return self.target_lang == "zho_Hant" and os.environ.get("DISABLE_OPENCC") != "1"

    @property
    def enable_ocr(self) -> bool:
        # 掃描版/圖片型 PDF 抽不到文字時，用 RapidOCR fallback（可用 DISABLE_OCR=1 關閉）
        return os.environ.get("DISABLE_OCR") != "1"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
