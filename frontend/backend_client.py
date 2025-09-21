# backend_client.py
# Streamlit helper to呼叫「backend」FastAPI（不更動你的 UI）
import io, json, zipfile, requests, streamlit as st
from typing import Tuple, Optional

# ====== Configuration discovery（不新增 UI）======
def _get_backend_url() -> str:
    # 先用 session_state，其次 st.secrets，最後預設 localhost
    url = st.session_state.get("backend_url")
    if not url:
        try:
            if "BACKEND_URL" in st.secrets:
                url = st.secrets["BACKEND_URL"]
        except Exception:
            url = None
    return url or "http://localhost:8000"

def _get_llm_creds() -> Tuple[Optional[str], Optional[str]]:
    api = (
        st.session_state.get("api")
        or st.session_state.get("api_key")
        or st.session_state.get("LLM_API_KEY")
    )
    if not api:
        try:
            if "LLM_API_KEY" in st.secrets:
                api = st.secrets["LLM_API_KEY"]
        except Exception:
            api = None

    base = (
        st.session_state.get("baseurl")
        or st.session_state.get("base_url")
        or st.session_state.get("LLM_BASE_URL")
    )
    if not base:
        try:
            if "LLM_BASE_URL" in st.secrets:
                base = st.secrets["LLM_BASE_URL"]
        except Exception:
            base = None

    return api, base

def _auth_headers() -> dict:
    api, base = _get_llm_creds()
    headers = {}
    if api:
        headers["X-LLM-API-Key"] = api
    if base:
        # 同時送兩種大小寫，確保與後端 middleware 相容
        headers["X-LLM-Base-URL"] = base  # URL
        headers["X-LLM-Base-Url"] = base  # Url
    return headers

# ====== Low-level HTTP helpers ======
def _post_file(endpoint: str, uploaded_file, extra_data: dict = None) -> dict:
    url = f"{_get_backend_url()}{endpoint}"
    files = {
        "file": (
            uploaded_file.name,
            uploaded_file.getvalue(),
            getattr(uploaded_file, "type", None) or "application/octet-stream",
        )
    }
    resp = requests.post(url, files=files, data=extra_data or {}, headers=_auth_headers(), timeout=300)
    resp.raise_for_status()
    return resp.json()

def _post_json(endpoint: str, payload: dict) -> dict:
    url = f"{_get_backend_url()}{endpoint}"
    resp = requests.post(url, json=payload, headers=_auth_headers(), timeout=300)
    resp.raise_for_status()
    return resp.json()

def _get_bytes(endpoint: str) -> bytes:
    url = f"{_get_backend_url()}{endpoint}"
    resp = requests.get(url, headers=_auth_headers(), timeout=300)
    resp.raise_for_status()
    return resp.content

# ====== Pipeline pieces ======
def convert(uploaded_file) -> dict:
    return _post_file("/convert", uploaded_file)

def summarize(job_id: str, pdf_path: str) -> dict:
    return _post_json("/summarize", {"job_id": job_id, "pdf_path": pdf_path})

def keywords(job_id: str, pdf_path: str, mapping_json: str) -> dict:
    return _post_json("/keywords", {"job_id": job_id, "pdf_path": pdf_path, "mapping_json": mapping_json})

def slides(job_id: str, summary_json: str) -> dict:
    return _post_json("/slides", {"job_id": job_id, "summary_json": summary_json})

def mindmap(job_id: str, summary_json: str, keywords_json: str) -> dict:
    return _post_json("/mindmap", {"job_id": job_id, "summary_json": summary_json, "keywords_json": keywords_json})

def download_bundle(job_id: str) -> bytes:
    return _get_bytes(f"/download/{job_id}")

# ====== Convenience actions（在你的按鈕下呼叫）======
def do_summary_action(files):
    if not files:
        st.warning("請先上傳文件。")
        return
    f = files[0]
    with st.spinner("正在摘要整理…"):
        c = convert(f)
        s = summarize(c["job_id"], c["pdf_path"])
        zip_bytes = download_bundle(c["job_id"])
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        summary_txt = z.read("summary.json")
        mapping_txt = z.read("paragraphs.json")
    st.success("摘要完成")
    st.subheader("摘要（JSON）")
    st.json(json.loads(summary_txt))
    col1, col2, col3 = st.columns(3)
    col1.download_button("下載 summary.json", summary_txt, file_name="summary.json", use_container_width=True)
    col2.download_button("下載 paragraphs.json", mapping_txt, file_name="paragraphs.json", use_container_width=True)
    col3.download_button("下載全部（zip）", zip_bytes, file_name="bundle.zip", use_container_width=True)

def do_keywords_action(files):
    if not files:
        st.warning("請先上傳文件。")
        return
    f = files[0]
    with st.spinner("正在擷取關鍵字…"):
        c = convert(f)
        s = summarize(c["job_id"], c["pdf_path"])
        k = keywords(c["job_id"], c["pdf_path"], s["mapping_json"])
        zip_bytes = download_bundle(c["job_id"])
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        kw_txt = z.read("keywords.json")
    st.success("關鍵字完成")
    st.subheader("關鍵字（JSON）")
    st.json(json.loads(kw_txt))
    st.download_button("下載全部（zip）", zip_bytes, file_name="bundle.zip", use_container_width=True)

def do_mindmap_action(files):
    if not files:
        st.warning("請先上傳文件。")
        return
    f = files[0]
    with st.spinner("正在生成心智圖…"):
        c = convert(f)
        s = summarize(c["job_id"], c["pdf_path"])
        k = keywords(c["job_id"], c["pdf_path"], s["mapping_json"])
        m = mindmap(c["job_id"], s["summary_json"], k["keywords_json"])
        zip_bytes = download_bundle(c["job_id"])
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        mindmap_pdf = z.read("mindmap.pdf")
    st.success("心智圖完成")
    st.download_button("下載心智圖（PDF）", mindmap_pdf, file_name="mindmap.pdf", use_container_width=True)
    st.download_button("下載全部（zip）", zip_bytes, file_name="bundle.zip", use_container_width=True)

def do_slides_action(files):
    if not files:
        st.warning("請先上傳文件。")
        return
    f = files[0]
    with st.spinner("正在生成簡報…"):
        c = convert(f)
        s = summarize(c["job_id"], c["pdf_path"])
        sl = slides(c["job_id"], s["summary_json"])
        zip_bytes = download_bundle(c["job_id"])
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        slides_pdf = z.read("slides.pdf")
        slides_pptx = z.read("slides.pptx")
    st.success("簡報完成")
    c1, c2 = st.columns(2)
    c1.download_button("下載簡報（PDF）", slides_pdf, file_name="slides.pdf", use_container_width=True)
    c2.download_button("下載簡報（PPTX）", slides_pptx, file_name="slides.pptx", use_container_width=True)
    st.download_button("下載全部（zip）", zip_bytes, file_name="bundle.zip", use_container_width=True)
