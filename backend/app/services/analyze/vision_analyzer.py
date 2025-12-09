"""Vision API 分析器 - 使用 Vision LLM 分析圖片內容"""

from __future__ import annotations

import base64
from typing import Optional

from openai import AsyncOpenAI


class VisionAnalyzer:
    """使用 OpenAI Vision API 分析圖片內容"""
    
    def __init__(self, client: AsyncOpenAI, model: str, rate_limiter=None):
        """
        初始化 Vision 分析器
        
        Args:
            client: AsyncOpenAI 客戶端
            model: Vision 模型名稱（如 gpt-4o, gpt-4o-mini）
            rate_limiter: 速率限制器（可選）
        """
        self.client = client
        self.model = model
        self.rate_limiter = rate_limiter
    
    async def analyze_image(
        self,
        image_bytes: bytes,
        context: str = "",
        page_number: int = 0
    ) -> str:
        """
        使用 Vision API 分析圖片內容
        
        Args:
            image_bytes: 圖片的二進制數據
            context: 頁面文字上下文（可選，幫助理解圖片）
            page_number: 頁碼（用於錯誤處理）
            
        Returns:
            圖片的文字描述
        """
        try:
            # 使用速率限制器
            if self.rate_limiter:
                await self.rate_limiter.acquire()
            
            # 轉換為 base64
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            
            # 構建 prompt
            prompt = self._build_prompt(context)
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{base64_image}",
                                    "detail": "low"  # 使用低解析度節省成本
                                }
                            }
                        ]
                    }
                ],
                max_completion_tokens=300,
                temperature=0.1  # 極低溫度值，確保嚴格依據圖片內容描述，不過度想像
            )
            
            content = response.choices[0].message.content or ""
            return content.strip()
            
        except Exception as e:
            # Vision API 失敗不應該影響整體處理
            return f"（圖片分析失敗）"
    
    def _build_prompt(self, context: str) -> str:
        """
        構建分析 prompt
        
        Args:
            context: 頁面文字上下文
            
        Returns:
            完整的 prompt
        """
        base_prompt = (
            "請用繁體中文簡潔描述這張圖片的重要內容（50-100 字）：\n"
            "- 如果是圖表（柱狀圖、折線圖、餅圖等），請說明數據趨勢、關鍵數值和結論\n"
            "- 如果是流程圖或架構圖，請說明主要步驟或組件關係\n"
            "- 如果是示意圖或概念圖，請說明核心概念\n"
            "- 如果是表格，請提取關鍵數據和結論\n"
            "- 如果是照片，請說明重點內容和意義\n"
            "保持客觀、精確，避免冗長描述。"
        )
        
        if context:
            # 提供上下文幫助理解圖片
            context_snippet = context[:300]
            return f"頁面文字摘要：{context_snippet}\n\n{base_prompt}"
        
        return base_prompt
    
    async def analyze_multiple_images(
        self,
        images: list,
        context: str = "",
        page_number: int = 0
    ) -> list[str]:
        """
        批量分析多張圖片（序列處理，避免過多並發）
        
        Args:
            images: ExtractedImage 對象列表
            context: 頁面文字上下文
            page_number: 頁碼
            
        Returns:
            圖片描述列表
        """
        descriptions = []
        
        for img in images:
            desc = await self.analyze_image(
                img.image_bytes,
                context,
                page_number
            )
            descriptions.append(desc)
        
        return descriptions
