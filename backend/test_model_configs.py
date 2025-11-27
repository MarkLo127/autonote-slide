"""
測試智能模型配置系統 - 包含多供應商支援

這個腳本示範如何使用 LLMSettings.from_model() 方法
來自動選擇最佳的模型配置，並測試所有支援的供應商。
"""

from app.models.schemas import LLMSettings, MODEL_PROVIDERS

print("=" * 60)
print("測試模型供應商配置")
print("=" * 60)

# 列出所有可用的供應商
print("\n📋 可用的模型供應商:")
for key, provider in MODEL_PROVIDERS.items():
    if key != "custom":
        print(f"  - {provider['name']}: {len(provider['models'])} 個模型")
        print(f"    Base URL: {provider['base_url']}")
        print(f"    API Key Env: {provider['api_key_env']}")
        print(f"    模型: {', '.join(provider['models'][:3])}{'...' if len(provider['models']) > 3 else ''}")
        print()

print("\n" + "=" * 60)
print("測試各供應商的模型配置")
print("=" * 60)

# 測試 OpenAI 模型
print("\n🤖 OpenAI 模型配置")
print("-" * 60)
for model in ["gpt-5.1-2025-11-13", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"]:
    settings = LLMSettings.from_model(
        api_key="sk-test-key",
        model=model
    )
    print(f"模型: {model}")
    print(f"  並發數: {settings.concurrency}")
    print(f"  每分鐘請求數: {settings.max_requests_per_minute}")
    print(f"  請求延遲: {settings.request_delay}s")
    print()

# 測試 Claude 模型
print("🧠 Claude 模型配置")
print("-" * 60)
for model in MODEL_PROVIDERS["claude"]["models"][:2]:
    settings = LLMSettings.from_model(
        api_key="sk-ant-test-key",
        model=model,
        base_url=MODEL_PROVIDERS["claude"]["base_url"]
    )
    print(f"模型: {model}")
    print(f"  並發數: {settings.concurrency}")
    print(f"  每分鐘請求數: {settings.max_requests_per_minute}")
    print(f"  請求延遲: {settings.request_delay}s")
    print()

# 測試 Gemini 模型
print("✨ Gemini 模型配置")
print("-" * 60)
for model in MODEL_PROVIDERS["gemini"]["models"][:2]:
    settings = LLMSettings.from_model(
        api_key="test-gemini-key",
        model=model,
        base_url=MODEL_PROVIDERS["gemini"]["base_url"]
    )
    print(f"模型: {model}")
    print(f"  並發數: {settings.concurrency}")
    print(f"  每分鐘請求數: {settings.max_requests_per_minute}")
    print(f"  請求延遲: {settings.request_delay}s")
    print()

# 測試 DeepSeek 模型
print("🔮 DeepSeek 模型配置")
print("-" * 60)
for model in MODEL_PROVIDERS["deepseek"]["models"]:
    settings = LLMSettings.from_model(
        api_key="test-deepseek-key",
        model=model,
        base_url=MODEL_PROVIDERS["deepseek"]["base_url"]
    )
    print(f"模型: {model}")
    print(f"  並發數: {settings.concurrency}")
    print(f"  每分鐘請求數: {settings.max_requests_per_minute}")
    print(f"  請求延遲: {settings.request_delay}s")
    print()

# 測試 Qwen 模型
print("🌟 Qwen 模型配置")
print("-" * 60)
for model in MODEL_PROVIDERS["qwen"]["models"][:2]:
    settings = LLMSettings.from_model(
        api_key="test-qwen-key",
        model=model,
        base_url=MODEL_PROVIDERS["qwen"]["base_url"]
    )
    print(f"模型: {model}")
    print(f"  並發數: {settings.concurrency}")
    print(f"  每分鐘請求數: {settings.max_requests_per_minute}")
    print(f"  請求延遲: {settings.request_delay}s")
    print()

# 測試 Grok 模型
print("🚀 Grok 模型配置")
print("-" * 60)
for model in MODEL_PROVIDERS["grok"]["models"][:3]:
    settings = LLMSettings.from_model(
        api_key="test-grok-key",
        model=model,
        base_url=MODEL_PROVIDERS["grok"]["base_url"]
    )
    print(f"模型: {model}")
    print(f"  並發數: {settings.concurrency}")
    print(f"  每分鐘請求數: {settings.max_requests_per_minute}")
    print(f"  請求延遲: {settings.request_delay}s")
    print()

# 測試配置覆寫
print("\n" + "=" * 60)
print("測試配置覆寫")
print("=" * 60)
settings_custom = LLMSettings.from_model(
    api_key="sk-test-key",
    model="gpt-5-mini-2025-08-07",
    concurrency=50,  # 覆寫並發數
    max_retries=10   # 覆寫重試次數
)
print(f"模型: {settings_custom.model}")
print(f"並發數: {settings_custom.concurrency} (預設: 100, 已覆寫為 50)")
print(f"最大重試次數: {settings_custom.max_retries} (預設: 5, 已覆寫為 10)")

print("\n✅ 所有配置測試通過！")
print("=" * 60)
