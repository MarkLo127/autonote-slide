# Phase 1 — 串通驗證腳本

一支獨立 script 串通整條 pipeline：**PDF → Qwen2.5 摘要 → NLLB 翻譯**，
用來在包成服務之前，實測**品質**（印出結果）與**速度**（各階段耗時、tokens/sec）。

對應技術規格 [`pdf-summarize-translate-technical-spec.md`](../pdf-summarize-translate-technical-spec.md) 的 Phase 1。

- **摘要**：Qwen2.5-Instruct，透過 llama.cpp `llama-server` 的 OpenAI 相容 `/v1`（開源權重、本地推理）
- **翻譯**：NLLB-200-distilled，CTranslate2 本地 in-process（開源權重、CPU int8）
- 全程本地、**不需要任何 API Key、不連任何雲端付費 API**

---

## 1. 安裝 Python 依賴

```bash
pip install -r backend/requirements.txt
```

## 2. 準備摘要模型（Qwen2.5 GGUF + llama-server）

**取得 GGUF 權重**（擇一）：

```bash
# 用 huggingface CLI 下載 Q4_K_M 量化檔到 models/
mkdir -p models/summarize
huggingface-cli download Qwen/Qwen2.5-3B-Instruct-GGUF \
  qwen2.5-3b-instruct-q4_k_m.gguf \
  --local-dir models/summarize
```

**啟動 llama-server**（需先安裝 llama.cpp；macOS 可 `brew install llama.cpp`）：

```bash
llama-server \
  --model models/summarize/qwen2.5-3b-instruct-q4_k_m.gguf \
  --port 8001 \
  --ctx-size 8192 \
  --n-gpu-layers 0        # 有 GPU 就設成 999
```

> 也可以用 Ollama 取代：`ollama run qwen2.5:3b-instruct`，端點改成 `--summarize-url http://localhost:11434/v1 --model qwen2.5:3b-instruct`。

## 3. 準備翻譯模型（NLLB → CTranslate2）

把 NLLB-200-distilled-600M 轉成 CTranslate2 int8 格式（只需做一次）：

```bash
ct2-transformers-converter \
  --model facebook/nllb-200-distilled-600M \
  --output_dir models/nllb-200-distilled-600m-ct2 \
  --quantization int8
```

（`ct2-transformers-converter` 隨 `ctranslate2` 一起安裝。tokenizer 預設直接從
Hugging Face id `facebook/nllb-200-distilled-600M` 載入，第一次會自動下載小檔。）

---

## 4. 執行

```bash
# 先確認環境就緒（不需要 PDF）
python scripts/phase1_pipeline.py --check

# 跑完整 pipeline（預設只處理前 3 個 chunk 以快速驗證）
python scripts/phase1_pipeline.py path/to/paper.pdf

# 處理全部 chunk
python scripts/phase1_pipeline.py paper.pdf --max-chunks 0

# 只測摘要 / 只測翻譯
python scripts/phase1_pipeline.py paper.pdf --no-translate
python scripts/phase1_pipeline.py paper.pdf --no-summarize
```

### 常用參數

| 參數 | 預設 | 說明 |
|---|---|---|
| `--summarize-url` | `http://localhost:8001/v1` | OpenAI 相容摘要端點 |
| `--model` | `qwen2.5-3b-instruct` | 摘要模型名稱（需與 server 載入一致） |
| `--nllb-ct2-dir` | `models/nllb-200-distilled-600m-ct2` | NLLB CTranslate2 目錄 |
| `--nllb-device` | `cpu` | `cpu` 或 `cuda` |
| `--target-lang` | `zho_Hant` | NLLB 目標語言（正體中文；簡體用 `zho_Hans`） |
| `--max-chunks` | `3` | 最多處理幾段（`0`=全部） |
| `--max-chunk-chars` | `6000` | 每段字元上限 |

---

## 5. 輸出說明

每個 chunk 會印出原文節錄、Qwen2.5 摘要、NLLB 翻譯；結尾有一張**速度報告**：

```
══════════ 速度報告 ══════════
PDF 擷取         ：0.12s
摘要（Qwen2.5）  ：18.40s（3 段 + 全局，共 1560 tok，平均 84.8 tok/s，平均 4.60s/段）
翻譯（NLLB）     ：6.20s（42 句，6.8 句/s）
合計             ：24.72s
```

用這份報告評估：CPU 上速度是否可接受、摘要品質是否堪用、翻譯是否通順，
再決定進入 Phase 2（包成 FastAPI）。

> 提示：CPU 首次推理含載入/暖機，較慢屬正常；重跑同檔可觀察穩定速度。
