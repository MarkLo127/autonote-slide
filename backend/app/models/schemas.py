from typing import List, Optional

from pydantic import BaseModel, Field


class PageSummary(BaseModel):
    page_number: int
    classification: str
    bullets: List[str]
    keywords: List[str] = Field(default_factory=list)
    skipped: bool
    skip_reason: Optional[str] = None


class GlobalSummaryExpansions(BaseModel):
    key_conclusions: str
    core_data: str
    risks_and_actions: str


class GlobalSummary(BaseModel):
    bullets: List[str]
    expansions: GlobalSummaryExpansions


# 模型特定的預設配置
# 根據每個模型的速率限制（TPM/RPM）優化配置
# 使用最大速率以獲得最快處理速度
MODEL_CONFIGS = {
    "gpt-5.1-2025-11-13": {
        # TPM: 30,000, RPM: 500
        # 瓶頸在 TPM，但仍盡可能提高速度
        "max_requests_per_minute": 50,
        "request_delay": 0.05,
        "concurrency": 20,
        "max_retries": 5,
    },
    "gpt-5-mini-2025-08-07": {
        # TPM: 500,000, RPM: 500
        # 全速運行，接近 RPM 上限
        "max_requests_per_minute": 480,
        "request_delay": 0.01,
        "concurrency": 100,
        "max_retries": 5,
    },
    "gpt-5-nano-2025-08-07": {
        # TPM: 200,000, RPM: 500
        # 全速運行
        "max_requests_per_minute": 400,
        "request_delay": 0.02,
        "concurrency": 80,
        "max_retries": 5,
    },
}





class LLMSettings(BaseModel):
    api_key: str
    base_url: Optional[str] = None
    model: str = "gpt-5-mini-2025-08-07"
    max_requests_per_minute: int = 10  # 每分鐘最大請求數
    request_delay: float = 0.5  # 請求間延遲（秒）
    max_retries: int = 3  # 最大重試次數
    concurrency: int = 2  # 並發請求數
    
    # Vision API 相關配置
    enable_vision: bool = False  # 是否啟用圖片分析
    vision_model: str = "gpt-4o"  # Vision 模型（gpt-4o, gpt-4o-mini 等）
    min_image_width: int = 200  # 最小圖片寬度（像素），小於此值的圖片會被忽略
    min_image_height: int = 150  # 最小圖片高度（像素）
    min_image_size_kb: float = 10.0  # 最小圖片大小（KB）
    max_images_per_page: int = 5  # 每頁最多分析幾張圖片

    @classmethod
    def from_model(
        cls,
        api_key: str,
        model: str,
        base_url: Optional[str] = None,
        **overrides
    ) -> "LLMSettings":
        """
        根據模型名稱自動選擇最佳配置。
        
        Args:
            api_key: OpenAI API 金鑰
            model: 模型名稱
            base_url: 自訂 API base URL（可選）
            **overrides: 覆寫特定配置參數
            
        Returns:
            配置好的 LLMSettings 實例
            
        Example:
            # 自動配置
            settings = LLMSettings.from_model(
                api_key="sk-xxx",
                model="gpt-5-mini-2025-08-07"
            )
            
            # 自動配置 + 覆寫並發數
            settings = LLMSettings.from_model(
                api_key="sk-xxx",
                model="gpt-5-mini-2025-08-07",
                concurrency=100
            )
        """
        # 獲取模型配置，如果找不到則使用 mini 的配置作為預設
        config = MODEL_CONFIGS.get(model, MODEL_CONFIGS["gpt-5-mini-2025-08-07"])
        
        # 合併預設配置和覆寫參數
        return cls(
            api_key=api_key,
            model=model,
            base_url=base_url,
            **{**config, **overrides}
        )


class Paragraph(BaseModel):
    index: int
    text: str
    start_char: int
    end_char: int

class SummaryItem(BaseModel):
    paragraph_index: int
    summary: str

class KeywordItem(BaseModel):
    paragraph_index: int
    keywords: List[str]

class AnalyzeResponse(BaseModel):
    language: str
    total_pages: int
    page_summaries: List[PageSummary]
    global_summary: GlobalSummary
    system_prompt: Optional[str] = None
    wordcloud_image_url: Optional[str] = None
