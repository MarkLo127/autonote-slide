# 清理緩存腳本使用說明

## 📋 功能說明

`clean_cache.sh` 腳本會清理項目中所有開發和構建過程產生的緩存文件，但**不會刪除**：
- ✅ 源代碼文件
- ✅ node_modules（依賴包）
- ✅ pnpm-lock.yaml（鎖定文件）
- ✅ package.json（配置文件）

## 🧹 會清理的內容

### 前端緩存
- `.next/` - Next.js 構建輸出
- `.turbo/` - Turbopack 緩存
- `out/` - 靜態導出輸出
- `tsconfig.tsbuildinfo` - TypeScript 增量編譯緩存

### 後端緩存
- `__pycache__/` - Python 字節碼緩存
- `*.pyc` - Python 編譯文件
- `*.pyo` - Python 優化文件
- `.pytest_cache/` - Pytest 測試緩存

### 通用緩存
- `.DS_Store` - macOS 系統文件
- `npm-debug.log` - NPM 錯誤日誌
- `yarn-error.log` - Yarn 錯誤日誌

## 🚀 使用方法

### 方法 1：直接執行
```bash
./clean_cache.sh
```

### 方法 2：使用 bash 執行
```bash
bash clean_cache.sh
```

## 📊 執行範例

```bash
$ ./clean_cache.sh

🧹 開始清理緩存...
================================

📦 清理前端緩存...
  ✓ 刪除 frontend/.next (Next.js 構建輸出)
  - frontend/.turbo 不存在，跳過
  - frontend/out 不存在，跳過
  - TypeScript 緩存不存在，跳過

🐍 清理後端緩存...
  ✓ 刪除 12 個 __pycache__ 目錄
  ✓ 刪除 35 個 .pyc 文件
  - 沒有 .pyo 文件，跳過
  - Pytest 緩存不存在，跳過

🔧 清理通用緩存...
  ✓ 刪除 5 個 .DS_Store 文件 (macOS 緩存)

================================
✅ 清理完成！

📋 保留的重要文件：
  ✓ node_modules (依賴包)
  ✓ pnpm-lock.yaml (鎖定文件)
  ✓ package.json (包配置)
  ✓ 所有源代碼文件

💡 提示：
  - 下次運行 'pnpm dev' 時，緩存會自動重新生成
  - 如果需要重新安裝依賴，請運行 'pnpm install'
```

## ⚠️ 注意事項

1. **不影響功能**：清理後項目仍可正常運行
2. **自動重建**：運行 `pnpm dev` 時會自動重新生成緩存
3. **安全操作**：只刪除可自動重建的文件
4. **磁盤空間**：可以釋放數百 MB 的磁盤空間

## 🔄 何時使用

建議在以下情況執行清理：
- ✅ 構建出現奇怪的錯誤
- ✅ 切換 Node.js 或 Python 版本後
- ✅ 磁盤空間不足
- ✅ 長時間開發後想清理緩存
- ✅ 準備提交代碼到 Git（確保沒有緩存文件）

## 💾 恢復緩存

清理後，只需重新運行開發服務器即可自動重建緩存：

```bash
# 前端
cd frontend
pnpm dev

# 後端
cd backend
python -m backend
```

## 🛠️ 故障排除

### 權限錯誤
如果遇到權限問題，請確保腳本有執行權限：
```bash
chmod +x clean_cache.sh
```

### 找不到命令
確保在項目根目錄執行：
```bash
cd /Users/yaolo/Desktop/autonote-slide
./clean_cache.sh
```
