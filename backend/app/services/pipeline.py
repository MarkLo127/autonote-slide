"""核心編排：PDF → 擷取 → 分類 → 分段 → 摘要 → 翻譯 → 彙整 → 組裝結果。

以 generator 形式產出進度事件（dict），供 NDJSON 串流或背景任務消費。
事件格式：{"type": "progress"|"result"|"error", "progress": int, "message": str, "data": ...}
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

from ..core.config import Settings
from . import textproc
from .llm import LLMClient
from .summarize import Summarizer, parse_global
from .translate import build_translator, to_iso


def run_pipeline(pdf_path: str | Path, settings: Settings,
                 do_summary: bool = True, do_translate: bool = True,
                 do_wordcloud: bool = True, do_report: bool = True,
                 doc_id: str | None = None) -> Iterator[dict]:
    fix = textproc.to_traditional if settings.use_opencc else (lambda s: s)

    def ev(progress: int, message: str, type_: str = "progress", data=None) -> dict:
        return {"type": type_, "progress": progress, "message": message, "data": data}

    try:
        yield ev(3, "開始擷取 PDF 文字（掃描頁自動 OCR）")
        pages = textproc.extract_pages(pdf_path, ocr=settings.enable_ocr)
        total_pages = len(pages)

        meaningful = [
            textproc.clean_page_text(p) for p in pages if textproc.is_meaningful_page(p)
        ]
        meaningful = [m for m in meaningful if m.strip()]
        chunks = textproc.chunk_pages(meaningful, settings.max_chunk_chars)
        yield ev(15, f"擷取完成：{total_pages} 頁 → 有效內容 {len(chunks)} 段")
        if not chunks:
            yield ev(100, "PDF 未擷取到有效文字（OCR 後仍無內容，可能是空白或非文字文件）", "error")
            return

        # 偵測來源語言：已是目標語言就不必翻譯（中文文件翻成中文只會空轉又失真）
        from .keywords import detect_language

        src_lang = detect_language("\n".join(chunks))
        if do_translate and src_lang == to_iso(settings.target_lang):
            do_translate = False
            yield ev(16, f"原文已是目標語言（{src_lang}），略過翻譯")

        # 準備模型（摘要與 Qwen 翻譯共用同一個 LLMClient）
        llm = LLMClient(settings.summarize_url, settings.model)
        summarizer = Summarizer(llm) if do_summary else None
        translator = build_translator(settings, llm, src_lang) if do_translate else None

        n = len(chunks)
        segments: list[dict] = []
        chunk_summaries: list[str] = []

        for i, chunk in enumerate(chunks):
            seg: dict = {"index": i, "original": chunk}
            if summarizer:
                s = summarizer.summarize_chunk(chunk)
                seg["summary"] = fix(s.text)
                chunk_summaries.append(seg["summary"])
            if translator:
                t = translator.translate(chunk)
                seg["translated"] = fix(t.text)
            segments.append(seg)
            # 15% → 90% 之間依段數推進
            prog = 15 + int(75 * (i + 1) / n)
            yield ev(prog, f"完成第 {i + 1}/{n} 段")

        global_summary = None
        if summarizer and chunk_summaries:
            yield ev(90, "彙整全局重點")
            g = summarizer.summarize_global(chunk_summaries)
            global_summary = parse_global(fix(g.text))

        # 關鍵字 + 文字雲（由原文擷取，純 CPU）
        original_text = "\n".join(c for c in chunks)
        keywords: list = []
        wordcloud_url = None
        if do_wordcloud:
            from .keywords import extract_keywords
            from .wordcloud_gen import generate_wordcloud

            yield ev(93, "提取關鍵字並產生文字雲")
            kw_pairs = extract_keywords(original_text)
            keywords = [w for w, _ in kw_pairs]
            wordcloud_url = generate_wordcloud(kw_pairs, settings.font_path)

        result = {
            "language": src_lang,
            "total_pages": total_pages,
            "segments": segments,
            "global_summary": global_summary,
            "keywords": keywords,
            "wordcloud_image_url": wordcloud_url,
            "report_pdf_url": None,
        }

        # 對照式 PDF 報告
        if do_report and doc_id:
            from .report import build_report_pdf

            yield ev(97, "產生 PDF 報告")
            out = settings.storage_dir / "reports" / f"{doc_id}.pdf"
            build_report_pdf(result, settings.font_path, out)
            result["report_pdf_url"] = f"/documents/{doc_id}/report.pdf"

        yield ev(100, "分析完成", "result", result)

    except Exception as e:  # noqa: BLE001
        yield ev(100, f"處理失敗：{e}", "error")
