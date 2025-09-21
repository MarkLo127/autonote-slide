# backend/app/services/convert.py
import os, shlex
from .utils import run_cmd

# 加入 .pdf，讓 PDF 走直通（pass-through）
SUPPORTED = {".doc", ".docx", ".ppt", ".pptx", ".md", ".txt", ".pdf"}

def convert_to_pdf(src_path: str, outdir: str) -> str:
    ext = os.path.splitext(src_path)[1].lower()
    assert ext in SUPPORTED, f"Unsupported file: {ext}"
    base = os.path.splitext(os.path.basename(src_path))[0]
    out_pdf = os.path.join(outdir, f"{base}.pdf")

    if ext == ".pdf":
        # 已經是 PDF：若檔名不同則複製一份，否則直接回傳原路徑
        if os.path.abspath(src_path) != os.path.abspath(out_pdf):
            # 保險起見，若同名已存在就直接回傳 src_path
            try:
                # 盡量確保 out_pdf 存在
                with open(src_path, "rb") as r, open(out_pdf, "wb") as w:
                    w.write(r.read())
                return out_pdf
            except Exception:
                return src_path
        return src_path

    if ext in {".doc", ".docx", ".ppt", ".pptx"}:
        # LibreOffice headless conversion
        cmd = f"soffice --headless --convert-to pdf --outdir {shlex.quote(outdir)} {shlex.quote(src_path)}"
        run_cmd(cmd)
        # LibreOffice 通常輸出同名 .pdf；若抓不到就撿第一個 pdf
        if not os.path.exists(out_pdf):
            for f in os.listdir(outdir):
                if f.lower().endswith(".pdf"):
                    return os.path.join(outdir, f)

    elif ext in {".md", ".txt"}:
        # Pandoc conversion
        cmd = f"pandoc {shlex.quote(src_path)} -o {shlex.quote(out_pdf)}"
        run_cmd(cmd)

    else:
        raise ValueError(f"Cannot convert {ext}")

    if not os.path.exists(out_pdf):
        raise RuntimeError("PDF not created. Check system tools: LibreOffice/Pandoc")
    return out_pdf
