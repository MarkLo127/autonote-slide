from dataclasses import dataclass
from typing import List, Optional

# OpenAI Python SDK (supports custom base_url for compatible providers)
try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


_SYSTEM_SUMMARY_ZH = (
    "你是一位擅長長文閱讀與歸納的助理。請以精簡條列、可快速瀏覽的方式撰寫中文摘要。"
)
_SYSTEM_KEYWORDS_ZH = (
    "請從文件中萃取 8–15 個關鍵字（或關鍵詞片語），只輸出以逗號分隔的清單，不要加說明。"
)
_SYSTEM_OUTLINE_ZH = (
    "請將文件整理成 3 層的大綱結構。輸出 JSON，格式為：\n"
    "{\"title\": \"主題\", \"children\": [ {\"title\": \"要點\", \"children\": [ ... ] } ] }。"
)

_SYSTEM_SUMMARY_EN = (
    "You are a concise analyst. Produce a scannable bullet summary in English."
)
_SYSTEM_KEYWORDS_EN = (
    "Extract 8–15 keywords/phrases. Output a single comma-separated line, no extra text."
)
_SYSTEM_OUTLINE_EN = (
    "Turn the document into a 3-level outline. Return JSON shaped as:\n"
    "{\"title\": \"Topic\", \"children\": [ {\"title\": \"Point\", \"children\": [ ... ] } ] }."
)


def _pick(prompts: tuple[str, str], language: str) -> str:
    zh, en = prompts
    return zh if language.lower().startswith("zh") else en


@dataclass
class OpenAIChatClient:
    api_key: str
    base_url: Optional[str] = None
    model: str = "gpt-4o-mini"

    def _client(self):
        if OpenAI is None:
            raise RuntimeError("openai 套件未安裝。請先 pip install openai")
        return OpenAI(api_key=self.api_key, base_url=self.base_url)  # type: ignore

    def _complete(self, system_prompt: str, user_prompt: str) -> str:
        client = self._client()
        resp = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        content = resp.choices[0].message.content or ""
        return content.strip()

    # --- public methods -----------------------------------------------------
    def summarize(self, text: str, *, language: str = "zh") -> str:
        sys = _pick((_SYSTEM_SUMMARY_ZH, _SYSTEM_SUMMARY_EN), language)
        # Keep prompt small; model can handle long inputs but you might chunk upstream.
        user = f"請以 5–8 點條列說明這份文件的重點：\n\n{text[:16000]}"
        return self._complete(sys, user)

    def keywords(self, text: str, *, language: str = "zh") -> List[str]:
        sys = _pick((_SYSTEM_KEYWORDS_ZH, _SYSTEM_KEYWORDS_EN), language)
        user = f"從以下內容擷取關鍵字：\n\n{text[:16000]}"
        line = self._complete(sys, user)
        # Normalize to list
        parts = [p.strip() for p in line.replace("\n", ",").split(",") if p.strip()]
        # 去重維持順序
        seen, out = set(), []
        for p in parts:
            if p not in seen:
                out.append(p)
                seen.add(p)
        return out[:20]

    def outline(self, text: str, *, language: str = "zh") -> dict:
        import json
        sys = _pick((_SYSTEM_OUTLINE_ZH, _SYSTEM_OUTLINE_EN), language)
        user = f"為以下內文建立三層大綱 JSON：\n\n{text[:16000]}\n\n只輸出 JSON。"
        raw = self._complete(sys, user)
        # 若模型多包了文字，嘗試抽出 JSON
        def _extract_json(s: str) -> str:
            start = s.find("{")
            end = s.rfind("}")
            if start != -1 and end != -1 and end > start:
                return s[start : end + 1]
            return s
        raw_json = _extract_json(raw)
        try:
            data = json.loads(raw_json)
        except Exception:
            # fallback：若解析失敗，給定簡單結構
            data = {"title": "文件", "children": [{"title": "要點", "children": []}]}
        return data