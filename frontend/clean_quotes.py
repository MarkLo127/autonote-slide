#!/usr/bin/env python3
import re

def clean_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    cleaned_lines = []
    for i, line in enumerate(lines):
        # 移除只包含空白和一個引號的行
        if line.strip() == '"':
            print(f"{filepath}:{i+1} - Removing standalone quote")
            continue
        
        # 移除行尾的孤立引號（但保留正常的字串結尾）
        # 例如：onClick={onClose}" 應該改為 onClick={onClose}
        line = re.sub(r'([a-zA-Z0-9_})])"\s*$', r'\1\n', line)
        
        cleaned_lines.append(line)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(cleaned_lines)
    
    print(f"Cleaned {filepath}")

if __name__ == "__main__":
    files = [
        "src/app/page.tsx",
        "src/app/results/page.tsx",
        "src/components/ApiSettingsDialog.tsx",
        "src/components/Header.tsx"
    ]
    for f in files:
        try:
            clean_file(f)
        except Exception as e:
            print(f"Error cleaning {f}: {e}")
