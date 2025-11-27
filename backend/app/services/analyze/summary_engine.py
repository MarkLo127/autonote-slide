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
請對上述內容進行精簡的四維度分析，**總字數控制在100-650字以內**：

### 1. 頁面總覽 (page_summary: 80-200字)
- 概括本頁核心主題與主要內容
- 屬於文件的哪個部分
- 完整段落，流暢連貫

### 2. 關鍵發現 (key_findings: 60-150字)
- 本頁最值得關注的發現或結論
- 揭示的趨勢或模式
- 直指重點，避免贅述

### 3. 核心數據 (data_points: 60-150字)
- 關鍵財務數據或業務指標
- 保留完整數值、單位、時間與對比
- 精確呈現量化資訊

### 4. 風險與機會 (risks_opportunities: 60-150字)
- 潛在風險因素或挑戰
- 機會或正面因素
- 明確指出需警惕的要點

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
- **簡潔精準**：每個維度簡明扼要，總計100-650字
- **基於原文**：嚴格基於本頁內容
- 如某維度無內容可簡述「本頁未涉及」
"""


GLOBAL_PROMPT_TEMPLATE = """
## 全局彙整任務

您將收到來自文件各頁面的四個維度分析結果。請基於這些分類輸入，生成針對性的全局彙整。

### 輸入資料

#### 【頁面總覽彙總】
{page_summaries}

#### 【關鍵發現彙總】
{key_findings}

#### 【核心數據彙總】
{data_points}

#### 【風險與機會彙總】
{risks_opportunities}

---

### 輸出要求

請生成以下四個全局分析段落，每個段落基於對應的維度輸入：

#### 1. 全局總結 (overview: 300-600字)
- **輸入來源**：基於「頁面總覽彙總」
- **目的**：從宏觀視角綜述整份文件的核心內容與意義
- **內容要求**：
  - 整份文件的主要主題與目的是什麼？
  - 文件的整體結構與邏輯是怎樣的？
  - 涵蓋哪些關鍵領域或板塊？
  - 對讀者或决策者的意義何在？
- **風格**：高層次綜述，提供完整全景視圖
- **格式**：單一連貫段落，300-600字

#### 2. 關鍵結論 (key_conclusions: 200-400字)
- **輸入來源**：基於「關鍵發現彙總」
- **目的**：提煉跨頁面的核心洞察與戰略意涵
- **內容要求**：
  - 跨頁面整合後最重要的發現是什麼？
  - 呈現什麼整體趨勢或模式？
  - 對業務或策略有什麼重要啟示？
  - 必須標註來源頁碼（格式：〔p.3〕或〔p.5-7〕）
- **風格**：聚焦核心，突出關鍵洞察
- **格式**：單一連貫段落，200-400字

#### 3. 核心數據與依據 (core_data: 200-400字)
- **輸入來源**：基於「核心數據彙總」
- **目的**：整合重要量化指標，呈現數據全貌與趨勢
- **內容要求**：
  - 最關鍵的財務或業務指標有哪些？
  - 數據呈現什麼整體趨勢或變化？
  - 各項指標之間有什麼關聯或對比？
  - 必須保留完整數值、單位、時間與頁碼標記
- **風格**：數據導向，精確量化
- **格式**：單一連貫段落，200-400字

#### 4. 風險與建議 (risks_and_actions: 200-400字)
- **輸入來源**：基於「風險與機會彙總」
- **目的**：識別主要風險並提出針對性建議
- **內容要求**：
  - 文件揭示的主要風險因素有哪些？
  - 哪些不確定性或挑戰需要特別關注？
  - 有哪些機會或正面因素？
  - 建議採取什麼行動或決策？
  - 必須標示相關頁碼參照
- **風格**：風險導向，提供可執行建議
- **格式**：單一連貫段落，200-400字

### 輸出格式（TOON）
```
global_summary:
  overview: |
    本文件為XX公司的XX報告，主要涵蓋...整體而言...（300-600字完整段落）
  expansions:
    key_conclusions: |
      跨頁面分析顯示...核心發現包括...〔p.5-7〕...綜合來看...（200-400字完整段落）
    core_data: |
      財務數據方面...〔p.3〕...同時...〔p.15-18〕...整體趨勢...（200-400字完整段落）
    risks_and_actions: |
      主要風險因素包括...〔p.22〕...此外...建議...（200-400字完整段落）
```

### 品質標準
- **禁止條列式**：所有內容必須是連貫段落，不可使用編號或符號分點
- **針對性強**：每個維度嚴格基於對應的輸入來源，避免資訊混雜
- **跨頁整合**：綜合多個頁面的資訊，提煉整體觀點而非簡單堆砌
- **語氣明確**：避免模糊表述（「可能」「也許」等），基於實證下結論
- **結構完整**：每個段落都需邏輯清晰連貫，自然收尾
- **頁碼標註**：在擴充分析中必須標註來源頁碼
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
        """轉換為舊格式以保持向後兼容"""
        if self.skipped:
            return PageSummaryResult(
                page_number=self.page_number,
                classification=self.classification,
                bullets=[f"〔p.{self.page_number}〕{self.skip_reason or '本頁跳過'}"],
                skipped=True,
                skip_reason=self.skip_reason
            )
        
        # 合併四個維度為單一 bullet（用於舊版兼容）
        combined_parts = []
        if self.page_summary:
            combined_parts.append(f"【總覽】{self.page_summary}")
        if self.key_findings:
            combined_parts.append(f"【發現】{self.key_findings}")
        if self.data_points:
            combined_parts.append(f"【數據】{self.data_points}")
        if self.risks_opportunities:
            combined_parts.append(f"【風險】{self.risks_opportunities}")
        
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
                
                # 解析三個擴充段落
                key_conclusions = self._parse_toon_multiline(content, 'key_conclusions')
                core_data = self._parse_toon_multiline(content, 'core_data')
                risks_and_actions = self._parse_toon_multiline(content, 'risks_and_actions')
                
                parsed = {
                    "overview": overview,  # 現在是字串而非列表
                    "expansions": {
                        "key_conclusions": key_conclusions,
                        "core_data": core_data,
                        "risks_and_actions": risks_and_actions
                    }
                }
                logger.info(f"解析 global_summary: overview {len(overview)} 字")
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


    async def summarize_page(self, page: ClassifiedPage) -> PageDetailedAnalysis:
        """生成頁面的四維度詳細分析"""
        if page.classification in SKIP_CLASS_LABELS and page.classification != "normal":
            reason = self._ensure_min_length(
                page.skip_reason or "〈本頁跳過〉內容不足以生成摘要。",
                55,
            )
            return PageDetailedAnalysis(
                page_number=page.page_number,
                classification=page.classification,
                page_summary=reason,
                key_findings="",
                data_points="",
                risks_opportunities="",
                skipped=True,
                skip_reason=page.skip_reason,
            )

        text = page.text[:4000]
        prompt = PAGE_PROMPT_TEMPLATE.format(page_no=page.page_number, page_class=page.classification)
        user_prompt = f"{prompt}\n{text}\n\n{PAGE_INSTRUCTIONS}".strip()
        data = await self._chat_toon(SYSTEM_PROMPT, user_prompt)
        
        # 檢查是否成功解析四維度
        if "page_summary" in data:
            # 成功解析四維度分析
            page_summary = self._ensure_min_length(data.get("page_summary", "").strip(), 80)
            key_findings = self._ensure_min_length(data.get("key_findings", "").strip(), 60)
            data_points = self._ensure_min_length(data.get("data_points", "").strip(), 60)
            risks_opportunities = self._ensure_min_length(data.get("risks_opportunities", "").strip(), 60)
            
            # 限制最大長度（確保總計不超過650字）
            page_summary = self._trim_to_limit(page_summary, 200)
            key_findings = self._trim_to_limit(key_findings, 150)
            data_points = self._trim_to_limit(data_points, 150)
            risks_opportunities = self._trim_to_limit(risks_opportunities, 150)
            
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
        """基於四維度頁面分析生成全局彙整"""
        # 分別收集各維度內容
        page_summaries = []
        key_findings = []
        data_points = []
        risks_opportunities = []
        
        for page in page_results:
            if not page.skipped:
                page_summaries.append(f"〔p.{page.page_number}〕{page.page_summary}")
                key_findings.append(f"〔p.{page.page_number}〕{page.key_findings}")
                data_points.append(f"〔p.{page.page_number}〕{page.data_points}")
                risks_opportunities.append(f"〔p.{page.page_number}〕{page.risks_opportunities}")
        
        # 組織分維度的提示詞輸入（限制每個維度的字數以避免超token）
        page_summaries_text = "\n\n".join(page_summaries[:80])  # 約前80頁
        key_findings_text = "\n\n".join(key_findings[:80])
        data_points_text = "\n\n".join(data_points[:80])
        risks_opportunities_text = "\n\n".join(risks_opportunities[:80])
        
        # 調用 LLM 生成全局分析
        prompt = GLOBAL_PROMPT_TEMPLATE.format(
            page_summaries=page_summaries_text or "暫無內容",
            key_findings=key_findings_text or "暫無內容",
            data_points=data_points_text or "暫無內容",
            risks_opportunities=risks_opportunities_text or "暫無內容"
        )
        
        data = await self._chat_toon(SYSTEM_PROMPT, prompt)

        # 處理 overview - 現在是單一段落而非列表
        overview_text = data.get("overview", "")
        if isinstance(overview_text, list):
            # Fallback: 如果返回列表，合併為段落
            overview_text = " ".join([str(item).strip() for item in overview_text if item])
        
        # 確保 overview 段落至少 300 字
        overview_text = self._ensure_min_length(overview_text.strip(), 300)
        # 限制最大 600 字
        overview_text = self._trim_to_limit(overview_text, 600)
        
        expansions_raw = data.get("expansions", {})
        
        # 調試日誌
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"全局彙整解析結果 - overview 長度: {len(overview_text)}")
        logger.info(f"expansions_raw 鍵: {expansions_raw.keys() if expansions_raw else '無'}")
        if expansions_raw:
            logger.info(f"key_conclusions 長度: {len(expansions_raw.get('key_conclusions', ''))}")
            logger.info(f"core_data 長度: {len(expansions_raw.get('core_data', ''))}")
            logger.info(f"risks_and_actions 長度: {len(expansions_raw.get('risks_and_actions', ''))}")

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

        # 將單一 overview 段落包裝為列表以保持數據結構兼容
        overview_bullets = [overview_text] if overview_text else ["〔全局摘要〕（待補要點）本文檔內容不足以生成完整摘要，建議人工檢視原始文件以獲取完整上下文資訊。"]

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
        sentence_endings = ['。', '！', '？', '；', '：', '，', '、']
        
        # 從後往前找最近的句子結束標點
        best_pos = -1
        for ending in sentence_endings:
            pos = truncated.rfind(ending)
            if pos > len(truncated) * 0.7:  # 至少保留70%的內容
                best_pos = pos
                break
        
        if best_pos > 0:
            # 在標點符號之後截斷（包含標點）
            return truncated[:best_pos + 1].rstrip()
        else:
            # 如果找不到合適的標點，在最後一個空格處截斷
            last_space = truncated.rfind(' ')
            if last_space > len(truncated) * 0.8:
                return truncated[:last_space].rstrip() + "。"
            # 最後的fallback：硬截斷但加句號
            return truncated.rstrip() + "。"

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
