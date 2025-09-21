import streamlit as st
from backend_client import (
    do_summary_action,
    do_keywords_action,
    do_mindmap_action,
    do_slides_action,
)


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
        "🛠️ 選擇功能", ["摘要整理","關鍵字擷取","心智圖生成","簡報生成"]
    )

    # === 新增：讓輸入框帶入既有的已儲存值（不改版面，只補 value） ===
    apikey = st.sidebar.text_input(
        "🗝️ apikey",
        value=st.session_state.get("api", ""),
        placeholder="🗝️ 輸入apikey"
    )
    baseurl = st.sidebar.text_input(
        "🔗 baseurl",
        value=st.session_state.get("baseurl", ""),
        placeholder="🔗 輸入baseurl(可選)"
    )

    save = st.sidebar.button("儲存", use_container_width=True)
    reset = st.sidebar.button("重置", use_container_width=True)

    # === 新增：儲存 / 重置 行為（只動 session_state，不動你的 UI 結構） ===
    if save:
        if apikey:
            st.session_state["api"] = apikey.strip()
        else:
            st.session_state.pop("api", None)
        if baseurl:
            st.session_state["baseurl"] = baseurl.strip()
        else:
            st.session_state.pop("baseurl", None)
        st.success("已儲存 API 設定（此次與後續請求都會帶到後端）")

    if reset:
        st.session_state.pop("api", None)
        st.session_state.pop("baseurl", None)
        st.success("已重置 API 設定")
        # 同步清空輸入框顯示
        apikey = ""
        baseurl = ""

    # ====== 摘要整理 ======
    if options == "摘要整理":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>摘要整理</h3>",
            unsafe_allow_html=True
        )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True,
            type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始摘要整理", use_container_width=True)
        if clicked:
            # backend_client 會自動從 st.session_state['api']/['baseurl'] 帶 Header
            do_summary_action(files)

    # ====== 關鍵字擷取 ======
    elif options == "關鍵字擷取":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>關鍵字擷取</h3>",
            unsafe_allow_html=True
        )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True,
            type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始關鍵字擷取", use_container_width=True)
        if clicked:
            do_keywords_action(files)

    # ====== 心智圖生成 ======
    elif options == "心智圖生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>心智圖生成</h3>",
            unsafe_allow_html=True
        )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True,
            type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始生成心智圖", use_container_width=True)
        if clicked:
            do_mindmap_action(files)

    # ====== 簡報生成 ======
    elif options == "簡報生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>簡報生成</h3>",
            unsafe_allow_html=True
        )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True,
            type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始生成簡報", use_container_width=True)
        if clicked:
            do_slides_action(files)

    # Add more components and logic for the main application here


if __name__ == "__main__":
    app()
