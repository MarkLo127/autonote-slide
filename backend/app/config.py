from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 啟動時可為空；由前端每請求以 Header 傳入
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-5-mini-2025-08-07"
    LLM_BASE_URL: Optional[str] = None
    MAX_TOKENS: int = 2000

    class Config:
        env_file = ".env"

settings = Settings()
