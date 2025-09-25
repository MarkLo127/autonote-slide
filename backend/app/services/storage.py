import os
from fastapi import UploadFile
from datetime import datetime
from backend.app.core.config import UPLOAD_DIR, STATIC_MOUNT

def save_upload(file: UploadFile) -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    _, ext = os.path.splitext(file.filename)
    path = os.path.join(UPLOAD_DIR, f"up_{ts}{ext}")
    with open(path, "wb") as f:
        f.write(file.file.read())
    return path

def make_public_url(abs_path: str) -> str:
    # 將 storage/ 相對於專案根的路徑轉成 /static/ 對外網址
    # e.g. storage/wordclouds/xxx.png -> /static/wordclouds/xxx.png
    rel = abs_path.replace("\\", "/").split("storage/")[-1]
    return f"{STATIC_MOUNT}/{rel}"
