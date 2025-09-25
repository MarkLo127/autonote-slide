"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { FileUpload } from "@/components/file-upload"
import { SettingsModal } from "@/components/settings-modal"

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [documentContent, setDocumentContent] = useState<string>("")
  const [summary, setSummary] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showWordCloud, setShowWordCloud] = useState(true)
  const [highlightedParagraph, setHighlightedParagraph] = useState<number | null>(null)

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file)
    setDocumentContent(`已上傳文件：${file.name}\n\n請手動觸發分析以查看摘要和關鍵詞。`)
    setSummary([])
    setKeywords([])
    setIsProcessing(false)

    // 移除原本的自動分析邏輯
    // setIsProcessing(true)
    // setTimeout(() => {
    //   setDocumentContent(...)
    //   setSummary(...)
    //   setKeywords(...)
    //   setIsProcessing(false)
    // }, 2000)
  }

  const handleSummaryClick = (index: number) => {
    setHighlightedParagraph(index)
    setTimeout(() => setHighlightedParagraph(null), 3000)
  }

  const handleKeywordHover = (keyword: string) => {
    // Simulate highlighting matching paragraphs
    const paragraphIndex = keywords.indexOf(keyword) % 3
    setHighlightedParagraph(paragraphIndex)
  }

  return (
    <div className="min-h-screen text-foreground">
      <Header onSettingsClick={() => setShowSettings(true)} />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
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

          <FileUpload onFileUpload={handleFileUpload} />

          {uploadedFile && (
            <div className="glass-panel rounded-xl p-6 max-w-md w-full text-center animate-fade-in-up">
              <h3 className="text-lg font-semibold text-primary mb-2">檔案已上傳</h3>
              <p className="text-muted-foreground">{uploadedFile.name}</p>
              <button onClick={() => setUploadedFile(null)} className="glass-button mt-4 px-4 py-2 rounded-lg text-sm">
                重新上傳
              </button>
            </div>
          )}
        </div>
      </main>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
