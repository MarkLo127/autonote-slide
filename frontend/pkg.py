import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import streamlit as st
from PIL import Image, UnidentifiedImageError


# 將專案根目錄加入 sys.path，方便引用 backend 套件
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.app.core.config import UPLOAD_DIR  # noqa: E402  # isort:skip
from backend.app.models.schemas import LLMSettings  # noqa: E402  # isort:skip
from backend.app.services.nlp.keyword_extractor import (  # noqa: E402  # isort:skip
    extract_keywords_by_paragraph,
)
from backend.app.services.nlp.language_detect import detect_lang  # noqa: E402  # isort:skip
from backend.app.services.nlp.segmenter import ensure_offsets_if_needed  # noqa: E402  # isort:skip
from backend.app.services.nlp.summarizer import (  # noqa: E402  # isort:skip
    summarize_by_paragraph,
    summarize_global,
)
from backend.app.services.parsing.file_loader import (  # noqa: E402  # isort:skip
    load_file_as_text_and_paragraphs,
)
from backend.app.services.wordcloud.wordcloud_gen import (  # noqa: E402  # isort:skip
    build_wordcloud,
)



class DocAnalyzer:
    """
    類別：DocAnalyzer
    功能：封裝文件解析與 UI 呈現的相關流程（上傳保存、段落轉換、LLM 摘要/關鍵字、詞雲渲染、摘要視圖）。
    使用方式：
        analyzer = DocAnalyzer(upload_dir=UPLOAD_DIR)
        analyzer.ensure_state()
        result = analyzer.analyze_document(uploaded_file, settings)
        analyzer.render_summary_view([result])
    """

    def __init__(self, upload_dir: str):
        """
        參數：
            upload_dir: 上傳檔案要儲存的目錄路徑
        """
        self.upload_dir = upload_dir

    # === 方法：ensure_state ===
    # 功能：初始化 / 取得 Streamlit 的 session_state，確保必要的鍵存在。
    @staticmethod
    def ensure_state():
        if "analysis_results" not in st.session_state:
            st.session_state["analysis_results"] = {}

    # === 方法：run_sync ===
    # 功能：在同步環境執行 async 協程：將 coroutine 交給事件迴圈跑並回傳結果。
    @staticmethod
    def run_sync(coro):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)
        else:
            return loop.run_until_complete(coro)

    # === 方法：_save_streamlit_upload ===
    # 功能：將 Streamlit 上傳的檔案寫入本機 upload_dir，回傳存檔完整路徑字串。
    def _save_streamlit_upload(self, uploaded_file) -> str:
        os.makedirs(self.upload_dir, exist_ok=True)
        suffix = Path(uploaded_file.name).suffix or ""
        filename = f"up_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}{suffix}"
        output_path = Path(self.upload_dir) / filename
        output_path.write_bytes(uploaded_file.getbuffer())
        return str(output_path)

    # === 方法：_paragraph_to_dict ===
    # 功能：統一段落物件為可序列化 dict，確保至少包含 index/text/start_char/end_char。
    @staticmethod
    def _paragraph_to_dict(paragraph) -> Dict[str, Any]:
        if hasattr(paragraph, "model_dump"):
            data = paragraph.model_dump()
        else:
            data = {
                "index": getattr(paragraph, "index", 0),
                "text": getattr(paragraph, "text", ""),
                "start_char": getattr(paragraph, "start_char", 0),
                "end_char": getattr(paragraph, "end_char", 0),
            }
        data.setdefault("text", "")
        return data

    # === 方法：analyze_document ===
    # 功能：主流程——保存上傳檔 → 讀取全文與段落 → 語言偵測/位移補齊 → LLM 全局摘要 & 段落摘要 →
    #       關鍵字抽取 → 詞雲生成 → 回傳整體分析結果（含錯誤處理）。
    def analyze_document(self, uploaded_file, settings: "LLMSettings") -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "file_name": uploaded_file.name,
        }

        # 1) 檔案保存 + 文字/段落解析
        try:
            saved_path = self._save_streamlit_upload(uploaded_file)
            full_text, paragraphs = load_file_as_text_and_paragraphs(saved_path)
        except ValueError as exc:
            result["error"] = str(exc)
            return result
        except Exception as exc:  # pylint: disable=broad-except
            result["error"] = f"上傳檔案處理失敗：{exc}"
            return result

        if not full_text.strip():
            result["error"] = "解析不到文字內容，可能是掃描影像或受保護文件。"
            return result

        # 2) 前處理：語言偵測、段落位移補齊、段落標準化
        lang = detect_lang(full_text)
        paragraphs = ensure_offsets_if_needed(full_text, paragraphs)
        paragraph_dicts = [self._paragraph_to_dict(p) for p in paragraphs]

        # 3) LLM 摘要：全局摘要 + 逐段摘要
        try:
            global_summary = self.run_sync(summarize_global(full_text, settings))
            paragraph_summaries = self.run_sync(summarize_by_paragraph(paragraphs, settings))
        except Exception as exc:  # pylint: disable=broad-except
            result["error"] = f"LLM 呼叫失敗：{exc}"
            return result

        paragraph_summaries = [
            {
                "paragraph_index": item["paragraph_index"],
                "summary": item["summary"],
            }
            for item in paragraph_summaries
        ]

        # 4) 關鍵字抽取（逐段）
        paragraph_keywords = extract_keywords_by_paragraph(paragraphs, lang)
        paragraph_keywords = [
            {
                "paragraph_index": item["paragraph_index"],
                "keywords": item.get("keywords", []),
            }
            for item in paragraph_keywords
        ]

        # 5) 詞雲生成（可能因字型/語系失敗，獨立錯誤捕捉）
        wordcloud_path = None
        wordcloud_error = None
        try:
            wordcloud_path = build_wordcloud(paragraph_keywords, lang)
        except RuntimeError as exc:
            wordcloud_error = str(exc)

        # 6) 彙整結果
        result.update(
            {
                "language": lang,
                "paragraphs": paragraph_dicts,
                "global_summary": global_summary,
                "paragraph_summaries": paragraph_summaries,
                "paragraph_keywords": paragraph_keywords,
                "wordcloud_path": wordcloud_path,
                "wordcloud_error": wordcloud_error,
            }
        )
        return result

    # === 方法：render_wordcloud ===
    # 功能：渲染詞雲區塊：載入圖片檔並顯示；若有錯誤顯示提示。
    @staticmethod
    def render_wordcloud(path: str, error: str | None):
        if path:
            try:
                with Image.open(path) as img:
                    st.image(img, caption="文字雲", use_column_width=True)
            except (FileNotFoundError, UnidentifiedImageError):
                st.warning("文字雲圖片讀取失敗，請重新生成。")
        elif error:
            st.warning(error)

    # === 方法：render_summary_view ===
    # 功能：渲染『摘要整理』分頁：逐筆顯示各段的摘要結果。
    @classmethod
    def render_summary_view(cls, results: List[Dict[str, Any]]):
        if not results:
            st.info("尚未產生摘要，請先上傳文件並點擊「開始摘要整理」。")
            return

        for res in results:
            st.divider()
            st.markdown(f"### 📄 {res['file_name']}")
            if res.get("error"):
                st.error(res["error"])
                continue

            st.caption(f"語言偵測：{res['language']}")
            st.markdown("**全局摘要**")
            st.write(res["global_summary"])

            with st.expander("段落摘要", expanded=False):
                for item in res["paragraph_summaries"]:
                    idx = item["paragraph_index"] + 1
                    st.markdown(f"**第 {idx} 段**")
                    st.write(item["summary"])

            with st.expander("段落內容與關鍵字", expanded=False):
                keyword_map = {
                    item["paragraph_index"]: item.get("keywords", [])
                    for item in res["paragraph_keywords"]
                }
                for para in res["paragraphs"]:
                    idx = para["index"] + 1
                    st.markdown(f"**第 {idx} 段**")
                    st.write(para.get("text", ""))
                    keywords = keyword_map.get(para["index"], [])
                    if keywords:
                        st.caption("關鍵字：" + "、".join(keywords))
                    else:
                        st.caption("關鍵字：無")

            cls.render_wordcloud(res.get("wordcloud_path") or "", res.get("wordcloud_error"))