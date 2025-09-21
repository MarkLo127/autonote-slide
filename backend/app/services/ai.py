# app/services/ai.py
import json
from tenacity import retry, stop_after_attempt, wait_fixed
from typing import Optional
from openai import OpenAI
from contextvars import ContextVar
from ..config import settings

# ⇩⇩ 透過 contextvars 存每個請求的 API Key/Base URL（由 middleware 設定）
_req_api_key: ContextVar[Optional[str]] = ContextVar("req_api_key", default=None)
_req_base_url: ContextVar[Optional[str]] = ContextVar("req_base_url", default=None)

def set_request_llm(api_key: Optional[str], base_url: Optional[str]):
    _req_api_key.set(api_key)
    _req_base_url.set(base_url)

def _get_client() -> OpenAI:
    # 先用「每次請求」的 header 覆蓋；沒有就用環境變數
    ak = _req_api_key.get()
    bu = _req_base_url.get()
    if ak:
        return OpenAI(api_key=ak, base_url=bu or settings.LLM_BASE_URL)
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
        return {"raw": content}
