from __future__ import annotations
from typing import Dict, List

# Normalize the outline JSON (title + children[ {title, children}... ])

def _normalize(node: dict) -> dict:
    title = node.get("title") or node.get("name") or node.get("text") or "節點"
    raw_children = node.get("children") or []
    children = []
    for c in raw_children:
        if isinstance(c, dict):
            children.append(_normalize(c))
        elif isinstance(c, str):
            children.append({"title": c, "children": []})
    return {"title": str(title), "children": children}


def to_mermaid(node: dict) -> str:
    """Convert normalized outline to Mermaid mindmap text."""
    lines: List[str] = ["mindmap"]

    def walk(n: dict, indent: int) -> None:
        prefix = "  " * indent
        lines.append(f"{prefix}{n['title']}")
        for ch in n.get("children", []) or []:
            walk(ch, indent + 1)

    walk(node, 1)
    return "\n".join(lines)


def build_mindmap_from_outline(outline_json: dict, *, language: str = "zh") -> Dict:
    root = _normalize(outline_json or {"title": "文件", "children": []})
    mermaid = to_mermaid(root)
    return {"root": root, "mermaid": mermaid}