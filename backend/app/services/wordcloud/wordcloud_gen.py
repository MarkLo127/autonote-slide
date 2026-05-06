import base64
import re
from io import BytesIO
from typing import Dict, List, Optional

import jieba

from backend.app.core.config import DEFAULT_EN_FONT, DEFAULT_ZH_FONT

EN_WORD_RE = re.compile(r"[A-Za-z][A-Za-z\-']{1,}")


def _tokenize_fallback(text: Optional[str], lang: str) -> List[str]:
    if not text:
        return []
    lowered = (lang or "").lower()
    if lowered.startswith("zh"):
        return [token.strip() for token in jieba.cut(text) if token.strip() and len(token.strip()) > 1]
    if lowered.startswith("en"):
        return re.findall(r"[A-Za-z][A-Za-z\-']{2,}", text.lower())
    tokens = re.split(r"\s+", text)
    return [token.strip() for token in tokens if token.strip()]


def build_wordcloud(paragraph_keywords: List[Dict], lang: str, fallback_text: Optional[str] = None) -> str:
    """Generate a word cloud and return it as a base64 PNG data URL.
    Raises RuntimeError if the wordcloud package is not installed."""
    try:
        from wordcloud import WordCloud  # lazy import — not available on Vercel
    except ImportError as exc:
        raise RuntimeError("wordcloud 套件未安裝，略過文字雲生成。") from exc

    # Tier 1: collect keywords from paragraph analysis
    collected: List[str] = []
    for item in paragraph_keywords:
        keywords = item.get("keywords") if isinstance(item, dict) else None
        if not keywords:
            continue
        for word in keywords:
            if isinstance(word, str):
                stripped = word.strip()
                if stripped:
                    collected.append(stripped)

    # Tier 2: if not enough keywords, fall back to full-text tokenisation
    if len(collected) < 15 and fallback_text:
        collected = _tokenize_fallback(fallback_text, lang)

    if not collected:
        raise RuntimeError("文字內容不足，無法生成文字雲。")

    lowered_lang = (lang or "").lower()
    is_zh = lowered_lang.startswith("zh")

    if not is_zh:
        english_only = [w for w in collected if EN_WORD_RE.search(w)]
        if english_only:
            collected = english_only

    text = " ".join(collected[:1000])

    import os
    font_path = DEFAULT_ZH_FONT if is_zh else DEFAULT_EN_FONT

    if is_zh and (not font_path or not os.path.exists(font_path)):
        english_words = [w for w in collected if EN_WORD_RE.search(w)]
        if len(english_words) >= 5:
            text = " ".join(english_words[:1000])
            font_path = DEFAULT_EN_FONT
            is_zh = False
        else:
            raise RuntimeError(
                "找不到中文字型：請將 Noto Sans TC / Noto Sans CJK 放到 assets/fonts/，"
                "或用環境變數 FONT_ZH_PATH 指向字型檔。"
            )

    wc = WordCloud(
        background_color="white",
        width=1200,
        height=600,
        font_path=font_path or None,
        max_words=150,
        min_font_size=10,
        max_font_size=80,
        collocations=False,
        prefer_horizontal=0.9,
    ).generate(text)

    buf = BytesIO()
    wc.to_image().save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"
