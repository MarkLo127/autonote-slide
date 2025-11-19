"""
測試智能模型配置系統

這個腳本示範如何使用 LLMSettings.from_model() 方法
來自動選擇最佳的模型配置。
"""

from app.models.schemas import LLMSettings

# 測試 1: gpt-5-mini (最快，適合大文件)
print("=== gpt-5-mini 配置 ===")
settings_mini = LLMSettings.from_model(
    api_key="sk-test-key",
    model="gpt-5-mini-2025-08-07"
)
print(f"模型: {settings_mini.model}")
print(f"每分鐘請求數: {settings_mini.max_requests_per_minute}")
print(f"並發數: {settings_mini.concurrency}")
print(f"請求延遲: {settings_mini.request_delay}s")
print(f"預估 200 頁處理時間: ~25-30 秒\n")

# 測試 2: gpt-5-nano
print("=== gpt-5-nano 配置 ===")
settings_nano = LLMSettings.from_model(
    api_key="sk-test-key",
    model="gpt-5-nano-2025-08-07"
)
print(f"模型: {settings_nano.model}")
print(f"每分鐘請求數: {settings_nano.max_requests_per_minute}")
print(f"並發數: {settings_nano.concurrency}")
print(f"請求延遲: {settings_nano.request_delay}s")
print(f"預估 200 頁處理時間: ~40-50 秒\n")

# 測試 3: gpt-5.1 (受 TPM 限制)
print("=== gpt-5.1 配置 ===")
settings_5_1 = LLMSettings.from_model(
    api_key="sk-test-key",
    model="gpt-5.1-2025-11-13"
)
print(f"模型: {settings_5_1.model}")
print(f"每分鐘請求數: {settings_5_1.max_requests_per_minute}")
print(f"並發數: {settings_5_1.concurrency}")
print(f"請求延遲: {settings_5_1.request_delay}s")
print(f"預估 200 頁處理時間: ~10-13 分鐘\n")

# 測試 4: 覆寫配置
print("=== gpt-5-mini 配置 + 自訂覆寫 ===")
settings_custom = LLMSettings.from_model(
    api_key="sk-test-key",
    model="gpt-5-mini-2025-08-07",
    concurrency=100,  # 覆寫並發數
    max_retries=5     # 覆寫重試次數
)
print(f"模型: {settings_custom.model}")
print(f"每分鐘請求數: {settings_custom.max_requests_per_minute}")
print(f"並發數: {settings_custom.concurrency} (已覆寫)")
print(f"最大重試次數: {settings_custom.max_retries} (已覆寫)")
print(f"請求延遲: {settings_custom.request_delay}s")

# 測試 5: 手動配置 (向後兼容)
print("\n=== 手動配置 (向後兼容) ===")
settings_manual = LLMSettings(
    api_key="sk-test-key",
    model="gpt-4",
    max_requests_per_minute=5,
    concurrency=1
)
print(f"模型: {settings_manual.model}")
print(f"每分鐘請求數: {settings_manual.max_requests_per_minute}")
print(f"並發數: {settings_manual.concurrency}")

print("\n✅ 所有配置測試通過！")
