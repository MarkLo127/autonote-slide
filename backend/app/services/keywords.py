"""關鍵字提取：中文用 jieba TF-IDF，英文用頻率統計 + 停用詞（不依賴 NLTK 下載資料）。"""
from __future__ import annotations

import re
from collections import Counter

# 常見英文停用詞（精簡內建版，避免 NLTK 需下載語料）
_EN_STOP = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one",
    "our", "out", "has", "had", "him", "his", "how", "man", "new", "now", "old", "see",
    "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use",
    "with", "this", "that", "from", "they", "will", "would", "there", "their", "what",
    "which", "when", "were", "have", "been", "more", "also", "than", "then", "them",
    "these", "such", "into", "only", "other", "some", "could", "about", "using", "used",
    "each", "both", "between", "over", "under", "while", "where", "here", "very", "most",
    "may", "our", "we", "is", "in", "on", "of", "to", "as", "by", "an", "or", "be", "at",
    "it", "if", "so", "do", "no", "up", "figure", "table", "et", "al", "eq", "section",
}


def detect_language(text: str) -> str:
    """回傳 ISO 639-1 語言碼。CJK 先用字元集確定性判斷，其餘才交給 langdetect。"""
    from .textproc import script_language

    lang = script_language(text)
    if lang:
        return lang
    try:
        from langdetect import DetectorFactory, detect

        DetectorFactory.seed = 0  # langdetect 預設隨機，固定種子以確保同文同果
        code = detect(text[:2000])
        return "zh" if code.startswith("zh") else code
    except Exception:  # noqa: BLE001
        return "en"


def extract_keywords(text: str, top_k: int = 60) -> list[tuple[str, float]]:
    """回傳 [(word, weight), ...]，權重已正規化到 (0, 1]。"""
    lang = detect_language(text)
    if lang == "zh":
        import jieba.analyse

        pairs = jieba.analyse.extract_tags(text, topK=top_k, withWeight=True)
        return [(w, float(round(wt, 4))) for w, wt in pairs]

    # 英文：token 化 + 停用詞 + 頻率
    tokens = [t.lower() for t in re.findall(r"[A-Za-z][A-Za-z\-]{2,}", text)]
    tokens = [t for t in tokens if t not in _EN_STOP]
    if not tokens:
        return []
    counts = Counter(tokens).most_common(top_k)
    top = counts[0][1]
    return [(w, round(c / top, 4)) for w, c in counts]
