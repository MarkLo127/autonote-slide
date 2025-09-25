import os
from typing import List, Dict
from wordcloud import WordCloud
from datetime import datetime
from backend.app.core.config import WORDCLOUD_DIR, DEFAULT_ZH_FONT, DEFAULT_EN_FONT

def build_wordcloud(paragraph_keywords: List[Dict], lang: str) -> str:
    os.makedirs(WORDCLOUD_DIR, exist_ok=True)
    all_words = []
    for item in paragraph_keywords:
        all_words.extend(item["keywords"])
    text = " ".join(all_words)

    is_zh = str(lang).lower().startswith("zh")
    font_path = DEFAULT_ZH_FONT if is_zh else DEFAULT_EN_FONT

    if is_zh and (not font_path or not os.path.exists(font_path)):
        raise RuntimeError(
            "找不到中文字型：請把 Noto Sans TC / Noto Sans CJK 放到 assets/fonts/（支援 .ttf/.otf/.ttc），"
            "或以環境變數 FONT_ZH_PATH 指向字型檔。"
        )

    wc = WordCloud(
        background_color="white",
        width=1200,
        height=600,
        font_path=font_path  # 英文 None 亦可
    ).generate(text)

    ts = datetime.now(datetime.timezone.utc).strftime("%Y%m%d%H%M%S%f")
    out_path = os.path.join(WORDCLOUD_DIR, f"wc_{ts}.png")
    wc.to_file(out_path)
    return out_path
