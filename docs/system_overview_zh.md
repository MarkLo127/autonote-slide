# AutoNote&Slide 系統說明與文件撰寫建議

此文件提供撰寫系統說明書或技術報告時可以參考的結構，並對應到實際程式碼位置。

## 1. 系統目標與功能

- 針對長篇 PDF、報告、簡報與技術文件：
  - 自動分頁與頁面分類
  - 為每頁產生重點摘要
  - 彙整整份文件的結論、核心數據與風險/行動建議
  - 生成文字雲，協助快速掌握主題

## 2. 系統架構

建議在文件中繪製一張架構圖，說明：

- 前端（Next.js）
  - 檔案上傳與預覽
  - 進度顯示（Streaming）
  - 結果展示與 PDF 報告下載
- 後端（FastAPI）
  - 檔案解析模組
  - NLP 模組（語言偵測、關鍵字抽取、分段）
  - LLM 摘要模組（SummaryEngine）
  - 視覺化模組（WordCloud）
- 外部 LLM 服務
  - 例如 OpenAI 相容 API

## 3. 核心模組與對應程式碼

- 檔案解析：`backend/app/services/parsing/`
- 頁面分類：`backend/app/services/analyze/page_classifier.py`
- 摘要引擎：`backend/app/services/analyze/summary_engine.py`
- NLP：
  - 語言偵測：`backend/app/services/nlp/language_detect.py`
  - 關鍵字抽取：`backend/app/services/nlp/keyword_extractor.py`
  - 分段摘要：`backend/app/services/nlp/segmenter.py`
- 文字雲：`backend/app/services/wordcloud/wordcloud_gen.py`
- 前端 UI 流程：`frontend/src/app/page.tsx`
- 報告匯出：`frontend/src/lib/generateAnalysisPdf.ts`

## 4. 錯誤處理與穩定度

可在文件中介紹：

- `main.py`：
  - 上傳大小限制 middleware（避免超大檔案）
  - CORS 管理（限制允許的前端網域）
- `summary_engine.py`：
  - LLM 回應解析時的重試與 fallback 機制
  - 確保即使部分頁面失敗，整體流程仍可完成
- 其他 NLP / 視覺化模組遇到空內容時提供預設提示文字

## 5. 測試與評估建議

可以依照以下方向設計測試案例：

- 不同型態文件（年報、技術白皮書、簡報、課程講義）
- 不同語言與長度（短篇 / 長篇）
- 測量：
  - 分析時間
  - 使用者對摘要可讀性與有用性的主觀評價

## 6. 未來擴充方向

可列出可能的延伸功能，例如：

- 多檔案合併分析與跨文件總結
- 使用者登入與歷史紀錄
- 領域特化的摘要樣式（財務、技術、教育等）
- 新增更多視覺化圖表（時間線、比較圖）

---

撰寫系統說明文件時，可以依照以上章節調整內容與深度，並搭配實際畫面截圖與使用情境示例。
