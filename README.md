# AutoNote Slide

功能：
- 上傳檔案 → 一律轉 PDF
- 讀 PDF（含必要時 OCR，支援繁中/英文）
- 摘要：回傳重點，並盡量附上來源段落 ids（可動態覆蓋 LLM）
- 關鍵字：回傳關鍵字，並附上關鍵字首次出現的段落 id
- 產簡報：依重點產生 PPTX，並轉成 PDF
- **投影片主題樣式**：支援預設主題與自訂顏色/字型/比例/Logo/頁尾

## LLM 設定策略
- 預設從 `.env` 讀取 `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL`。
- 前端也可在每次請求 **動態覆蓋**（`llm_baseurl / llm_apikey / llm_model`）。
- 若覆蓋欄位未提供，則沿用 `.env` 的值。

## 系統相依
- LibreOffice（必裝，用於 docx/pptx/xlsx → PDF）
- Tesseract OCR（建議安裝語言包：`eng`、`chi_tra`）

macOS：
```bash
brew install --cask libreoffice
brew install tesseract && brew install tesseract-lang  # 或安裝 chi_tra 語言包
```

Ubuntu / Debian：
```bash
sudo apt-get update
sudo apt-get install -y libreoffice tesseract-ocr tesseract-ocr-chi-tra
```


## 啟動
```bash
streamlit run frontend/main.py  
{ [ -f .env ] || cp backend/.env.example .env; } && python -m uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8000 --reload 
```

## API 一覽

### 1) 上傳
`POST /api/upload`
- form-data: `file` (binary)
- 回傳：`saved_path`

### 2) 轉 PDF
`POST /api/convert`
- form-data: `file` 或 `path`
- 回傳：`pdf_path`

### 3) 單獨摘要（可覆蓋 LLM）
`POST /api/summarize`
- JSON: `{ "text": "...", "llm_baseurl?": "...", "llm_apikey?": "...", "llm_model?": "..." }`
- 回傳：`{ summary: { points: [ {point, paragraph_ids?} ] } }`

### 4) 單獨關鍵字
`POST /api/keywords`
- JSON: `{ "text": "..." }`
- 回傳：`{ keywords: [...], map: { kw: [paragraph_id?] } }`

### 5) 可用主題清單
`GET /api/themes`
- 回傳：`{ presets: [{ name, ...themeFields }] }`

### 6) 產簡報（支援主題）
`POST /api/slides`
- JSON：
```json
{
  "title": "專案重點",
  "points": ["目標 A","進度 B","風險 C"],
  "theme": {
    "preset_name": "clean_dark",
    "footer_text": "Company Internal",
    "logo_path": "storage/assets/logo.png"
  }
}
```
- 回傳：`pptx_path`, `pdf_path`

### 7) 一條龍處理（支援主題 + LLM 覆蓋）
`POST /api/process`
- form-data: `file` 或 `path`；可選：`theme_preset`、`footer_text`、`llm_baseurl`、`llm_apikey`、`llm_model`
- 回傳：
```json
{
  "ok": true,
  "pdf_path": "/outputs/xxx.pdf",
  "paragraphs": [ {"id":"p1_1","page":1,"text":"..."}, ... ],
  "summary": { "points": [ {"point":"...","paragraph_ids":["p1_1"]}, ... ] },
  "keywords": { "keywords":["..."], "map": { "關鍵字":["p1_2"] } },
  "slides_pptx_path": "/outputs/auto_slides.pptx",
  "slides_pdf_path": "/outputs/auto_slides.pdf"
}
```
