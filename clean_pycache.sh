#!/usr/bin/env bash
set -e

# 預設清理當前目錄，也可以傳入指定目錄
TARGET_DIR="${1:-.}"

echo "🧹 Cleaning __pycache__ under: $TARGET_DIR"

# 找到所有 __pycache__ 並刪除
find "$TARGET_DIR" -type d -name "__pycache__" -exec rm -rf {} +

echo "✅ Done. All __pycache__ removed."