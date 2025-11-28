# Railway 部署文件

本目錄包含 Railway 平台部署所需的配置文件。

## 📁 文件說明

### Backend 配置
- **`backend/Dockerfile.railway`** - Backend Docker 構建文件
- **`backend/railway.json`** - Backend Railway 服務配置

### Frontend 配置
- **`frontend/Dockerfile.railway`** - Frontend Docker 構建文件  
- **`frontend/railway.json`** - Frontend Railway 服務配置

## 🚀 快速開始

請查看完整的部署教學：

📖 **[Railway 部署教學](file:///.gemini/antigravity/brain/653d3846-48a9-458c-b186-56bf666c42a3/railway_deployment_guide.md)**

## ⚡ 快速部署步驟

1. 登入 [Railway.app](https://railway.app/)
2. 建立新專案 → 選擇 GitHub repo
3. 部署 **Backend**：
   - Root Directory: `backend`
   - Dockerfile: `Dockerfile.railway`
   - 環境變數: `APP_HOST=0.0.0.0`, `APP_PORT=${{PORT}}`
4. 部署 **Frontend**：
   - Root Directory: `frontend`
   - Dockerfile: `Dockerfile.railway`
   - 環境變數: `NEXT_PUBLIC_BACKEND_URL=https://your-backend-url`
5. 為兩個服務生成域名
6. 完成！

## 💡 重要提示

- Backend 需要先部署並獲取 URL
- Frontend 的 `NEXT_PUBLIC_BACKEND_URL` 必須指向 Backend URL
- Railway 自動提供 `${{PORT}}` 環境變數
- 免費額度約 $5 USD

## ❓ 問題排查

如遇到問題，請查看詳細教學中的「故障排除」章節。
