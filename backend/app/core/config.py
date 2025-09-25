import os
from typing import Optional, Tuple

# === 專案路徑 ===
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
UPLOAD_DIR = os.path.join(STORAGE_DIR, "uploads")
WORDCLOUD_DIR = os.path.join(STORAGE_DIR, "wordclouds")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")

# 靜態檔對外
STATIC_DIR = STORAGE_DIR
STATIC_MOUNT = "/static"

# === 字型自動搜尋 ===
FONT_EXTS = (".ttf", ".otf", ".ttc")
PREFERRED_KEYWORDS = [  # 依序加分，越前面權重越高
    "NotoSansTC", "Noto Sans TC",
    "NotoSansCJK", "Noto Sans CJK",
    "SourceHanSans", "Source Han Sans", "思源黑體",
]

def _score_font(path: str) -> int:
    """根據檔名是否包含偏好關鍵字給分，越高越優先。"""
    name = os.path.basename(path)
    score = 0
    for i, kw in enumerate(PREFERRED_KEYWORDS):
        if kw.lower().replace(" ", "") in name.lower().replace(" ", ""):
            score += (len(PREFERRED_KEYWORDS) - i) * 10
    # 檔名較短通常較乾淨
    score += max(0, 50 - len(name))
    return score

def _discover_font(root: str) -> Optional[str]:
    """在 root（含子資料夾）尋找第一個合適字型，依 score 決勝。"""
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
    # 依分數高→低、再以路徑字典序穩定排序
    candidates.sort(key=lambda x: (-x[1], x[0]))
    return candidates[0][0]

def _normalize(path: Optional[str]) -> Optional[str]:
    return os.path.abspath(path) if path else None

# 允許環境變數覆寫（最高優先）
ENV_ZH_FONT = os.getenv("FONT_ZH_PATH")
DEFAULT_ZH_FONT = _normalize(ENV_ZH_FONT) or _normalize(_discover_font(FONTS_DIR))
DEFAULT_EN_FONT = None  # 英文不強制指定

# 啟動時確保資料夾存在
for d in (STORAGE_DIR, UPLOAD_DIR, WORDCLOUD_DIR, FONTS_DIR):
    os.makedirs(d, exist_ok=True)

# 友善提示（不拋錯，讓上層決定是否要報錯）
if DEFAULT_ZH_FONT is None:
    # 你可以改成 logging.warning
    print(
        "[warn] 未在 assets/fonts/ 找到中文字型（.ttf/.otf/.ttc）。"
        " 建議放入 Noto Sans TC 或 Noto Sans CJK；或設定環境變數 FONT_ZH_PATH 指向字型檔。"
    )
