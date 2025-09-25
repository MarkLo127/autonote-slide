"use client"

import { useMemo, useState } from "react"
import { Header } from "@/components/header"
import { FileUpload } from "@/components/file-upload"
import { SettingsModal } from "@/components/settings-modal"
import { DocumentViewer } from "@/components/document-viewer"
import { SummaryPanel } from "@/components/summary-panel"
import { WordCloud } from "@/components/word-cloud"
import { apiService, type AnalyzeResponse } from "@/services/api"

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showWordCloud, setShowWordCloud] = useState(true)
  const [highlightedParagraph, setHighlightedParagraph] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (file: File) => {
    setUploadedFile(file)
    setAnalysisResult(null)
    setHighlightedParagraph(null)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!uploadedFile || isProcessing) return
    setIsProcessing(true)
    setHighlightedParagraph(null)
    setError(null)

    try {
      const result = await apiService.analyzeFile(uploadedFile)
      setAnalysisResult(result)
      setShowWordCloud(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "分析失敗，請稍後再試。")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSummaryClick = (paragraphIndex: number) => {
    setHighlightedParagraph(paragraphIndex)
    setTimeout(() => setHighlightedParagraph(null), 3000)
  }

  const handleKeywordHover = (paragraphIndex: number | null) => {
    setHighlightedParagraph(paragraphIndex)
  }

  const documentContent = useMemo(() => {
    if (analysisResult) {
      return analysisResult.paragraphs.map((p) => p.text).join("\n\n")
    }
    if (uploadedFile) {
      return `已上傳文件：${uploadedFile.name}\n\n請點擊下方「摘要生成」開始分析。`
    }
    return ""
  }, [analysisResult, uploadedFile])

  const keywordItems = useMemo(
    () =>
      analysisResult
        ? analysisResult.paragraph_keywords.flatMap((item) =>
            item.keywords.map((keyword) => ({ keyword, paragraphIndex: item.paragraph_index })),
          )
        : [],
    [analysisResult],
  )

  const canAnalyze = Boolean(uploadedFile)

  return (
    <div className="min-h-screen text-foreground">
      <Header onSettingsClick={() => setShowSettings(true)} />

      <main className="container mx-auto px-4 py-8 space-y-10">
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-8">
          <div className="text-center space-y-4 animate-fade-in-up">
            <h1 className="text-4xl md:text-6xl font-bold text-balance bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800 bg-clip-text text-transparent">
              AI 文件
              <br />
              摘要工具
            </h1>
            <p className="text-xl bg-gradient-to-r from-blue-500 via-emerald-500 to-orange-500 bg-clip-text text-transparent max-w-2xl text-pretty font-semibold">
              上傳您的文件，獲得 AI 驅動的智能摘要、關鍵詞提取和段落高亮功能
            </p>
          </div>

          <FileUpload onFileUpload={handleFileUpload} onAnalyze={handleAnalyze} isProcessing={isProcessing} canAnalyze={canAnalyze} />

          {uploadedFile && (
            <div className="glass-panel rounded-xl p-6 max-w-md w-full text-center animate-fade-in-up">
              <h3 className="text-lg font-semibold text-primary mb-2">檔案已上傳</h3>
              <p className="text-muted-foreground">{uploadedFile.name}</p>
              <button
                onClick={() => {
                  setUploadedFile(null)
                  setAnalysisResult(null)
                  setHighlightedParagraph(null)
                }}
                className="glass-button mt-4 px-4 py-2 rounded-lg text-sm"
              >
                重新上傳
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="glass-panel border border-red-500/40 bg-red-500/10 text-red-200 rounded-2xl p-4 max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {uploadedFile && (
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <DocumentViewer content={documentContent} highlightedParagraph={highlightedParagraph} isProcessing={isProcessing} />

            <div className="space-y-6">
              <SummaryPanel
                globalSummary={analysisResult?.global_summary || ""}
                paragraphSummaries={analysisResult?.paragraph_summaries || []}
                isProcessing={isProcessing}
                onSummaryClick={handleSummaryClick}
              />

              {showWordCloud && analysisResult && (
                <WordCloud
                  keywords={keywordItems}
                  wordcloudImageUrl={analysisResult?.wordcloud_image_url}
                  onKeywordHover={handleKeywordHover}
                  onToggle={() => setShowWordCloud(false)}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
