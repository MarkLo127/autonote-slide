# main.py  — Streamlit 前端（複製貼上即可）
import streamlit as st
import requests
from io import BytesIO
import json
import time

st.set_page_config(page_title="Autonote&Slide", layout="wide")
st.markdown("<h1 style='text-align:center;'>📄 Autonote & Slide</h1>", unsafe_allow_html=True)
st.subheader(" ", divider="rainbow")

# ---- Sidebar ----
st.sidebar.markdown("### ⚙️ 連線設定")
backend_url = st.sidebar.text_input("Backend URL", value="http://localhost:8000", help="例如 http://localhost:8000")
api_key = st.sidebar.text_input("LLM API Key", type="password", help="OpenAI 相容 API Key（必填）")
base_url = st.sidebar.text_input("LLM Base URL（可留空）", value="", help="OpenAI 相容服務的 Base URL（DeepSeek / 本地伺服器）")

colA, colB = st.sidebar.columns(2)
if colA.button("測試連線 /health", use_container_width=True):
    try:
        r = requests.get(f"{backend_url}/health", timeout=15)
        r.raise_for_status()
        st.sidebar.success(r.json())
    except Exception as e:
        st.sidebar.error(f"無法連線：{e}")

st.sidebar.markdown("### 🧭 功能選單")
mode = st.sidebar.radio(
    "選擇功能",
    ["摘要整理", "關鍵字擷取", "心智圖生成", "簡報生成"],
    horizontal=False,
)

# ---- Upload ----
st.markdown("### 上傳文件")
uploaded = st.file_uploader(
    "支援：PDF / DOCX / DOC / PPTX / PPT / MD / TXT",
    type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt"],
    accept_multiple_files=False
)

def _headers():
    h = {}
    if api_key:
        h["X-LLM-API-Key"] = api_key
    if base_url:
        h["X-LLM-Base-Url"] = base_url
    return h

def _process_once(file):
    """呼叫 /process，一口氣跑完轉檔→整理→關鍵字→簡報→心智圖，回傳 JSON。"""
    if not file:
        st.warning("請先上傳文件")
        return None
    if not api_key:
        st.warning("請先在左側輸入 LLM API Key")
        return None

    files = {"file": (file.name, file.getvalue(), file.type or "application/octet-stream")}
    with st.spinner("後端處理中（轉檔 / 總結 / 關鍵字 / 簡報 / 心智圖）…"):
        r = requests.post(f"{backend_url}/process", headers=_headers(), files=files, timeout=600)
        r.raise_for_status()
        return r.json()

def _file_url(job_id: str, name: str) -> str:
    return f"{backend_url}/file/{job_id}/{name}"

def _get_json(url: str):
    r = requests.get(url, timeout=180)
    r.raise_for_status()
    return r.json()

def _get_bytes(url: str) -> bytes:
    r = requests.get(url, timeout=180)
    r.raise_for_status()
    return r.content

st.markdown("---")

# ---- Main Actions ----
go = st.button(f"開始 {mode}", type="primary", use_container_width=True)

if go:
    out = _process_once(uploaded)
    if not out:
        st.stop()

    job_id = out["job_id"]
    st.success(f"✅ 處理完成（job_id={job_id}）")

    # 可直接下載整包 ZIP
    bundle_bytes = _get_bytes(f"{backend_url}/download/{job_id}")
    st.download_button(
        "下載本次完整 ZIP",
        data=bundle_bytes,
        file_name=f"{job_id}_bundle.zip",
        mime="application/zip",
        use_container_width=True,
    )

    # 各產物網址（由 /file endpoint 提供）
    summary_url  = _file_url(job_id, "summary.json")
    keywords_url = _file_url(job_id, "keywords.json")
    slides_pptx_url = _file_url(job_id, "slides.pptx")
    slides_pdf_url  = _file_url(job_id, "slides.pdf")
    mindmap_pdf_url = _file_url(job_id, "mindmap.pdf")
    mapping_url = _file_url(job_id, "paragraphs.json")

    # 取回 JSON 給前端展示
    summary = _get_json(summary_url)
    keywords = _get_json(keywords_url)
    mapping = _get_json(mapping_url)

    if mode == "摘要整理":
        st.markdown("## 📝 摘要整理")
        pts = summary.get("points", [])
        if not pts:
            st.info("沒有擷取到重點（可能原檔文字太少或是掃描影像 PDF）。")
        for i, pt in enumerate(pts, start=1):
            st.markdown(f"### {i}. {pt.get('title','')}")
            for b in pt.get("bullets", []):
                st.markdown(f"- {b}")
            refs = pt.get("para_refs", [])
            if refs:
                st.caption(f"參考段落：{refs}")

        with st.expander("查看段落映射（paragraphs.json）"):
            st.json(mapping)

    elif mode == "關鍵字擷取":
        st.markdown("## 🔑 全域關鍵字")
        gk = keywords.get("global_keywords", [])
        if gk:
            st.write(", ".join(gk))
        else:
            st.info("沒有擷取到有效關鍵字。")

        with st.expander("每段關鍵字（per_paragraph）"):
            st.json(keywords.get("per_paragraph", []))

        with st.expander("段落映射（paragraphs.json）"):
            st.json(mapping)

    elif mode == "心智圖生成":
        st.markdown("## 🧠 心智圖")
        pdf_bytes = _get_bytes(mindmap_pdf_url)
        st.download_button(
            "下載心智圖 PDF",
            data=pdf_bytes,
            file_name=f"mindmap_{job_id}.pdf",
            mime="application/pdf",
            use_container_width=True,
        )
        st.caption("（如需預覽，可將下載的 PDF 直接於瀏覽器開啟）")

    elif mode == "簡報生成":
        st.markdown("## 📊 簡報")
        pptx_bytes = _get_bytes(slides_pptx_url)
        pdf_bytes  = _get_bytes(slides_pdf_url)
        c1, c2 = st.columns(2)
        with c1:
            st.download_button(
                "下載簡報 PPTX",
                data=pptx_bytes,
                file_name=f"slides_{job_id}.pptx",
                mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                use_container_width=True,
            )
        with c2:
            st.download_button(
                "下載簡報 PDF",
                data=pdf_bytes,
                file_name=f"slides_{job_id}.pdf",
                mime="application/pdf",
                use_container_width=True,
            )

        with st.expander("查看摘要（summary.json）"):
            st.json(summary)
