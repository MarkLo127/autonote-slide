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
        "🛠️ 選擇功能", ["摘要整理","關鍵字擷取","心智圖生成","簡報生成"]
    )
    apikey = st.sidebar.text_input("🗝️ apikey", placeholder="🗝️ 輸入apikey")
    baseurl = st.sidebar.text_input("🔗 baseurl", placeholder="🔗 輸入baseurl(可選)")

    save = st.sidebar.button("儲存",use_container_width=True)
    reset = st.sidebar.button("重置",use_container_width=True)
    
    
    if options == "摘要整理":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>摘要整理</h3>",
            unsafe_allow_html=True
            )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
        left, middle, right = st.columns(3)
        middle.button("開始摘要整理",use_container_width=True)
    elif options == "關鍵字擷取":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>關鍵字擷取</h3>",
            unsafe_allow_html=True
            )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
        left, middle, right = st.columns(3)
        middle.button("開始關鍵字擷取",use_container_width=True)
    elif options == "心智圖生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>心智圖生成</h3>",
            unsafe_allow_html=True
            )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
        left, middle, right = st.columns(3)
        middle.button("開始生成心智圖",use_container_width=True)
    elif options == "簡報生成":
        st.markdown(
            "<h3 style='text-align: center; color: grey;'>簡報生成</h3>",
            unsafe_allow_html=True
            )
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
        left, middle, right = st.columns(3)
        middle.button("開始生成簡報",use_container_width=True)


    # Add more components and logic for the main application here

if __name__ == "__main__":
    app()