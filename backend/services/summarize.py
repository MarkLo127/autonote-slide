from typing import Dict, List, Optional
from services.llm import ask_llm
import re
import json

SYSTEM = (
    "You summarize documents and map each point back to paragraph ids when possible. "
    "Return JSON with keys: points (list of {point, paragraph_ids})."
)

PROMPT_TMPL = (
    "Summarize the document into 5-10 concise bullet points in Traditional Chinese or English depending on input.\n"
    "If you can, add paragraph_ids referencing the source paragraphs (like ['p1_1','p1_2']).\n"
    "Text:\n"
    "{text}"
)

def _fallback_summary(text: str, paragraphs: Optional[List[dict]] = None) -> Dict:
    # 取前幾段第一句當作粗略重點
    sent = re.split(r"(?<=[。！？.!?])\s+", text)
    picks = [s.strip() for s in sent if s.strip()][:8]
    points = []
    for i, p in enumerate(picks):
        pts = {"point": p}
        if paragraphs and i < len(paragraphs):
            pts["paragraph_ids"] = [paragraphs[i]["id"]]
        points.append(pts)
    return {"points": points}

def make_summary(text: str, paragraphs: Optional[List[dict]] = None) -> Dict:
    prompt = PROMPT_TMPL.format(text=text[:8000])  # 控制長度，避免超限
    resp = ask_llm(prompt, SYSTEM)
    if resp:
        # 嘗試解析為 JSON；若不是，就包成單點
        try:
            data = json.loads(resp)
            if isinstance(data, dict) and "points" in data:
                return data
        except Exception:
            pass
        return {"points": [{"point": resp}]}
    return _fallback_summary(text, paragraphs)
