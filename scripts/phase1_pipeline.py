#!/usr/bin/env python3
"""
Phase 1 串通驗證腳本：PDF → Qwen2.5 摘要 → 翻譯

目的：在還沒包成 API / 服務之前，用一支 script 串通整條 pipeline，
      實測「品質」（印出結果）與「速度」（各階段耗時、tokens/sec）。

摘要（Qwen2.5-Instruct，透過 llama.cpp llama-server / Ollama 的 OpenAI 相容 /v1）
      讀英文 → 直接輸出正體中文摘要（逐段 + 全局彙整）。

翻譯（可切換 --translator）：
  * qwen（預設，技術文推薦）：同一顆 Qwen2.5 一模兩用，術語一致性高、正體中文穩定。
  * nllb（通用 / 多語）：NLLB-200-distilled（CTranslate2 int8），速度快、支援 200+ 語言，
                          但密集技術文品質較弱。

用法：
  python scripts/phase1_pipeline.py --check
  python scripts/phase1_pipeline.py paper.pdf                    # 預設 Qwen 翻譯
  python scripts/phase1_pipeline.py paper.pdf --translator nllb  # 改用 NLLB
  python scripts/phase1_pipeline.py paper.pdf --no-translate     # 只測摘要

依賴與模型準備請見 scripts/README.md。
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

# ── 重依賴延遲載入，讓 --help / 部分模式在缺套件時仍能給出清楚訊息 ──

# NLLB 語言代碼 → 給 LLM 用的人類可讀語言名稱
LANG_NAMES = {
    "zho_Hant": "正體中文（繁體）",
    "zho_Hans": "簡體中文",
    "eng_Latn": "English",
    "jpn_Jpan": "日本語",
}


def _die(msg: str, code: int = 1) -> "None":
    print(f"\n[ERROR] {msg}", file=sys.stderr)
    sys.exit(code)


_OPENCC = None  # 延遲載入的 s2t 轉換器單例


def to_traditional(text: str) -> str:
    """用 OpenCC s2t 把殘留簡體字轉正體（確定性保底，補 LLM 偶發繁簡漂移）。"""
    global _OPENCC
    if _OPENCC is None:
        try:
            import opencc

            _OPENCC = opencc.OpenCC("s2t")
        except ImportError:
            _die("缺少 opencc，請先 `pip install -r backend/requirements.txt`")
    return _OPENCC.convert(text)


@contextmanager
def timer():
    """量測一段程式耗時（秒）。用法：with timer() as t: ...; t.elapsed"""

    class _T:
        elapsed = 0.0

    t = _T()
    start = time.perf_counter()
    try:
        yield t
    finally:
        t.elapsed = time.perf_counter() - start


# ────────────────────────────── PDF 擷取與分段 ──────────────────────────────


def extract_pages(pdf_path: Path) -> list[str]:
    """用 PyMuPDF 抽每頁純文字（此步不需要 AI）。"""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        _die("缺少 PyMuPDF，請先 `pip install -r backend/requirements.txt`")
    doc = fitz.open(pdf_path)
    pages = [page.get_text("text").strip() for page in doc]
    doc.close()
    return pages


def chunk_pages(pages: list[str], max_chars: int) -> list[str]:
    """把連續頁面依字元預算聚成 chunk，盡量在頁界切開以維持語意完整。"""
    chunks: list[str] = []
    buf = ""
    for page in pages:
        if not page:
            continue
        if buf and len(buf) + len(page) > max_chars:
            chunks.append(buf)
            buf = page
        else:
            buf = f"{buf}\n\n{page}" if buf else page
    if buf:
        chunks.append(buf)
    return chunks


_SENT_SPLIT = re.compile(r"(?<=[.!?。！？])\s+")


def split_sentences(text: str) -> list[str]:
    """粗略斷句：NLLB 是句級 MT，逐句翻譯品質與速度都較穩。"""
    parts: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts.extend(s.strip() for s in _SENT_SPLIT.split(line) if s.strip())
    return parts


# ────────────────────────────── 共用 LLM Client（OpenAI 相容） ──────────────────────────────


@dataclass
class ChatResult:
    text: str
    elapsed: float
    completion_tokens: int = 0

    @property
    def tokens_per_sec(self) -> float:
        return self.completion_tokens / self.elapsed if self.elapsed > 0 else 0.0


class LLMClient:
    """OpenAI 相容端點的極簡 client（llama-server / Ollama 皆可）。摘要與翻譯共用。"""

    def __init__(self, base_url: str, model: str, timeout: float = 600.0):
        try:
            import httpx
        except ImportError:
            _die("缺少 httpx，請先 `pip install -r backend/requirements.txt`")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.Client(timeout=timeout)

    def list_models(self) -> str:
        """確認端點可連線，回傳可用的 model 名稱字串。"""
        try:
            r = self.client.get(f"{self.base_url}/models")
            r.raise_for_status()
            data = r.json().get("data", [])
            return ", ".join(m.get("id", "?") for m in data) or "(無)"
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(
                f"無法連線推理端點 {self.base_url}（{e}）。"
                "請先啟動 llama-server / Ollama 並載入 Qwen2.5，見 scripts/README.md"
            ) from e

    def chat(self, system: str, user: str, max_tokens: int, temperature: float = 0.3) -> ChatResult:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        with timer() as t:
            r = self.client.post(f"{self.base_url}/chat/completions", json=payload)
            r.raise_for_status()
            data = r.json()
        text = data["choices"][0]["message"]["content"].strip()
        usage = data.get("usage") or {}
        return ChatResult(text, t.elapsed, int(usage.get("completion_tokens", 0)))


# ────────────────────────────── 摘要（Qwen2.5） ──────────────────────────────


class Summarizer:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def summarize_chunk(self, text: str, max_tokens: int = 400) -> ChatResult:
        system = (
            "你是專業的技術文件摘要助手。請用**正體中文（繁體）**，"
            "以條列方式精煉重點，忠於原文、不杜撰，不要加入開場白。"
        )
        return self.llm.chat(system, f"請摘要以下內容的重點：\n\n{text}", max_tokens)

    def summarize_global(self, chunk_summaries: list[str], max_tokens: int = 700) -> ChatResult:
        system = (
            "你是專業的技術文件摘要助手。請用**正體中文（繁體）**，"
            "將多段分頁摘要彙整為四個面向：結論、關鍵數據、風險/限制、行動建議。"
            "以標題 + 條列呈現，忠於原文、不杜撰。"
        )
        joined = "\n\n".join(f"[段落 {i + 1}]\n{s}" for i, s in enumerate(chunk_summaries))
        return self.llm.chat(system, f"以下是各段落摘要，請彙整成全局重點：\n\n{joined}", max_tokens)


# ────────────────────────────── 翻譯 ──────────────────────────────


@dataclass
class TranslateResult:
    text: str
    elapsed: float
    n_sentences: int = 0
    completion_tokens: int = 0


class QwenTranslator:
    """一模兩用：用同一顆 Qwen2.5 做翻譯，術語一致性高、正體中文穩定（技術文推薦）。"""

    def __init__(self, llm: LLMClient, tgt_lang: str = "zho_Hant"):
        self.llm = llm
        self.tgt_name = LANG_NAMES.get(tgt_lang, tgt_lang)

    def translate(self, text: str) -> TranslateResult:
        system = (
            f"你是專業技術文件翻譯，將內容忠實譯成{self.tgt_name}。嚴格遵守：\n"
            "1. 人名、作者名、機構/單位名一律保留英文原樣，不翻譯也不音譯"
            "（例：Haoran Wei 保持 Haoran Wei，不可譯成「華然·魏」或「華羅」）。\n"
            "2. 模型、演算法、專有名詞與縮寫保留原文，必要時中英並陳"
            "（例：DeepEncoder V2、raster-scan、LLM、VLMs）。\n"
            "3. 用詞精準：依上下文選正確詞義（如 genuine→真正、非「真誠」）；術語前後一致。\n"
            "4. 保留原文段落結構；只輸出譯文本身，不要任何說明、開場白或標註。"
        )
        # 譯文長度約與原文相當，依字元數動態給 token 上限
        max_tokens = min(2048, len(text) // 2 + 400)
        res = self.llm.chat(system, text, max_tokens, temperature=0.2)
        return TranslateResult(
            res.text, res.elapsed, len(split_sentences(text)), res.completion_tokens
        )


class NLLBTranslator:
    """通用 / 多語：CTranslate2 載入 NLLB-200-distilled（int8）。句級 MT，速度快。"""

    def __init__(
        self,
        ct2_dir: str,
        tokenizer_src: str,
        src_lang: str = "eng_Latn",
        tgt_lang: str = "zho_Hant",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        try:
            import ctranslate2
            import transformers
        except ImportError:
            _die(
                "缺少 ctranslate2 / transformers，"
                "請先 `pip install -r backend/requirements.txt`"
            )
        if not Path(ct2_dir).exists():
            raise RuntimeError(
                f"找不到 NLLB CTranslate2 模型目錄：{ct2_dir}。"
                "請先用 ct2-transformers-converter 轉檔，見 scripts/README.md"
            )
        self.src_lang = src_lang
        self.tgt_lang = tgt_lang
        self.tokenizer = transformers.AutoTokenizer.from_pretrained(
            tokenizer_src, src_lang=src_lang
        )
        self.translator = ctranslate2.Translator(
            ct2_dir, device=device, compute_type=compute_type
        )

    def _translate_sentences(self, sentences: list[str]) -> list[str]:
        if not sentences:
            return []
        sources = [
            self.tokenizer.convert_ids_to_tokens(self.tokenizer.encode(s))
            for s in sentences
        ]
        results = self.translator.translate_batch(
            sources,
            target_prefix=[[self.tgt_lang]] * len(sources),
            beam_size=2,
            max_batch_size=16,
        )
        out: list[str] = []
        for res in results:
            tokens = res.hypotheses[0]
            if tokens and tokens[0] == self.tgt_lang:
                tokens = tokens[1:]
            ids = self.tokenizer.convert_tokens_to_ids(tokens)
            out.append(self.tokenizer.decode(ids, skip_special_tokens=True))
        return out

    def translate(self, text: str) -> TranslateResult:
        sentences = split_sentences(text)
        with timer() as t:
            translated = self._translate_sentences(sentences)
        return TranslateResult(" ".join(translated), t.elapsed, len(sentences))


def build_translator(args, llm: LLMClient | None):
    if args.translator == "qwen":
        if llm is None:
            llm = LLMClient(args.summarize_url, args.model)
        return QwenTranslator(llm, args.target_lang)
    return NLLBTranslator(
        args.nllb_ct2_dir, args.nllb_tokenizer, args.src_lang, args.target_lang,
        device=args.nllb_device,
    )


# ────────────────────────────── 主流程 ──────────────────────────────


@dataclass
class Stats:
    stage_times: dict[str, float] = field(default_factory=dict)


def run_check(args) -> int:
    print("== 環境檢查 ==")
    ok = True

    try:
        llm = LLMClient(args.summarize_url, args.model)
        names = llm.list_models()
        print(f"[OK ] 推理端點 {args.summarize_url} 可連線；可用模型：{names}")
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"[FAIL] {e}")

    if args.translator == "nllb":
        try:
            NLLBTranslator(
                args.nllb_ct2_dir, args.nllb_tokenizer, args.src_lang, args.target_lang
            )
            print(f"[OK ] NLLB CTranslate2 模型載入成功：{args.nllb_ct2_dir}")
        except Exception as e:  # noqa: BLE001
            ok = False
            print(f"[FAIL] {e}")
    else:
        print("[--] 翻譯器 = qwen（一模兩用），不需要 NLLB 模型")

    print("\n結果：", "全部就緒 ✅" if ok else "尚有項目未就緒 ❌")
    return 0 if ok else 1


def run_pipeline(args) -> int:
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        _die(f"找不到 PDF：{pdf_path}")

    stats = Stats()
    print(f"== Phase 1 pipeline：{pdf_path.name}（翻譯器={args.translator}）==\n")

    # 1) 擷取
    with timer() as t:
        pages = extract_pages(pdf_path)
    stats.stage_times["pdf_extract"] = t.elapsed
    chunks = chunk_pages(pages, args.max_chunk_chars)
    total_chars = sum(len(p) for p in pages)
    print(
        f"[擷取] {len(pages)} 頁、{total_chars:,} 字元 → {len(chunks)} 個 chunk"
        f"（{t.elapsed:.2f}s）\n"
    )
    if not chunks:
        _die("PDF 未擷取到文字（可能是掃描版，Phase 7 才會加 OCR）。")

    # 準備模型（摘要與 Qwen 翻譯共用同一個 LLMClient）
    llm = None if (args.no_summarize and args.translator != "qwen") else LLMClient(
        args.summarize_url, args.model
    )
    summarizer = None if args.no_summarize else Summarizer(llm)
    translator = None if args.no_translate else build_translator(args, llm)

    # 目標為正體中文時，對 Qwen 中文輸出做 OpenCC s2t 保底（可用 --no-opencc 關閉）
    use_opencc = args.target_lang == "zho_Hant" and not args.no_opencc
    fix = to_traditional if use_opencc else (lambda s: s)
    if use_opencc:
        print("[OpenCC] 已啟用 s2t 繁體保底\n")

    n = min(len(chunks), args.max_chunks) if args.max_chunks else len(chunks)
    chunk_summaries: list[str] = []
    sum_tok, sum_time, tr_time, tr_sents, tr_tok = 0, 0.0, 0.0, 0, 0

    for i in range(n):
        chunk = chunks[i]
        print(f"────── Chunk {i + 1}/{n}（{len(chunk):,} 字元）──────")
        print(f"原文節錄：{chunk[:160].replace(chr(10), ' ')}…\n")

        if summarizer:
            res = summarizer.summarize_chunk(chunk)
            res.text = fix(res.text)
            chunk_summaries.append(res.text)
            sum_tok += res.completion_tokens
            sum_time += res.elapsed
            tps = f"、{res.tokens_per_sec:.1f} tok/s" if res.completion_tokens else ""
            print(f"【摘要 · Qwen2.5】（{res.elapsed:.2f}s{tps}）\n{res.text}\n")

        if translator:
            sample = chunk[: args.translate_chars]
            tr = translator.translate(sample)
            tr.text = fix(tr.text)
            tr_time += tr.elapsed
            tr_sents += tr.n_sentences
            tr_tok += tr.completion_tokens
            label = "Qwen2.5" if args.translator == "qwen" else "NLLB"
            print(f"【翻譯 · {label}】（{tr.elapsed:.2f}s、{tr.n_sentences} 句）\n{tr.text}\n")

    # 全局彙整
    if summarizer and chunk_summaries:
        print("────── 全局彙整 ──────")
        gs = summarizer.summarize_global(chunk_summaries)
        gs.text = fix(gs.text)
        sum_tok += gs.completion_tokens
        sum_time += gs.elapsed
        print(f"（{gs.elapsed:.2f}s）\n{gs.text}\n")

    # ── 速度總表 ──
    print("══════════ 速度報告 ══════════")
    print(f"PDF 擷取         ：{stats.stage_times['pdf_extract']:.2f}s")
    if summarizer:
        avg = sum_time / (n + 1) if n else 0
        tps = f"，平均 {sum_tok / sum_time:.1f} tok/s" if sum_time else ""
        print(
            f"摘要（Qwen2.5）  ：{sum_time:.2f}s（{n} 段 + 全局，"
            f"共 {sum_tok} tok{tps}，平均 {avg:.2f}s/段）"
        )
    if translator:
        label = "Qwen2.5" if args.translator == "qwen" else "NLLB"
        if args.translator == "qwen":
            extra = f"，{tr_tok / tr_time:.1f} tok/s" if tr_time else ""
            print(f"翻譯（{label}）  ：{tr_time:.2f}s（{n} 段、共 {tr_tok} tok{extra}）")
        else:
            sps = f"，{tr_sents / tr_time:.1f} 句/s" if tr_time else ""
            print(f"翻譯（{label}）     ：{tr_time:.2f}s（{tr_sents} 句{sps}）")
    total = stats.stage_times["pdf_extract"] + sum_time + tr_time
    print(f"合計             ：{total:.2f}s")
    print("\n提示：首次推理含載入 / 暖機，較慢屬正常；重跑同檔可觀察穩定速度。")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Phase 1 串通驗證：PDF → Qwen2.5 摘要 → 翻譯",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("pdf", nargs="?", help="要處理的 PDF 路徑")
    p.add_argument("--check", action="store_true", help="只檢查環境是否就緒")

    # 摘要 / Qwen 翻譯（OpenAI 相容端點）
    p.add_argument("--summarize-url", default="http://localhost:11434/v1",
                   help="OpenAI 相容端點（llama-server / Ollama 皆可）")
    p.add_argument("--model", default="qwen2.5:3b-instruct",
                   help="Qwen2.5 模型名稱（需與 server 載入的一致）")

    # 翻譯器選擇
    p.add_argument("--translator", default="qwen", choices=["qwen", "nllb"],
                   help="qwen=一模兩用(技術文推薦)；nllb=通用/多語")

    # NLLB（僅 --translator nllb 時需要）
    p.add_argument("--nllb-ct2-dir", default="models/nllb-200-distilled-600m-ct2",
                   help="NLLB 的 CTranslate2 轉檔目錄")
    p.add_argument("--nllb-tokenizer", default="facebook/nllb-200-distilled-600M",
                   help="NLLB tokenizer 來源（HF id 或本地路徑）")
    p.add_argument("--nllb-device", default="cpu", choices=["cpu", "cuda"])
    p.add_argument("--src-lang", default="eng_Latn", help="原文語言代碼（NLLB 用）")
    p.add_argument("--target-lang", default="zho_Hant", help="目標語言代碼")

    # 流程控制
    p.add_argument("--max-chunk-chars", type=int, default=6000, help="每個 chunk 的字元上限")
    p.add_argument("--max-chunks", type=int, default=3,
                   help="最多處理幾個 chunk（0=全部；驗證時建議留小值）")
    p.add_argument("--translate-chars", type=int, default=1500,
                   help="每個 chunk 取多少字元原文做翻譯對照樣本")
    p.add_argument("--no-summarize", action="store_true", help="跳過摘要，只測翻譯")
    p.add_argument("--no-translate", action="store_true", help="跳過翻譯，只測摘要")
    p.add_argument("--no-opencc", action="store_true",
                   help="關閉 OpenCC s2t 繁體保底（預設在 target-lang=zho_Hant 時開啟）")
    return p


def main() -> int:
    args = build_parser().parse_args()
    if args.check:
        return run_check(args)
    if not args.pdf:
        _die("請提供 PDF 路徑，或用 --check 檢查環境。用 -h 看說明。")
    if args.no_summarize and args.no_translate:
        _die("--no-summarize 與 --no-translate 不能同時開，那樣沒東西可跑。")
    return run_pipeline(args)


if __name__ == "__main__":
    raise SystemExit(main())
