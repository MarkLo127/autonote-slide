import os, requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("LLM_API_KEY")
BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

def ask_llm(prompt: str, system: str = "You are a helpful assistant.") -> Optional[str]:
    if not API_KEY:
        return None
    url = f"{BASE_URL.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    data = {
        "model": MODEL,
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
