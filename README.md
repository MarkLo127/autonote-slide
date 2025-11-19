# AutoNote&Slide - 技術文檔

## 📋 專案概述

**AutoNote&Slide** 是一個智能文件分析與摘要生成系統，能自動將 PDF 文件轉換為結構化的摘要報告，並生成視覺化的文字雲。系統支援多語言文檔分析。

**核心功能**：
- 📄 PDF 文件上傳與解析
- 🤖 AI 驅動的分頁摘要生成
- 📊 全局重點彙整（結論、數據、風險、行動建議）
- 🏷️ 關鍵字自動提取
- ☁️ 文字雲視覺化
- 📑 專業 PDF 報告匯出

## 🏗️ 系統架構

### 整體架構圖

```
┌─────────────────┐         ┌─────────────────┐
│                 │   HTTP  │                 │
│  Next.js 前端   │ ◄─────► │  FastAPI 後端   │
│   (React 19)    │         │   (Python 3.x)  │
│                 │         │                 │
└─────────────────┘         └─────────────────┘
        │                           │
        │                           ├─► PDF 解析 (PyMuPDF)
        │                           ├─► NLP 處理 (jieba, nltk)
        │                           ├─► LLM 摘要 (OpenAI API)
        │                           └─► 文字雲生成 (wordcloud)
        │
        └─► PDF 報告生成 (pdf-lib)
```

### 技術棧分層

| 層級 | 前端 | 後端 |
|------|------|------|
| **框架** | Next.js 15.5.4 + React 19 | FastAPI + Uvicorn |
| **語言** | TypeScript 5 | Python 3.x |
| **樣式** | Tailwind CSS 4 | - |
| **狀態管理** | React Hooks | Pydantic Models |
| **HTTP 客戶端** | Fetch API | HTTPX (via OpenAI SDK) |
| **AI/ML** | - | OpenAI API |
| **NLP** | - | jieba, nltk, langdetect |
| **文件處理** | pdf-lib | PyMuPDF (fitz) |
| **部署** | Docker + Next.js standalone | Docker + Uvicorn |



## 🔧 核心技術詳解

### 1. 後端架構 (FastAPI)

#### 1.1 專案結構

```
backend/
├── app/
│   ├── main.py                 # FastAPI 應用入口
│   ├── core/
│   │   ├── config.py          # 配置管理
│   │   └── llm_client.py      # LLM 客戶端封裝
│   ├── models/
│   │   └── schemas.py         # Pydantic 數據模型
│   ├── routes/
│   │   ├── analyze.py         # 分析 API
│   │   └── health.py          # 健康檢查
│   ├── services/
│   │   ├── analyze/           # 分析服務
│   │   │   ├── summary_engine.py      # 摘要引擎
│   │   │   ├── page_classifier.py     # 頁面分類器
│   │   │   ├── page_parser.py         # 頁面解析器
│   │   │   ├── image_extractor.py     # 圖片提取器
│   │   │   └── vision_analyzer.py     # Vision API 分析器
│   │   ├── nlp/               # NLP 服務
│   │   │   ├── language_detect.py     # 語言偵測
│   │   │   ├── keyword_extractor.py   # 關鍵字提取
│   │   │   └── segmenter.py           # 文本分段
│   │   ├── parsing/           # 檔案解析
│   │   │   └── parse_pdf.py           # PDF 解析
│   │   ├── wordcloud/         # 文字雲生成
│   │   │   └── wordcloud_gen.py
│   │   └── storage.py         # 檔案儲存
│   └── utils/
│       └── text_clean.py      # 文本清理工具
├── assets/                    # 字型資源
├── requirements.txt
└── Dockerfile
```

#### 1.2 關鍵技術決策

**API 設計 - Streaming Response**
- 使用 `StreamingResponse` 實現即時進度更新
- 採用 NDJSON (Newline Delimited JSON) 格式
- 前端可即時顯示處理進度

```python
# 範例：進度事件流
{"type": "progress", "progress": 12, "message": "檔案儲存完成"}
{"type": "progress", "progress": 35, "message": "頁面判定完成"}
{"type": "progress", "progress": 90, "message": "完成第 150/150 頁摘要"}
{"type": "result", "progress": 100, "data": {...}}
```

**LLM 整合策略**
- 支援多模型配置
- 自動速率限制 (OpenAI SDK 內建重試)
- 高並發處理（可調整並發數）

**智能頁面分類**
- 自動跳過無意義頁面：
  - 封面頁、目錄頁
  - 純圖片頁、照片頁
  - 參考文獻頁
  - 空白頁



#### 1.3 核心演算法

**摘要生成流程**

```python
# 1. 文檔解析
pages = parse_pages(pdf_path)

# 2. 頁面分類
classified_pages = [classify_page(p) for p in pages]

# 3. 並發生成摘要
page_summaries = await summarize_pages(classified_pages)

# 4. 全局摘要生成
global_summary = await summarize_global(page_summaries)

# 5. 關鍵字提取
keywords = extract_keywords(pages, language)

# 6. 文字雲生成
wordcloud = generate_wordcloud(keywords, language)
```

**關鍵字提取演算法**
- 中文：jieba 分詞 + TF-IDF
- 英文：NLTK + 停用詞過濾
- 支援多語言混合文檔

### 2. 前端架構 (Next.js)

#### 2.1 專案結構

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根佈局
│   │   ├── page.tsx            # 首頁（上傳介面）
│   │   └── page-summary/
│   │       └── viewer/
│   │           └── page.tsx    # 結果查看器
│   └── lib/
│       └── generateAnalysisPdf.ts  # PDF 報告生成
├── public/                     # 靜態資源
├── package.json
└── Dockerfile
```

#### 2.2 關鍵技術實現

**即時進度顯示**
```typescript
// NDJSON 串流解析
const decoder = new TextDecoder();
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const events = chunk.split('\n').filter(Boolean);
  
  for (const event of events) {
    const data = JSON.parse(event);
    if (data.type === 'progress') {
      setProgress(data.progress);
    }
  }
}
```

**PDF 報告生成**
- 使用 `pdf-lib` 建構 PDF
- 支援中文字型嵌入
- 包含文字雲圖片
- 自動分頁與排版

**響應式設計**
- Tailwind CSS  實現
- 移動端優化
- 暗色模式支援（可選）


## 🚀 部署架構

### Docker Compose 部署

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./storage:/app/storage
    
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      NEXT_PUBLIC_BACKEND_URL: http://backend:8000
```

### 環境變數配置

**後端**
- `ALLOWED_ORIGINS`: CORS 允許來源
- `MAX_BODY_MB`: 上傳大小限制（預設 50MB）
- `OPENAI_API_KEY`: OpenAI API 金鑰（可選）

**前端**
- `NEXT_PUBLIC_BACKEND_URL`: 後端 API 端點
- `PORT`: 前端服務埠（預設 3000）

## 🎯 API 端點規格

### POST /analyze

上傳文件並進行分析。

**Request (multipart/form-data)**
```
file: File                    # PDF 文件
llm_api_key: string          # OpenAI API Key
llm_base_url: string?        # 自定義 API 端點（可選）
analysis_level: enum         # light | medium | deep
enable_vision: boolean       # 是否啟用 Vision 分析
```

**Response (application/x-ndjson)**
```json
{"type": "progress", "progress": 5, "message": "開始儲存檔案"}
{"type": "progress", "progress": 28, "message": "完成文字解析，共 150 頁"}
{"type": "progress", "progress": 35, "message": "頁面判定完成"}
{"type": "progress", "progress": 85, "message": "完成第 150/150 頁摘要"}
{"type": "progress", "progress": 100, "message": "分析完成", "data": {...}}
```

**Result Data Schema**
```typescript
interface AnalyzeResponse {
  language: string;
  total_pages: number;
  page_summaries: PageSummary[];
  global_summary: GlobalSummary;
  wordcloud_image_url: string | null;
}
```

## 🔐 安全考量

1. **上傳限制**
   - 文件大小限制（預設 50MB）
   - 僅支援 PDF 格式
   - Content-Type 驗證

2. **CORS 配置**
   - 可配置允許來源
   - 支援憑證傳遞

3. **API Key 處理**
   - 前端傳遞 API Key（不存儲）
   - 支援後端統一配置
   - HTTPS 傳輸加密

4. **錯誤處理**
   - API 失敗自動重試
   - Fallback 機制避免空白結果
   - 詳細錯誤日誌

## 📊 性能優化

### 後端優化

1. **並發處理**
   - 異步 API 調用
   - 可配置並發數（預設 100）
   - 智能速率控制

2. **快取策略**
   - 上傳文件臨時儲存
   - 生成結果檔案快取

3. **資源管理**
   - PDF 文件流式讀取
   - 及時釋放記憶體

### 前端優化

1. **Next.js 優化**
   - Turbopack 編譯加速
   - 伺服器端渲染（SSR）
   - 自動代碼分割

2. **用戶體驗**
   - 即時進度反饋
   - 樂觀 UI 更新
   - 錯誤重試機制

## 🧪 測試策略

### 單元測試
- 頁面分類邏輯
- 文本清理函數
- 關鍵字提取

### 整合測試
- API 端點測試
- LLM 調用測試
- Vision API 測試

### E2E 測試
- 完整上傳流程
- PDF 報告生成
- 錯誤處理

---

## 📈 擴展性設計

### 支援更多文件格式
- DOCX (已實現框架)
- PPTX (已實現框架)  
- Markdown (已實現)
- 圖片 OCR（待實現）

### LLM 模型擴展
- 支援更多 OpenAI 模型
- 兼容其他 LLM 服務
- 本地模型整合

### Vision 功能增強
- 圖表數據提取
- 表格識別
- 手寫文字辨識

## 🛠️ 開發工具

### 後端
- **Linting**: pylint
- **Formatting**: black
- **Type Checking**: mypy (可選)

### 前端
- **Linting**: ESLint 9
- **Formatting**: Prettier 
- **Type Checking**: TypeScript 5
---
**更新日期**: 2025-11-20  
**版本**: 1.0.0
