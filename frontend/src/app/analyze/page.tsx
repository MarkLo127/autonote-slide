"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Upload,
  Progress,
  Modal,
  Select,
  Input,
  message,
  Alert,
  Tag,
  Collapse,
  Space,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  SettingOutlined,
  DownloadOutlined,
  FileTextOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import { useAnalysisState } from "@/hooks/useAnalysisState";
import { loadApiSettings, getApiKeyForProvider } from "@/lib/storage";
import { generateAnalysisPdf } from "@/lib/generateAnalysisPdf";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

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

const getDefaultBackendUrl = () => {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (process.env.NODE_ENV === "production") {
    return "https://autonote-backend.up.railway.app";
  }
  return "http://localhost:8000";
};

const rawBackendOrigin = getDefaultBackendUrl();
const sanitizeBase = (base: string) => base.replace(/\/$/, "");

const resolveBrowserBackendBase = (base: string) => {
  if (typeof window === "undefined") return base;
  try {
    const url = new URL(base);
    if (url.hostname === "backend" || url.hostname === "0.0.0.0") {
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

const normalizeOptionalUrl = (url: string) =>
  url ? url.trim().replace(/\/$/, "") : "";

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

const classificationMap: Record<string, string> = {
  normal: "一般內容",
  toc: "目錄頁",
  pure_image: "純圖片",
  blank: "空白/水印",
  cover: "封面",
};

export default function AnalyzePage() {
  const { setAnalysisResult: saveAnalysisResult } = useAnalysisState();
  const [backendBase, setBackendBase] = useState(INITIAL_BACKEND_BASE);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [filePreviewType, setFilePreviewType] = useState<FilePreviewKind>("none");
  const [filePreviewContent, setFilePreviewContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [providers, setProviders] = useState<Record<string, ModelProvider>>({});
  const [levelMapping, setLevelMapping] = useState<Record<string, Record<string, string>>>({});
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ value: number; message: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [analysisLevel] = useState("medium");
  const [isMobile, setIsMobile] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const aggregatedKeywords = useMemo(() => {
    if (!analysisResult) return [];
    return Array.from(
      new Set(
        analysisResult.page_summaries
          .map((page) => page.keywords.slice(0, 4))
          .flat()
          .filter((kw) => kw.trim().length > 0)
      )
    ).slice(0, 24);
  }, [analysisResult]);

  const selectedFileName = selectedFiles[0]?.name ?? "";

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
    [backendBase]
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

  useEffect(() => {
    if (!levelMapping[selectedProvider]) return;
    const modelToSet = levelMapping[selectedProvider][analysisLevel];
    if (modelToSet) {
      setSelectedModel(modelToSet);
    }
  }, [analysisLevel, selectedProvider, levelMapping]);

  // File preview effect
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!selectedFiles.length) {
      setFilePreviewUrl(null);
      setFilePreviewType("none");
      setFilePreviewContent("");
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
    setAnalysisProgress(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedFiles.length) {
      setError("請先選擇要上傳的檔案");
      return;
    }

    const settings = loadApiSettings();
    const currentApiKey = getApiKeyForProvider(settings, selectedProvider);

    if (!currentApiKey.trim()) {
      setError("請先在首頁設定 API Key");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress({ value: 5, message: "準備分析…" });

    try {
      const formData = new FormData();
      formData.append("file", selectedFiles[0]);
      formData.append("llm_api_key", currentApiKey);
      formData.append("llm_model", selectedModel);
      formData.append("llm_provider", selectedProvider);

      if (selectedProvider === "custom" && customBaseUrl.trim()) {
        formData.append("llm_base_url", normalizeOptionalUrl(customBaseUrl));
      }

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
              value: typeof event.progress === "number" ? Math.min(Math.max(event.progress, 0), 100) : 0,
              message: event.message ?? "",
            });
          } else if (event.type === "result" && event.data) {
            finalData = event.data;
            setAnalysisProgress({
              value: typeof event.progress === "number" ? Math.min(Math.max(event.progress, 0), 100) : 100,
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
          if (remaining) handleLine(remaining);
          break;
        }

        if (shouldStop && !buffer.length) break;
      }

      if (serverError) throw new Error(serverError);
      if (!finalData) throw new Error("未取得分析結果，請稍後再試");

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
      messageApi.success("分析結果已完成");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "分析時發生未知錯誤";
      setError(msg);
      setAnalysisResult(null);
      setAnalysisProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFiles, selectedModel, selectedProvider, customBaseUrl, analysisLevel, backendBase, toAbsoluteUrl, messageApi, saveAnalysisResult, selectedFileName]);

  const resetSelection = useCallback(() => {
    setSelectedFiles([]);
    setAnalysisResult(null);
    setError(null);
    setAnalysisProgress(null);
  }, []);

  const handleDownloadReport = useCallback(async () => {
    if (!analysisResult) {
      setError("請先完成檔案分析後再下載報告");
      return;
    }

    setIsDownloading(true);

    try {
      const languageLabel = analysisResult.language ? analysisResult.language.toUpperCase() : null;
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
        pdfBytes.byteOffset + pdfBytes.byteLength
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
      messageApi.success("PDF 報告下載成功");
    } catch (err) {
      console.error("生成 PDF 失敗", err);
      const msg = err instanceof Error ? err.message : "PDF 生成時發生未知錯誤";
      setError(msg);
    } finally {
      setIsDownloading(false);
    }
  }, [analysisResult, aggregatedKeywords, selectedFileName, toAbsoluteUrl, messageApi]);

  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    accept: ".pdf",
    showUploadList: false,
    beforeUpload: (file) => {
      handleFilesSelected([file]);
      return false;
    },
    onDrop: (e) => {
      if (e.dataTransfer.files) {
        handleFilesSelected(Array.from(e.dataTransfer.files));
      }
    },
  };

  const renderFilePreview = () => {
    if (!selectedFiles.length) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
          <Text type="secondary">上傳檔案後即可在此預覽原始內容</Text>
        </div>
      );
    }

    if (filePreviewType === "pdf" && filePreviewUrl) {
      return (
        <iframe
          title="檔案預覽"
          src={filePreviewUrl}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
        />
      );
    }

    if (filePreviewType === "image" && filePreviewUrl) {
      return (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
          <Image
            src={filePreviewUrl}
            alt="選擇的圖片預覽"
            fill
            style={{ objectFit: "contain" }}
            unoptimized
          />
        </div>
      );
    }

    if (filePreviewType === "text") {
      return (
        <pre style={{ whiteSpace: "pre-wrap", padding: 16, margin: 0, fontSize: 14, lineHeight: 1.6, overflow: "auto", height: "100%" }}>
          {filePreviewContent}
        </pre>
      );
    }

    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Text type="secondary">此檔案格式暫不支援內嵌預覽</Text>
      </div>
    );
  };

  const renderAnalysisResult = () => {
    if (!analysisResult) {
      return (
        <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text type="secondary">完成檔案分析後，全局摘要與逐頁重點將顯示於此處</Text>
        </div>
      );
    }

    const languageLabel = analysisResult.language ? analysisResult.language.toUpperCase() : "";

    const collapseItems = analysisResult.page_summaries
      .filter((page) => !page.skipped)
      .map((page) => ({
        key: page.page_number,
        label: (
          <Space>
            <Text strong>第 {page.page_number} 頁</Text>
            <Tag color="default">{classificationMap[page.classification] ?? page.classification}</Tag>
          </Space>
        ),
        children: (
          <div>
            <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
              {page.bullets.map((bullet, idx) => (
                <li key={idx} style={{ marginBottom: 8 }}>{bullet}</li>
              ))}
            </ul>
            {page.keywords.length > 0 && (
              <Space wrap>
                {page.keywords.map((kw) => (
                  <Tag key={kw} color="green">{kw}</Tag>
                ))}
              </Space>
            )}
          </div>
        ),
      }));

    return (
      <div>
        {/* Summary Header */}
        <Space style={{ marginBottom: 24 }}>
          {languageLabel && <Tag color="blue">語言：{languageLabel}</Tag>}
          <Tag color="green">共 {analysisResult.total_pages} 頁</Tag>
        </Space>

        {/* Global Summary */}
        <Card title="全局總結" style={{ marginBottom: 24 }}>
          {analysisResult.global_summary.bullets.length > 0 ? (
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {analysisResult.global_summary.bullets.map((item, index) => (
                <li key={index} style={{ marginBottom: 12 }}>{item}</li>
              ))}
            </ul>
          ) : (
            <Text type="secondary">尚未取得全局摘要</Text>
          )}
        </Card>

        {/* Expansions */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={8}>
            <Card title="關鍵結論" size="small" style={{ height: "100%" }}>
              <Text>{analysisResult.global_summary.expansions.key_conclusions || "暫無資料"}</Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card title="核心數據與依據" size="small" style={{ height: "100%" }}>
              <Text>{analysisResult.global_summary.expansions.core_data || "暫無資料"}</Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card title="風險與建議" size="small" style={{ height: "100%" }}>
              <Text>{analysisResult.global_summary.expansions.risks_and_actions || "暫無資料"}</Text>
            </Card>
          </Col>
        </Row>

        {/* Keywords and Wordcloud */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card title="整體關鍵字" size="small">
              {aggregatedKeywords.length > 0 ? (
                <Space wrap>
                  {aggregatedKeywords.map((kw) => (
                    <Tag key={kw} color="purple">{kw}</Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">暫無關鍵字可顯示</Text>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="文字雲" size="small">
              {analysisResult.wordcloud_image_url ? (
                <div style={{ position: "relative", aspectRatio: "4/3", width: "100%" }}>
                  <Image
                    src={analysisResult.wordcloud_image_url}
                    alt="關鍵字文字雲"
                    fill
                    style={{ objectFit: "contain" }}
                    unoptimized
                  />
                </div>
              ) : (
                <Text type="secondary">尚未取得文字雲</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Page Summaries */}
        <Card title="逐頁重點與關鍵字">
          <Collapse items={collapseItems} />
        </Card>
      </div>
    );
  };

  return (
    <div className="hero-gradient" style={{ minHeight: "100vh", padding: isMobile ? "12px" : "24px" }}>
      {contextHolder}

      {/* Alert Banner */}
      {isMobile && (
        <Alert
          description="建議使用電腦瀏覽器獲得最佳體驗"
          type="info"
          showIcon
          closable
          style={{ marginBottom: 12, fontSize: 12 }}
        />
      )}
      {!isMobile && (
        <Alert
          description="目前僅支援電腦端使用，請使用電腦瀏覽器獲得最佳體驗"
          type="warning"
          showIcon
          style={{ maxWidth: 1400, margin: "0 auto 24px" }}
        />
      )}

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Upload and Preview Section */}
        <Row gutter={[isMobile ? 12 : 24, isMobile ? 12 : 24]} style={{ marginBottom: isMobile ? 12 : 24 }}>
          {/* Upload Card */}
          <Col xs={24} xl={12}>
            <Card
              className="glass-card-strong hover-lift"
              style={{ borderRadius: isMobile ? 16 : 24, minHeight: isMobile ? "auto" : 500 }}
              styles={{ body: { padding: isMobile ? 16 : 32 } }}
              extra={
                <Tooltip title="模型設定">
                  <Button
                    type="text"
                    icon={<SettingOutlined />}
                    onClick={() => setSettingsOpen(true)}
                  />
                </Tooltip>
              }
            >
              <Dragger 
                {...uploadProps} 
                style={{ 
                  padding: isMobile ? 20 : 40, 
                  background: "transparent", 
                  border: "2px dashed #d1d5db" 
                }}
              >
                <p style={{ marginBottom: isMobile ? 8 : 16 }}>
                  <UploadOutlined style={{ fontSize: isMobile ? 32 : 48, color: "#6366f1" }} />
                </p>
                <Title level={isMobile ? 5 : 4}>上傳您的檔案</Title>
                <Paragraph type="secondary" style={{ fontSize: isMobile ? 13 : 14, marginBottom: isMobile ? 8 : 16 }}>
                  {isMobile ? "點擊上傳檔案" : "將檔案拖放到此處，或點擊任何地方瀏覽檔案"}
                </Paragraph>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  支援格式：PDF｜最大 50MB
                </Text>
              </Dragger>

              {selectedFiles.length > 0 && (
                <Card size="small" style={{ marginTop: isMobile ? 12 : 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>
                        <FileTextOutlined /> {selectedFileName.length > 20 && isMobile ? selectedFileName.slice(0, 20) + "..." : selectedFileName}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatBytes(selectedFiles[0].size)}
                      </Text>
                    </div>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={resetSelection} size={isMobile ? "small" : "middle"}>
                      {isMobile ? "" : "移除"}
                    </Button>
                  </div>
                </Card>
              )}

              {error && (
                <Alert message={error} type="error" showIcon style={{ marginTop: isMobile ? 12 : 16 }} />
              )}

              {analysisProgress && (
                <div style={{ marginTop: isMobile ? 12 : 16 }}>
                  <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>{analysisProgress.message}</Text>
                  <Progress percent={analysisProgress.value} status="active" strokeColor={{ from: '#6366f1', to: '#ec4899' }} size={isMobile ? "small" : "default"} />
                </div>
              )}

              <Button
                type="primary"
                size={isMobile ? "middle" : "large"}
                block
                onClick={handleAnalyze}
                loading={isAnalyzing}
                disabled={selectedFiles.length === 0}
                className="gradient-button"
                style={{ marginTop: isMobile ? 16 : 24, height: isMobile ? 40 : 48, borderRadius: 12 }}
              >
                {isAnalyzing ? "分析中…" : "開始分析"}
              </Button>
            </Card>
          </Col>

          {/* Preview Card - Hidden on mobile */}
          {!isMobile && (
            <Col xs={24} xl={12}>
              <Card
                title="檔案預覽"
                className="glass-card-strong hover-lift"
                style={{ borderRadius: 24, minHeight: 500 }}
                styles={{ body: { padding: 24, height: 420, overflow: "hidden" } }}
              >
                {renderFilePreview()}
              </Card>
            </Col>
          )}
        </Row>

        {/* Results Section */}
        <Card
          className="glass-card-strong hover-lift"
          style={{ borderRadius: isMobile ? 16 : 24 }}
          styles={{ body: { padding: isMobile ? 16 : 32 } }}
          title={
            <Title level={isMobile ? 5 : 4} className="gradient-text" style={{ margin: 0 }}>
              分析結果整理
            </Title>
          }
          extra={
            isMobile ? (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => void handleDownloadReport()}
                disabled={!analysisResult || isDownloading || isAnalyzing}
                loading={isDownloading}
                size="small"
                className="gradient-button"
              >
                下載
              </Button>
            ) : (
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>PDF 將包含摘要、關鍵字與文字雲</Text>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => void handleDownloadReport()}
                  disabled={!analysisResult || isDownloading || isAnalyzing}
                  loading={isDownloading}
                  className="gradient-button"
                >
                  下載 PDF 報告
                </Button>
              </Space>
            )
          }
        >
          {renderAnalysisResult()}
        </Card>
      </div>

      {/* Settings Modal */}
      <Modal
        title="模型選擇"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={() => setSettingsOpen(false)}
        okText="確認"
        cancelText="取消"
      >
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          選擇要使用的 AI 模型（API Key 請在首頁設定）
        </Paragraph>

        <div style={{ marginBottom: 16 }}>
          <Text strong>模型供應商</Text>
          <Select
            value={selectedProvider}
            onChange={(value) => {
              setSelectedProvider(value);
              const provider = providers[value];
              if (provider && provider.models.length > 0) {
                setSelectedModel(provider.models[0]);
              }
            }}
            style={{ width: "100%", marginTop: 8 }}
            options={Object.entries(providers).map(([key, provider]) => ({
              value: key,
              label: provider.name,
            }))}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong>模型</Text>
          {selectedProvider === "custom" ? (
            <Input
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="請輸入模型名稱（例如：gpt-4）"
              style={{ marginTop: 8 }}
            />
          ) : (
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: "100%", marginTop: 8 }}
              options={providers[selectedProvider]?.models.map((model) => ({
                value: model,
                label: model,
              })) ?? []}
            />
          )}
        </div>

        {selectedProvider === "custom" && (
          <div>
            <Text strong>自訂 Base URL</Text>
            <Input
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              style={{ marginTop: 8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}