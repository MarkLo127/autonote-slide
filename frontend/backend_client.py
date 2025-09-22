# frontend/backend_client.py
import io, json, zipfile, requests, streamlit as st
from typing import Tuple, Optional

def _get_backend_url() -> str:
    url = st.session_state.get("backend_url")
    if not url:
        try:
            if "BACKEND_URL" in st.secrets:
                url = st.secrets["BACKEND_URL"]
        except Exception:
            url = None
    return (url or "http://localhost:8000").rstrip("/")

def _get_llm_creds() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    api = (
        (st.session_state.get("api") or "").strip()
        or (st.session_state.get("api_key") or "").strip()
        or (st.session_state.get("LLM_API_KEY") or "").strip()
    )
    if not api:
        try:
            api = (st.secrets.get("LLM_API_KEY") or "").strip()  # type: ignore
        except Exception:
            api = ""

    base = (
        (st.session_state.get("baseurl") or "").strip()
        or (st.session_state.get("base_url") or "").strip()
        or (st.session_state.get("LLM_BASE_URL") or "").strip()
    )
    if not base:
        try:
            base = (st.secrets.get("LLM_BASE_URL") or "").strip()  # type: ignore
        except Exception:
            base = ""

    model = (
        (st.session_state.get("model") or "").strip()
        or (st.session_state.get("LLM_MODEL") or "").strip()
    )
    if not model:
        try:
            model = (st.secrets.get("LLM_MODEL") or "").strip()  # type: ignore
        except Exception:
            model = ""

    return (api or None), (base or None), (model or None)

def _auth_headers(require_api: bool = True) -> dict:
    api, base, model = _get_llm_creds()
    if require_api and not api:
        st.error("❗ 尚未設定 API Key。請在左側「apikey」欄位輸入後再重試。")
        raise RuntimeError("Missing API Key")
    headers = {}
    if api:
        headers["X-LLM-API-Key"] = api
    if base:
        headers["X-LLM-Base-URL"] = base
        headers["X-LLM-Base-Url"] = base
    if model:
        headers["X-LLM-Model"] = model
    return headers

def _show_http_error(resp: requests.Response, action_label: str):
    try:
        j = resp.json()
        detail = j.get("detail", j)
    except Exception:
        detail = resp.text
    st.error(f"❌ {action_label} 失敗（HTTP {resp.status_code}）\n\n{detail}")

def _post_file(endpoint: str, uploaded_file, extra_data: dict = None) -> dict:
    url = f"{_get_backend_url()}{endpoint}"
    files = {
        "file": (
            uploaded_file.name,
            uploaded_file.getvalue(),
            getattr(uploaded_file, "type", None) or "application/octet-stream",
        )
    }
    try:
        resp = requests.post(url, files=files, data=extra_data or {}, headers=_auth_headers(), timeout=300)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError:
        _show_http_error(resp, f"上傳/轉檔（{endpoint}）")  # type: ignore[arg-type]
        raise
    except Exception as e:
        st.error(f"❌ 請求錯誤：{e}")
        raise

def _post_json(endpoint: str, payload: dict) -> dict:
    url = f"{_get_backend_url()}{endpoint}"
    try:
        resp = requests.post(url, json=payload, headers=_auth_headers(), timeout=300)
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError:
        _show_http_error(resp, f"呼叫 {endpoint}")  # type: ignore[arg-type]
        raise
    except Exception as e:
        st.error(f"❌ 請求錯誤：{e}")
        raise

def _get_bytes(endpoint: str) -> bytes:
    url = f"{_get_backend_url()}{endpoint}"
    try:
        resp = requests.get(url, headers=_auth_headers(require_api=False), timeout=300)
        resp.raise_for_status()
        return resp.content
    except requests.HTTPError:
        _show_http_error(resp, f"下載 {endpoint}")  # type: ignore[arg-type]
        raise
    except Exception as e:
        st.error(f"❌ 下載錯誤：{e}")
        raise

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

# ====== Actions ======
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
    st.success("✅ 摘要完成")
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
    st.success("✅ 關鍵字完成")
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
    st.success("✅ 心智圖完成")
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
    st.success("✅ 簡報完成")
    c1, c2 = st.columns(2)
    c1.download_button("下載簡報（PDF）", slides_pdf, file_name="slides.pdf", use_container_width=True)
    c2.download_button("下載簡報（PPTX）", slides_pptx, file_name="slides.pptx", use_container_width=True)
    st.download_button("下載全部（zip）", zip_bytes, file_name="bundle.zip", use_container_width=True)
