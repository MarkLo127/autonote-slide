import { ApiConfig, AnalyzeResponse } from '@/lib/types';

const DEFAULT_BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

function resolveBackendUrl(): string {
  if (typeof window !== 'undefined') {
    return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
  }
  return DEFAULT_BACKEND_URL;
}

export async function analyzeDocument(
  file: File,
  config: ApiConfig
): Promise<AnalyzeResponse> {
  const baseUrl = resolveBackendUrl();
  const targetUrl = `${baseUrl}/analyze`;

  const body = new FormData();
  body.append('file', file);
  body.append('llm_api_key', config.apiKey);
  body.append('llm_model', config.model);
  if (config.llmBaseUrl) {
    body.append('llm_base_url', config.llmBaseUrl);
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    body
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `上傳失敗 (${response.status})`);
  }

  const payload = (await response.json()) as AnalyzeResponse;
  return payload;
}
