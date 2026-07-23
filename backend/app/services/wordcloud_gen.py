"""文字雲：由關鍵字權重產生 PNG，回傳 base64 data URI（中文用 Noto Sans TC）。"""
from __future__ import annotations

import base64
from io import BytesIO


def generate_wordcloud(keywords: list[tuple[str, float]], font_path: str,
                       width: int = 900, height: int = 480) -> str | None:
    if not keywords:
        return None
    from wordcloud import WordCloud

    freqs = {w: wt for w, wt in keywords if wt > 0}
    if not freqs:
        return None

    wc = WordCloud(
        font_path=font_path,
        width=width,
        height=height,
        background_color="white",
        prefer_horizontal=0.9,
        collocations=False,
    ).generate_from_frequencies(freqs)

    buf = BytesIO()
    wc.to_image().save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"
