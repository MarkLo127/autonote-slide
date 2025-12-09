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
    "- 採用標準商業與財務專業術語，禁止直譯或生硬翻譯\n"
    "- 確保專業名詞準確（如：revenue 營收、profit 利潤、market share 市場佔有率）\n"
    "- 禁止逐字摘抄原文，需重新組織表達\n"
    "- 嚴禁使用省略號（「..」「…」）或未完成句式\n"
    "- 所有句子必須完整，每個段落必須有完整的結尾，絕對禁止中途截斷\n"
    "- 如果內容即將超過長度限制，請提前結束在完整句子處，不要開始新句子\n"
    "- 數據需保留完整（數值、單位、時間、對比基準）"
)

PAGE_PROMPT_TEMPLATE = """
分析第 {page_no} 頁內容。頁面分類：{page_class}。

頁面文字如下（如超長已截斷 4000 字）：
"""

PAGE_INSTRUCTIONS = """
## 任務要求
請對上述內容進行深入的四維度分析，**根據實際內容決定長度，避免強行湊字數**：

### 1. 頁面總覽 (page_summary: 建議50-400字)
- 概括本頁核心主題與主要內容
- 屬於文件的哪個部分
- 完整段落，流暢連貫
- **可視內容多寡調整長度，重質不重量**

### 2. 關鍵發現 (key_findings: 建議30-300字)
- 本頁最值得關注的發現或結論
- 揭示的趨勢或模式
- 直指重點，提供深入洞察
- **若無重大發現可簡短說明**

### 3. 核心數據 (data_points: 建議30-300字)
- 關鍵財務數據或業務指標
- 保留完整數值、單位、時間與對比
- 精確呈現量化資訊並提供脈絡
- **若本頁無數據可簡述「本頁未涉及具體數據」**

### 4. 風險與機會 (risks_opportunities: 建議30-300字)
- 潛在風險因素或挑戰
- 機會或正面因素
- 明確指出需警惕的要點與可能的應對方向
- **若本頁無風險內容可簡述「本頁無明顯風險提示」**

### 輸出格式（TOON）
```
page_detailed_analysis:
  page_summary: |
    本頁為XX部分，討論...
  key_findings: |
    核心發現為...
  data_points: |
    關鍵數據包括...
  risks_opportunities: |
    主要風險為...
```

### 品質標準
- **禁止條列式**：必須是連貫段落
- **質量優先**：根據實際內容決定長度，寧可簡短精準也不要冗長重複
- **基於原文**：嚴格基於本頁內容
- **允許簡短**：若某維度確實無內容，簡短說明即可
"""


GLOBAL_PROMPT_TEMPLATE = """
你必須生成一個完整的TOON格式輸出，包含4個部分。禁止遺漏任何部分。

輸入資料：

【頁面總覽】
{page_summaries}

【關鍵發現】
{key_findings}

【核心數據】
{data_points}

【風險機會】
{risks_opportunities}

輸出要求（**必須完整生成以下TOON結構**）：

1. **overview**: 基於【頁面總覽】，寫一段300-600字的段落
2. **key_conclusions**: 基於【關鍵發現】，寫一段200-400字的段落  
3. **core_data**: 基於【核心數據】，寫一段200-400字的段落
4. **risks_and_actions**: 基於【風險機會】，寫一段200-400字的段落

**TOON格式輸出（照抄此結構，填入內容）**：
```
global_summary:
  overview: |
    文件是...（這裡寫300-600字段落）
  expansions:
    key_conclusions: |
      關鍵發現是...（這裡寫200-400字段落）
    core_data: |
      核心數據顯示...（這裡寫200-400字段落）  
    risks_and_actions: |
      主要風險包括...（這裡寫200-400字段落）
```

**重要**：
- 必須生成完整的4個段落
- 禁止條列式，全部使用段落
- 不可遺漏 expansions 部分
"""


@dataclass
class PageDetailedAnalysis:
    """頁面詳細分析結果（四維度結構化）"""
    page_number: int
    classification: str
    page_summary: str           # 頁面總覽（200-300字）
    key_findings: str           # 關鍵發現（150-250字）
    data_points: str            # 核心數據（150-250字）
    risks_opportunities: str    # 風險與機會（150-250字）
    skipped: bool = False
    skip_reason: Optional[str] = None
    
    def to_legacy_format(self) -> "PageSummaryResult":
        """轉換為舊格式以保持向後兼容，清除TOON標籤"""
        if self.skipped:
            return PageSummaryResult(
                page_number=self.page_number,
                classification=self.classification,
                bullets=[f"〔p.{self.page_number}〕{self.skip_reason or '本頁跳過'}"],
                skipped=True,
                skip_reason=self.skip_reason
            )
        
        # 清理函數：移除TOON標籤
        def clean_toon_labels(text: str) -> str:
            import re
            # 移除所有 TOON 格式標籤和結構
            # 1. 移除完整的 TOON 標籤行（如 "key_findings: |"）
            text = re.sub(r'^\s*(page_summary|key_findings|data_points|risks_opportunities|page_detailed_analysis)\s*:\s*\|?\s*$', '', text, flags=re.MULTILINE)
            # 2. 移除內聯的 TOON 標籤（如文本中間出現的 "key_findings: |"）
            text = re.sub(r'(page_summary|key_findings|data_points|risks_opportunities|page_detailed_analysis)\s*:\s*\|', '', text)
            # 3. 移除 YAML/TOON 格式的縮排標記
            text = re.sub(r'^\s{2,}', '', text, flags=re.MULTILINE)
            # 4. 移除連續多個空行
            text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
            return text.strip()
        
        # 合併四個維度為單一 bullet（用於舊版兼容）
        combined_parts = []
        if self.page_summary:
            cleaned = clean_toon_labels(self.page_summary)
            if cleaned:
                combined_parts.append(f"【總覽】{cleaned}")
        if self.key_findings:
            cleaned = clean_toon_labels(self.key_findings)
            if cleaned:
                combined_parts.append(f"【發現】{cleaned}")
        if self.data_points:
            cleaned = clean_toon_labels(self.data_points)
            if cleaned:
                combined_parts.append(f"【數據】{cleaned}")
        if self.risks_opportunities:
            cleaned = clean_toon_labels(self.risks_opportunities)
            if cleaned:
                combined_parts.append(f"【風險】{cleaned}")
        
        combined = "\n\n".join(combined_parts) if combined_parts else "（無內容）"
        
        return PageSummaryResult(
            page_number=self.page_number,
            classification=self.classification,
            bullets=[f"〔p.{self.page_number}〕{combined}"],
            skipped=False,
            skip_reason=None
        )


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
    def _parse_toon_multiline(content: str, key: str, parent_key: str = None) -> str:
        """
        解析 TOON 格式的多行文字段落，支持嵌套結構
        
        格式範例:
        key_conclusions: |
          段落內容第一行
          段落內容第二行
        
        或嵌套格式:
        expansions:
          key_conclusions: |
            段落內容
        
        Args:
            content: 要解析的內容
            key: 要查找的key
            parent_key: 父級key（如果是嵌套結構）
        
        Returns:
            完整段落文字
        """
        import re
        
        # 如果有父級key，先提取父級內容塊
        if parent_key:
            # 找到父級key的內容塊
            parent_pattern = rf'{parent_key}:\s*\n((?:[ \t]+.+\n?)+)'
            parent_match = re.search(parent_pattern, content)
            if parent_match:
                content = parent_match.group(1)
        
        # 尋找 key: | 後的內容（支持縮進）
        # 更寬鬆的pattern，允許key前面有空格
        pattern = rf'^\s*{key}:\s*\|\s*\n((?:[ \t]+.+\n?)+)'
        match = re.search(pattern, content, re.MULTILINE)
        
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
            # 構建 API 參數字典
            api_params = {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_completion_tokens": 4000,  # 足夠的token限制以避免內容被截斷
            }
            
            # GPT-5-mini 和 GPT-5-nano 不支援自定義 temperature，只能使用默認值 1
            # 其他模型則可以使用自定義 temperature
            model_lower = self._model.lower()
            if "gpt-5-mini" not in model_lower and "gpt-5-nano" not in model_lower:
                api_params["temperature"] = 0.3  # 提高溫度值，給予AI更多思考空間，生成更豐富的洞察
            
            response = await self._client.chat.completions.create(**api_params)
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
            
            # 檢查是否為 page_detailed_analysis 格式（四維度頁面分析）
            if 'page_detailed_analysis' in content:
                page_summary = self._parse_toon_multiline(content, 'page_summary')
                key_findings = self._parse_toon_multiline(content, 'key_findings')
                data_points = self._parse_toon_multiline(content, 'data_points')
                risks_opportunities = self._parse_toon_multiline(content, 'risks_opportunities')
                
                parsed = {
                    "page_summary": page_summary,
                    "key_findings": key_findings,
                    "data_points": data_points,
                    "risks_opportunities": risks_opportunities
                }
                logger.info(f"解析 page_detailed_analysis: 總覽 {len(page_summary)} 字、發現 {len(key_findings)} 字、數據 {len(data_points)} 字、風險 {len(risks_opportunities)} 字")
            
            # 檢查是否為 page_summary 格式（段落或列表 - 舊格式向後兼容）
            elif 'page_summary' in content or 'summary:' in content or 'bullets[' in content:
                # 嘗試解析段落格式（summary: |\n ...）
                summary = self._parse_toon_multiline(content, 'summary')
                if summary:
                    # 如果有段落，將其包裝為單一 bullet
                    parsed = {"bullets": [summary]}
                    logger.info(f"解析 page_summary 段落: {len(summary)} 字")
                else:
                    # Fallback: 嘗試解析為列表格式
                    bullets = self._parse_toon_bullets(content)
                    parsed = {"bullets": bullets}
                    logger.info(f"解析 page_summary 列表: {len(bullets)} 條要點")
            
            # 檢查是否為 global_summary 格式
            elif 'global_summary' in content or 'overview:' in content or 'overview[' in content:
                # 解析 overview 段落（現在是單一段落而非列表）
                overview = self._parse_toon_multiline(content, 'overview')
                
                # 解析三個擴充段落，使用 parent_key 來正確提取嵌套字段
                key_conclusions = self._parse_toon_multiline(content, 'key_conclusions', parent_key='expansions')
                core_data = self._parse_toon_multiline(content, 'core_data', parent_key='expansions')
                risks_and_actions = self._parse_toon_multiline(content, 'risks_and_actions', parent_key='expansions')
                
                parsed = {
                    "overview": overview,  # 現在是字串而非列表
                    "expansions": {
                        "key_conclusions": key_conclusions,
                        "core_data": core_data,
                        "risks_and_actions": risks_and_actions
                    }
                }
                logger.info(f"解析 global_summary: overview {len(overview)} 字、key_conclusions {len(key_conclusions)} 字、core_data {len(core_data)} 字、risks_and_actions {len(risks_and_actions)} 字")
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

    async def _chat_simple(self, system_prompt: str, user_prompt: str) -> str:
        """直接调用LLM并返回文本响应，不进行TOON格式解析
        
        用于全局摘要等不需要结构化解析的场景，提高可靠性。
        
        Args:
            system_prompt: 系统提示词
            user_prompt: 用户提示词
            
        Returns:
            LLM返回的纯文本响应，失败时返回空字符串
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # 構建 API 參數字典
            api_params = {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "max_completion_tokens": 4000,  # 足夠的token限制以避免內容被截斷
            }
            
            # GPT-5-mini 和 GPT-5-nano 不支援自定義 temperature，只能使用默認值 1
            model_lower = self._model.lower()
            if "gpt-5-mini" not in model_lower and "gpt-5-nano" not in model_lower:
                api_params["temperature"] = 0.3
            
            response = await self._client.chat.completions.create(**api_params)
            content = response.choices[0].message.content or ""
            return content.strip()
            
        except Exception as exc:
            logger.error(f"_chat_simple API 調用失敗: {exc}")
            return ""


    async def summarize_page(self, page: ClassifiedPage) -> PageDetailedAnalysis:
        """生成頁面的四維度詳細分析"""
        # 跳過目錄、封面、純圖片、空白頁，這些頁面不會出現在報告中
        if page.classification in SKIP_CLASS_LABELS and page.classification != "normal":
            return PageDetailedAnalysis(
                page_number=page.page_number,
                classification=page.classification,
                page_summary="",
                key_findings="",
                data_points="",
                risks_opportunities="",
                skipped=True,
                skip_reason=f"已跳過{page.classification}類型頁面",
            )

        text = page.text[:4000]
        prompt = PAGE_PROMPT_TEMPLATE.format(page_no=page.page_number, page_class=page.classification)
        user_prompt = f"{prompt}\n{text}\n\n{PAGE_INSTRUCTIONS}".strip()
        data = await self._chat_toon(SYSTEM_PROMPT, user_prompt)
        
        # 檢查是否成功解析四維度
        if "page_summary" in data:
            # 成功解析四維度分析
            # 降低最低字數要求，避免因字數不足而丟棄內容
            page_summary = self._ensure_min_length(data.get("page_summary", "").strip(), 15)  # 從150降到15
            key_findings = self._ensure_min_length(data.get("key_findings", "").strip(), 10)  # 從100降到10
            data_points = self._ensure_min_length(data.get("data_points", "").strip(), 10)  # 從100降到10
            risks_opportunities = self._ensure_min_length(data.get("risks_opportunities", "").strip(), 10)  # 從100降到10
            
            # 限制最大長度（確保總計不超過1300字）
            page_summary = self._trim_to_limit(page_summary, 400)
            key_findings = self._trim_to_limit(key_findings, 300)
            data_points = self._trim_to_limit(data_points, 300)
            risks_opportunities = self._trim_to_limit(risks_opportunities, 300)
            
            return PageDetailedAnalysis(
                page_number=page.page_number,
                classification=page.classification,
                page_summary=page_summary,
                key_findings=key_findings,
                data_points=data_points,
                risks_opportunities=risks_opportunities,
                skipped=False,
                skip_reason=None,
            )
        else:
            # Fallback: 如果未能解析四維度，使用傳統 fallback
            fallback_text = self._fallback_bullets(page)[0]  # 獲取單一段落
            return PageDetailedAnalysis(
                page_number=page.page_number,
                classification=page.classification,
                page_summary=fallback_text,
                key_findings="本頁未能生成詳細分析。",
                data_points="本頁未能提取核心數據。",
                risks_opportunities="本頁未能識別風險與機會。",
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

    async def synthesize_global(self, page_results: List[PageDetailedAnalysis]) -> GlobalSummary:
        """基於四維度頁面分析生成全局彙整 - 使用简单文本生成提升可靠性"""
        # 分別收集各維度內容
        page_summaries = []
        key_findings = []
        data_points = []
        risks_opportunities = []
        
        for page in page_results:
            if not page.skipped:
                page_summaries.append(f"【第{page.page_number}頁】{page.page_summary}")
                if page.key_findings:
                    key_findings.append(f"【第{page.page_number}頁】{page.key_findings}")
                if page.data_points:
                    data_points.append(f"【第{page.page_number}頁】{page.data_points}")
                if page.risks_opportunities:
                    risks_opportunities.append(f"【第{page.page_number}頁】{page.risks_opportunities}")
        
        import logging
        logger = logging.getLogger(__name__)
        
        # 1. 生成全局總覽（基於所有頁面的page_summary）
        overview_text = ""
        if page_summaries:
            overview_prompt = f"""你的任務是基於以下各頁面的總覽內容，撰寫一段簡潔的全局文檔摘要。

【各頁面總覽】：
{chr(10).join(page_summaries[:60])}

【輸出要求】：
1. 撰寫一段300-600字的連貫段落
2. 提煉整份文件的核心主題與結構
3. 說明文件類型、主要內容與目的
4. 使用客觀、專業的語氣
5. **直接輸出段落文本，不要添加任何標題、標籤或格式標記**

現在請撰寫全局摘要："""
            
            try:
                overview_text = await self._chat_simple(SYSTEM_PROMPT, overview_prompt)
                if len(overview_text) < 100:  # 太短，使用fallback
                    # 從第一頁摘要中提取內容，確保移除TOON標籤並智能截斷到完整句子
                    if page_summaries:
                        import re
                        first_page = page_summaries[0]
                        # 移除【第X頁】前綴
                        first_page = re.sub(r'^【第\d+頁】', '', first_page)
                        # 清理可能的TOON標籤
                        first_page = re.sub(r'(page_summary|key_findings|data_points|risks_opportunities|page_detailed_analysis)\s*:\s*\|', '', first_page)
                        first_page = first_page.strip()
                        # 使用 _trim_to_limit 確保完整句子截斷
                        truncated = self._trim_to_limit(first_page, 500)
                        overview_text = "本文檔涵蓋多個主題。" + truncated
                    else:
                        overview_text = "本文檔涵蓋多個主題。"
                overview_text = self._trim_to_limit(overview_text, 600)
                logger.info(f"生成全局總覽: {len(overview_text)} 字")
            except Exception as e:
                logger.error(f"生成全局總覽失敗: {e}")
                overview_text = "本文檔進行了全面分析，請參考逐頁內容以了解詳情。"
        else:
            overview_text = "本文檔內容不足以生成摘要。"
        
        # 2. 生成關鍵結論（基於所有頁面的key_findings）
        key_conclusions = ""
        if key_findings:
            conclusions_prompt = f"""請基於以下各頁面的關鍵發現，提煉出整體的關鍵結論。

【各頁面關鍵發現】：
{chr(10).join(key_findings[:60])}

【輸出要求】：
1. 撰寫一段200-400字的連貫段落
2. 提煉最重要的發現與結論
3. 識別主要趨勢或模式
4. 突出最值得關注的洞察
5. **直接輸出段落文本，不要添加標題或格式標記**

現在請撰寫關鍵結論："""
            
            try:
                key_conclusions = await self._chat_simple(SYSTEM_PROMPT, conclusions_prompt)
                if len(key_conclusions) < 50:
                    # 智能fallback：提取第一個發現並截斷到完整句子
                    if key_findings:
                        import re
                        first_finding = key_findings[0]
                        first_finding = re.sub(r'^【第\d+頁】', '', first_finding)
                        first_finding = re.sub(r'(page_summary|key_findings|data_points|risks_opportunities|page_detailed_analysis)\s*:\s*\|', '', first_finding).strip()
                        # 使用 _trim_to_limit 確保完整句子截斷
                        truncated = self._trim_to_limit(first_finding, 400)
                        key_conclusions = "核心發現包括：" + truncated
                    else:
                        key_conclusions = "請參考逐頁分析。"
                key_conclusions = self._trim_to_limit(key_conclusions, 400)
                logger.info(f"生成關鍵結論: {len(key_conclusions)} 字")
            except Exception as e:
                logger.error(f"生成關鍵結論失敗: {e}")
                key_conclusions = "主要發現請參考各頁面的關鍵發現部分。"
        else:
            key_conclusions = "本文件未涉及重大發現或結論。"
        
        # 3. 生成核心數據（基於所有頁面的data_points）
        core_data = ""
        if data_points:
            data_prompt = f"""請基於以下各頁面的核心數據，彙整出關鍵數據總結。

【各頁面核心數據】：
{chr(10).join(data_points[:60])}

【輸出要求】：
1. 撰寫一段200-400字的連貫段落
2. 整合最重要的財務或業務數據  
3. 保留關鍵數值、時間、對比資訊
4. 突出數據之間的關聯或趨勢
5. **直接輸出段落文本，不要添加標題或格式標記**

現在請撰寫核心數據總結："""
            
            try:
                core_data = await self._chat_simple(SYSTEM_PROMPT, data_prompt)
                if len(core_data) < 50:
                    # 智能fallback
                    if data_points:
                        import re
                        first_data = data_points[0]
                        first_data = re.sub(r'^【第\d+頁】', '', first_data)
                        first_data = re.sub(r'(page_summary|key_findings|data_points|risks_opportunities|page_detailed_analysis)\s*:\s*\|', '', first_data).strip()
                        # 使用 _trim_to_limit 確保完整句子截斷
                        truncated = self._trim_to_limit(first_data, 400)
                        core_data = "關鍵數據包括：" + truncated
                    else:
                        core_data = "請參考逐頁分析。"
                core_data = self._trim_to_limit(core_data, 400)
                logger.info(f"生成核心數據: {len(core_data)} 字")
            except Exception as e:
                logger.error(f"生成核心數據失敗: {e}")
                core_data = "核心數據請參考各頁面的數據部分。"
        else:
            core_data = "本文件未涉及具體量化數據。"
        
        # 4. 生成風險與建議（基於所有頁面的risks_opportunities）
        risks_and_actions = ""
        if risks_opportunities:
            risks_prompt = f"""請基於以下各頁面的風險與機會，彙整出風險與建議總結。

【各頁面風險與機會】：
{chr(10).join(risks_opportunities[:60])}

【輸出要求】：
1. 撰寫一段200-400字的連貫段落
2. 識別最重要的風險因素與機會
3. 提供可行的應對建議或行動方向
4. 平衡風險警示與機會把握
5. **直接輸出段落文本，不要添加標題或格式標記**

現在請撰寫風險與建議總結："""
            
            try:
                risks_and_actions = await self._chat_simple(SYSTEM_PROMPT, risks_prompt)
                if len(risks_and_actions) < 50:
                    # 智能fallback
                    if risks_opportunities:
                        import re
                        first_risk = risks_opportunities[0]
                        first_risk = re.sub(r'^【第\d+頁】', '', first_risk)
                        first_risk = re.sub(r'(page_summary|key_findings|data_points|risks_opportunities|page_detailed_analysis)\s*:\s*\|', '', first_risk).strip()
                        # 使用 _trim_to_limit 確保完整句子截斷
                        truncated = self._trim_to_limit(first_risk, 400)
                        risks_and_actions = "主要風險包括：" + truncated
                    else:
                        risks_and_actions = "請參考逐頁分析。"
                risks_and_actions = self._trim_to_limit(risks_and_actions, 400)
                logger.info(f"生成風險與建議: {len(risks_and_actions)} 字")
            except Exception as e:
                logger.error(f"生成風險與建議失敗: {e}")
                risks_and_actions = "風險評估請參考各頁面的風險與機會部分。"
        else:
            risks_and_actions = "本文件未明確提及風險或機會。"
        
        # 組裝最終結果
        expansions = GlobalSummaryExpansions(
            key_conclusions=key_conclusions,
            core_data=core_data,
            risks_and_actions=risks_and_actions,
        )

        # 將 overview 包裝為列表以保持數據結構兼容
        overview_bullets = [overview_text] if overview_text else ["本文檔內容不足以生成完整摘要。"]

        return GlobalSummary(bullets=overview_bullets, expansions=expansions)


    @staticmethod
    def _trim_to_limit(text: str, limit: int) -> str:
        """智能截斷文字，在句子邊界處結束而非中途截斷"""
        stripped = text.strip()
        if len(stripped) <= limit:
            return stripped
        
        # 如果需要截斷，在句子邊界處截斷
        truncated = stripped[:limit]
        
        # 定義句子結束標點（優先級從高到低）
        # 優先在完整句子處截斷（。！？），其次才考慮其他標點
        primary_endings = ['。', '！', '？']
        secondary_endings = ['；', '：', '，', '、']
        
        # 首先嘗試在主要句子結束標點處截斷
        best_pos = -1
        for ending in primary_endings:
            pos = truncated.rfind(ending)
            if pos > len(truncated) * 0.5:  # 至少保留50%的內容以獲得完整句子
                best_pos = pos
                break
        
        # 如果找不到主要標點，嘗試次要標點
        if best_pos <= 0:
            for ending in secondary_endings:
                pos = truncated.rfind(ending)
                if pos > len(truncated) * 0.7:  # 次要標點要求保留更多內容
                    best_pos = pos
                    break
        
        if best_pos > 0:
            # 在標點符號之後截斷（包含標點）
            return truncated[:best_pos + 1].rstrip()
        else:
            # 如果找不到合適的標點，嘗試在最後一個空格或中文字符處截斷
            # 對於中文，盡量避免在詞語中間截斷
            last_space = truncated.rfind(' ')
            if last_space > len(truncated) * 0.8:
                return truncated[:last_space].rstrip() + "。"
            # 最後的fallback：返回原文而不是空字符串
            # 如果文字已經很短，保留完整內容總比丟失好
            if len(stripped) <= limit * 1.2:  # 如果只超出20%，保留完整
                return stripped
            # 真的太長，在80%處硬截斷並加句號
            safe_pos = int(limit * 0.8)
            return stripped[:safe_pos].rstrip() + "。"

    @staticmethod
    def _prefix_bullet(page_number: int, bullet: str) -> str:
        core = bullet.replace("..", "").replace("…", "").strip()
        return f"〔p.{page_number}〕• {core}"

    @staticmethod
    def _fallback_bullets(page: ClassifiedPage) -> List[str]:
        """生成 fallback 段落摘要（而非列表）"""
        lines = [line for line in page.text.splitlines() if line.strip()]
        
        # 收集文字直到達到 200-500 字
        paragraph_parts: List[str] = []
        total_length = 0
        target_length = 350  # 目標長度
        
        for line in lines:
            if total_length >= target_length:
                break
            clean_line = line.strip()
            if clean_line:
                paragraph_parts.append(clean_line)
                total_length += len(clean_line)
        
        # 組合成段落
        if paragraph_parts:
            # 使用句號或逗號連接，形成自然段落
            paragraph = ""
            for i, part in enumerate(paragraph_parts):
                if i > 0 and not paragraph.endswith(('。', '，', '、', '；')):
                    paragraph += "。"
                paragraph += part
                if total_length >= 200:
                    break
            
            # 確保以句號結尾
            if paragraph and not paragraph.endswith('。'):
                paragraph += "。"
            
            # 限制最大長度
            if len(paragraph) > 500:
                paragraph = paragraph[:497] + "。"
            
            summary = f"〔p.{page.page_number}〕{paragraph}"
        else:
            summary = f"〔p.{page.page_number}〕本頁內容過短，僅偵測到零散文字，建議人工檢視原文以獲取完整上下文資訊。"
        
        # 確保至少 200 字
        summary = SummaryEngine._ensure_min_length_static(summary, 200)
        
        return [summary]

    @staticmethod
    def _ensure_min_length(text: str, min_chars: int) -> str:
        return SummaryEngine._ensure_min_length_static(text, min_chars)

    @staticmethod
    def _ensure_min_length_static(text: str, min_chars: int) -> str:
        """確保最小長度，但如果內容本身就短，直接返回不填充"""
        stripped = text.strip()
        # 如果有内容就直接返回，不管长度
        if stripped:
            return stripped
        # 只有在完全没有内容时才返回提示
        return "本頁無相關內容。"
