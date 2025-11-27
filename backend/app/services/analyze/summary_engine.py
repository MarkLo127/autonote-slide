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
    "您是專業的商業文件分析專家，專精於提煉核心洞察與可執行建議。\n"
    "\n"
    "## 核心原則\n"
    "1. **精準性**：嚴格基於原文數據與明確陳述，禁止臆測或補充未提及資訊\n"
    "2. **完整性**：每項要點需包含主體、行動與實證依據，語句須自成一體\n"
    "3. **專業性**：採用繁體中文商業語彙，避免口語化或模糊表述\n"
    "4. **客觀性**：不添加外部知識、個人觀點或假設性推論\n"
    "\n"
    "## 語言規範\n"
    "- 全程使用繁體中文，保持專業學術風格\n"
    "- 禁止逐字摘抄原文，需重新組織表達\n"
    "- 嚴禁使用省略號（「..」「…」）或未完成句式\n"
    "- 數據需保留完整（數值、單位、時間、對比基準）"
)

PAGE_PROMPT_TEMPLATE = """
分析第 {page_no} 頁內容。頁面分類：{page_class}。

頁面文字如下（如超長已截斷 4000 字）：
"""

PAGE_INSTRUCTIONS = """
## 任務要求
請將上述內容精煉為 3-4 條核心要點，每條需符合以下標準：

### 內容規範
- **長度控制**：每條 55-110 個全形字（約 1-2 句完整表述）
- **資訊聚焦**：單一重點（策略結論 / 量化數據 / 風險警示 / 行動方案）
- **數據完整**：必須保留數值、單位、時間範圍及對比基準
- **語句獨立**：可單獨理解，無需參照前後文

### 禁止事項
- 不使用條列符號（•、-）或頁碼標記
- 不引用圖表編號或章節標題
- 不添加原文未提及的推測或建議

### 輸出格式（TOON）
```
page_summary:
  bullets[4]: |
    要點一的完整內容
    要點二的完整內容
    要點三的完整內容
    要點四的完整內容
```

注意：使用 | 符號後每條要點獨立一行，無需額外標記。
"""

GLOBAL_PROMPT_TEMPLATE = """
## 全局彙整任務

### 輸入資料
以下為各頁面提煉的核心重點：
{page_points}

### 輸出要求

#### 1. 執行摘要 (overview)
- **數量**：5-7 條關鍵洞察
- **長度**：每條 60-120 全形字
- **總計**：合計至少 300 字
- **內容**：跨頁綜合分析，非單純彙總
- **風格**：決策層級視角，直指核心議題

#### 2. 深度分析 (expansions)
提供三個主題的展開論述，每項 200-400 字：

a) **戰略結論 (key_conclusions)**
   - 核心發現與策略意涵
   - 必須標註來源頁碼（格式：〔p.3〕或〔p.5-7〕）
   - 強調因果關係與業務影響

b) **關鍵數據 (core_data)**
   - 重要量化指標與趨勢
   - 完整呈現數值、單位、時間與對比
   - 註明數據出處頁碼

c) **風險與行動 (risks_and_actions)**
   - 潛在風險與應對建議
   - 明確可執行的行動方案
   - 標示相關頁碼參照

### 輸出格式（TOON）
```
global_summary:
  overview[7]: |
    第一條執行摘要的完整內容
    第二條執行摘要的完整內容
    第三條執行摘要的完整內容
    第四條執行摘要的完整內容
    第五條執行摘要的完整內容
    第六條執行摘要的完整內容
    第七條執行摘要的完整內容
  expansions:
    key_conclusions: |
      戰略結論的完整段落內容（200-400字）
      務必包含來源頁碼標記〔p.x〕
      表達需完整，不可草率收尾
    core_data: |
      關鍵數據的完整段落內容（200-400字）
      包含數值、單位、時間與頁碼標記
    risks_and_actions: |
      風險與行動的完整段落內容（200-400字）
      明確指出風險點與具體行動方案
```

### 品質標準
- 語氣明確果斷，避免模糊表述（「可能」「也許」等）
- 結論需基於實證，不做無根據推測
- 段落結構完整，邏輯清晰連貫
- 每段必須自然收尾，不可戛然而止
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


    @staticmethod
    def _parse_toon_bullets(content: str) -> list:
        """
        解析 TOON 格式的 bullets 列表
        
        格式範例:
        bullets[4]: |
          要點一
          要點二
          要點三
          要點四
        
        Returns:
            str 列表
        """
        import re
        
        # 尋找 bullets[N]: | 後的內容
        pattern = r'bullets\[\d+\]:\s*\|\s*\n((?:[ \t]+.+\n?)+)'
        match = re.search(pattern, content)
        
        if match:
            bullets_block = match.group(1)
            # 分割每行並清理空白
            bullets = [line.strip() for line in bullets_block.split('\n') if line.strip()]
            return bullets
        
        return []
    
    @staticmethod
    def _parse_toon_multiline(content: str, key: str) -> str:
        """
        解析 TOON 格式的多行文字段落
        
        格式範例:
        key_conclusions: |
          段落內容第一行
          段落內容第二行
        
        Returns:
            完整段落文字
        """
        import re
        
        # 尋找 key: | 後的內容（支持縮進）
        pattern = rf'{key}:\s*\|\s*\n((?:[ \t]+.+\n?)+)'
        match = re.search(pattern, content)
        
        if match:
            text_block = match.group(1)
            # 移除每行的縮進，合併為段落
            lines = [line.strip() for line in text_block.split('\n') if line.strip()]
            return '\n'.join(lines)
        
        return ""

    async def _chat_toon(self, system_prompt: str, user_prompt: str) -> dict:
        """呼叫 LLM 並解析 TOON 格式回傳內容。

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
                # 移除 response_format 以允許 TOON 格式輸出
                temperature=0.1,  # 極低溫度值，確保嚴格依據原文分析，不過度想像
            )
            content = response.choices[0].message.content or ""
            
            # 調試日誌：顯示 API 返回內容的前 300 字元
            logger.info(f"API 返回內容（前300字）: {content[:300]}")
            
            # 清理 markdown 代碼塊
            content = content.strip()
            if content.startswith("```"):
                # 移除開頭的 ```toon 或 ```
                content = re.sub(r'^```(?:toon)?\s*\n?', '', content)
                # 移除結尾的 ```
                content = re.sub(r'\n?```\s*$', '', content)
                content = content.strip()
                logger.info(f"清理 markdown 代碼塊後: {content[:300]}")
            
            # 解析 TOON 格式
            parsed = {}
            
            # 檢查是否為 page_summary 格式
            if 'page_summary' in content or 'bullets[' in content:
                bullets = self._parse_toon_bullets(content)
                parsed = {"bullets": bullets}
                logger.info(f"解析 page_summary: {len(bullets)} 條要點")
            
            # 檢查是否為 global_summary 格式
            elif 'global_summary' in content or 'overview[' in content:
                overview = self._parse_toon_bullets(content.replace('overview[', 'bullets['))
                
                # 解析三個擴充段落
                key_conclusions = self._parse_toon_multiline(content, 'key_conclusions')
                core_data = self._parse_toon_multiline(content, 'core_data')
                risks_and_actions = self._parse_toon_multiline(content, 'risks_and_actions')
                
                parsed = {
                    "overview": overview,
                    "expansions": {
                        "key_conclusions": key_conclusions,
                        "core_data": core_data,
                        "risks_and_actions": risks_and_actions
                    }
                }
                logger.info(f"解析 global_summary: {len(overview)} 條 overview")
            else:
                # Fallback: 嘗試當作純文字切分
                logger.warning("無法識別 TOON 格式，嘗試 fallback 解析")
                lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('#')]
                parsed = {"bullets": lines[:5]} if lines else {}
            
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
        data = await self._chat_toon(SYSTEM_PROMPT, user_prompt)
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
        data = await self._chat_toon(SYSTEM_PROMPT, GLOBAL_PROMPT_TEMPLATE.format(page_points=payload))

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
