# 自帶模型的摘要/翻譯推理服務：Ollama + Qwen3.5-4B（Q4_K_M）
# 模型於 build 階段拉下並複製進 image 層 → 部署即帶模型、開機零下載、跨平台可上雲。
FROM ollama/ollama:latest

ARG MODEL=qwen3.5:4b
ENV MODEL=${MODEL}

# 用 cache mount 下載（網路斷了可續傳，不必從頭），再複製進 image 的 /models。
# 注意：不可用 `pkill -f "ollama serve"`——會連 build 自己的 shell 一起殺掉（exit 143）。
RUN --mount=type=cache,target=/root/.ollama \
    bash -c 'ollama serve & \
      for i in $(seq 1 60); do ollama list >/dev/null 2>&1 && break; sleep 1; done; \
      ollama pull "$MODEL"' \
    && mkdir -p /models \
    && cp -a /root/.ollama/. /models/

# 執行期從已烤進 image 的 /models 讀模型
ENV OLLAMA_MODELS=/models/models

EXPOSE 11434
# ollama 預設 entrypoint = ollama serve（image 已設 OLLAMA_HOST=0.0.0.0）
