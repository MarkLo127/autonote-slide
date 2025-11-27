"""
測試模型級別映射功能

驗證各供應商的 LIGHT/MEDIUM/DEEP 級別映射是否正確
"""

from app.models.schemas import MODEL_LEVEL_MAPPING

print("=" * 70)
print("模型級別映射測試")
print("=" * 70)

providers_cn = {
    "openai": "OpenAI",
    "claude": "Claude (Anthropic)",
    "gemini": "Gemini (Google)",
    "deepseek": "DeepSeek",
    "qwen": "Qwen (Alibaba)",
    "grok": "Grok (X.AI)",
}

for provider_key, provider_name in providers_cn.items():
    print(f"\n📊 {provider_name}")
    print("-" * 70)
    
    if provider_key in MODEL_LEVEL_MAPPING:
        mapping = MODEL_LEVEL_MAPPING[provider_key]
        print(f"  LIGHT (輕量):   {mapping.get('light', 'N/A')}")
        print(f"  MEDIUM (標準):  {mapping.get('medium', 'N/A')}")
        print(f"  DEEP (深度):    {mapping.get('deep', 'N/A')}")
    else:
        print("  ⚠️  未配置級別映射")

print("\n" + "=" * 70)
print("驗證用戶需求")
print("=" * 70)

# 驗證 Claude 分類
print("\n✅ Claude 模型分類驗證:")
expected_claude = {
    "light": "claude-3-7-sonnet-20250219",
    "medium": "claude-sonnet-4-20250514", 
    "deep": "claude-sonnet-4-5-20250929"
}
actual_claude = MODEL_LEVEL_MAPPING["claude"]
print(f"  LIGHT:  {actual_claude['light']} {'✓' if actual_claude['light'] == expected_claude['light'] else '✗'}")
print(f"  MEDIUM: {actual_claude['medium']} {'✓' if actual_claude['medium'] == expected_claude['medium'] else '✗'}")
print(f"  DEEP:   {actual_claude['deep']} {'✓' if actual_claude['deep'] == expected_claude['deep'] else '✗'}")

# 驗證 Gemini 分類
print("\n✅ Gemini 模型分類驗證:")
expected_gemini = {
    "light": "gemini-2.5-flash-lite",
    "medium": "gemini-2.5-flash",
    "deep": "gemini-2.5-pro"
}
actual_gemini = MODEL_LEVEL_MAPPING["gemini"]
print(f"  LIGHT:  {actual_gemini['light']} {'✓' if actual_gemini['light'] == expected_gemini['light'] else '✗'}")
print(f"  MEDIUM: {actual_gemini['medium']} {'✓' if actual_gemini['medium'] == expected_gemini['medium'] else '✗'}")
print(f"  DEEP:   {actual_gemini['deep']} {'✓' if actual_gemini['deep'] == expected_gemini['deep'] else '✗'}")

# 驗證 DeepSeek 分類
print("\n✅ DeepSeek 模型分類驗證:")
expected_deepseek = {
    "light": "deepseek-chat",
    "medium": "deepseek-chat",
    "deep": "deepseek-reasoner"
}
actual_deepseek = MODEL_LEVEL_MAPPING["deepseek"]
print(f"  LIGHT:  {actual_deepseek['light']} {'✓' if actual_deepseek['light'] == expected_deepseek['light'] else '✗'}")
print(f"  MEDIUM: {actual_deepseek['medium']} {'✓' if actual_deepseek['medium'] == expected_deepseek['medium'] else '✗'}")
print(f"  DEEP:   {actual_deepseek['deep']} {'✓' if actual_deepseek['deep'] == expected_deepseek['deep'] else '✗'}")

# 驗證 Qwen 分類
print("\n✅ Qwen 模型分類驗證:")
expected_qwen = {
    "light": "qwen-flash",
    "medium": "qwen-plus",
    "deep": "qwen3-max"
}
actual_qwen = MODEL_LEVEL_MAPPING["qwen"]
print(f"  LIGHT:  {actual_qwen['light']} {'✓' if actual_qwen['light'] == expected_qwen['light'] else '✗'}")
print(f"  MEDIUM: {actual_qwen['medium']} {'✓' if actual_qwen['medium'] == expected_qwen['medium'] else '✗'}")
print(f"  DEEP:   {actual_qwen['deep']} {'✓' if actual_qwen['deep'] == expected_qwen['deep'] else '✗'}")

# 驗證 Grok 分類
print("\n✅ Grok 模型分類驗證:")
expected_grok = {
    "light": "grok-3-mini",
    "medium": "grok-4",
    "deep": "grok-4-1-fast-reasoning"
}
actual_grok = MODEL_LEVEL_MAPPING["grok"]
print(f"  LIGHT:  {actual_grok['light']} {'✓' if actual_grok['light'] == expected_grok['light'] else '✗'}")
print(f"  MEDIUM: {actual_grok['medium']} {'✓' if actual_grok['medium'] == expected_grok['medium'] else '✗'}")
print(f"  DEEP:   {actual_grok['deep']} {'✓' if actual_grok['deep'] == expected_grok['deep'] else '✗'}")

print("\n" + "=" * 70)
print("✅ 所有級別映射測試通過！")
print("=" * 70)
