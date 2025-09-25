export interface Paragraph {
  index: number;
  text: string;
  start_char: number;
  end_char: number;
}

export interface SummaryItem {
  paragraph_index: number;
  summary: string;
}

export interface KeywordItem {
  paragraph_index: number;
  keywords: string[];
}

export interface AnalyzeResponse {
  language: string;
  paragraphs: Paragraph[];
  global_summary: string;
  paragraph_summaries: SummaryItem[];
  paragraph_keywords: KeywordItem[];
  wordcloud_image_url: string;
}

export interface ApiConfig {
  apiKey: string;
  llmBaseUrl?: string;
  model: string;
}

export interface StoredDocument extends AnalyzeResponse {
  id: string;
  filename: string;
  uploadedAt: string;
}
