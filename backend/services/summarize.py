from typing import Dict, List, Optional
from services.llm import ask_llm
import re, json

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
    sent = re.split(r"(?<=[。！？.!?])\s+", text)
    picks = [s.strip() for s in sent if s.strip()][:8]
    points = []
    for i, p in enumerate(picks):
        pts = {"point": p}
        if paragraphs and i < len(paragraphs):
            pts["paragraph_ids"] = [paragraphs[i]["id"]]
        points.append(pts)
    return {"points": points}

def make_summary(
    text: str,
    paragraphs: Optional[List[dict]] = None,
    llm: Optional[dict] = None,    # 可帶 {base_url, api_key, model}
) -> Dict:
    prompt = PROMPT_TMPL.format(text=text[:8000])
    kwargs = llm or {}
    resp = ask_llm(prompt, SYSTEM, **kwargs) if kwargs else ask_llm(prompt, SYSTEM)
    if resp:
        try:
            data = json.loads(resp)
            if isinstance(data, dict) and "points" in data:
                return data
        except Exception:
            pass
        return {"points": [{"point": resp}]}
    return _fallback_summary(text, paragraphs)
