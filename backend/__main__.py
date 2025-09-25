# backend/__main__.py
import os
from dotenv import load_dotenv, find_dotenv
import uvicorn

def _load_env():
    # 讀取專案根 .env（不覆蓋現有環境變數）
    load_dotenv(find_dotenv(usecwd=True), override=False)

    # 允許用相對路徑指定字型（相對於目前啟動的工作目錄）
    if not os.getenv("FONT_ZH_PATH"):
        rel = os.getenv("FONT_ZH_PATH_REL")
        if rel:
            os.environ["FONT_ZH_PATH"] = os.path.abspath(os.path.join(os.getcwd(), rel))

def main():
    _load_env()
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "8000"))
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)

if __name__ == "__main__":
    main()
