# Railway 部署指南

在 Railway 上以**三個服務**部署（同一個 repo、不同 Root Directory）：

| 服務 | Root Directory | Dockerfile | 對外 | 說明 |
|---|---|---|---|---|
| `summarize-service` | `summarize-service` | `Dockerfile` | 內網 | Ollama + Qwen3.5-4B（已烤進 image）|
| `gateway` | `/`（repo 根） | `backend/Dockerfile` | 內網 | FastAPI：上傳/摘要/翻譯/文字雲/報告/歷史 |
| `frontend` | `frontend` | `Dockerfile` | **公開** | nginx 服務靜態檔 + 反代 API |

各服務已附 `railway.json`（指定 Dockerfile），Railway 會自動用 Docker 建置。

---

## ⚠️ 先看資源限制（重要）

本專案自帶 **Qwen3.5-4B**，對 Railway 是**吃資源**的部署：

- **記憶體**：summarize-service 需 **~8GB RAM**（實測佔 7.6GB）→ 需 Railway **付費方案**並把該服務記憶體開到 8GB 以上（建議 10–12GB）。
- **映像大小**：summarize-service image ≈ **~10GB**（ollama base ~7GB + 模型 ~3.4GB）。Railway 建置/儲存要能容納。
- **無 GPU**：Railway 純 CPU，Qwen3.5-4B 一份 15 頁文件約 **15–20 分鐘**。適合個人/低並發。
- **建置時間**：summarize-service build 要在 image 內 `ollama pull`（~3.4GB），首次 build 較久。

> 若 Railway 方案記憶體/映像受限，替代作法：把模型改成 **volume 掛載 + 首次開機 `ollama pull`**（image 小、但首次啟動需下載），或改用更小模型（如 `qwen3.5:1.7b`，改 `summarize-service` 的 `MODEL` build-arg 與 gateway 的 `SUMMARIZE_MODEL`）。

---

## 部署步驟

### 1. 建立專案並連接 repo
Railway → New Project → Deploy from GitHub repo → 選本 repo。

### 2. 建立三個服務
專案內 New Service ×3，每個都指向同一個 repo，然後到各服務 **Settings → Root Directory** 分別設為上表的值。Railway 會讀該目錄的 `railway.json` 用 Dockerfile 建置。

### 3. 設定環境變數

**gateway**（Variables）：
```
SUMMARIZE_URL   = http://${{summarize-service.RAILWAY_PRIVATE_DOMAIN}}:11434/v1
SUMMARIZE_MODEL = qwen3.5:4b
TRANSLATOR      = qwen
TARGET_LANG     = zho_Hant
ALLOWED_ORIGINS = *
HOST            = 0.0.0.0
# PORT 由 Railway 自動注入；gateway 會綁定它
```

**frontend**（Variables）：
```
GATEWAY_UPSTREAM = ${{gateway.RAILWAY_PRIVATE_DOMAIN}}:${{gateway.PORT}}
# PORT 由 Railway 自動注入；nginx template 會監聽它
```

**summarize-service**：預設即可（Ollama 綁 0.0.0.0:11434）。`${{...RAILWAY_PRIVATE_DOMAIN}}` 是 Railway 的服務參照語法，部署時自動代入內網位址。

### 4. 私有網路
Railway 專案內服務預設可透過 `*.railway.internal` 互通（見上面的參照變數）。frontend 用同源相對路徑呼叫 API，由 nginx 反代到 gateway，不需要對外開 gateway。

### 5. 公開網域
只有 **frontend** 需要對外：Settings → Networking → Generate Domain。gateway / summarize-service 保持內網即可。

### 6. 持久化 volume（gateway）
gateway 的歷史 DB、報告、快取都在 `/app/storage`。到 **gateway → Settings → Volumes**，掛一個 volume 到 `/app/storage`，重新部署也不會遺失歷史紀錄與報告。

### 7. 記憶體
到 **summarize-service → Settings**，把記憶體上限調到 **≥8GB**（建議 10–12GB），否則模型載入會 OOM。

---

## 部署後檢查
- `https://<frontend-domain>/healthz` → 應回 `{"summarize":"ok","models":["qwen3.5:4b"]}`
- 開 `https://<frontend-domain>/` → 上傳一份 PDF 測試（首份較久，屬 CPU 正常）

## 本地 vs Railway
- **本地**：`docker compose up -d --build`（nginx 預設 `PORT=80`、`GATEWAY_UPSTREAM=gateway:8000`，見 compose）。
- **Railway**：靠上面的環境變數覆寫 `PORT` 與 `GATEWAY_UPSTREAM`，程式與 Dockerfile 完全相同、無需改碼。
