import streamlit as st
from backend_client import process

# ⬇ 新增：從你的後端 schema 建立 LLM 設定（若你的 schema 路徑不同，請調整匯入）
try:
    from backend.app.models.schemas import LLMSettings  # 建議：後端已存在
except Exception:
    LLMSettings = None  # 若你沒有這個 schema，也可改成 dict 傳入，視 backend_client 實作而定


def _make_settings(api_key: str | None, base_url: str | None):
    """將側欄輸入轉為後端可用的 LLM 設定物件/字典。"""
    api_key = (api_key or "").strip()
    base_url = (base_url or "").strip() or None
    if not api_key:
        return None

    # 若你的 backend 需要 model/temperature，可在這裡給預設值
    if LLMSettings:
        try:
            return LLMSettings(api_key=api_key, base_url=base_url)
        except TypeError:
            # 某些版本需要 model/temperature
            return LLMSettings(
                api_key=api_key,
                base_url=base_url,
                model="gpt-5-mini-2025-08-07",
            )
    else:
        # 若沒有資料模型，就用 dict（需確保 backend_client.process.analyze_document 能接受）
        return {
            "api_key": api_key,
            "base_url": base_url,
            "model": "gpt-5-mini-2025-08-07",
            "temperature": 0.3,
        }


def _analyze(files, settings):
    """批次呼叫後端分析，回傳 results 陣列。"""
    results = []
    for f in files:
        try:
            res = process.analyze_document(f, settings)
        except Exception as e:
            res = {"file_name": getattr(f, "name", "未命名"), "error": f"分析失敗：{e}"}
        results.append(res)
    return results


def app():
    st.set_page_config(page_title="Autonote&Slide", layout="wide")
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

    # 文字框：顯示已保存值
    apikey = st.sidebar.text_input(
        "🗝️ apikey",
        value=st.session_state.get("api", ""),
        placeholder="🗝️ 輸入apikey",
        type="password",           # ← 重要：輸入時隱藏
    )
    baseurl = st.sidebar.text_input(
        "🔗 baseurl",
        value=st.session_state.get("baseurl", ""),
        placeholder="🔗 輸入baseurl(可選)",
    )

    # ✅ 立刻把目前輸入鏡射到 session_state
    if apikey:
        st.session_state["api"] = apikey.strip()
    if baseurl:
        st.session_state["baseurl"] = baseurl.strip()

    save = st.sidebar.button("儲存", use_container_width=True)
    if save:
        st.success("已儲存 API 設定")
        
    reset = st.sidebar.button("重置", use_container_width=True)
    if reset:
        st.session_state.pop("api", None)
        st.session_state.pop("baseurl", None)
        st.success("已重置 API 設定")

    # ====== 共用上傳（依你原樣保留；每頁只做各自任務）======
    def _common_upload():
        return st.file_uploader(
            "上傳文件",
            accept_multiple_files=True,
            type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt"],
        )

    # ====== 摘要整理 ======
    if options == "摘要整理":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>摘要整理</h3>",
            unsafe_allow_html=True,
        )
        files = _common_upload()
        left, middle, right = st.columns(3)
        clicked = middle.button("開始摘要整理", use_container_width=True)

        if clicked:
            settings = _make_settings(st.session_state.get("api"), st.session_state.get("baseurl"))
            if not settings:
                st.error("請先輸入有效的 API Key（左側欄）。")
            elif not files:
                st.info("請先上傳至少一個文件。")
            else:
                results = _analyze(files, settings)
                # 👉 只渲染摘要
                process.render_summary_view(results)

    # ====== 關鍵字擷取 ======
    elif options == "關鍵字擷取":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>關鍵字擷取</h3>",
            unsafe_allow_html=True,
        )
        files = _common_upload()
        left, middle, right = st.columns(3)
        clicked = middle.button("開始關鍵字擷取", use_container_width=True)

        if clicked:
            settings = _make_settings(st.session_state.get("api"), st.session_state.get("baseurl"))
            if not settings:
                st.error("請先輸入有效的 API Key（左側欄）。")
            elif not files:
                st.info("請先上傳至少一個文件。")
            else:
                results = _analyze(files, settings)
                # 👉 只渲染關鍵字 + 文字雲
                process.render_keywords_view(results)

    # ====== 心智圖生成 ======
    elif options == "心智圖生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>心智圖生成</h3>",
            unsafe_allow_html=True,
        )
        files = _common_upload()
        left, middle, right = st.columns(3)
        clicked = middle.button("開始生成心智圖", use_container_width=True)

        if clicked:
            settings = _make_settings(st.session_state.get("api"), st.session_state.get("baseurl"))
            if not settings:
                st.error("請先輸入有效的 API Key（左側欄）。")
            elif not files:
                st.info("請先上傳至少一個文件。")
            else:
                results = _analyze(files, settings)
                # 👉 只渲染心智圖
                process.render_mindmap_view(results)


if __name__ == "__main__":
    app()