# PDF 摘要 + 翻譯服務 技術規格（重新設計版）

> 版本：2.0.0 ｜ 更新日期：2026-07-23
> 本版為「大動刀」重構：**移除舊有 AutoNote&Slide 全部前後端與 OpenAI 依賴**，改為**完全本地、純開源權重模型**的新架構。

---

## 1. 專案目標與定位

讓使用者上傳外語（以英文為主）PDF 文件，系統輸出：

- **全文 / 分頁摘要**（中文，正體優先）
- **逐段翻譯**（原文 ↔ 譯文對照）
- **關鍵字與文字雲**（延續舊版視覺化）
- **可下載的對照式 PDF 報告**

### 核心約束（本次重構的紅線）

| 約束 | 說明 |
|---|---|
| **零付費 LLM API** | 完全不呼叫 OpenAI / Anthropic / Gemini 等任何雲端付費 API，也不需要任何 API Key |
| **只用開源權重模型** | 全部採用權重公開、可本地自架的開放權重模型（Qwen、NLLB 等），無授權費、可離線運行 |
| **CPU 為主、GPU 可選** | 預設在 2 vCPU / 4–8GB RAM 的低規主機上即可跑；偵測到 GPU 時自動升級模型層級與速度 |
| **一鍵部署** | Docker Compose 一鍵起服務，模型檔以 volume 掛載，image 不含權重 |
| **隱私自持** | 文件與推理全程留在本機，不外送任何第三方 |

### 與舊版的差異

| 項目 | 舊版 (AutoNote&Slide v1) | 新版 (v2) |
|---|---|---|
| 摘要引擎 | OpenAI API（付費、需 Key、需連外） | 本地 llama.cpp + Qwen2.5（開源權重） |
| 翻譯 | 無 | 本地 CTranslate2 + NLLB-200 |
| Vision | OpenAI Vision API | 移除（改以 OCR fallback，見 §10） |
| 前端框架 | Next.js（README 標示）/ 實為混雜 | 重寫為 Vite + React 19 + TS，單頁 |
| 對外依賴 | 需連 OpenAI | 完全離線可運作 |
| 資料快取 | 檔案暫存 | SQLite，依 PDF hash 去重快取 |

---

## 2. 系統架構

```
                         ┌──────────────────────┐
   PDF 上傳 / 輪詢  ────▶│     api-gateway       │
   (Vite + React SPA)    │      (FastAPI)        │
                         │  上傳 / 擷取 / 分段    │
                         │  快取 / 排程 / 匯出    │
                         └───────────┬───────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                    ▼
      ┌────────────────────┐ ┌──────────────────┐ ┌──────────────┐
      │ summarize-service  │ │ translate-service│ │  cache-db     │
      │ llama.cpp          │ │ CTranslate2      │ │  SQLite       │
      │ (llama-server)     │ │ + NLLB-200       │ │  (volume)     │
      │ Qwen2.5 GGUF       │ │ distilled-600M   │ │  依 hash 快取  │
      │ OpenAI 相容 /v1    │ │ 極簡 FastAPI     │ │               │
      └────────────────────┘ └──────────────────┘ └──────────────┘

   ※ 關鍵字 / 文字雲 / PDF 報告皆在 api-gateway 內完成（純 CPU、無需 AI）
```

**四個角色**

1. **api-gateway**（FastAPI）：上傳、PyMuPDF 文字擷取、分頁分段、頁面分類（跳過封面/目錄/純圖頁）、呼叫下游模型、關鍵字提取、文字雲、PDF 報告匯出、SQLite 快取、NDJSON 串流進度。
2. **summarize-service**：`llama.cpp` 內建 `llama-server`，載入 **Qwen2.5-Instruct GGUF** 量化模型，對外暴露 OpenAI 相容 `/v1/chat/completions`（gateway 以標準 client 呼叫，不綁定廠商 SDK）。
3. **translate-service**（雙軌）：
   - **技術文（預設）**：直接用 summarize-service 那顆 **Qwen2.5 一模兩用**做翻譯 —— 術語一致性高、正體中文穩定（見 §3.3 Phase 1 實測）。
   - **通用 / 多語（可選）**：`CTranslate2` + **NLLB-200-distilled**，包一層極簡 FastAPI 提供 `/translate`，速度快、支援 200+ 語言。
4. **cache-db**：SQLite 檔案掛 volume，依 PDF hash 快取結果，避免重算。單機規模不需要 Postgres。

---

## 3. 模型選型與資源評估

> 選型原則：**開放權重、可離線、中文能力優先、CPU 上可量化跑**。摘要選 **Qwen2.5**（同量級中對正體/簡體中文與英中理解最強）；翻譯採**雙軌**——技術文用 Qwen2.5 一模兩用（術語一致），通用/多語才走 **NLLB-200**（CTranslate2 優化、CPU 上快）。此決策依 §3.3 Phase 1 實測結果。

### 3.1 預設（CPU 主機）

| 用途 | 模型 | 量化 | 記憶體 | 備註 |
|---|---|---|---|---|
| 摘要 + 技術文翻譯 | Qwen2.5-3B-Instruct | Q4_K_M GGUF | ~2.2GB | 一模兩用；中文品質佳、術語一致、指令遵循穩定 |
| 通用/多語翻譯（可選） | NLLB-200-distilled-600M | int8 | ~0.6GB | 200+ 語言、速度快；密集技術文品質較弱 |

**總預算**：預設只需 Qwen2.5（~2.2GB）；若同時載入 NLLB 約 2.8–3GB。加 FastAPI 與系統開銷，**主機建議至少 4GB RAM，8GB 較保險**。

### 3.3 Phase 1 實測（決策依據）

於 Apple M3 / 16GB、`qwen2.5:3b-instruct`（Ollama，本地）+ NLLB-200-distilled-600M（CTranslate2 int8）實測一份 15 頁英文技術論文：

| 項目 | 實測 |
|---|---|
| PDF 擷取 | 0.15s / 15 頁 |
| 摘要 Qwen2.5-3B | ~15s/段、暖機後 23–26 tok/s（全文 10 段推估 ~2.7 分鐘）|
| 翻譯 Qwen2.5-3B | ~11s/段、26 tok/s、**品質佳**（術語保留、正體中文通順）|
| 翻譯 NLLB-600M | ~2.5s/段、極快，但**技術文破碎**（術語音譯、重複、亂碼）|

**結論**：技術文翻譯**改用 Qwen2.5**（品質壓倒性優於 NLLB，速度雖慢 4× 仍實用）；NLLB 僅保留為通用/多語快速路。摘要與翻譯共用同一顆 Qwen，記憶體與部署更省。

### 3.2 GPU 可選（自動升級）

api-gateway 啟動時偵測 `nvidia-smi` / CUDA 是否可用；summarize-service 依環境變數決定模型層級與 `--n-gpu-layers`：

| 環境 | 摘要模型 | 說明 |
|---|---|---|
| CPU only | Qwen2.5-3B Q4_K_M | 預設，`-ngl 0` |
| GPU 8–12GB | Qwen2.5-7B Q4_K_M | `-ngl 999`，品質明顯提升 |
| GPU 16GB+ | Qwen2.5-14B Q4_K_M | 長文摘要更完整 |

翻譯層不強制升級；GPU 存在時可改用 `NLLB-200-distilled-1.3B` 提升翻譯品質。

**模型層級由 `MODEL_TIER=cpu|gpu-small|gpu-large` 環境變數控制**，掛載對應的 GGUF 檔即可切換，image 不變。

---

## 4. 功能模組

| 模組 | 位置 | 職責 | 關鍵技術 |
|---|---|---|---|
| 上傳與儲存 | gateway `services/storage` | 接收 PDF、算 hash、暫存 | FastAPI UploadFile |
| PDF 解析 | gateway `services/parsing` | 抽純文字、抽圖 | PyMuPDF (fitz) |
| 頁面分類 | gateway `services/analyze/page_classifier` | 跳過封面/目錄/純圖/參考文獻/空白頁 | 規則引擎 |
| 摘要引擎 | gateway `services/analyze/summary_engine` | 分頁摘要 → 全局彙整 | llama-server /v1 |
| 翻譯引擎 | gateway `services/translate` | 逐段翻譯、原文對照 | translate-service |
| 關鍵字 | gateway `services/nlp/keyword_extractor` | 中：jieba+TF-IDF；英：NLTK+停用詞 | jieba / nltk |
| 文字雲 | gateway `services/wordcloud` | 產生 base64 圖 | wordcloud + Noto Sans TC |
| 報告匯出 | gateway `services/report` | 對照式 PDF（原文/譯文/摘要） | reportlab / PyMuPDF |
| 快取 | gateway `services/cache` | 依 hash 存取結果 | SQLite |

---

## 5. 資料處理流程（Pipeline）

1. **上傳** → 存 PDF、算 hash、查快取；命中則直接回傳。
2. **文字擷取** → PyMuPDF 抽純文字（不需 AI）。
3. **頁面分類** → 規則跳過封面、目錄、純圖、參考文獻、空白頁，降低無效運算。
4. **分段（chunking）** → 依模型有效 context 切段（實際數字需依最終 GGUF build 測試調整；不同 build 有效 context 不同）。
5. **處理順序（兩模式可切換）**：
   - **先摘要後翻譯**（預設）：先用 Qwen2.5 對每段摘要，再把摘要送 NLLB 翻譯 → 送翻譯的字數少、快、穩。
   - **先翻譯後摘要**：需要保留完整原文對照時用，兩模型都處理全文，較慢。
6. **全局彙整** → 分頁摘要合併成結論 / 數據 / 風險 / 行動建議（延續舊版四象限）。
7. **關鍵字 + 文字雲** → 於 gateway 完成。
8. **合併與快取** → 依段落順序組合，存入 SQLite。
9. **回傳 / 匯出** → NDJSON 串流進度 + 最終 JSON；可另匯出對照式 PDF 報告。

---

## 6. API 設計

沿用舊版好用的 **NDJSON 串流進度**（避免長任務 HTTP timeout），並補上非同步輪詢：

```
POST /documents
  multipart/form-data:
    file: PDF
    mode: summary_first | translate_first   (預設 summary_first)
    target_lang: zh-Hant | zh-Hans | ...     (預設 zh-Hant)
    features: [summary, translate, wordcloud, report]  (可多選)
  → { "doc_id": "..." }              # 立即回傳，不同步等待

GET /documents/{doc_id}/status
  → { "status": "processing|done|error", "progress": 0-100, "message": "..." }

GET /documents/{doc_id}/result
  → {
      "language": "en",
      "total_pages": 150,
      "page_summaries": [...],
      "global_summary": { "conclusion": "...", "data": "...", "risk": "...", "action": "..." },
      "translated_segments": [...],
      "original_segments": [...],
      "keywords": [...],
      "wordcloud_image_url": "data:image/png;base64,...",
      "report_pdf_url": "/documents/{doc_id}/report.pdf"
    }

GET /documents/{doc_id}/report.pdf     # 對照式 PDF 報告下載
GET /healthz                            # 健康檢查（含各下游模型就緒狀態）
```

**串流版（可選）**：`POST /documents?stream=1` 直接回 `application/x-ndjson`：

```json
{"type":"progress","progress":28,"message":"完成文字解析，共 150 頁"}
{"type":"progress","progress":85,"message":"完成第 150/150 頁摘要"}
{"type":"result","progress":100,"data":{...}}
```

---

## 7. 前端設計（重寫）

- **技術**：Vite + React 19 + TypeScript，單頁應用（取代舊 Next.js 混雜結構）。
- **不再需要 API Key 欄位**（舊版最大改動點）——本地推理無需任何金鑰。
- **三區塊**：上傳區（拖放 + 模式/語向/功能勾選）、進度區（NDJSON 即時進度條）、結果區（分頁摘要、原文/譯文對照、文字雲、PDF 下載）。
- **i18n**：沿用現有 `frontend/src/i18n.ts`，介面支援正體中文 / English。
- **串流解析**：`ReadableStream` + `TextDecoder` 解析 NDJSON（沿用舊版模式）。

---

## 8. Docker Compose 部署（骨架）

```yaml
services:
  api-gateway:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - SUMMARIZE_BASE_URL=http://summarize-service:8001/v1
      - TRANSLATE_URL=http://translate-service:8002
      - MODEL_TIER=cpu            # cpu | gpu-small | gpu-large
    volumes: ["./storage:/app/storage"]        # SQLite + 暫存檔
    depends_on: [summarize-service, translate-service]

  summarize-service:
    image: ghcr.io/ggml-org/llama.cpp:server   # 或自建
    command: >
      --model /models/qwen2.5-3b-instruct-q4_k_m.gguf
      --port 8001 --ctx-size 8192 --n-gpu-layers 0
    volumes: ["./models/summarize:/models"]

  translate-service:
    build: ./translate                          # CTranslate2 + NLLB + FastAPI
    ports: ["8002:8002"]
    volumes: ["./models/nllb-200-distilled-600m-int8:/models/nllb"]
```

- 模型檔一律以 **volume 掛載**，image 不含權重，方便換版與縮小體積。
- GPU 主機：改掛 7B/14B GGUF 並將 `--n-gpu-layers` 設為 `999`、`MODEL_TIER=gpu-*`。

---

## 9. 開發階段規劃

| Phase | 目標 |
|---|---|
| **1 核心 pipeline** | 一支 script 串：PDF → 文字 → Qwen2.5 摘要 → NLLB 翻譯 → 印結果，先確認品質與速度 |
| **2 包成 API** | 邏輯包進 FastAPI，非同步任務（先用 `BackgroundTasks`，量小不上 Celery），補 NDJSON 串流 |
| **3 快取與持久化** | SQLite，依 PDF hash 去重快取 |
| **4 功能回填** | 頁面分類、關鍵字/文字雲、對照式 PDF 報告匯出 |
| **5 前端重寫** | Vite+React SPA，移除 API Key，接串流進度 |
| **6 Docker 化與部署** | Dockerfile / compose，部署雲端 VM，量測 CPU 記憶體/速度 |
| **7（可選）優化** | 分段摘要去重、掃描版 PDF 加 Tesseract OCR fallback、GPU 自動升級 |

---

## 10. 硬體建議與成本

| 等級 | 規格 | 適用 |
|---|---|---|
| 最低可行 | 2 vCPU / 4GB RAM | 個人、小文件，Qwen2.5-3B |
| 較穩定 | 2–4 vCPU / 8GB RAM | 小團隊、並發數個請求 |
| 高品質（可選） | 1× GPU 8–16GB VRAM | Qwen2.5-7B/14B，速度品質大幅提升 |

CPU 方案完全**不需要 GPU**，是本專案「輕量」定位的核心優勢；GPU 為純可選加速路徑。每月成本依供應商而定，CPU 方案常見於各雲最低階方案。

---

## 11. 安全與隱私

- **無金鑰、無外送**：不需要任何 API Key，推理全程本機完成，文件不離開主機。
- **上傳限制**：僅 PDF、大小上限（預設 50MB，`MAX_BODY_MB` 可調）、Content-Type 驗證。
- **CORS**：`ALLOWED_ORIGINS` 可配置。
- **快取隔離**：SQLite 依 hash 存取，可設定 TTL 定期清除（沿用 `clean_cache.sh` 概念）。

---

## 12. 已知限制

- 掃描版（圖片型）PDF 無法直接擷取文字，需整合 Tesseract OCR（Phase 7）。
- 純 CPU 推理速度有限，大量並發或超長文件會變慢；單機部署適合個人或小團隊，未針對高流量設計。
- 摘要品質受限於 3–7B 等級開源模型，無法完全對齊大型雲端模型；但對「先抓重點再決定是否細讀」與離線、零成本、隱私自持的情境已足夠。
- 移除 Vision API 後，圖表/圖片內含的資訊需靠 OCR 或人工補讀。

---

## 13. 未來可擴充

- 多語言（NLLB 支援 200+ 語言，只是切語言代碼）。
- 批次處理多份 PDF。
- 使用者帳號與歷史紀錄。
- 向量搜尋（sentence-transformers，同樣開源）——對已上傳文件庫做語意檢索。
- GPU 自動升級與模型熱切換。
