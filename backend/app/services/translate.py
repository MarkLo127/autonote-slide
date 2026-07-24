"""翻譯引擎：Qwen2.5 一模兩用（技術文，預設）／ NLLB-200（通用、多語）。"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .llm import LLMClient
from .textproc import split_sentences

LANG_NAMES = {
    "zho_Hant": "正體中文（繁體）",
    "zho_Hans": "簡體中文",
    "eng_Latn": "English",
    "jpn_Jpan": "日本語",
    "kor_Hang": "한국어",
}

# NLLB 語言碼 → langdetect 的 ISO 639-1 碼（用來比對偵測到的來源語言）
_ISO_OF = {"zho": "zh", "eng": "en", "jpn": "ja", "kor": "ko",
           "fra": "fr", "deu": "de", "spa": "es", "rus": "ru"}
# 反向：偵測到的來源語言 → NLLB 碼（NLLB 需要明確的來源語言）
_NLLB_OF = {"zh": "zho_Hans", "en": "eng_Latn", "ja": "jpn_Jpan", "ko": "kor_Hang",
            "fr": "fra_Latn", "de": "deu_Latn", "es": "spa_Latn", "ru": "rus_Cyrl"}


def to_iso(nllb_code: str) -> str:
    """把 NLLB 碼（zho_Hant）轉成 ISO 639-1（zh），無對應時回原字串前綴。"""
    prefix = nllb_code.split("_")[0]
    return _ISO_OF.get(prefix, prefix)


def to_nllb(iso_code: str, default: str = "eng_Latn") -> str:
    """把 ISO 639-1（zh）轉成 NLLB 碼（zho_Hans），未知語言退回 default。"""
    return _NLLB_OF.get(iso_code, default)


@dataclass
class TranslateResult:
    text: str
    elapsed: float
    n_sentences: int = 0
    completion_tokens: int = 0


class Translator(Protocol):
    def translate(self, text: str) -> TranslateResult: ...


class QwenTranslator:
    """一模兩用：同一顆 Qwen 做翻譯。切成 ~窗口大小的小段逐段翻譯再合併，
    避免整段長文丟給小模型時 echo 原文或被截斷（LLM 翻譯可靠性關鍵）。"""

    def __init__(self, llm: LLMClient, tgt_lang: str = "zho_Hant", window_chars: int = 1400):
        self.llm = llm
        self.tgt_name = LANG_NAMES.get(tgt_lang, tgt_lang)
        self.window_chars = window_chars

    def _windows(self, text: str) -> list[str]:
        """依句界把文字聚成不超過 window_chars 的小段。"""
        out: list[str] = []
        buf = ""
        for sent in split_sentences(text):
            if buf and len(buf) + len(sent) + 1 > self.window_chars:
                out.append(buf)
                buf = sent
            else:
                buf = f"{buf} {sent}" if buf else sent
        if buf:
            out.append(buf)
        return out or ([text] if text.strip() else [])

    def translate(self, text: str) -> TranslateResult:
        system = (
            f"你是專業技術文件翻譯，將內容忠實譯成{self.tgt_name}。嚴格遵守：\n"
            "1. 人名、作者名、機構名保留英文原樣，不翻譯也不音譯（例：Haoran Wei）。\n"
            "2. 模型、演算法、專有名詞與縮寫保留原文，必要時中英並陳（例：DeepEncoder V2、LLM、VLMs）。\n"
            f"3. 必須翻成{self.tgt_name}，禁止原封不動輸出原文；用詞精準、依上下文選正確詞義、術語前後一致。\n"
            "4. 只輸出譯文本身，不要任何說明、開場白或標註。"
        )
        parts: list[str] = []
        elapsed = 0.0
        tokens = 0
        for w in self._windows(text):
            res = self.llm.chat(system, w, max_tokens=min(2048, len(w) + 500), temperature=0.2)
            parts.append(res.text)
            elapsed += res.elapsed
            tokens += res.completion_tokens
        return TranslateResult("\n".join(parts), elapsed, len(split_sentences(text)), tokens)


class NLLBTranslator:
    """通用/多語：CTranslate2 載入 NLLB-200-distilled（int8）。句級 MT，速度快。"""

    def __init__(self, ct2_dir: str, tokenizer_src: str, src_lang: str = "eng_Latn",
                 tgt_lang: str = "zho_Hant", device: str = "cpu", compute_type: str = "int8"):
        import ctranslate2
        import transformers

        if not Path(ct2_dir).exists():
            raise RuntimeError(f"找不到 NLLB CTranslate2 模型目錄：{ct2_dir}")
        self.tgt_lang = tgt_lang
        self.tokenizer = transformers.AutoTokenizer.from_pretrained(tokenizer_src, src_lang=src_lang)
        self.translator = ctranslate2.Translator(ct2_dir, device=device, compute_type=compute_type)

    def translate(self, text: str) -> TranslateResult:
        sentences = split_sentences(text)
        start = time.perf_counter()
        out = self._translate_sentences(sentences)
        return TranslateResult(" ".join(out), time.perf_counter() - start, len(sentences))

    def _translate_sentences(self, sentences: list[str]) -> list[str]:
        if not sentences:
            return []
        sources = [self.tokenizer.convert_ids_to_tokens(self.tokenizer.encode(s)) for s in sentences]
        results = self.translator.translate_batch(
            sources, target_prefix=[[self.tgt_lang]] * len(sources), beam_size=2, max_batch_size=16
        )
        out: list[str] = []
        for res in results:
            tokens = res.hypotheses[0]
            if tokens and tokens[0] == self.tgt_lang:
                tokens = tokens[1:]
            ids = self.tokenizer.convert_tokens_to_ids(tokens)
            out.append(self.tokenizer.decode(ids, skip_special_tokens=True))
        return out


def build_translator(settings, llm: LLMClient, src_iso: str | None = None) -> Translator:
    """src_iso 為偵測到的來源語言（ISO 639-1）；未提供時退回 settings.src_lang。"""
    if settings.translator == "qwen":
        return QwenTranslator(llm, settings.target_lang)
    src = to_nllb(src_iso, settings.src_lang) if src_iso else settings.src_lang
    return NLLBTranslator(
        settings.nllb_ct2_dir, settings.nllb_tokenizer, src,
        settings.target_lang, device=settings.nllb_device,
    )
