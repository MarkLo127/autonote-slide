# AutoNote — 本地 PDF 摘要 + 翻譯

上傳外語（以英文為主）PDF，輸出**中文摘要、逐段原文/譯文對照、關鍵字文字雲、可下載的對照式 PDF 報告**。

**核心特色**：完全本地推理、**零 API Key**、**不連任何雲端付費 LLM**、模型烤進 image、`docker compose up` 一鍵起。

> 版本 2.0 為「大動刀」重構：移除舊有 OpenAI 版前後端，改為純開源權重（Qwen3.5-4B）本地架構。

---

## 功能

- 📄 PDF 上傳、文字擷取；掃描版自動 **OCR fallback**（RapidOCR，純 CPU）
- 🤖 分段摘要 → 全局重點彙整（結論 / 關鍵數據 / 風險 / 行動建議）
- 🌐 逐段翻譯（原文 ↔ 譯文對照），正體中文；OpenCC 繁體保底
- 🏷️ 關鍵字提取（中：jieba+TF-IDF｜英：頻率+停用詞）
- ☁️ 文字雲（Noto Sans TC）
- 📑 對照式 PDF 報告匯出（reportlab、中文嵌字）
- 🕘 歷史紀錄（SQLite 持久化，可查看 / 下載 / 刪除）
- ⚡ 依 PDF hash + 選項去重快取；可 `refresh` 強制重跑
- 🖥️ 前端：Vite + React 19 + TS，兩欄上傳（左控制、右 PDF 預覽）、繁中/EN、light/dark、RWD

---

## 系統架構

三個 Docker 服務：

```text
   ┌─────────────┐   同源 /API 反代   ┌──────────────────────┐
   │  frontend   │ ───────────────▶ │       gateway         │
   │ Vite+React  │                   │      (FastAPI)        │
   │  → nginx    │                   │ 上傳/擷取/OCR/分類/分段 │
   └─────────────┘                   │ 摘要/翻譯/文字雲/報告   │
                                     │ 快取(SQLite)/歷史(SQLite)│
                                     └───────────┬───────────┘
                                                 │ OpenAI 相容 /v1
                                                 ▼
                                     ┌──────────────────────┐
                                     │   summarize-service   │
                                     │  Ollama + Qwen3.5-4B   │
                                     │  (Q4_K_M，已烤進 image) │
                                     └──────────────────────┘
```

- **gateway**：整條 pipeline（PyMuPDF 擷取、RapidOCR fallback、頁面分類、分段、呼叫模型、關鍵字、文字雲、PDF 報告、SQLite 快取與歷史、NDJSON 串流進度）。以標準 httpx client 呼叫 `/v1`，不綁廠商 SDK；會過濾模型的 `<think>` 推理輸出。
- **summarize-service**：Ollama 載入 **Qwen3.5-4B**，**摘要與翻譯共用同一顆**（一模兩用，術語一致）。
- **frontend**：nginx 服務靜態檔並反代 API 到 gateway（同源、串流關 buffer）。

---

## 模型

| 用途 | 模型 | 說明 |
|---|---|---|
| 摘要 + 技術文翻譯 | **Qwen3.5-4B**（Q4_K_M GGUF） | 2026 世代、支援 201 語言、中文最強；一模兩用。約 2.6GB 權重 |
| 通用/多語翻譯（可選） | NLLB-200-distilled-600M（CTranslate2 int8） | `TRANSLATOR=nllb` 啟用；速度快、200+ 語言，但密集技術文品質較弱 |
| 繁體保底 | OpenCC `s2t` | 補模型偶發繁簡漂移（確定性、成本近零） |

**翻譯採視窗式**：把每段切成 ~1400 字小段逐段翻譯再合併，避免整段長文丟給小模型時 echo 原文或被截斷。

**記憶體**：Qwen3.5-4B（含 KV ~4GB）+ gateway（~0.8GB）+ OS ≈ **~6GB → 8GB RAM 可跑**（低並發）。純 CPU；一份 15 頁文件約 15–20 分鐘。有 GPU 可換 7B/14B/30B-A3B 大幅加速。

> **MLX 版不可上雲**（Apple Silicon 專屬）；雲端一律用 GGUF。

---

## 快速開始（Docker）

```bash
docker compose up -d --build
```

首次 build 會在 summarize-service image 內 `ollama pull qwen3.5:4b`（~3.4GB），較久；之後開機零下載。

- 前端：`http://localhost:8080`
- Gateway（除錯用）：`http://localhost:8001` ｜ 健康檢查 `GET /healthz`

停止：`docker compose down`（加 `-v` 連 volume 一起清）。

> 若在受限網路（熱點）build 出現 `tls: bad record MAC`：那是 MTU 問題。Docker Desktop → Docker Engine 加 `"mtu":1400`（OrbStack 則改 `~/.orbstack/config/docker.json`），重啟後重試。

---

## 設定（環境變數）

gateway 全部可用環境變數覆寫（見 [backend/app/core/config.py](backend/app/core/config.py)）：

| 變數 | 預設 | 說明 |
|---|---|---|
| `SUMMARIZE_URL` | `http://localhost:11434/v1` | 推理端點（Ollama/llama-server，OpenAI 相容） |
| `SUMMARIZE_MODEL` | `qwen3.5:4b` | 摘要/翻譯模型 |
| `TRANSLATOR` | `qwen` | `qwen`（一模兩用）｜`nllb`（通用/多語） |
| `TARGET_LANG` | `zho_Hant` | 目標語言（正體中文；簡體用 `zho_Hans`） |
| `MAX_CHUNK_CHARS` | `6000` | 每段字元上限 |
| `MAX_BODY_MB` | `50` | 上傳大小上限 |
| `ALLOWED_ORIGINS` | `*` | CORS 來源 |
| `STORAGE_DIR` | `storage` | 上傳/報告/SQLite 位置 |
| `DISABLE_OCR` | — | 設 `1` 關閉掃描頁 OCR fallback |
| `DISABLE_OPENCC` | — | 設 `1` 關閉繁體保底 |

---

## API

```
POST   /documents            上傳 PDF（multipart：file、features、可選 ?stream=1、?refresh=1）
                             features = summary,translate,wordcloud,report（可多選）
                             → { "doc_id": "..." }；?stream=1 直接回 NDJSON 進度
GET    /documents            歷史清單（新到舊）
GET    /documents/{id}/status   { status, progress, message }
GET    /documents/{id}/result   完整結果（見下）
GET    /documents/{id}/report.pdf  下載對照式 PDF 報告
DELETE /documents/{id}       刪除該筆歷史與其報告
GET    /healthz              健康檢查（含模型就緒狀態）
```

**結果 schema**

```jsonc
{
  "doc_id": "...", "language": "en", "total_pages": 15,
  "segments": [{ "index": 0, "original": "...", "translated": "...", "summary": "..." }],
  "global_summary": { "conclusion": "...", "data": "...", "risk": "...", "action": "..." },
  "keywords": ["..."],
  "wordcloud_image_url": "data:image/png;base64,...",
  "report_pdf_url": "/documents/{id}/report.pdf"
}
```

**NDJSON 串流事件**

```json
{"type":"progress","progress":15,"message":"擷取完成：15 頁 → 有效內容 6 段"}
{"type":"progress","progress":90,"message":"彙整全局重點"}
{"type":"result","progress":100,"message":"分析完成","data":{ ... }}
```

---

## 專案結構

```text
backend/
├── Dockerfile               gateway image
├── requirements.txt
├── __main__.py              python -m backend（uvicorn 入口）
└── app/
    ├── main.py              FastAPI 組裝 + CORS
    ├── core/config.py       設定（環境變數）
    ├── models/schemas.py    Pydantic 模型
    ├── routes/              documents（上傳/狀態/結果/報告/歷史/刪除）、health
    └── services/
        ├── llm.py           OpenAI 相容 client（含 <think> 過濾）
        ├── summarize.py     Qwen 摘要 + 四象限彙整
        ├── translate.py     QwenTranslator（視窗式）+ NLLBTranslator
        ├── textproc.py      PDF 擷取 / OCR fallback 觸發 / 分類 / 分段 / OpenCC
        ├── ocr.py           RapidOCR 掃描頁辨識
        ├── keywords.py      關鍵字提取
        ├── wordcloud_gen.py 文字雲
        ├── report.py        對照式 PDF 報告（reportlab）
        ├── pipeline.py      編排（產出 NDJSON 進度事件）
        ├── jobs.py          非同步任務（記憶體即時狀態）
        ├── cache.py         結果去重快取（SQLite）
        └── store.py         歷史持久化（SQLite）
frontend/                    Vite + React 19 + TS（nginx 部署）
summarize-service/           Ollama + Qwen3.5-4B（Dockerfile 烤模型）
scripts/                     Phase 1 串通驗證腳本（見下）
docker-compose.yml           三服務一鍵起
RAILWAY.md                   Railway 雲端部署指南
```

---

## 本地開發（不走 Docker）

需要一個本地 Ollama（`ollama pull qwen3.5:4b`）或 llama-server 提供 `/v1`。

**後端**
```bash
conda create -n autonote python=3.12 && conda activate autonote
pip install -r backend/requirements.txt
SUMMARIZE_URL=http://localhost:11434/v1 python -m backend   # 預設 :8000
```

**前端**
```bash
cd frontend && npm install
VITE_BACKEND_URL=http://localhost:8000 npm run dev          # 預設 :5173
```

---

## Phase 1 驗證腳本（scripts/）

在包成服務前，用一支獨立 script 串通 **PDF → Qwen 摘要 → 翻譯**，實測品質與速度：

```bash
pip install -r backend/requirements.txt
python scripts/phase1_pipeline.py --check                       # 檢查環境
python scripts/phase1_pipeline.py paper.pdf                     # 預設 Qwen 翻譯
python scripts/phase1_pipeline.py paper.pdf --translator nllb   # 改用 NLLB（需先轉 CTranslate2）
python scripts/phase1_pipeline.py paper.pdf --no-translate      # 只測摘要
```

常用參數：`--summarize-url`、`--model`、`--target-lang`（預設 `zho_Hant`）、`--max-chunks`、`--no-opencc`。
NLLB 需先轉檔：`ct2-transformers-converter --model facebook/nllb-200-distilled-600M --output_dir models/nllb-200-distilled-600m-ct2 --quantization int8`。

---

## 部署

- **本地 / 單機 VM**：`docker compose up -d --build`（三服務、自帶模型）。
- **Railway**：見 [RAILWAY.md](RAILWAY.md)（三服務、私有網路、storage volume、資源需求；注意需 ~8GB RAM 方案、image ~10GB、純 CPU）。

---

## 已知限制

- 純 CPU 推理較慢；大量並發或超長文件會變慢，適合個人/小團隊。
- 摘要品質受限於 4B 等級開源模型，無法對齊大型雲端模型；對「先抓重點再決定是否細讀」與離線、零成本、隱私自持已足夠。
- 掃描版 PDF 靠 RapidOCR fallback；複雜表格/公式的高精度需求可另接 DeepSeek-OCR 作 GPU 選配層。
- 報告 PDF 存在 gateway 的 `storage/reports`；歷史存在 SQLite。若外部清掉 `storage/` 檔案，歷史仍在但「下載 PDF」會 404。

---

## 安全與隱私

- **無金鑰、無外送**：推理全程本機，文件不離開主機。
- 上傳限制（僅 PDF、大小上限、Content-Type 驗證）、CORS 可配置。
