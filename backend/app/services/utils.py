# backend/app/services/utils.py
import os
import json
import uuid
import zipfile
import subprocess
from typing import Any
from fastapi import UploadFile

# === 路徑設定 ===
# 本檔位於 backend/app/services/utils.py
# workspace 目錄位於 backend/workspace
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_WORKSPACE = os.path.join(_ROOT, "workspace")

def job_dir(job_id: str) -> str:
    d = os.path.join(_WORKSPACE, job_id)
    os.makedirs(d, exist_ok=True)
    return d

# === 安全寫檔（原子覆寫）===
def write_json(path: str, data: Any) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)  # 原子替換
    return path

# === 封裝整個工作目錄成 zip（穩定版）===
def bundle_zip(outdir: str, zip_path: str) -> str:
    os.makedirs(outdir, exist_ok=True)
    tmp = zip_path + ".tmp"
    # 建立 zip（排除自身 .zip / .tmp）
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(outdir):
            for name in files:
                full = os.path.join(root, name)
                if os.path.abspath(full) == os.path.abspath(zip_path):
                    continue
                if full.endswith(".tmp"):
                    continue
                arc = os.path.relpath(full, outdir)
                z.write(full, arcname=arc)
    # 以原子方式替換
    if os.path.exists(zip_path):
        os.remove(zip_path)
    os.replace(tmp, zip_path)
    return zip_path

# === 上傳存檔（保留原檔名，必要時去衝突）===
async def save_upload(file: UploadFile, outdir: str) -> str:
    os.makedirs(outdir, exist_ok=True)
    orig = file.filename or f"upload-{uuid.uuid4().hex}"
    safe_name = orig.replace("/", "_").replace("\\", "_")
    path = os.path.join(outdir, safe_name)
    # 若同名就加後綴
    if os.path.exists(path):
        stem, ext = os.path.splitext(safe_name)
        path = os.path.join(outdir, f"{stem}-{uuid.uuid4().hex[:6]}{ext}")
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
    return path

# === 轉檔用 ===
def run_cmd(cmd: str) -> None:
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}")
