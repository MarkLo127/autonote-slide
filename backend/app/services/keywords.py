from typing import List, Dict, Any
from .ai import chat_json
from pathlib import Path

PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "keywords_zh_en.txt"

def _load_prompt() -> str:
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()

def make_keywords(paragraphs: List[str]) -> Dict[str, Any]:
    joined = "\\n\\n".join([f"[{i+1}] {p}" for i, p in enumerate(paragraphs)])
    user = f"PARAGRAPHS:\\n{joined}\\n\\nReturn JSON only."
    return chat_json(_load_prompt(), user)
