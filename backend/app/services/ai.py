# backend/app/services/ai.py
import json
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_fixed
from openai import OpenAI
from openai import NotFoundError, AuthenticationError, BadRequestError, APIConnectionError, RateLimitError
from contextvars import ContextVar
from ..config import settings

# 以 ContextVar 保存「每個請求」暫存設定
_cv_api_key: ContextVar[Optional[str]] = ContextVar("llm_api_key", default=None)
_cv_base_url: ContextVar[Optional[str]] = ContextVar("llm_base_url", default=None)
_cv_model:    ContextVar[Optional[str]] = ContextVar("llm_model", default=None)

def set_request_llm(api_key: Optional[str], base_url: Optional[str], model: Optional[str] = None) -> None:
    """由 middleware 呼叫，把本次請求的 LLM Key/BaseURL/Model 放進 ContextVar。"""
    if api_key:
        _cv_api_key.set(api_key.strip())
    if base_url:
        _cv_base_url.set(base_url.strip())
    if model:
        _cv_model.set(model.strip())

def _norm_base(base_url: Optional[str]) -> Optional[str]:
    if not base_url:
        return None
    b = base_url.rstrip("/")
    # 多數 OpenAI 相容端點需要以 /v1 結尾
    if not b.endswith("/v1"):
        b = b + "/v1"
    return b

def _get_client() -> OpenAI:
    api_key = _cv_api_key.get() or settings.LLM_API_KEY
    base_url = _norm_base(_cv_base_url.get() or settings.LLM_BASE_URL)
    if not api_key:
        raise RuntimeError("Missing LLM_API_KEY. Please send header 'X-LLM-API-Key'.")
    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)

def _get_model() -> str:
    return (_cv_model.get() or settings.LLM_MODEL or "gpt-5-mini-2025-08-07").strip()

@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))
def chat_json(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None) -> dict:
    client = _get_client()
    model = _get_model()
    try:
        msg = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            max_tokens=max_tokens or settings.MAX_TOKENS,
        )
        content = msg.choices[0].message.content or "{}"
        s = content.strip()
        if s.startswith("```"):
            s = s.strip("`")
            if s.startswith("json"):
                s = s[4:].strip()
        try:
            return json.loads(s)
        except Exception:
            return {"raw": content}
    except NotFoundError as e:
        base = _norm_base(_cv_base_url.get() or settings.LLM_BASE_URL) or "openai-default"
        raise RuntimeError(f"Model '{model}' not found at base '{base}'. "
                           f"請確認模型名稱是否正確，或用 'X-LLM-Model' header 指定正確的模型。") from e
    except AuthenticationError as e:
        raise RuntimeError("Invalid API key. 請確認 apikey 是否正確。") from e
    except RateLimitError as e:
        raise RuntimeError("Rate limit exceeded / 配額不足。") from e
    except APIConnectionError as e:
        raise RuntimeError(f"LLM 連線失敗：{e}") from e
    except BadRequestError as e:
        raise RuntimeError(f"LLM 請求內容有誤：{e}") from e
