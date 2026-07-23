# 多階段：build Vite 靜態檔 → nginx 服務並反代 API 到 gateway
# 容器內用 npm（不會 gate 建置腳本，esbuild 原生 binary 正常安裝）
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# 同源部署：API 走相對路徑，交給 nginx 反代（見 nginx.conf.template）
ENV VITE_BACKEND_URL=""
RUN npm run build

FROM nginx:alpine
# nginx template：啟動時 envsubst 帶入 PORT / GATEWAY_UPSTREAM（本地預設；Railway 覆寫）
ENV PORT=80 \
    GATEWAY_UPSTREAM=gateway:8000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
