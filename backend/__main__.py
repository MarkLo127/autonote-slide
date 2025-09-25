# 讓你可以用：python -m backend 啟動
import os
import uvicorn

def main():
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "8000"))
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)

if __name__ == "__main__":
    main()
