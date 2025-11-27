"""LLM powered summarisation orchestrator aligned with new spec."""

from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from dataclasses import dataclass
from typing import Awaitable, Callable, List

from openai import AsyncOpenAI

from backend.app.models.schemas import GlobalSummary, GlobalSummaryExpansions, LLMSettings, PageSummary
from .page_classifier import ClassifiedPage, SKIP_CLASS_LABELS


class RateLimiter:
    """Token bucket rate limiter for API requests"""
    
    def __init__(self, max_requests: int, time_window: float):
        """
        初始化速率限制器
        
        Args:
            max_requests: 時間窗口內最大請求數
            time_window: 時間窗口（秒）
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = deque()
        self._lock = asyncio.Lock()
    
    async def acquire(self):
        """請求許可發送 API 請求，如果超過速率限制則等待"""
        async with self._lock:
            now = time.time()
            # 移除時間窗口外的舊請求
            while self.requests and self.requests[0] < now - self.time_window:
                self.requests.popleft()
            
            # 如果達到最大請求數，計算需要等待的時間
            if len(self.requests) >= self.max_requests:
                sleep_time = self.requests[0] + self.time_window - now
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                    return await self.acquire()
            
            # 記錄這次請求
            self.requests.append(now)



SYSTEM_PROMPT = (
    "你是文件壓縮摘要專家，擅長結論先行與精準行動建議。"
    "全程使用繁體中文，禁止逐字複製原文，也不得使用省略號「..」「…」。"
    "每個要點須含主詞、動詞與佐證，語句要完整自然。"
    "【重要約束】嚴格依據文件原文內容進行分析，禁止想像、推測或補充任何原文沒有提及的資訊。"
    "僅基於實際可見的數據、結論和明確陳述進行摘要，不得添加外部知識或假設性內容。"
)

PAGE_PROMPT_TEMPLATE = """
分析第 {page_no} 頁內容。頁面分類：{page_class}。

頁面文字如下（如超長已截斷 4000 字）：
"""

PAGE_INSTRUCTIONS = """
請將上列內容整理成 4 條要點（若內容極少可減至 3 條）：
- 每條至少 55 個全形字，最多 110 字。
- 僅保留單一資訊重點：結論、佐證數據、風險或待辦。
- 有數據須保留數值、單位、時間與對比方向。
- 語句需完整，可直接閱讀，不可使用條列符號或頁碼字樣。
請以 JSON 輸出：{"bullets": ["要點一", "要點二", ...]}
禁止回傳多餘欄位。
"""

GLOBAL_PROMPT_TEMPLATE = """
依據下列逐頁重點彙整全局摘要：
{page_points}

請輸出 JSON：
{{
  "overview": ["重點1", "重點2", "重點3", "重點4", "重點5"],
  "expansions": {{
    "key_conclusions": "段落文字",
    "core_data": "段落文字",
    "risks_and_actions": "段落文字"
  }}
}}
規則：
- overview 每條句子需為 60~120 個全形字，至少 5 條，合計須超過 300 字。
- 三段擴充各為 200~400 字，須點出來源頁碼（格式：〔p.x〕或範圍）。務必完整表達分析結論，不可草率收尾。
- 強調結論與可行動事項，語氣務必明確，不得敷衍。
"""


@dataclass
class PageSummaryResult:
    page_number: int
    classification: str
    bullets: List[str]
    skipped: bool
    skip_reason: str | None


class SummaryEngine:
    def __init__(self, settings: LLMSettings, concurrency: int = None):
        # 恢復 OpenAI SDK 的自動重試（讓 SDK 處理 429 錯誤）
        self._client = AsyncOpenAI(
            api_key=settings.api_key,
            base_url=settings.base_url
            # 不設置 max_retries，使用 SDK 預設的重試機制
        )
        self._model = settings.model
        self._settings = settings
        # 使用配置的並發數，如果未指定則使用配置中的值
        self._concurrency = max(1, concurrency if concurrency is not None else settings.concurrency)
        
        # 調試日誌：確認配置
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"SummaryEngine 配置: model={self._model}, "
                   f"concurrency={self._concurrency}")


    async def _chat_json(self, system_prompt: str, user_prompt: str) -> dict:
        """呼叫 LLM 並嘗試將回傳內容解析成 JSON。

        OpenAI SDK 會自動處理 429 錯誤和重試。
        """
        import logging
        import re
        logger = logging.getLogger(__name__)
        
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,  # 極低溫度值，確保嚴格依據原文分析，不過度想像
            )
            content = response.choices[0].message.content or "{}"
            
            # 調試日誌：顯示 API 返回內容的前 200 字元
            logger.info(f"API 返回內容（前200字）: {content[:200]}")
            
            # 清理 markdown 代碼塊（某些 LLM 提供商會用 ```json ... ``` 包裹 JSON）
            content = content.strip()
            if content.startswith("```"):
                # 移除開頭的 ```json 或 ```
                content = re.sub(r'^```(?:json)?\s*\n?', '', content)
                # 移除結尾的 ```
                content = re.sub(r'\n?```\s*$', '', content)
                content = content.strip()
                logger.info(f"清理 markdown 代碼塊後: {content[:200]}")
            
            parsed = json.loads(content)
            
            # 調試日誌：顯示解析後的 keys
            logger.info(f"解析後的 JSON keys: {list(parsed.keys())}")
            
            return parsed
        except Exception as exc:
            # 失敗時返回空 dict，使用 fallback 機制
            logger.error(f"API 調用失敗: {exc}")
            return {}

    async def summarize_page(self, page: ClassifiedPage) -> PageSummaryResult:
        if page.classification in SKIP_CLASS_LABELS and page.classification != "normal":
            reason = self._ensure_min_length(
                page.skip_reason or "〈本頁跳過〉內容不足以生成摘要。",
                55,
            )
            return PageSummaryResult(
                page_number=page.page_number,
                classification=page.classification,
                bullets=[self._prefix_bullet(page.page_number, reason)],
                skipped=True,
                skip_reason=page.skip_reason,
            )

        text = page.text[:4000]
        prompt = PAGE_PROMPT_TEMPLATE.format(page_no=page.page_number, page_class=page.classification)
        user_prompt = f"{prompt}\n{text}\n\n{PAGE_INSTRUCTIONS}".strip()
        data = await self._chat_json(SYSTEM_PROMPT, user_prompt)
        raw_bullets = [line.strip() for line in data.get("bullets", []) if line and line.strip()]
        bullets: List[str] = []
        for bullet in raw_bullets[:5]:
            enriched = self._ensure_min_length(bullet, 55)
            bullets.append(self._prefix_bullet(page.page_number, enriched))

        if len(bullets) < 3:
            bullets = self._fallback_bullets(page)

        return PageSummaryResult(
            page_number=page.page_number,
            classification=page.classification,
            bullets=bullets[:5],
            skipped=False,
            skip_reason=None,
        )

    async def summarize_pages(
        self,
        pages: List[ClassifiedPage],
        progress_callback: Callable[[int], Awaitable[None]] | None = None,
    ) -> List[PageSummaryResult]:
        semaphore = asyncio.Semaphore(self._concurrency)
        results: List[PageSummaryResult | None] = [None] * len(pages)

        async def _worker(idx: int, page: ClassifiedPage):
            async with semaphore:
                summary = await self.summarize_page(page)
            results[idx] = summary
            if progress_callback:
                await progress_callback(idx + 1)

        await asyncio.gather(*(_worker(idx, page) for idx, page in enumerate(pages)))
        return [r for r in results if r is not None]

    async def summarize_global(self, page_results: List[PageSummaryResult]) -> GlobalSummary:
        page_points = []
        for page in page_results:
            for bullet in page.bullets:
                page_points.append(f"{bullet}")

        payload = "\n".join(page_points[:160]) or "暫無要點"
        data = await self._chat_json(SYSTEM_PROMPT, GLOBAL_PROMPT_TEMPLATE.format(page_points=payload))

        overview = [self._ensure_min_length(item.strip(), 60) for item in data.get("overview", []) if item and item.strip()]
        expansions_raw = data.get("expansions", {})

        expansions = GlobalSummaryExpansions(
            key_conclusions=self._trim_to_limit(
                self._ensure_min_length(expansions_raw.get("key_conclusions", ""), 200),
                400,
            ),
            core_data=self._trim_to_limit(
                self._ensure_min_length(expansions_raw.get("core_data", ""), 200),
                400,
            ),
            risks_and_actions=self._trim_to_limit(
                self._ensure_min_length(expansions_raw.get("risks_and_actions", ""), 200),
                400,
            ),
        )

        overview = [self._trim_to_limit(item, 120) for item in overview][:7]
        if len(overview) < 5:
            overview.extend(["（待補要點）"] * (5 - len(overview)))

        return GlobalSummary(bullets=overview[:7], expansions=expansions)

    @staticmethod
    def _trim_to_limit(text: str, limit: int) -> str:
        stripped = text.strip()
        if len(stripped) <= limit:
            return stripped
        return stripped[: limit - 1].rstrip() + "。"

    @staticmethod
    def _prefix_bullet(page_number: int, bullet: str) -> str:
        core = bullet.replace("..", "").replace("…", "").strip()
        return f"〔p.{page_number}〕• {core}"

    @staticmethod
    def _fallback_bullets(page: ClassifiedPage) -> List[str]:
        lines = [line for line in page.text.splitlines() if line.strip()]
        bullets: List[str] = []
        chunk: List[str] = []
        for line in lines:
            chunk.append(line.strip())
            candidate = "".join(chunk)
            if len(candidate) >= 70:
                bullets.append(f"〔p.{page.page_number}〕• {candidate[:110]}")
                chunk = []
            if len(bullets) == 4:
                break
        if chunk and len(bullets) < 4:
            remaining = "".join(chunk)
            bullets.append(f"〔p.{page.page_number}〕• {remaining[:110]}")
        if not bullets:
            bullets.append(f"〔p.{page.page_number}〕• 本頁內容過短，僅偵測到零散文字，建議人工檢視。")
        bullets = [SummaryEngine._ensure_min_length_static(b, 55) for b in bullets]
        return bullets

    @staticmethod
    def _ensure_min_length(text: str, min_chars: int) -> str:
        return SummaryEngine._ensure_min_length_static(text, min_chars)

    @staticmethod
    def _ensure_min_length_static(text: str, min_chars: int) -> str:
        stripped = text.strip()
        if len(stripped) >= min_chars:
            return stripped
        if not stripped:
            stripped = "內容過短，請人工補充。"
        padding_needed = min_chars - len(stripped)
        padding = "" if padding_needed <= 0 else f"（補充：內容僅 {len(stripped)} 字，建議檢視原文補強。）"
        result = stripped + padding
        if len(result) < min_chars:
            result += "請參考原頁面取得完整上下文。"
        return result
