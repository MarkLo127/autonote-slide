import shutil
import subprocess
from pathlib import Path
from typing import Optional
from PIL import Image
from PyPDF2 import PdfReader, PdfWriter
from utils.paths import uploads_dir, with_outputs

SUPPORTED_OFFICE = {".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".odp", ".ods", ".rtf", ".txt", ".md"}
SUPPORTED_IMAGE = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}

def save_upload(file) -> Path:
    dest = uploads_dir / file.filename
    with dest.open("wb") as f:
        import shutil as _sh
        _sh.copyfileobj(file.file, f)
    return dest

def _libreoffice_convert(src: Path) -> Optional[Path]:
    # 以 LibreOffice headless 轉 PDF
    outdir = with_outputs("").parent
    cmd = ["soffice", "--headless", "--convert-to", "pdf", str(src), "--outdir", str(outdir)]
    try:
        import subprocess as _sp
        _sp.run(cmd, check=True, stdout=_sp.PIPE, stderr=_sp.PIPE)
        pdf_path = outdir / (src.stem + ".pdf")
        return pdf_path if pdf_path.exists() else None
    except Exception:
        return None

def _image_to_pdf(src: Path) -> Path:
    img = Image.open(src).convert("RGB")
    out = with_outputs(src.stem + ".pdf")
    img.save(out)
    return out

def _txt_md_to_pdf(src: Path) -> Path:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    out = with_outputs(src.stem + ".pdf")
    c = canvas.Canvas(str(out), pagesize=A4)
    width, height = A4
    with src.open("r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    y = height - 72
    for line in text.splitlines():
        c.drawString(72, y, line[:1000])
        y -= 14
        if y < 72:
            c.showPage(); y = height - 72
    c.save()
    return out

def convert_to_pdf(src: Path) -> Path:
    ext = src.suffix.lower()
    if ext == ".pdf":
        # 確保輸出到 outputs 下（也能順便修復壓縮）
        reader = PdfReader(str(src))
        out = with_outputs(src.stem + "_copy.pdf")
        writer = PdfWriter()
        for p in reader.pages:
            writer.add_page(p)
        with out.open("wb") as f:
            writer.write(f)
        return out

    if ext in SUPPORTED_IMAGE:
        return _image_to_pdf(src)

    if ext in {".txt", ".md"}:
        try:
            from reportlab.pdfgen import canvas  # lazy import 檢查
            return _txt_md_to_pdf(src)
        except Exception:
            pass  # 退回 LibreOffice（若有裝）

    if ext in SUPPORTED_OFFICE:
        pdf_path = _libreoffice_convert(src)
        if pdf_path:
            return pdf_path
        raise RuntimeError("LibreOffice 轉檔失敗或未安裝，請先安裝 LibreOffice。")

    raise ValueError(f"不支援的檔案格式: {ext}")
