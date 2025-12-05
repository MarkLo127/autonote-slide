/**
 * API Settings Storage Utilities
 * Manages API keys and endpoints for multiple LLM providers
 */

export interface ApiSettings {
  openai_api_key: string;
  anthropic_api_key: string;
  gemini_api_key: string;
  grok_api_key: string;
  deepseek_api_key: string;
  qwen_api_key: string;
  custom_api_key: string;
  custom_base_url: string;
  selected_provider: string;
  selected_model: string;
}

const STORAGE_KEY = "autonote:api_settings";

export function saveApiSettings(settings: Partial<ApiSettings>): void {
  if (typeof window === "undefined") return;
  
  const current = loadApiSettings();
  const updated = { ...current, ...settings };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save API settings:", error);
  }
}

export function loadApiSettings(): ApiSettings {
  if (typeof window === "undefined") {
    return getDefaultSettings();
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultSettings();
    
    const parsed = JSON.parse(stored);
    return { ...getDefaultSettings(), ...parsed };
  } catch (error) {
    console.error("Failed to load API settings:", error);
    return getDefaultSettings();
  }
}

export function clearApiSettings(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear API settings:", error);
  }
}

function getDefaultSettings(): ApiSettings {
  return {
    openai_api_key: "",
    anthropic_api_key: "",
    gemini_api_key: "",
    grok_api_key: "",
    deepseek_api_key: "",
    qwen_api_key: "",
    custom_api_key: "",
    custom_base_url: "",
    selected_provider: "openai",
    selected_model: "gpt-4o-mini",
  };
}

/**
 * Get the API key for the selected provider
 */
export function getApiKeyForProvider(
  settings: ApiSettings,
  provider: string
): string {
  switch (provider) {
    case "openai":
      return settings.openai_api_key;
    case "anthropic":
    case "claude":
      return settings.anthropic_api_key;
    case "gemini":
      return settings.gemini_api_key;
    case "grok":
      return settings.grok_api_key;
    case "deepseek":
      return settings.deepseek_api_key;
    case "qwen":
      return settings.qwen_api_key;
    case "custom":
      return settings.custom_api_key;
    default:
      return "";
  }
}

/**
 * Get the base URL for the selected provider
 */
export function getBaseUrlForProvider(
  settings: ApiSettings,
  provider: string
): string {
  switch (provider) {
    case "custom":
      return settings.custom_base_url;
    default:
      return ""; // Backend will use default for known providers
  }
}
