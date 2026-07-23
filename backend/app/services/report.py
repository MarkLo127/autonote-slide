"""對照式 PDF 報告：全局摘要 + 文字雲 + 逐段（原文 / 譯文 / 摘要）。"""
from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

_FONT_REGISTERED = False
_FONT_NAME = "NotoTC"


def _ensure_font(font_path: str) -> str:
    global _FONT_REGISTERED
    if not _FONT_REGISTERED:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        pdfmetrics.registerFont(TTFont(_FONT_NAME, font_path))
        _FONT_REGISTERED = True
    return _FONT_NAME


def _p(text: str) -> str:
    return escape(text or "").replace("\n", "<br/>")


def _clip_sentence(text: str, limit: int = 700) -> str:
    """在句界截斷原文，避免切在字中間。"""
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in (". ", "。", "! ", "? ", "\n"):
        idx = cut.rfind(sep)
        if idx > limit * 0.5:
            return cut[: idx + 1].rstrip() + " …"
    return cut.rstrip() + " …"


def build_report_pdf(result: dict, font_path: str, out_path: str | Path) -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        HRFlowable, Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer,
    )

    font = _ensure_font(font_path)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    ACCENT, MUTED, INK = "#2563EB", "#64748B", "#0F172A"
    h1 = ParagraphStyle("h1", fontName=font, fontSize=20, leading=26, textColor=INK, spaceAfter=4)
    meta = ParagraphStyle("meta", fontName=font, fontSize=10, leading=14, textColor=MUTED)
    h2 = ParagraphStyle("h2", fontName=font, fontSize=14, leading=20, textColor=INK,
                        spaceBefore=16, spaceAfter=8)
    tag = ParagraphStyle("tag", fontName=font, fontSize=9.5, leading=13, textColor=ACCENT,
                         spaceBefore=6, spaceAfter=2)
    body = ParagraphStyle("body", fontName=font, fontSize=10.5, leading=16, textColor=INK, spaceAfter=4)
    orig = ParagraphStyle("orig", fontName=font, fontSize=9, leading=14, textColor=MUTED, spaceAfter=2)
    note = ParagraphStyle("note", fontName=font, fontSize=9.5, leading=14, textColor=MUTED,
                          spaceAfter=4)
    seg_h = ParagraphStyle("seg_h", fontName=font, fontSize=11, leading=15, textColor=INK,
                           spaceBefore=10, spaceAfter=2)

    def rule(color=ACCENT, w=1.2):
        return HRFlowable(width="100%", thickness=w, color=color, spaceBefore=2, spaceAfter=8)

    story = [
        Paragraph("PDF 摘要 + 翻譯報告", h1),
        Paragraph(f"共 {result.get('total_pages', 0)} 頁　·　語言：{result.get('language', '')}"
                  f"　·　有效段落 {len(result.get('segments', []))}", meta),
        rule(),
    ]

    # 全局摘要
    gs = result.get("global_summary")
    if gs and any(gs.get(k) for k in ("conclusion", "data", "risk", "action", "raw")):
        story.append(Paragraph("全局重點", h2))
        printed = False
        for key, name in [("conclusion", "結論"), ("data", "關鍵數據"),
                          ("risk", "風險/限制"), ("action", "行動建議")]:
            val = gs.get(key)
            if val:
                story.append(Paragraph(name, tag))
                story.append(Paragraph(_p(val), body))
                printed = True
        if not printed and gs.get("raw"):
            story.append(Paragraph(_p(gs["raw"]), body))

    # 文字雲
    wc = result.get("wordcloud_image_url")
    if wc and wc.startswith("data:image"):
        story.append(Paragraph("關鍵字文字雲", h2))
        raw = base64.b64decode(wc.split(",", 1)[1])
        story.append(Image(BytesIO(raw), width=168 * mm, height=90 * mm))

    # 逐段對照
    story.append(Paragraph("逐段對照", h2))
    for seg in result.get("segments", []):
        block = [Paragraph(f"段落 {seg.get('index', 0) + 1}", seg_h), rule(MUTED, 0.5)]
        has_content = False
        if seg.get("summary"):
            block.append(Paragraph("摘要", tag))
            block.append(Paragraph(_p(seg["summary"]), body))
            has_content = True
        if seg.get("translated"):
            block.append(Paragraph("譯文", tag))
            block.append(Paragraph(_p(seg["translated"]), body))
            has_content = True
        if not has_content:
            block.append(Paragraph("（此段未啟用摘要／翻譯，僅顯示原文）", note))
        if seg.get("original"):
            block.append(Paragraph("原文", tag))
            block.append(Paragraph(_p(_clip_sentence(seg["original"])), orig))
        block.append(Spacer(1, 6 * mm))
        story.append(KeepTogether(block))

    SimpleDocTemplate(str(out_path), pagesize=A4,
                      topMargin=18 * mm, bottomMargin=18 * mm,
                      leftMargin=18 * mm, rightMargin=18 * mm).build(story)
    return str(out_path)
