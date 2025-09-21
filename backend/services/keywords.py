from typing import Dict, List, Optional
from langdetect import detect
import re

# 中文：jieba；英文：RAKE
import jieba.analyse
from rake_nltk import Rake

def _lang(text: str) -> str:
    try:
        return detect(text[:1000])
    except Exception:
        return "unknown"

def _kw_en(text: str, top_k: int = 15) -> List[str]:
    r = Rake()
    r.extract_keywords_from_text(text)
    cands = r.get_ranked_phrases()[:top_k]
    return [c.strip() for c in cands]

def _kw_zh(text: str, top_k: int = 15) -> List[str]:
    kws = jieba.analyse.extract_tags(text, topK=top_k, withWeight=False, allowPOS=("n", "vn", "v"))
    return [k.strip() for k in kws]

def make_keywords(text: str, paragraphs: Optional[List[dict]] = None, top_k: int = 15) -> Dict:
    lg = _lang(text)
    if lg.startswith("zh"):
        words = _kw_zh(text, top_k)
    else:
        words = _kw_en(text, top_k)

    # 簡單把每個關鍵字去比對所在段落（第一次出現者）
    mapping = {}
    if paragraphs:
        for w in words:
            found = None
            for p in paragraphs:
                if w.lower() in p["text"].lower():
                    found = p["id"]; break
            mapping[w] = [found] if found else []
    else:
        mapping = {w: [] for w in words}

    return {"keywords": words, "map": mapping}
