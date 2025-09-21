import os, shlex, tempfile, json
from typing import Dict, Any, List
from .utils import run_cmd

def _escape(s: str) -> str:
    return s.replace('"','\\"')

def _build_dot(summary: Dict[str, Any], keywords: Dict[str, Any]) -> str:
    # Simple hierarchical mind map using Graphviz
    lang = summary.get("language", "auto")
    title = "心智圖 / Mind Map" if lang.startswith("zh") or lang == "auto" else "Mind Map"
    lines = ['digraph G {', 'rankdir=LR;', 'node [shape=box, style="rounded,filled", fillcolor="#f0f0f0"];']
    lines.append(f'"root" [label="{_escape(title)}", shape=oval, fillcolor="#d0e4fe"];')

    points: List[dict] = summary.get("points", [])
    for i, p in enumerate(points, start=1):
        pid = f"p{i}"
        lines.append(f'"{pid}" [label="{_escape(p.get("title","Point"))}"];')
        lines.append(f'"root" -> "{pid}";')
        for j, b in enumerate(p.get("bullets", [])[:6], start=1):
            bid = f"{pid}_b{j}"
            lines.append(f'"{bid}" [label="{_escape(b)}", shape=note, fillcolor="#fff9c4"];')
            lines.append(f'"{pid}" -> "{bid}";')

    # global keywords
    gk = keywords.get("global_keywords", [])
    if gk:
        lines.append(f'"kw" [label="Keywords: {", ".join(_escape(x) for x in gk[:12])}", shape=folder, fillcolor="#e1f5fe"];')
        lines.append('"root" -> "kw";')

    lines.append('}')
    return "\n".join(lines)

def make_mindmap(summary: Dict[str, Any], keywords: Dict[str, Any], out_pdf: str):
    dot = _build_dot(summary, keywords)
    tmp_dot = out_pdf.replace(".pdf", ".dot")
    with open(tmp_dot, "w", encoding="utf-8") as f:
        f.write(dot)
    cmd = f'dot -Tpdf {shlex.quote(tmp_dot)} -o {shlex.quote(out_pdf)}'
    run_cmd(cmd)
