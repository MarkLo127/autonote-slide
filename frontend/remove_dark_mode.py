#!/usr/bin/env python3
"""
Carefully remove dark: Tailwind class modifiers without breaking syntax.
This only removes the dark: prefix, leaving the rest of the class intact.
"""
import re

def remove_dark_classes(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern: dark:classname (with or without dash/slash after colon)
    # Example: dark:bg-slate-800 -> (removed)
    # Example: dark:text-white -> (removed)
    # This pattern matches dark: followed by any valid class name characters
    # and removes the entire dark:classname token
    pattern = r'\sdark:[a-zA-Z0-9_\-/\[\]\.]+(?=\s|"|\'|>|$)'
    
    original_length = len(content)
    content = re.sub(pattern, '', content)
    removed_length = original_length - len(content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Processed {filepath}: removed {removed_length} characters")

if __name__ == "__main__":
    files = [
        "src/app/page.tsx",
        "src/app/results/page.tsx",
        "src/components/ApiSettingsDialog.tsx",
        "src/components/Header.tsx",
        "src/app/analyze/page.tsx"
    ]
    for f in files:
        try:
            remove_dark_classes(f)
        except FileNotFoundError:
            print(f"Skipped {f}: file not found")
        except Exception as e:
            print(f"Error processing {f}: {e}")
