import os, json
from tenacity import retry, stop_after_attempt, wait_fixed
from typing import Optional
from openai import OpenAI
from ..config import settings

def _get_client() -> OpenAI:
    if settings.LLM_BASE_URL:
        return OpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)
    return OpenAI(api_key=settings.LLM_API_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))
def chat_json(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None) -> dict:
    client = _get_client()
    max_toks = max_tokens or settings.MAX_TOKENS
    msg = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[{"role":"system","content":system_prompt},
                  {"role":"user","content":user_prompt}],
        temperature=0.2,
        response_format={"type":"json_object"},
        max_tokens=max_toks
    )
    content = msg.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except Exception:
        # last-resort: wrap in braces if missing
        if not content.strip().startswith("{"):
            content = "{" + content
        if not content.strip().endswith("}"):
            content = content + "}"
        try:
            return json.loads(content)
        except Exception:
            return {"raw": content}
