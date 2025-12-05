#!/usr/bin/env python3
import re

def fix_jsx_attributes(filepath):
    """修復所有缺少結尾引號的 JSX/HTML 屬性"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修復模式：屬性名="值（沒有結尾引號，後面是新行或下一個屬性）
    # 例如：className="abc 應該變成 className="abc"
    # 例如：fill="none 應該變成 fill="none"
    
    # 模式1：屬性="值\n下一行開始空白
    pattern1 = r'(\w+)="([^"\n]+)\n(\s+)'
    content = re.sub(pattern1, r'\1="\2"\n\3', content)
    
    # 模式2：屬性="值\n下一行或結尾
    pattern2 = r'(\w+)="([^"\n]+)$'
    content = re.sub(pattern2, r'\1="\2"', content, flags=re.MULTILINE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed {filepath}")

if __name__ == "__main__":
    files = [
        "src/app/page.tsx",
        "src/app/results/page.tsx",
        "src/components/ApiSettingsDialog.tsx",
        "src/components/Header.tsx"
    ]
    for f in files:
        try:
            fix_jsx_attributes(f)
        except Exception as e:
            print(f"Error fixing {f}: {e}")
