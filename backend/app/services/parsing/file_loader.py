from typing import Tuple, List
from backend.app.models.schemas import Paragraph
from .parse_pdf import parse_pdf

PARSERS = {
    ".pdf": parse_pdf,
}

def load_file_as_text_and_paragraphs(path: str) -> Tuple[str, List[Paragraph]]:
    import os
    ext = os.path.splitext(path)[1].lower()
    if ext not in PARSERS:
        raise ValueError(f"不支援的副檔名: {ext}，目前僅支援 PDF 格式")
    return PARSERS[ext](path)
