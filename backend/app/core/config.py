import os
from typing import Optional

# === 專案路徑 ===
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
UPLOAD_DIR = os.path.join(STORAGE_DIR, "uploads")
WORDCLOUD_DIR = os.path.join(STORAGE_DIR, "wordclouds")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")

STATIC_DIR = STORAGE_DIR
STATIC_MOUNT = "/static"

# === 字型自動搜尋 ===
FONT_EXTS = (".ttf", ".otf", ".ttc")
PREFERRED_KEYWORDS = [
    "NotoSansTC", "Noto Sans TC",
    "NotoSansCJK", "Noto Sans CJK",
    "SourceHanSans", "Source Han Sans", "思源黑體",
]

def _score_font(path: str) -> int:
    name = os.path.basename(path)
    score = 0
    for i, kw in enumerate(PREFERRED_KEYWORDS):
        if kw.lower().replace(" ", "") in name.lower().replace(" ", ""):
            score += (len(PREFERRED_KEYWORDS) - i) * 10
    score += max(0, 50 - len(name))  # 檔名越短加分
    return score

def _discover_font(root: str) -> Optional[str]:
    if not os.path.isdir(root):
        return None
    candidates = []
    for r, _, files in os.walk(root):
        for f in files:
            if f.lower().endswith(FONT_EXTS):
                p = os.path.join(r, f)
                candidates.append((p, _score_font(p)))
    if not candidates:
        return None
    candidates.sort(key=lambda x: (-x[1], x[0]))  # 高分優先，其次字典序
    return candidates[0][0]

def _normalize(path: Optional[str]) -> Optional[str]:
    return os.path.abspath(path) if path else None

# 允許環境變數覆寫（最高優先）
ENV_ZH_FONT = os.getenv("FONT_ZH_PATH")
DEFAULT_ZH_FONT = _normalize(ENV_ZH_FONT) or _normalize(_discover_font(FONTS_DIR))
DEFAULT_EN_FONT = None  # 英文不強制指定

# ⚠️ 不主動建立任何資料夾；由實際用到的服務（上傳/文字雲）各自建立即可
# 友善提示（不拋錯）
if DEFAULT_ZH_FONT is None:
    print(
        "[warn] 未在 assets/fonts/ 找到中文字型（.ttf/.otf/.ttc）。"
        " 建議放入 Noto Sans TC / Noto Sans CJK，或設環境變數 FONT_ZH_PATH 指向字型檔。"
    )
