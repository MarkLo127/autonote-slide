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


DEFAULT_MODEL = "gpt-5-mini-2025-08-07"
SUPPORTED_EXTS = ["pdf", "docx", "pptx", "md", "txt"]


def _ensure_state():
    if "analysis_results" not in st.session_state:
        st.session_state["analysis_results"] = {}


def _run_sync(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        return loop.run_until_complete(coro)


def _save_streamlit_upload(uploaded_file) -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    suffix = Path(uploaded_file.name).suffix or ""
    filename = f"up_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}{suffix}"
    output_path = Path(UPLOAD_DIR) / filename
    output_path.write_bytes(uploaded_file.getbuffer())
    return str(output_path)


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


def analyze_document(uploaded_file, settings: LLMSettings) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "file_name": uploaded_file.name,
    }

    try:
        saved_path = _save_streamlit_upload(uploaded_file)
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

    lang = detect_lang(full_text)
    paragraphs = ensure_offsets_if_needed(full_text, paragraphs)
    paragraph_dicts = [_paragraph_to_dict(p) for p in paragraphs]

    try:
        global_summary = _run_sync(summarize_global(full_text, settings))
        paragraph_summaries = _run_sync(summarize_by_paragraph(paragraphs, settings))
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

    paragraph_keywords = extract_keywords_by_paragraph(paragraphs, lang)
    paragraph_keywords = [
        {
            "paragraph_index": item["paragraph_index"],
            "keywords": item.get("keywords", []),
        }
        for item in paragraph_keywords
    ]

    wordcloud_path = None
    wordcloud_error = None
    try:
        wordcloud_path = build_wordcloud(paragraph_keywords, lang)
    except RuntimeError as exc:
        wordcloud_error = str(exc)

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


def render_wordcloud(path: str, error: str | None):
    if path:
        try:
            with Image.open(path) as img:
                st.image(img, caption="文字雲", use_column_width=True)
        except (FileNotFoundError, UnidentifiedImageError):
            st.warning("文字雲圖片讀取失敗，請重新生成。")
    elif error:
        st.warning(error)


def render_summary_view(results: List[Dict[str, Any]]):
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

        render_wordcloud(res.get("wordcloud_path") or "", res.get("wordcloud_error"))


def render_keywords_view(results: List[Dict[str, Any]]):
    if not results:
        st.info("尚未擷取關鍵字，請先上傳文件並點擊「開始關鍵字擷取」。")
        return

    for res in results:
        st.divider()
        st.markdown(f"### 📄 {res['file_name']}")
        if res.get("error"):
            st.error(res["error"])
            continue

        table_rows = [
            {
                "段落": item["paragraph_index"] + 1,
                "關鍵字": "、".join(item.get("keywords", [])) or "無",
            }
            for item in res["paragraph_keywords"]
        ]
        st.dataframe(table_rows, use_container_width=True)
        render_wordcloud(res.get("wordcloud_path") or "", res.get("wordcloud_error"))


def _escape_label(label: str) -> str:
    return label.replace("\\", "\\\\").replace("\"", "\\\"")


def _trim_text(text: str, limit: int = 70) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


def _build_mindmap_dot(res: Dict[str, Any]) -> str:
    summary_map = {
        item["paragraph_index"]: item["summary"]
        for item in res["paragraph_summaries"]
    }
    keyword_map = {
        item["paragraph_index"]: item.get("keywords", [])
        for item in res["paragraph_keywords"]
    }

    lines = [
        "digraph G {",
        "  rankdir=LR;",
        "  graph [splines=true, nodesep=0.6, ranksep=1.2];",
        "  node [shape=box, style=\"rounded,filled\", fillcolor=\"#E8F0FE\", color=\"#1a73e8\", fontname=\"Helvetica\", fontsize=11];",
        f"  root [label=\"{_escape_label(res['file_name'])}\"];",
    ]

    for idx, summary in summary_map.items():
        node_id = f"p{idx}"
        label = f"第 {idx + 1} 段\\n{_escape_label(_trim_text(summary))}"
        lines.append(f"  {node_id} [label=\"{label}\"];")
        lines.append(f"  root -> {node_id};")

        for kid_idx, kw in enumerate(keyword_map.get(idx, [])[:5], start=1):
            child_id = f"{node_id}_{kid_idx}"
            kw_label = _escape_label(kw)
            lines.append(
                f"  {child_id} [label=\"{kw_label}\", shape=oval, style=\"filled\", fillcolor=\"#FFF7AE\", color=\"#F4B400\", fontsize=10];"
            )
            lines.append(f"  {node_id} -> {child_id};")

    lines.append("}")
    return "\n".join(lines)


def render_mindmap_view(results: List[Dict[str, Any]]):
    if not results:
        st.info("尚未生成心智圖，請先上傳文件並點擊「開始生成心智圖」。")
        return

    for res in results:
        st.divider()
        st.markdown(f"### 📄 {res['file_name']}")
        if res.get("error"):
            st.error(res["error"])
            continue

        if not res.get("paragraph_summaries"):
            st.warning("尚無段落摘要，無法生成心智圖。")
            continue

        dot = _build_mindmap_dot(res)
        st.graphviz_chart(dot, use_container_width=True)


def app():
    st.set_page_config(page_title="Autonote&Slide", layout="wide")
    _ensure_state()

    hide_menu_style = "<style> footer {visibility: hidden;} </style>"
    st.markdown(hide_menu_style, unsafe_allow_html=True)
    st.markdown(
        "<h1 style='text-align: center; color: rainbow;'>📄 Autonote&Slide</h1>",
        unsafe_allow_html=True,
    )
    st.subheader(" ", divider="rainbow")
    st.sidebar.markdown(
        "<h2 style='text-align: center; color: grey;'>📜 功能選單</h2>",
        unsafe_allow_html=True,
    )

    options = st.sidebar.selectbox(
        "🛠️ 選擇功能", ["摘要整理", "關鍵字擷取", "心智圖生成"]
    )

    api_value = st.session_state.get("api", "")
    base_value = st.session_state.get("baseurl", "")
    model_value = st.session_state.get("model", DEFAULT_MODEL)

    apikey = st.sidebar.text_input(
        "🗝️ API Key",
        value=api_value,
        placeholder="輸入 OpenAI 相容 API Key",
    )
    baseurl = st.sidebar.text_input(
        "🔗 Base URL",
        value=base_value,
        placeholder="可選，自行部署的相容 API 端點",
    )
    llm_model = st.sidebar.text_input(
        "🤖 模型",
        value=model_value,
        placeholder=DEFAULT_MODEL,
    )

    if apikey:
        st.session_state["api"] = apikey.strip()
    if baseurl:
        st.session_state["baseurl"] = baseurl.strip()
    if llm_model:
        st.session_state["model"] = llm_model.strip()

    save = st.sidebar.button("儲存", use_container_width=True)
    reset = st.sidebar.button("重置", use_container_width=True)

    if save:
        st.success("已儲存 API 設定")

    if reset:
        for key in ("api", "baseurl", "model"):
            st.session_state.pop(key, None)
        st.success("已重置 API 設定")

    st.sidebar.caption("支援副檔名：" + ", ".join(f".{ext}" for ext in SUPPORTED_EXTS))

    files = st.file_uploader(
        "上傳文件",
        accept_multiple_files=True,
        type=SUPPORTED_EXTS,
    )

    action_label = {
        "摘要整理": "開始摘要整理",
        "關鍵字擷取": "開始關鍵字擷取",
        "心智圖生成": "開始生成心智圖",
    }[options]

    left, middle, right = st.columns(3)
    clicked = middle.button(action_label, use_container_width=True)

    if clicked:
        if not apikey or not apikey.strip():
            st.error("請先輸入 API Key")
        elif not files:
            st.error("請至少上傳一個文件")
        else:
            settings = LLMSettings(
                api_key=apikey.strip() if apikey else "",
                base_url=baseurl.strip() if baseurl else None,
                model=llm_model.strip() if llm_model else DEFAULT_MODEL,
            )
            results: List[Dict[str, Any]] = []
            progress = st.progress(0.0, text="開始分析…")
            total = len(files)
            for idx, file in enumerate(files, start=1):
                progress.progress((idx - 1) / total, text=f"分析 {file.name}…")
                with st.spinner(f"分析「{file.name}」中…"):
                    res = analyze_document(file, settings)
                results.append(res)
                progress.progress(idx / total, text=f"完成 {file.name}")
            progress.empty()
            st.session_state["analysis_results"][options] = results

    current_results = st.session_state["analysis_results"].get(options, [])

    if options == "摘要整理":
        render_summary_view(current_results)
    elif options == "關鍵字擷取":
        render_keywords_view(current_results)
    elif options == "心智圖生成":
        render_mindmap_view(current_results)


if __name__ == "__main__":
    app()
