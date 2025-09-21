import os, shutil, json, subprocess, shlex
from typing import Any
from fastapi import UploadFile

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WS = os.path.join(BASE, "workspace")

def job_dir(job_id: str) -> str:
    return os.path.join(WS, job_id)

async def save_upload(file: UploadFile, outdir: str) -> str:
    dst = os.path.join(outdir, file.filename)
    with open(dst, "wb") as f:
        f.write(await file.read())
    return dst

def write_json(path: str, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def run_cmd(cmd: str):
    proc = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {cmd}\n{proc.stdout}")

def bundle_zip(folder: str, out_zip: str):
    # zip everything in folder
    import zipfile
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(folder):
            for f in files:
                if f == os.path.basename(out_zip):
                    continue
                full = os.path.join(root, f)
                arc = os.path.relpath(full, folder)
                z.write(full, arcname=arc)
