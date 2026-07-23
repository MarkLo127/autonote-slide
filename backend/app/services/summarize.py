"""摘要引擎（Qwen2.5）。"""
from __future__ import annotations

import re

from .llm import ChatResult, LLMClient


class Summarizer:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def summarize_chunk(self, text: str, max_tokens: int = 900) -> ChatResult:
        system = (
            "你是專業的技術文件摘要助手。請用**正體中文（繁體）**，"
            "以條列方式精煉重點，忠於原文、不杜撰，不要加入開場白。"
        )
        return self.llm.chat(system, f"請摘要以下內容的重點：\n\n{text}", max_tokens)

    def summarize_global(self, chunk_summaries: list[str], max_tokens: int = 1400) -> ChatResult:
        system = (
            "你是專業的技術文件摘要助手。請用**正體中文（繁體）**，"
            "將多段分頁摘要彙整為四個面向：結論、關鍵數據、風險/限制、行動建議。"
            "以標題 + 條列呈現，忠於原文、不杜撰。"
        )
        joined = "\n\n".join(f"[段落 {i + 1}]\n{s}" for i, s in enumerate(chunk_summaries))
        return self.llm.chat(system, f"以下是各段落摘要，請彙整成全局重點：\n\n{joined}", max_tokens)


# 四象限切分：只認「標題行」為段界（化簡後剛好等於象限標題），內文的關鍵字不會誤判。
_HEADER_CORES = {
    "結論": "conclusion", "總結": "conclusion",
    "關鍵數據": "data", "鍵數據": "data", "數據": "data", "關鍵數据": "data", "關鍵資料": "data",
    "風險限制": "risk", "風險": "risk", "限制": "risk", "風險與限制": "risk", "限制與風險": "risk",
    "行動建議": "action", "建議": "action", "後續建議": "action", "行動": "action",
}
# 去除 markdown 記號、標點、數字、空白後用來比對標題
_STRIP_HEADER = re.compile(r"[#*`>~\-\s:：.。,，、()（）\[\]0-9/／\\|]")


def _header_section(line: str) -> str | None:
    core = _STRIP_HEADER.sub("", line)
    return _HEADER_CORES.get(core)


def parse_global(raw: str) -> dict:
    out = {"conclusion": "", "data": "", "risk": "", "action": "", "raw": raw}
    lines = raw.splitlines()
    bounds = [(key, i) for i, ln in enumerate(lines) if (key := _header_section(ln))]
    for j, (key, start) in enumerate(bounds):
        end = bounds[j + 1][1] if j + 1 < len(bounds) else len(lines)
        body = "\n".join(lines[start + 1:end]).strip()
        if body and not out[key]:  # 每格取第一個對應標題的內容，不重複
            out[key] = body
    return out
