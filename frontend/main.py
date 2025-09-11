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
    st.markdown(
        "<h3 style='text-align: center; color: grey;'>讓AI幫你整理筆記、生成簡報</h3>",
        unsafe_allow_html=True,
    )
    st.sidebar.title("選單")
    options = st.sidebar.selectbox(
        "選擇功能", ["摘要整理","關鍵字擷取","心智圖生成","簡報生成"]
    )
    apikey = st.sidebar.text_input("apikey", placeholder="輸入apikey")
    baseurl = st.sidebar.text_input("baseurl", placeholder="輸入baseurl(可選)")
    
    
    if options == "摘要整理":
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
    elif options == "關鍵字擷取":
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
    elif options == "心智圖生成":
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )
    elif options == "簡報生成":
        files = st.file_uploader(
            "上傳文件", accept_multiple_files=True, type=["pdf", "docx", "doc","pptx","ppt","md","txt"]
            )


    # Add more components and logic for the main application here

if __name__ == "__main__":
    app()