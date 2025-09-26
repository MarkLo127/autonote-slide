import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import streamlit as st
from PIL import Image, UnidentifiedImageError


# 將專案根目錄加入 sys.path，方便引用 backend 套件
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend.app.core.config import UPLOAD_DIR  # noqa: E402  # isort:skip
from backend.app.models.schemas import LLMSettings  # noqa: E402  # isort:skip
from backend.app.services.nlp.keyword_extractor import (  # noqa: E402  # isort:skip
    extract_keywords_by_paragraph,
)
from backend.app.services.nlp.language_detect import detect_lang  # noqa: E402  # isort:skip
from backend.app.services.nlp.segmenter import ensure_offsets_if_needed  # noqa: E402  # isort:skip
from backend.app.services.nlp.summarizer import (  # noqa: E402  # isort:skip
    summarize_by_paragraph,
    summarize_global,
)
from backend.app.services.parsing.file_loader import (  # noqa: E402  # isort:skip
    load_file_as_text_and_paragraphs,
)
from backend.app.services.wordcloud.wordcloud_gen import (  # noqa: E402  # isort:skip
    build_wordcloud,
)

