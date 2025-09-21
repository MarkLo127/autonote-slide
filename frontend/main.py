# main.py — Streamlit 前端（整合後端 + 模型選擇 + 主題）強化版
# 需求：pip install streamlit requests
# 運行：streamlit run main.py

import requests
import streamlit as st

# ============ 基本工具 ============
def get_backend_url() -> str:
    url = st.session_state.get("backend_url") or "http://localhost:8000"
    return url.rstrip("/")

@st.cache_data(ttl=60)
def get_themes_cached(backend_url: str):
    r = requests.get(f"{backend_url}/api/themes", timeout=20)
    r.raise_for_status()
    data = r.json()
    presets = [p["name"] for p in data.get("presets", [])]
    return presets or ["clean_light", "clean_dark", "corporate_blue"]

def get_themes():
    try:
        return get_themes_cached(get_backend_url())
    except Exception as e:
        st.toast(f"取得主題清單失敗：{e}", icon="⚠️")
        return ["clean_light", "clean_dark", "corporate_blue"]

def check_backend():
    try:
        r = requests.get(f"{get_backend_url()}/api/themes", timeout=5)
        r.raise_for_status()
        return True, ""
    except requests.exceptions.RequestException as e:
        return False, str(e)

def call_process_one_file(uploaded_file, theme_preset=None, footer_text=None,
                          llm_baseurl=None, llm_apikey=None, llm_model=None):
    """
    呼叫後端 /api/process
    - 會把 apikey/baseurl/model 一起傳給後端（單次請求覆蓋）
    """
    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
    data = {}
    if theme_preset: data["theme_preset"] = theme_preset
    if footer_text: data["footer_text"] = footer_text
    if llm_baseurl: data["llm_baseurl"] = llm_baseurl
    if llm_apikey: data["llm_apikey"] = llm_apikey
    if llm_model: data["llm_model"] = llm_model

    try:
        r = requests.post(f"{get_backend_url()}/api/process", files=files, data=data, timeout=180)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        body = ""
        try:
            body = e.response.text or ""
        except Exception:
            pass
        # 友善提示：常見的 NLTK stopwords 未安裝
        if "stopwords" in body.lower():
            st.error("後端缺少 NLTK stopwords，請在後端執行：\n\n"
                     "`python -c \"import nltk; nltk.download('stopwords'); nltk.download('punkt')\"`")
        else:
            st.error(f"後端回傳錯誤（{getattr(e.response, 'status_code', '??')}）：\n{body[:800]}")
        raise
    except requests.exceptions.RequestException as e:
        st.error(f"連線失敗：{e}")
        raise

def fetch_file_bytes(output_path: str) -> bytes:
    url = f"{get_backend_url()}{output_path}"
    r = requests.get(url, timeout=180)
    r.raise_for_status()
    return r.content

# ============ UI 佈局 ============
st.set_page_config(page_title="Autonote&Slide", layout="wide")
st.markdown("<style> footer{visibility:hidden;} </style>", unsafe_allow_html=True)
st.markdown("<h1 style='text-align:center;'>📄 Autonote&Slide</h1>", unsafe_allow_html=True)
st.subheader(" ", divider="rainbow")

st.sidebar.markdown("<h2 style='text-align:center; color: grey;'>📜 功能選單</h2>", unsafe_allow_html=True)
page = st.sidebar.selectbox("🛠️ 選擇功能", ["摘要整理", "關鍵字擷取", "心智圖生成", "簡報生成"])

# 後端設定
st.sidebar.text_input("🖥️ Backend URL", value=st.session_state.get("backend_url", "http://localhost:8000"),
                      key="backend_url", help="你的 FastAPI 後端，例如 http://localhost:8000")

# 後端連線檢查
ok_backend, err = check_backend()
if ok_backend:
    st.sidebar.success("後端連線：OK")
else:
    st.sidebar.error("後端連線失敗")
    st.sidebar.caption(err)

# LLM 設定（可直接覆蓋後端 .env）
st.sidebar.markdown("### 🤖 LLM 設定（選填）")
apikey = st.sidebar.text_input("API Key", type="password", help="不填則使用後端 .env 的預設 key")
baseurl = st.sidebar.text_input("Base URL", placeholder="如 https://api.openai.com/v1 或你的私有端點")
common_models = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "deepseek-chat", "deepseek-reasoner"]
model_choice = st.sidebar.selectbox("常用模型（可選）", options=common_models, index=0)
model_custom = st.sidebar.text_input("自訂模型（優先於上方下拉）", placeholder="如 gpt-4o-mini 或你的模型名")
chosen_model = model_custom.strip() if model_custom.strip() else model_choice

# ============ 各頁 ============
def section_summary():
    st.markdown("<h3 style='text-align: center; color: grey;'>摘要整理</h3>", unsafe_allow_html=True)
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"],
                            accept_multiple_files=False)
    run = st.button("開始摘要", type="primary", disabled=(file is None or not ok_backend), use_container_width=True)

    if run and file:
        with st.status("讀取並處理中…", expanded=True) as status:
            try:
                res = call_process_one_file(
                    file,
                    llm_baseurl=baseurl or None,
                    llm_apikey=apikey or None,
                    llm_model=chosen_model or None
                )
                status.update(label="完成 ✅", state="complete")
                st.markdown("#### 轉檔後 PDF")
                pdf_bytes = fetch_file_bytes(res["pdf_path"])
                st.download_button("下載 PDF", data=pdf_bytes, file_name="converted.pdf",
                                   mime="application/pdf", use_container_width=True)

                st.markdown("#### 段落 (Paragraphs)")
                st.dataframe(res["paragraphs"], use_container_width=True, hide_index=True)

                st.markdown("#### 摘要 (Summary)")
                points = res["summary"]["points"]
                for i, p in enumerate(points, start=1):
                    paragraph_ids = p.get("paragraph_ids") or []
                    st.markdown(f"**{i}. {p.get('point', '')}**  \n來源段落: `{', '.join(paragraph_ids)}`")

            except Exception as e:
                st.error(f"發生錯誤：{e}")

def section_keywords():
    st.markdown("<h3 style='text-align: center; color: grey;'>關鍵字擷取</h3>", unsafe_allow_html=True)
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"],
                            accept_multiple_files=False)
    run = st.button("開始擷取", type="primary", disabled=(file is None or not ok_backend), use_container_width=True)

    if run and file:
        with st.status("讀取並處理中…", expanded=True) as status:
            try:
                res = call_process_one_file(
                    file,
                    llm_baseurl=baseurl or None,
                    llm_apikey=apikey or None,
                    llm_model=chosen_model or None
                )
                status.update(label="完成 ✅", state="complete")

                st.markdown("#### 轉檔後 PDF")
                pdf_bytes = fetch_file_bytes(res["pdf_path"])
                st.download_button("下載 PDF", data=pdf_bytes, file_name="converted.pdf",
                                   mime="application/pdf", use_container_width=True)

                st.markdown("#### 關鍵字 (Keywords)")
                kws = res["keywords"]["keywords"]
                mapping = res["keywords"]["map"]
                for kw in kws:
                    locs = mapping.get(kw) or []
                    st.write(f"- **{kw}** → 段落: `{', '.join(locs)}`")

            except Exception as e:
                st.error(f"發生錯誤：{e}")

def section_mindmap():
    st.markdown("<h3 style='text-align: center; color: grey;'>心智圖生成</h3>", unsafe_allow_html=True)
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"],
                            accept_multiple_files=False)
    title = st.text_input("心智圖主題（Title）", value="Document Mindmap")
    run = st.button("生成心智圖（.mmd 下載）", type="primary", disabled=(file is None or not ok_backend), use_container_width=True)

    if run and file:
        with st.status("讀取並處理中…", expanded=True) as status:
            try:
                res = call_process_one_file(
                    file,
                    llm_baseurl=baseurl or None,
                    llm_apikey=apikey or None,
                    llm_model=chosen_model or None
                )
                status.update(label="完成 ✅", state="complete")

                points = [p.get("point", "") for p in res["summary"]["points"]]
                lines = ["mindmap", f"  root(({title}))"]
                for i, pt in enumerate(points, start=1):
                    safe = pt.replace("\n", " ").strip()
                    lines.append(f"    {i}. {safe}")
                mmd = "\n".join(lines)
                st.code(mmd, language="markdown")
                st.download_button("下載 mindmap.mmd", data=mmd.encode("utf-8"),
                                   file_name="mindmap.mmd", mime="text/plain", use_container_width=True)

            except Exception as e:
                st.error(f"發生錯誤：{e}")

def section_slides():
    st.markdown("<h3 style='text-align: center; color: grey;'>簡報生成</h3>", unsafe_allow_html=True)
    # 主題設定（只在此頁顯示）
    with st.sidebar.expander("🎨 簡報主題設定", expanded=True):
        theme_names = get_themes()
        chosen_preset = st.selectbox("主題 preset", options=theme_names,
                                     index=theme_names.index("clean_light") if "clean_light" in theme_names else 0)
        footer_text = st.text_input("頁尾文字（選填）", value="")
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"],
                            accept_multiple_files=False)
    run = st.button("開始生成簡報", type="primary", disabled=(file is None or not ok_backend), use_container_width=True)

    if run and file:
        with st.status("讀取、整理重點並產生投影片中…", expanded=True) as status:
            try:
                res = call_process_one_file(
                    file,
                    theme_preset=chosen_preset,
                    footer_text=footer_text,
                    llm_baseurl=baseurl or None,
                    llm_apikey=apikey or None,
                    llm_model=chosen_model or None
                )
                status.update(label="完成 ✅", state="complete")

                st.markdown("#### 投影片重點")
                for i, p in enumerate(res["summary"]["points"], start=1):
                    st.write(f"{i}. {p.get('point', '')}")

                st.markdown("#### 下載輸出")
                try:
                    pptx_bytes = fetch_file_bytes(res["slides_pptx_path"])
                    st.download_button("下載投影片（.pptx）", data=pptx_bytes, file_name="auto_slides.pptx",
                                       mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                       use_container_width=True)
                except Exception as e:
                    st.warning(f"PPTX 下載失敗：{e}")

                try:
                    pdf_bytes = fetch_file_bytes(res["slides_pdf_path"])
                    st.download_button("下載投影片（.pdf）", data=pdf_bytes, file_name="auto_slides.pdf",
                                       mime="application/pdf", use_container_width=True)
                except Exception as e:
                    st.warning(f"PDF 下載失敗（可能 LibreOffice 未安裝或後端轉檔失敗）：{e}")

            except Exception as e:
                st.error(f"發生錯誤：{e}")

# 路由
if page == "摘要整理":
    section_summary()
elif page == "關鍵字擷取":
    section_keywords()
elif page == "心智圖生成":
    section_mindmap()
elif page == "簡報生成":
    section_slides()
