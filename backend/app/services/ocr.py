"""掃描版/圖片型 PDF 的 OCR fallback（RapidOCR，ONNXRuntime、純 CPU、免系統套件）。"""
from __future__ import annotations

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
        except ImportError:  # 新版套件改名為 rapidocr
            from rapidocr import RapidOCR
        _engine = RapidOCR()
    return _engine


def ocr_png(png_bytes: bytes) -> str:
    """對 PNG bytes 做 OCR，依由上而下的順序組回純文字。失敗回空字串。"""
    try:
        engine = _get_engine()
        out = engine(png_bytes)
        # rapidocr-onnxruntime 回 (result, elapse)；result 為 [[box, text, score], ...]
        result = out[0] if isinstance(out, tuple) else getattr(out, "boxes", None) or out
        if not result:
            return ""
        lines = []
        for item in result:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                lines.append(str(item[1]))
        return "\n".join(lines).strip()
    except Exception:  # noqa: BLE001  OCR 失敗不應中斷整條 pipeline
        return ""
