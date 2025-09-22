import streamlit as st

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
        "🛠️ 選擇功能", ["摘要整理", "關鍵字擷取", "心智圖生成", "簡報生成"]
    )

    # 文字框：顯示已保存值
    apikey = st.sidebar.text_input(
        "🗝️ apikey",
        value=st.session_state.get("api", ""),
        placeholder="🗝️ 輸入apikey",
    )
    baseurl = st.sidebar.text_input(
        "🔗 baseurl",
        value=st.session_state.get("baseurl", ""),
        placeholder="🔗 輸入baseurl(可選)",
    )

    # ✅ 立刻把目前輸入鏡射到 session_state（不必按「儲存」也會被 backend_client 讀到）
    if apikey:
        st.session_state["api"] = apikey.strip()
    if baseurl:
        st.session_state["baseurl"] = baseurl.strip()

    save = st.sidebar.button("儲存", use_container_width=True)
    reset = st.sidebar.button("重置", use_container_width=True)

    if save:
        # 額外提示：不影響邏輯
        st.success("已儲存 API 設定")

    if reset:
        st.session_state.pop("api", None)
        st.session_state.pop("baseurl", None)
        st.success("已重置 API 設定")

    # ====== 摘要整理 ======
    if options == "摘要整理":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>摘要整理</h3>",
            unsafe_allow_html=True,
        )
        files = st.file_uploader(
            "上傳文件",
            accept_multiple_files=True,
            type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt"],
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始摘要整理", use_container_width=True)
      

    # ====== 關鍵字擷取 ======
    elif options == "關鍵字擷取":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>關鍵字擷取</h3>",
            unsafe_allow_html=True,
        )
        files = st.file_uploader(
            "上傳文件",
            accept_multiple_files=True,
            type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt"],
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始關鍵字擷取", use_container_width=True)
       

    # ====== 心智圖生成 ======
    elif options == "心智圖生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>心智圖生成</h3>",
            unsafe_allow_html=True,
        )
        files = st.file_uploader(
            "上傳文件",
            accept_multiple_files=True,
            type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt"],
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始生成心智圖", use_container_width=True)
     

    # ====== 簡報生成 ======
    elif options == "簡報生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>簡報生成</h3>",
            unsafe_allow_html=True,
        )
        files = st.file_uploader(
            "上傳文件",
            accept_multiple_files=True,
            type=["pdf", "docx", "doc", "pptx", "ppt", "md", "txt"],
        )
        left, middle, right = st.columns(3)
        clicked = middle.button("開始生成簡報", use_container_width=True)
    

if __name__ == "__main__":
    app()
