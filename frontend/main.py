# main.py  — 前端（Streamlit）x 後端（FastAPI）整合
# 需求：
#   pip install streamlit requests
# 使用：
#   streamlit run main.py
# 預設後端： http://localhost:8000  （可在側邊欄調整）

import io
import json
import requests
import streamlit as st

# -------------------------
# 簡單的後端呼叫工具
# -------------------------
def get_backend_url() -> str:
    url = st.session_state.get("backend_url") or "http://localhost:8000"
    return url.rstrip("/")

def get_themes():
    try:
        r = requests.get(f"{get_backend_url()}/api/themes", timeout=20)
        r.raise_for_status()
        data = r.json()
        return [p["name"] for p in data.get("presets", [])]
    except Exception as e:
        st.toast(f"取得主題清單失敗：{e}", icon="⚠️")
        return ["clean_light", "clean_dark", "corporate_blue"]

def call_process_one_file(uploaded_file, theme_preset=None, footer_text=None):
    """
    呼叫後端 /api/process
    - 參數：單一檔案、可選主題 preset 與頁尾文字
    - 回傳：後端結果 dict 或拋例外
    """
    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
    data = {}
    if theme_preset:
        data["theme_preset"] = theme_preset
    if footer_text:
        data["footer_text"] = footer_text

    r = requests.post(f"{get_backend_url()}/api/process", files=files, data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def fetch_file_bytes(output_path: str) -> bytes:
    """
    將後端回傳的 /outputs/... 檔案抓回來做下載按鈕
    """
    url = f"{get_backend_url()}{output_path}"
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.content

# -------------------------
# UI：頁面樣式與側邊欄
# -------------------------
st.set_page_config(page_title="Autonote&Slide", layout="wide")
st.markdown("<style> footer{visibility:hidden;} </style>", unsafe_allow_html=True)
st.markdown("<h1 style='text-align:center;'>📄 Autonote&Slide</h1>", unsafe_allow_html=True)
st.subheader(" ", divider="rainbow")

st.sidebar.markdown("<h2 style='text-align:center; color: grey;'>📜 功能選單</h2>", unsafe_allow_html=True)
page = st.sidebar.selectbox("🛠️ 選擇功能", ["摘要整理", "關鍵字擷取", "心智圖生成", "簡報生成"])

# 這兩個欄位保留（若你要傳到後端 LLM 可用），目前此前端不直接用到
apikey = st.sidebar.text_input("🗝️ apikey（選填，保留）", placeholder="輸入apikey")
baseurl = st.sidebar.text_input("🔗 baseurl（選填，保留）", placeholder="輸入LLM baseurl")

# 後端 URL（關鍵）
st.sidebar.text_input("🖥️ Backend URL", value=st.session_state.get("backend_url", "http://localhost:8000"),
                      key="backend_url", help="你的 FastAPI 後端，例如 http://localhost:8000")

# 主題（簡報/心智圖會用到；摘要/關鍵字不一定要）
with st.sidebar.expander("🎨 簡報主題設定", expanded=(page == "簡報生成" or page == "心智圖生成")):
    theme_names = get_themes()
    chosen_preset = st.selectbox("主題 preset", options=theme_names, index=theme_names.index("clean_light") if "clean_light" in theme_names else 0)
    footer_text = st.text_input("頁尾文字（選填）", value="")

# -------------------------
# 各功能頁面
# -------------------------

def section_summary():
    st.markdown("<h3 style='text-align: center; color: grey;'>摘要整理</h3>", unsafe_allow_html=True)
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"], accept_multiple_files=False)
    col1, col2, col3 = st.columns(3)
    run = col2.button("開始摘要", use_container_width=True, type="primary", disabled=(file is None))

    if run and file:
        with st.status("讀取並處理中…", expanded=True) as status:
            try:
                res = call_process_one_file(file)  # 不指定主題也可摘要
                status.update(label="完成 ✅", state="complete")

                # 下載原始 PDF（轉檔後）
                st.markdown("#### 轉檔後 PDF")
                pdf_bytes = fetch_file_bytes(res["pdf_path"])
                st.download_button("下載 PDF", data=pdf_bytes, file_name="converted.pdf", mime="application/pdf")

                # 顯示段落
                st.markdown("#### 段落 (Paragraphs)")
                st.dataframe(res["paragraphs"], use_container_width=True, hide_index=True)

                # 顯示摘要
                st.markdown("#### 摘要 (Summary)")
                points = res["summary"]["points"]
                for i, p in enumerate(points, start=1):
                    paragraph_ids = p.get("paragraph_ids") or []
                    st.markdown(f"**{i}. {p.get('point', '')}**  \n來源段落: `{', '.join(paragraph_ids)}`")

            except Exception as e:
                st.error(f"發生錯誤：{e}")

def section_keywords():
    st.markdown("<h3 style='text-align: center; color: grey;'>關鍵字擷取</h3>", unsafe_allow_html=True)
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"], accept_multiple_files=False)
    col1, col2, col3 = st.columns(3)
    run = col2.button("開始擷取", use_container_width=True, type="primary", disabled=(file is None))

    if run and file:
        with st.status("讀取並處理中…", expanded=True) as status:
            try:
                res = call_process_one_file(file)  # 後端一條龍：同時回摘要與關鍵字
                status.update(label="完成 ✅", state="complete")

                # 下載原始 PDF（轉檔後）
                st.markdown("#### 轉檔後 PDF")
                pdf_bytes = fetch_file_bytes(res["pdf_path"])
                st.download_button("下載 PDF", data=pdf_bytes, file_name="converted.pdf", mime="application/pdf")

                # 顯示關鍵字＋段落對應
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
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"], accept_multiple_files=False)
    title = st.text_input("心智圖主題（Title）", value="Document Mindmap")
    col1, col2, col3 = st.columns(3)
    run = col2.button("生成心智圖（.mmd 下載）", use_container_width=True, type="primary", disabled=(file is None))

    if run and file:
        with st.status("讀取並處理中…", expanded=True) as status:
            try:
                res = call_process_one_file(file)  # 拿摘要點
                status.update(label="完成 ✅", state="complete")

                points = [p.get("point", "") for p in res["summary"]["points"]]
                # 產生簡單的 Mermaid mindmap（可貼到支援 Mermaid 的工具）
                # 參考：https://mermaid.js.org/syntax/mindmap.html
                lines = ["mindmap", f"  root(({title}))"]
                for i, pt in enumerate(points, start=1):
                    lines.append(f"    {i}. {pt}")

                mmd = "\n".join(lines)
                st.code(mmd, language="markdown")

                st.download_button(
                    "下載 mindmap.mmd",
                    data=mmd.encode("utf-8"),
                    file_name="mindmap.mmd",
                    mime="text/plain",
                    use_container_width=True
                )

            except Exception as e:
                st.error(f"發生錯誤：{e}")

def section_slides():
    st.markdown("<h3 style='text-align: center; color: grey;'>簡報生成</h3>", unsafe_allow_html=True)
    file = st.file_uploader("上傳單一文件", type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt", "jpg", "png"], accept_multiple_files=False)
    col1, col2, col3 = st.columns(3)
    run = col2.button("開始生成簡報", use_container_width=True, type="primary", disabled=(file is None))

    if run and file:
        with st.status("讀取、整理重點並產生投影片中…", expanded=True) as status:
            try:
                res = call_process_one_file(file, theme_preset=st.session_state.get("chosen_preset", None), footer_text=st.session_state.get("footer_text", None))
                status.update(label="完成 ✅", state="complete")

                # 顯示重點
                st.markdown("#### 投影片重點")
                for i, p in enumerate(res["summary"]["points"], start=1):
                    st.write(f"{i}. {p.get('point', '')}")

                # 下載 PPTX
                st.markdown("#### 下載輸出")
                try:
                    pptx_bytes = fetch_file_bytes(res["slides_pptx_path"])
                    st.download_button("下載投影片（.pptx）", data=pptx_bytes, file_name="auto_slides.pptx",
                                       mime="application/vnd.openxmlformats-officedocument.presentationml.presentation", use_container_width=True)
                except Exception as e:
                    st.warning(f"PPTX 下載失敗：{e}")

                # 下載 PDF
                try:
                    pdf_bytes = fetch_file_bytes(res["slides_pdf_path"])
                    st.download_button("下載投影片（.pdf）", data=pdf_bytes, file_name="auto_slides.pdf",
                                       mime="application/pdf", use_container_width=True)
                except Exception as e:
                    st.warning(f"PDF 下載失敗（可能 LibreOffice 未安裝或後端轉檔失敗）：{e}")

            except Exception as e:
                st.error(f"發生錯誤：{e}")

# 將側邊欄選到的主題 preset 與 footer 存到 session（供簡報頁用）
st.session_state["chosen_preset"] = chosen_preset
st.session_state["footer_text"] = footer_text

# 導頁
if page == "摘要整理":
    section_summary()
elif page == "關鍵字擷取":
    section_keywords()
elif page == "心智圖生成":
    section_mindmap()
elif page == "簡報生成":
    section_slides()
