"""OpenAI 相容端點的極簡 client（llama-server / Ollama 皆可）。摘要與翻譯共用。"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass

import httpx

# Qwen3/Qwen3.5 等推理型模型可能輸出 <think>…</think>，摘要/翻譯要濾掉
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def strip_think(text: str) -> str:
    return _THINK.sub("", text).strip()


@dataclass
class ChatResult:
    text: str
    elapsed: float
    completion_tokens: int = 0


class LLMClient:
    def __init__(self, base_url: str, model: str, timeout: float = 600.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.Client(timeout=timeout)

    def ping(self) -> list[str]:
        """回傳端點可用的模型 id 清單；連不上則丟例外。"""
        r = self.client.get(f"{self.base_url}/models")
        r.raise_for_status()
        return [m.get("id", "?") for m in r.json().get("data", [])]

    def chat(self, system: str, user: str, max_tokens: int, temperature: float = 0.3) -> ChatResult:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            # 關掉推理型模型（如 Qwen3.5）的 thinking，否則 token 全花在推理、content 會空。
            # 標準 OpenAI 參數，非推理模型/其他 server 會忽略。
            "reasoning_effort": "none",
        }
        start = time.perf_counter()
        r = self.client.post(f"{self.base_url}/chat/completions", json=payload)
        r.raise_for_status()
        data = r.json()
        elapsed = time.perf_counter() - start
        text = strip_think(data["choices"][0]["message"]["content"])
        usage = data.get("usage") or {}
        return ChatResult(text, elapsed, int(usage.get("completion_tokens", 0)))
