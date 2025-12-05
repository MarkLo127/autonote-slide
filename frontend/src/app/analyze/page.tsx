"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import Image from "next/image";
import { useAnalysisState } from "@/hooks/useAnalysisState";
import { loadApiSettings, getApiKeyForProvider } from "@/lib/storage";

import { generateAnalysisPdf } from "@/lib/generateAnalysisPdf";

type PageSummary = {
  page_number: number;
  classification: string;
  bullets: string[];
  keywords: string[];
  skipped: boolean;
  skip_reason?: string | null;
};

type GlobalSummaryExpansions = {
  key_conclusions: string;
  core_data: string;
  risks_and_actions: string;
};

type GlobalSummary = {
  bullets: string[];
  expansions: GlobalSummaryExpansions;
};

type AnalyzeResponse = {
  language: string;
  total_pages: number;
  page_summaries: PageSummary[];
  global_summary: GlobalSummary;
  system_prompt?: string | null;
  wordcloud_image_url: string | null;
};

type FilePreviewKind = "none" | "pdf" | "text" | "image" | "generic";

type ModelProvider = {
  name: string;
  base_url: string;
  api_key_env: string;
  models: string[];
};

type ProvidersResponse = {
  providers: Record<string, ModelProvider>;
  level_mapping: Record<string, Record<string, string>>;
};

// Smart backend URL resolution:
// 1. Use explicit environment variable if set
// 2. In production, use Railway backend URL
// 3. In development, use localhost
const getDefaultBackendUrl = () => {
  // If environment variable is explicitly set, use it
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // In production environment, use Railway backend URL
  if (process.env.NODE_ENV === "production") {
    return "https://autonote-backend.up.railway.app";
  }
  
  // In development, use localhost
  return "http://localhost:8000";
};

const rawBackendOrigin = getDefaultBackendUrl();
const sanitizeBase = (base: string) => base.replace(/\/$/, "");

const resolveBrowserBackendBase = (base: string) => {
  if (typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    if (url.hostname === "backend") {
      const port = url.port || "8000";
      return `${window.location.protocol}//${window.location.hostname}${port ? `:${port}` : ""}`;
    }
    if (url.hostname === "0.0.0.0") {
      const port = url.port || "8000";
      return `${window.location.protocol}//${window.location.hostname}${port ? `:${port}` : ""}`;
    }
  } catch (err) {
    console.warn("解析後端位址失敗，將使用預設值", err);
    return base;
  }
  return base;
};

const INITIAL_BACKEND_BASE = sanitizeBase(rawBackendOrigin);
const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";

const normalizeOptionalUrl = (url: string) =>
  url ? url.trim().replace(/\/$/, "") : "";

const fileTypes = [
  { label: "PDF", color: "text-rose-500" },
];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const isTextFile = (file: File) => {
  const lower = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv")
  );
};

const isImageFile = (file: File) => file.type.startsWith("image/");

export default function AnalyzePage() {
  const { setAnalysisResult: saveAnalysisResult } = useAnalysisState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backendBase, setBackendBase] = useState(INITIAL_BACKEND_BASE);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(
    null,
  );
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [filePreviewType,
    setFilePreviewType] = useState<FilePreviewKind>("none");
  const [filePreviewContent, setFilePreviewContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-5-mini-2025-08-07");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [providers, setProviders] = useState<Record<string, ModelProvider>>({});
  const [levelMapping, setLevelMapping] = useState<Record<string, Record<string, string>>>({});
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  
  // Legacy support
  const [llmBaseUrl, setLlmBaseUrl] = useState(DEFAULT_LLM_BASE_URL);
  const [analysisCompleteMessage,
    setAnalysisCompleteMessage] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<
    { value: number; message: string } | null
  >(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [analysisLevel, setAnalysisLevel] = useState("medium");
  const fileInputId = useId();
  const aggregatedKeywords = useMemo(() => {
    if (!analysisResult) return [];
    return Array.from(
      new Set(
        analysisResult.page_summaries
          .map((page) => page.keywords.slice(0, 4))
          .flat()
          .filter((kw) => kw.trim().length > 0),
      ),
    ).slice(0, 24);
  }, [analysisResult]);

  const uploadHelpId = `${fileInputId}-help`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBackendBase(sanitizeBase(resolveBrowserBackendBase(rawBackendOrigin)));
  }, []);

  const toAbsoluteUrl = useCallback(
    (url: string | null | undefined): string | null => {
      if (!url) return null;
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith("/")) return `${backendBase}${url}`;
      return `${backendBase}/${url}`;
    },
    [backendBase],
  );

  // Fetch providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch(`${backendBase}/analyze/providers`);
        if (response.ok) {
          const data: ProvidersResponse = await response.json();
          setProviders(data.providers);
          setLevelMapping(data.level_mapping || {});
        }
      } catch (err) {
        console.error("獲取供應商資訊失敗", err);
      }
    };
    fetchProviders();
  }, [backendBase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings = loadApiSettings();
    setSelectedProvider(settings.selected_provider || "openai");
    setSelectedModel(settings.selected_model || "gpt-4o-mini");
    setHasLoadedSettings(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSettings || typeof window === "undefined") return;
    window.localStorage.setItem("autonote:llmApiKey", apiKey);
  }, [apiKey, hasLoadedSettings]);

  useEffect(() => {
    if (!hasLoadedSettings || typeof window === "undefined") return;
    window.localStorage.setItem("autonote:selectedProvider", selectedProvider);
  }, [selectedProvider, hasLoadedSettings]);

  useEffect(() => {
    if (!hasLoadedSettings || typeof window === "undefined") return;
    window.localStorage.setItem("autonote:selectedModel", selectedModel);
  }, [selectedModel, hasLoadedSettings]);

  useEffect(() => {
    if (!hasLoadedSettings || typeof window === "undefined") return;
    window.localStorage.setItem("autonote:customBaseUrl", customBaseUrl);
  }, [customBaseUrl, hasLoadedSettings]);

  // Sync analysis_level with selectedModel for all providers
  // 只有在 analysis_level 改变时才自动更新模型
  useEffect(() => {
    if (!levelMapping[selectedProvider]) return;
    const modelToSet = levelMapping[selectedProvider][analysisLevel];
    if (modelToSet) {
      setSelectedModel(modelToSet);
    }
  }, [analysisLevel, selectedProvider, levelMapping]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!analysisCompleteMessage) return undefined;

    const timer = window.setTimeout(() => {
      setAnalysisCompleteMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [analysisCompleteMessage]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!selectedFiles.length) {
      setFilePreviewUrl(null);
      setFilePreviewType("none");
      setFilePreviewContent("");
      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    const file = selectedFiles[0];

    if (isPdfFile(file)) {
      objectUrl = URL.createObjectURL(file);
      if (!cancelled) {
        setFilePreviewUrl(objectUrl);
        setFilePreviewType("pdf");
        setFilePreviewContent("");
      }
    } else if (isTextFile(file)) {
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled) {
          setFilePreviewContent((reader.result as string) ?? "");
          setFilePreviewUrl(null);
          setFilePreviewType("text");
        }
      };
      reader.readAsText(file, "utf-8");
    } else if (isImageFile(file)) {
      objectUrl = URL.createObjectURL(file);
      if (!cancelled) {
        setFilePreviewUrl(objectUrl);
        setFilePreviewType("image");
        setFilePreviewContent("");
      }
    } else {
      objectUrl = URL.createObjectURL(file);
      if (!cancelled) {
        setFilePreviewUrl(objectUrl);
        setFilePreviewType("generic");
        setFilePreviewContent("");
      }
    }

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedFiles]);

  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    if (fileArray.length > 1) {
      setError("一次僅能上傳 1 個檔案，已保留第一個檔案。");
    } else {
      setError(null);
    }

    const firstFile = fileArray[0];
    if (!firstFile) return;

    setSelectedFiles([firstFile]);
    setAnalysisResult(null);
    setAnalysisCompleteMessage(null);
    setAnalysisProgress(null);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer?.files) {
        handleFilesSelected(event.dataTransfer.files);
      }
    },
    [handleFilesSelected],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const selectedFileName = selectedFiles[0]?.name ?? "";

  const handleAnalyze = useCallback(async () => {
    if (!selectedFiles.length) {
      setError("請先選擇要上傳的檔案");
      return;
    }
    
    // 從 localStorage 載入 API 設定
    const settings = loadApiSettings();
    const currentApiKey = getApiKeyForProvider(settings, selectedProvider);
    
    if (!currentApiKey.trim()) {
      setError("請先在首頁設定 API Key");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisCompleteMessage(null);
    setError(null);
    setAnalysisProgress({ value: 5, message: "準備分析…" });

    try {
      const formData = new FormData();
      formData.append("file", selectedFiles[0]);
      formData.append("llm_api_key", currentApiKey);
      formData.append("llm_model", selectedModel);
      formData.append( "llm_provider", selectedProvider);
      
      // 如果選擇自訂，使用自訂的 Base URL
      if (selectedProvider === "custom" && customBaseUrl.trim()) {
        formData.append("llm_base_url", normalizeOptionalUrl(customBaseUrl));
      }
      
      // 保持對 analysis_level 的支援（向後兼容）
      if (analysisLevel) {
        formData.append("analysis_level", analysisLevel);
      }

      const analyzeEndpoint = `${backendBase}/analyze`;
      const response = await fetch(analyzeEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "分析失敗，請稍後再試");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: AnalyzeResponse | null = null;
      let serverError: string | null = null;
      let shouldStop = false;

      const handleLine = (line: string) => {
        if (!line) return;
        try {
          const event = JSON.parse(line) as {
            type?: string;
            progress?: number;
            message?: string;
            data?: AnalyzeResponse;
          };

          if (event.type === "progress") {
            setAnalysisProgress({
              value:
                typeof event.progress === "number"
                  ? Math.min(Math.max(event.progress, 0), 100)
                  : 0,
              message: event.message ?? "",
            });
          } else if (event.type === "result" && event.data) {
            finalData = event.data;
            setAnalysisProgress({
              value:
                typeof event.progress === "number"
                  ? Math.min(Math.max(event.progress, 0), 100)
                  : 100,
              message: event.message ?? "分析完成",
            });
            shouldStop = true;
          } else if (event.type === "error") {
            serverError = event.message || "分析失敗";
            setAnalysisProgress({ value: 100, message: serverError });
            shouldStop = true;
          }
        } catch (err) {
          console.error("無法解析伺服器訊息", err, line);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            handleLine(line);
            newlineIndex = buffer.indexOf("\n");
          }
        }

        if (done) {
          const remaining = buffer.trim();
          if (remaining) {
            handleLine(remaining);
          }
          break;
        }

        if (shouldStop) {
          // 嘗試讀完剩餘資料；若伺服器仍有內容會在下一輪完成。
          if (!buffer.length) {
            break;
          }
        }
      }

      if (serverError) {
        throw new Error(serverError);
      }

      if (!finalData) {
        throw new Error("未取得分析結果，請稍後再試");
      }

      const resolvedData: AnalyzeResponse = finalData;

      const resultData = {
        language: resolvedData.language,
        total_pages: resolvedData.total_pages,
        page_summaries: resolvedData.page_summaries,
        global_summary: resolvedData.global_summary,
        system_prompt: resolvedData.system_prompt,
        wordcloud_image_url: toAbsoluteUrl(resolvedData.wordcloud_image_url),
      document_name: selectedFileName,
      };
      setAnalysisResult(resultData);
      saveAnalysisResult(resultData);
      setAnalysisCompleteMessage("分析結果已完成");
      // Results will be displayed inline on this page
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "分析時發生未知錯誤";
      setError(message);
      setAnalysisResult(null);
      setAnalysisCompleteMessage(null);
      setAnalysisProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFiles, apiKey, selectedModel, selectedProvider, customBaseUrl, analysisLevel, backendBase, toAbsoluteUrl]);

  const resetSelection = useCallback(() => {
    setSelectedFiles([]);
    setAnalysisResult(null);
    setError(null);
    setAnalysisCompleteMessage(null);
    setAnalysisProgress(null);
  }, []);

  const handleDownloadReport = useCallback(async () => {
    if (!analysisResult) {
      setError("請先完成檔案分析後再下載報告");
      return;
    }

    setIsDownloading(true);

    try {
      const languageLabel = analysisResult.language
        ? analysisResult.language.toUpperCase()
        : null;

      const pdfFontUrl = toAbsoluteUrl("/assets/fonts/Noto_Sans_TC/NotoSansTC-VariableFont_wght.ttf");

      const pdfBytes = await generateAnalysisPdf({
        documentTitle: selectedFileName || "未命名檔案",
        languageLabel,
        totalPages: analysisResult.total_pages,
        globalSummary: analysisResult.global_summary,
        aggregatedKeywords,
        pageSummaries: analysisResult.page_summaries,
        wordcloudUrl: analysisResult.wordcloud_image_url ?? undefined,
        fontUrl: pdfFontUrl ?? undefined,
      });

      const arrayBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength,
      );
      const blob = new Blob([arrayBuffer as ArrayBuffer], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const baseName = (selectedFileName || "分析報告")
        .replace(/\.[^/.]+$/, "")
        .replace(/[\\/:*?"<>|]/g, "_");
      anchor.href = downloadUrl;
      anchor.download = `${baseName || "分析報告"}-分析結果.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("生成 PDF 失敗", err);
      const message =
        err instanceof Error ? err.message : "PDF 生成時發生未知錯誤";
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [
    analysisResult,
    aggregatedKeywords,
    selectedFileName,
    toAbsoluteUrl,
  ]);

  const renderUploadPreview = () => {
    if (!selectedFiles.length) {
      return (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
          上傳檔案後即可在此預覽原始內容。
        </div>
      );
    }

    if (filePreviewType === "pdf" && filePreviewUrl) {
      return (
        <iframe
          title="檔案預覽"
          src={filePreviewUrl}
          className="h-full w-full rounded-2xl border border-slate-200 bg-white"
        />
      );
    }

    if (filePreviewType === "image" && filePreviewUrl) {
      return (
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Image
            src={filePreviewUrl}
            alt="選擇的圖片預覽"
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      );
    }

    if (filePreviewType === "text") {
      return (
        <div className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/90 p-4">
          <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {filePreviewContent}
          </pre>
        </div>
      );
    }

    if (filePreviewType === "generic" && filePreviewUrl) {
      return (
        <iframe
          title="檔案預覽"
          src={filePreviewUrl}
          className="h-full w-full rounded-2xl border border-slate-200 bg-white"
        />
      );
    }

    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
        此檔案格式暫不支援內嵌預覽，請重新選擇其他檔案。
      </div>
    );
  };

  const renderAnalysisPanel = () => {
    if (!analysisResult) {
      return (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 p-8 text-sm text-slate-500">
          完成檔案分析後，全局摘要與逐頁重點將顯示於此處。
        </div>
      );
    }

    const languageLabel = analysisResult.language
      ? analysisResult.language.toUpperCase()
      : "";

    const classificationMap: Record<string, string> = {
      normal: "一般內容",
      toc: "目錄頁",
      pure_image: "純圖片",
      blank: "空白/水印",
      cover: "封面",
    };

    return (
      <div className="space-y-8">
        <section className="space-y-6 rounded-3xl glass-card-strong p-6 shadow-xl hover-lift">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {languageLabel ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                語言：{languageLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-600">
              共 {analysisResult.total_pages} 頁
            </span>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">全局總結</h3>
              {analysisResult.global_summary.bullets.length ? (
                <ul className="mt-4 space-y-3 text-[15px] leading-7 text-slate-800">
                  {analysisResult.global_summary.bullets.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-slate-500">尚未取得全局摘要。</p>
              )}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-600">關鍵結論</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {analysisResult.global_summary.expansions.key_conclusions || "暫無資料"}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-600">核心數據與依據</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {analysisResult.global_summary.expansions.core_data || "暫無資料"}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-600">風險與建議</h4>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {analysisResult.global_summary.expansions.risks_and_actions || "暫無資料"}
                </p>
              </article>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5">
              <h4 className="text-sm font-semibold text-slate-600">整體關鍵字</h4>
              {aggregatedKeywords.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {aggregatedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">暫無關鍵字可顯示。</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5">
              <h4 className="text-sm font-semibold text-slate-600">文字雲</h4>
              {analysisResult.wordcloud_image_url ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200">
                  <Image
                    src={analysisResult.wordcloud_image_url}
                    alt="關鍵字文字雲"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">尚未取得文字雲。</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-3xl glass-card-strong p-6 shadow-xl hover-lift">
          <h3 className="text-lg font-semibold text-slate-800">逐頁重點與關鍵字</h3>
          <div className="space-y-5 max-h-[520px] overflow-y-auto pr-2">
            {analysisResult.page_summaries
              .filter((page) => !page.skipped) // 过滤掉跳过的页面（目录、封面、纯图片、空白页等）
              .map((page) => (
              <article
                key={page.page_number}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      第 {page.page_number} 頁
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {classificationMap[page.classification] ?? page.classification}
                    </span>
                  </div>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                  {page.bullets.map((bullet, idx) => (
                    <li key={`${page.page_number}-${idx}`} className="rounded-xl bg-slate-50/80 px-3 py-2">
                      {bullet}
                    </li>
                  ))}
                </ul>
                {page.keywords.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {page.keywords.map((kw) => (
                      <span
                        key={`${page.page_number}-${kw}`}
                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">本頁尚無關鍵字。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 text-slate-900 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      <div className="relative z-10">
      {analysisCompleteMessage ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
          {analysisCompleteMessage}
        </div>
      ) : null}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-8 pt-8 animate-[fade-in-up_0.6s_ease-out]">
        <div aria-hidden />
        <div className="col-start-2 col-end-3 flex items-center justify-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 text-3xl text-white shadow-xl hover-glow">
            📄
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AutoNote & Slide</p>
            <p className="text-sm text-slate-600 font-medium">智慧文檔處理平台</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="group col-start-3 col-end-4 justify-self-end rounded-2xl glass-card p-3 shadow-lg transition hover:shadow-xl hover-lift"
          aria-label="開啟 API 設定"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-6 w-6 text-slate-600 transition group-hover:text-slate-900"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317a1 1 0 0 1 .894-.553h1.562a1 1 0 0 1 .894.553l.482.964a1 1 0 0 0 .764.553l1.064.12a1 1 0 0 1 .874.874l.12 1.064a1 1 0 0 0 .553.764l.964.482a1 1 0 0 1 .553.894v1.562a1 1 0 0 1-.553.894l-.964.482a1 1 0 0 0-.553.764l-.12 1.064a1 1 0 0 1-.874.874l-1.064.12a1 1 0 0 0-.764.553l-.482.964a1 1 0 0 1-.894.553h-1.562a1 1 0 0 1-.894-.553l-.482-.964a1 1 0 0 0-.764-.553l-1.064-.12a1 1 0 0 1-.874-.874l-.12-1.064a1 1 0 0 0-.553-.764l-.964-.482a1 1 0 0 1-.553-.894v-1.562a1 1 0 0 1 .553-.894l.964-.482a1 1 0 0 0 .553-.764l.12-1.064a1 1 0 0 1 .874-.874l1.064-.12a1 1 0 0 0 .764-.553l.482-.964Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </button>
      </header>

      <main className="mx-auto mt-8 max-w-[1400px] px-8 pb-20 lg:px-10">
        <div className="rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50 to-amber-100/70 px-8 py-5 text-sm font-medium text-amber-800 shadow-sm text-center lg:text-base">
          目前僅支援電腦端使用，請使用電腦瀏覽器獲得最佳體驗
        </div>

        <div className="mt-10 space-y-10">
          <div className="grid grid-cols-1 gap-10 xl:grid-cols-2 xl:items-stretch">
          <section className="relative flex w-full flex-col rounded-[40px] glass-card-strong p-10 shadow-2xl hover-lift lg:min-h-[620px] xl:min-h-[700px] animate-[scale-in_0.5s_ease-out]">
            <div className="mt-10 flex flex-1 flex-col items-center gap-6 text-center">
              <div
                className={`flex min-h-[420px] w-full flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed p-10 transition-all duration-300 ${dragging ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 scale-[1.02] shadow-lg" : "border-slate-300 bg-gradient-to-br from-slate-50/50 to-white/50"}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <label htmlFor={fileInputId} className="sr-only">
                  選擇要分析的檔案
                </label>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple={false}
                  className="sr-only"
                  aria-describedby={uploadHelpId}
                  onChange={(event) => {
                    if (event.target.files) {
                      handleFilesSelected(event.target.files);
                    }
                  }}
                />
                <div className="flex h-28 w-28 items-center justify-center rounded-[36px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-5xl text-white shadow-2xl hover:scale-110 transition-transform duration-300 animate-[pulse-glow_2s_ease-in-out_infinite]">
                  ⬆️
                </div>
                <div className="flex max-w-xl flex-col gap-3">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">上傳您的檔案</h1>
                  <p className="text-base leading-7 text-slate-700">
                    將檔案拖放到此處，或點擊任何地方瀏覽檔案。上傳後系統會整理每頁重點並彙整全局摘要。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-xl transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-2xl hover:scale-105"
                >
                  選擇檔案
                </button>
                <p id={uploadHelpId} className="text-xs leading-6 text-slate-500">
                  支援格式：PDF
                  <br />
                  最大檔案大小：50MB，一次僅能上傳 1 份檔案
                </p>
                <div className="flex flex-wrap justify-center gap-3 text-sm font-medium">
                  {fileTypes.map((type) => (
                    <span
                      key={type.label}
                      className={`${type.color} rounded-full bg-white px-3 py-1 shadow-sm`}
                    >
                      {type.label}
                    </span>
                  ))}
                </div>
              </div>

              {selectedFiles.length > 0 ? (
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">已選擇檔案</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedFileName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        檔案大小：{formatBytes(selectedFiles[0].size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="text-xs font-medium text-rose-500 hover:text-rose-600"
                    >
                      重新選擇
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              ) : null}

              {analysisProgress ? (
                <div className="w-full space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{analysisProgress.message || "分析中"}</span>
                    <span>{analysisProgress.value}%</span>
                  </div>
                   <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                     <div
                       className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                       style={{ width: `${Math.min(Math.max(analysisProgress.value, 0), 100)}%`, backgroundSize: '200% 100%', animation: 'gradient-shift 2s ease infinite' }}
                     />
                  </div>
                </div>
              ) : null}

              <div className="w-full space-y-4">
                <button
                  type="button"
                   onClick={handleAnalyze}
                   disabled={isAnalyzing}
                   className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-4 text-lg font-bold text-white shadow-2xl transition-all hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 hover:shadow-3xl hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                 >
                  {isAnalyzing ? "分析中…" : "開始分析"}
                </button>
              </div>
            </div>
          </section>

          <section className="relative flex w-full flex-col rounded-[40px] glass-card-strong p-10 shadow-2xl hover-lift lg:min-h-[620px] xl:min-h-[700px] animate-[scale-in_0.5s_ease-out_0.1s] opacity-0" style={{ animationFillMode: 'forwards' }}>
            <div className="flex flex-col items-center gap-4 text-center">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">檔案預覽</h2>
                <p className="mt-3 text-base text-slate-600">
                  左側上傳檔案後，可在此預覽原始檔案內容。
                </p>
              </div>
            </div>
            <div className="mt-6 flex-1 overflow-hidden rounded-[28px] bg-slate-50/90 p-4">
              <div className="h-full w-full">{renderUploadPreview()}</div>
            </div>
          </section>
          </div>

          <section className="relative w-full rounded-[40px] glass-card-strong p-10 shadow-2xl hover-lift animate-[scale-in_0.5s_ease-out_0.2s] opacity-0" style={{ animationFillMode: 'forwards' }}>
            <div className="flex flex-col gap-4 text-center lg:flex-row lg:items-center lg:justify-between">
              <div className="lg:text-left">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">分析結果整理</h2>
                <p className="mt-3 text-base text-slate-600">
                  檔案分析完成後，全局摘要與逐頁重點會集中顯示在此區域。
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 lg:items-end">
                <button
                  type="button"
                  onClick={() => void handleDownloadReport()}
                  disabled={!analysisResult || isDownloading || isAnalyzing}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${ !analysisResult || isDownloading || isAnalyzing
                      ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                      : "border-none bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl hover:from-emerald-600 hover:to-teal-600 hover:shadow-2xl hover:scale-105"
                  }`}
                >
                  {isDownloading ? "PDF 準備中…" : "下載 PDF 報告"}
                  {!isDownloading ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v11m0 0-3.5-3.5M12 16l3.5-3.5" />
                    </svg>
                  ) : null}
                </button>
                <p className="text-xs text-slate-400">PDF 將包含摘要、關鍵字與文字雲</p>
              </div>
            </div>
            <div className="mt-6">{renderAnalysisPanel()}</div>
          </section>
        </div>
      </main>

      <footer className="pb-8 text-center">
        <p className="text-sm text-slate-500">
          Powered by OpenAI
        </p>
      </footer>

      {settingsOpen ? (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 animate-[fade-in-up_0.3s_ease-out]">
           <div className="w-full max-w-md rounded-3xl glass-card-strong p-6 shadow-2xl animate-[scale-in_0.3s_ease-out]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">模型選擇</h3>
                <p className="text-sm text-slate-500">選擇要使用的 AI 模型（API Key 請在首頁設定）</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="關閉設定"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="providerSelect">
                  模型供應商
                </label>
                <select
                  id="providerSelect"
                  value={selectedProvider}
                  onChange={(event) => {
                    setSelectedProvider(event.target.value);
                    // 當切換供應商時，自動選擇該供應商的第一個模型
                    const provider = providers[event.target.value];
                    if (provider && provider.models.length > 0) {
                      setSelectedModel(provider.models[0]);
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                >
                  {Object.entries(providers).map(([key, provider]) => (
                    <option key={key} value={key}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="modelSelect">
                  模型
                </label>
                {selectedProvider === "custom" ? (
                  <input
                    id="modelSelect"
                    type="text"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    placeholder="請輸入模型名稱（例如：gpt-4）"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                  />
                ) : (
                  <select
                    id="modelSelect"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                  >
                    {providers[selectedProvider]?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {selectedProvider === "custom" 
                    ? "請輸入與您的自訂端點相容的模型名稱"
                    : `${providers[selectedProvider]?.name || ''} 提供的模型`}
                </p>
              </div>

              {selectedProvider === "custom" && (
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="customBaseUrlInput">
                    自訂 Base URL
                  </label>
                  <input
                    id="customBaseUrlInput"
                    type="url"
                    value={customBaseUrl}
                    onChange={(event) => setCustomBaseUrl(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    請輸入您的自訂 API 端點 URL
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                 onClick={() => setSettingsOpen(false)}
                 className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl transition-all"
               >
                確認
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}