export type AnalyzeResponse = {
  language: string;
  paragraphs: { index: number; text: string; start_char: number; end_char: number }[];
  global_summary: string;
  paragraph_summaries: { paragraph_index: number; summary: string }[];
  paragraph_keywords: { paragraph_index: number; keywords: string[] }[];
  wordcloud_image_url: string; // /static/wordclouds/wc_xxx.png
};

export async function analyzeDoc(opts: {
  file: File;
  llmApiKey: string;
  llmBaseUrl?: string;
  llmModel?: string;
}): Promise<AnalyzeResponse> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
  const form = new FormData();
  form.append("file", opts.file);
  form.append("llm_api_key", opts.llmApiKey);
  if (opts.llmBaseUrl) form.append("llm_base_url", opts.llmBaseUrl);
  form.append("llm_model", opts.llmModel ?? "gpt-4o-mini");

  const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
