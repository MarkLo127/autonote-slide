import json
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_fixed
from openai import OpenAI
from contextvars import ContextVar
from ..config import settings

# 以 ContextVar 保存「每個請求」的臨時 API Key/BaseURL（避免併發污染）
_cv_api_key: ContextVar[Optional[str]] = ContextVar("llm_api_key", default=None)
_cv_base_url: ContextVar[Optional[str]] = ContextVar("llm_base_url", default=None)

def set_request_llm(api_key: Optional[str], base_url: Optional[str]) -> None:
    """由 middleware 呼叫，把本次請求的 LLM Key/BaseURL 放進 ContextVar。"""
    if api_key:
        _cv_api_key.set(api_key.strip())
    if base_url:
        _cv_base_url.set(base_url.strip())

def _get_client() -> OpenAI:
    # 先取「本請求的 override」，否則用預設 settings
    api_key = _cv_api_key.get() or settings.LLM_API_KEY
    base_url = _cv_base_url.get() or settings.LLM_BASE_URL

    if not api_key:
        raise RuntimeError("LLM_API_KEY not provided. Pass via env or header X-LLM-API-Key.")

    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)

@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))
def chat_json(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None) -> dict:
    client = _get_client()
    max_toks = max_tokens or settings.MAX_TOKENS
    msg = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=max_toks,
    )
    content = msg.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except Exception:
        # 最後防呆：若供應商格式偶有偏差
        try:
            return json.loads(content.strip().strip("```json").strip("```"))
        except Exception:
            return {"raw": content}
