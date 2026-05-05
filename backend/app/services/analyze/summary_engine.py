"""LLM powered summarisation orchestrator aligned with new spec."""

from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from dataclasses import dataclass
from typing import Awaitable, Callable, List

from openai import AsyncOpenAI

from backend.app.models.schemas import GlobalSummary, LLMSettings
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
    "您是專業的文件分析專家，專精於以最精簡的語言提煉核心資訊。\n"
    "\n"
    "## 核心原則\n"
    "1. **精簡優先**：字數越少越好，只要意思清楚即可，嚴禁冗長\n"
    "2. **精準性**：嚴格基於原文內容，禁止臆測或補充未提及資訊\n"
    "3. **專業性**：採用繁體中文，根據文件類型使用適當專業語彙\n"
    "4. **客觀性**：不添加外部知識、個人觀點或假設性推論\n"
    "\n"
    "## 語言規範\n"
    "- 全程繁體中文，清晰易懂\n"
    "- 禁止逐字摘抄原文\n"
    "- 禁止省略號或未完成句式\n"
    "- 數據保留完整（數值、單位、時間、對比基準）"
)

PAGE_PROMPT_TEMPLATE = """
分析第 {page_no} 頁內容。頁面分類：{page_class}。

頁面文字如下（如超長已截斷 4000 字）：
"""

PAGE_INSTRUCTIONS = """
## 任務要求
請對上述內容進行**極度簡潔**的四維度分析：

### 1. 頁面總覽 (page_summary: 最多60字，一句話)
- 一句話說明本頁核心主題

### 2. 關鍵發現 (key_findings: 最多3條，每條以「- 」開頭，每條≤25字)
- 列出最值得關注的發現或結論
- 若無，輸出「- 無」

### 3. 核心數據 (data_points: 最多3筆，格式「- 指標：數值」，每條≤30字)
- 保留完整數值、單位、時間
- 若無，輸出「- 無」

### 4. 建議事項 (risks_opportunities: 最多2條，每條以「- 」開頭，每條≤20字)
- 需注意的事項或可行建議
- 若無，輸出「- 無」

### 輸出格式（TOON）
```
page_detailed_analysis:
  page_summary: |
    本頁介紹...（一句話）
  key_findings: |
    - 發現一
    - 發現二
  data_points: |
    - 指標：數值
  risks_opportunities: |
    - 建議一
```

### 品質標準
- **精簡優先**：字數越少越好，意思清楚即可
- **嚴格基於原文**：不添加原文沒有的資訊
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
    
    @staticmethod
    def _parse_bullet_lines(text: str) -> List[str]:
        """從條列式文字中提取要點（支援「- 」和「• 」開頭）"""
        if not text:
            return []
        lines = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith('- ') or line.startswith('• '):
                item = line[2:].strip()
            elif line.startswith('-') and len(line) > 1 and line[1] != '-':
                item = line[1:].strip()
            else:
                continue
            if item and item not in ('無', '無。', 'N/A', 'n/a'):
                lines.append(item)
        return lines

    def to_structured(self, keywords: List[str] = None):
        """轉換為結構化的 PageSummary 格式"""
        from backend.app.models.schemas import PageSummary as SchemasPageSummary
        kw = keywords or []

        if self.skipped:
            return SchemasPageSummary(
                page_number=self.page_number,
                classification=self.classification,
                summary=self.skip_reason or "本頁跳過",
                findings=[],
                data=[],
                actions=[],
                keywords=kw,
                skipped=True,
                skip_reason=self.skip_reason,
            )

        summary = self.page_summary.strip()
        if summary.startswith('- '):
            summary = summary[2:].strip()

        return SchemasPageSummary(
            page_number=self.page_number,
            classification=self.classification,
            summary=summary,
            findings=self._parse_bullet_lines(self.key_findings),
            data=self._parse_bullet_lines(self.data_points),
            actions=self._parse_bullet_lines(self.risks_opportunities),
            keywords=kw,
            skipped=False,
            skip_reason=None,
        )



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
        
        if "page_summary" in data:
            page_summary = self._trim_to_limit(data.get("page_summary", "").strip(), 100)
            if not page_summary:
                page_summary = f"第{page.page_number}頁內容。"

            return PageDetailedAnalysis(
                page_number=page.page_number,
                classification=page.classification,
                page_summary=page_summary,
                key_findings=data.get("key_findings", "").strip(),
                data_points=data.get("data_points", "").strip(),
                risks_opportunities=data.get("risks_opportunities", "").strip(),
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
    ) -> List[PageDetailedAnalysis]:
        semaphore = asyncio.Semaphore(self._concurrency)
        results: List[PageDetailedAnalysis | None] = [None] * len(pages)

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
        page_summaries_list = []
        key_findings_list = []
        data_points_list = []
        risks_list = []

        for page in page_results:
            if not page.skipped:
                page_summaries_list.append(f"p{page.page_number}: {page.page_summary}")
                if page.key_findings:
                    key_findings_list.append(f"p{page.page_number}: {page.key_findings}")
                if page.data_points:
                    data_points_list.append(f"p{page.page_number}: {page.data_points}")
                if page.risks_opportunities:
                    risks_list.append(f"p{page.page_number}: {page.risks_opportunities}")

        import logging
        logger = logging.getLogger(__name__)

        # 1. 全局總覽（3-5句話的段落）
        overview = "本文檔內容不足以生成摘要。"
        if page_summaries_list:
            overview_prompt = f"""基於以下各頁面總覽，以3至5句話撰寫全局摘要。

{chr(10).join(page_summaries_list[:60])}

【要求】：3至5句完整句子，說明文件類型、主題與目的，客觀專業，直接輸出不要標題。"""
            try:
                overview = await self._chat_simple(SYSTEM_PROMPT, overview_prompt)
                if len(overview) < 20:
                    overview = page_summaries_list[0].split(': ', 1)[-1] if page_summaries_list else overview
                overview = self._trim_to_limit(overview, 300)
                logger.info(f"全局總覽: {len(overview)} 字")
            except Exception as e:
                logger.error(f"生成全局總覽失敗: {e}")

        # 2. 關鍵結論（最多5條要點）
        key_conclusions: List[str] = []
        if key_findings_list:
            prompt = f"""基於以下各頁面的關鍵發現，提煉最多5條整體關鍵結論。

{chr(10).join(key_findings_list[:60])}

【要求】每條以「- 」開頭，最多30字，直接輸出條列不要前言，若無內容輸出「- 無」。"""
            try:
                raw = await self._chat_simple(SYSTEM_PROMPT, prompt)
                key_conclusions = PageDetailedAnalysis._parse_bullet_lines(raw)
                logger.info(f"關鍵結論: {len(key_conclusions)} 條")
            except Exception as e:
                logger.error(f"生成關鍵結論失敗: {e}")

        # 3. 核心數據（最多5筆）
        core_data: List[str] = []
        if data_points_list:
            prompt = f"""基於以下各頁面核心數據，提煉最多5筆最重要的量化指標。

{chr(10).join(data_points_list[:60])}

【要求】每筆以「- 」開頭，格式「指標：數值（背景）」，保留單位與時間，直接輸出條列不要前言，若無數據輸出「- 無」。"""
            try:
                raw = await self._chat_simple(SYSTEM_PROMPT, prompt)
                core_data = PageDetailedAnalysis._parse_bullet_lines(raw)
                logger.info(f"核心數據: {len(core_data)} 筆")
            except Exception as e:
                logger.error(f"生成核心數據失敗: {e}")

        # 4. 行動建議（最多3條）
        risks_and_actions: List[str] = []
        if risks_list:
            prompt = f"""基於以下各頁面的注意事項，提煉最多3條最重要的建議行動。

{chr(10).join(risks_list[:60])}

【要求】每條以「- 」開頭，以動詞開頭，最多25字，直接輸出條列不要前言，若無內容輸出「- 無」。"""
            try:
                raw = await self._chat_simple(SYSTEM_PROMPT, prompt)
                risks_and_actions = PageDetailedAnalysis._parse_bullet_lines(raw)
                logger.info(f"行動建議: {len(risks_and_actions)} 條")
            except Exception as e:
                logger.error(f"生成行動建議失敗: {e}")

        return GlobalSummary(
            overview=overview,
            key_conclusions=key_conclusions,
            core_data=core_data,
            risks_and_actions=risks_and_actions,
        )


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
