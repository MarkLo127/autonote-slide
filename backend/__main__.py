# backend/__main__.py
import uvicorn
from .app.main import app  # 直接匯入 FastAPI 物件，避免字串路徑解析失敗

def main():
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()
