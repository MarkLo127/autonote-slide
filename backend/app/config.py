from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    LLM_API_KEY: str
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: Optional[str] = None
    MAX_TOKENS: int = 2000

    class Config:
        env_file = ".env"

settings = Settings()
