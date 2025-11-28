# backend/__main__.py
import os
from dotenv import load_dotenv, find_dotenv
import uvicorn

def _load_env():
    # 讀專案根 .env（不覆蓋已存在的環境變數）
    load_dotenv(find_dotenv(usecwd=True), override=False)

    # 支援相對路徑：.env 內若設 FONT_ZH_PATH_REL=backend/assets/...
    if not os.getenv("FONT_ZH_PATH"):
        rel = os.getenv("FONT_ZH_PATH_REL")
        if rel:
            os.environ["FONT_ZH_PATH"] = os.path.abspath(os.path.join(os.getcwd(), rel))

    # （可選）若有需要，可在這裡做最小驗證與提示
    f = os.getenv("FONT_ZH_PATH")
    if f and not os.path.exists(f):
        print(f"[warn] FONT_ZH_PATH 指向的檔案不存在：{f}")

def main():
    _load_env()
    host = os.getenv("APP_HOST", "0.0.0.0")
    # Railway provides PORT env var, fallback to APP_PORT then 8000
    port_str = os.getenv("PORT") or os.getenv("APP_PORT") or "8000"
    port = int(port_str)
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)

if __name__ == "__main__":
    main()
