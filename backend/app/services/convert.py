# backend/app/services/convert.py
import os, shlex
from .utils import run_cmd  # ← 移除 ensure_ext

SUPPORTED = {".doc", ".docx", ".ppt", ".pptx", ".md", ".txt"}

def convert_to_pdf(src_path: str, outdir: str) -> str:
    ext = os.path.splitext(src_path)[1].lower()
    assert ext in SUPPORTED, f"Unsupported file: {ext}"
    base = os.path.splitext(os.path.basename(src_path))[0]
    out_pdf = os.path.join(outdir, f"{base}.pdf")

    if ext in {".doc", ".docx", ".ppt", ".pptx"}:
        # LibreOffice headless conversion
        cmd = f"soffice --headless --convert-to pdf --outdir {shlex.quote(outdir)} {shlex.quote(src_path)}"
        run_cmd(cmd)
        # LibreOffice 會用原始檔名輸出 .pdf；若檔名有差異，撿第一個 pdf
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
