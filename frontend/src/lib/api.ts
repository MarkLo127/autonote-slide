export const BACKEND: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8010";

export interface Segment {
  index: number;
  original: string;
  translated?: string | null;
  summary?: string | null;
}

export interface GlobalSummary {
  conclusion: string;
  data: string;
  risk: string;
  action: string;
  raw: string;
}

export interface AnalyzeResult {
  doc_id: string;
  language: string;
  total_pages: number;
  segments: Segment[];
  global_summary?: GlobalSummary | null;
  keywords: string[];
  wordcloud_image_url?: string | null;
  report_pdf_url?: string | null;
}

export interface StreamEvent {
  type: "progress" | "result" | "error";
  progress: number;
  message: string;
  data?: AnalyzeResult | null;
}

/** 上傳 PDF 並以 NDJSON 串流回報進度；逐事件 callback。 */
export async function analyzeStream(
  file: File,
  features: string[],
  onEvent: (e: StreamEvent) => void,
  refresh = false,
  signal?: AbortSignal,
): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("features", features.join(","));

  const url = `${BACKEND}/documents?stream=1${refresh ? "&refresh=1" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    body: fd,
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
}

export function reportUrl(result: AnalyzeResult): string | null {
  return result.report_pdf_url ? `${BACKEND}${result.report_pdf_url}` : null;
}

export interface DocumentSummary {
  doc_id: string;
  filename: string;
  created_at: number;
  status: string;
  total_pages: number;
  has_report: boolean;
  error?: string | null;
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch(`${BACKEND}/documents`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getResult(docId: string): Promise<AnalyzeResult> {
  const res = await fetch(`${BACKEND}/documents/${docId}/result`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${BACKEND}/documents/${docId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
