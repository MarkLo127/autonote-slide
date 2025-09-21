import os, requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
ENV_API_KEY = os.getenv("LLM_API_KEY")
ENV_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
ENV_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

def ask_llm(
    prompt: str,
    system: str = "You are a helpful assistant.",
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Optional[str]:
    """
    允許以參數覆蓋 .env（單次請求）
    """
    use_key = api_key or ENV_API_KEY
    if not use_key:
        return None
    use_base = (base_url or ENV_BASE_URL).rstrip("/")
    use_model = model or ENV_MODEL

    url = f"{use_base}/chat/completions"
    headers = {"Authorization": f"Bearer {use_key}", "Content-Type": "application/json"}
    data = {
        "model": use_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }
    try:
        r = requests.post(url, headers=headers, json=data, timeout=60)
        r.raise_for_status()
        j = r.json()
        return j["choices"][0]["message"]["content"].strip()
    except Exception:
        return None
