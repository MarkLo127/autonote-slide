#!/usr/bin/env python3
import re
import sys

def fix_classname_strings(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修復 className="...\n 沒有結尾引號的情況
    # 匹配模式：className="xxx（沒有引號結尾）然後是換行
    pattern = r'className="([^"]*)\n'
    
    def replacer(match):
        # 檢查是否確實缺少結尾引號
        line = match.group(0)
        if line.count('"') % 2 != 0:  # 奇數個引號，表示缺少結尾
            return match.group(0).rstrip('\n') + '"\n'
        return match.group(0)
    
    fixed = re.sub(pattern, replacer, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(fixed)
    
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
            fix_classname_strings(f)
        except Exception as e:
            print(f"Error fixing {f}: {e}")
