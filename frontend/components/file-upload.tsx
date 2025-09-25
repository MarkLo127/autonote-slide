"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, FileText, File, Brain, Hash, GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FileUploadProps {
  onFileUpload: (file: File) => void
  onAnalyze: () => void
  isProcessing: boolean
  canAnalyze: boolean
}

export function FileUpload({ onFileUpload, onAnalyze, isProcessing, canAnalyze }: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true)
    } else if (e.type === "dragleave") {
      setIsDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileUpload(e.dataTransfer.files[0])
      }
    },
    [onFileUpload],
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0])
    }
  }

  const handleSummaryGeneration = () => {
    if (!canAnalyze || isProcessing) return
    onAnalyze()
  }

  const handleKeywordExtraction = () => {
    if (!canAnalyze || isProcessing) return
    onAnalyze()
  }

  const handleMindMapGeneration = () => {
    console.log("心智圖生成功能")
  }

  return (
    <div className="w-full max-w-2xl animate-fade-in-up space-y-6">
      <div
        className={`glass-panel rounded-2xl p-12 text-center transition-all duration-300 ${
          isDragActive ? "drag-active scale-105" : ""
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600/30 to-emerald-600/30 rounded-full flex items-center justify-center pulse-glow">
              <Upload className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              上傳您的文件
            </h3>
            <p className="bg-gradient-to-r from-blue-500 via-emerald-500 to-orange-500 bg-clip-text text-transparent font-semibold text-lg">
              拖拽文件到此處，或點擊瀏覽文件
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
            <div className="flex items-center space-x-1 text-blue-500">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </div>
            <div className="flex items-center space-x-1 text-emerald-500">
              <File className="w-4 h-4" />
              <span>DOCX</span>
            </div>
            <div className="flex items-center space-x-1 text-orange-500">
              <File className="w-4 h-4" />
              <span>PPTX</span>
            </div>
            <div className="flex items-center space-x-1 text-purple-500">
              <FileText className="w-4 h-4" />
              <span>TXT</span>
            </div>
            <div className="flex items-center space-x-1 text-cyan-500">
              <FileText className="w-4 h-4" />
              <span>MD</span>
            </div>
          </div>

          <div className="pt-4">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md"
              onChange={handleFileSelect}
            />
            <Button asChild className="glass-button bg-primary/20 hover:bg-primary/30 text-primary border-primary/30">
              <label htmlFor="file-upload" className="cursor-pointer">
                選擇文件
              </label>
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleSummaryGeneration}
            disabled={!canAnalyze || isProcessing}
            className="glass-button bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 border-blue-500/30 flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
            {isProcessing ? "處理中..." : "摘要生成"}
          </Button>

          <Button
            onClick={handleKeywordExtraction}
            disabled={!canAnalyze || isProcessing}
            className="glass-button bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 border-emerald-500/30 flex items-center gap-2"
          >
            <Hash className="w-5 h-5" />
            關鍵字截取
          </Button>

          <Button
            onClick={handleMindMapGeneration}
            disabled
            className="glass-button bg-orange-500/20 hover:bg-orange-500/30 text-orange-600 border-orange-500/30 flex items-center gap-2"
          >
            <GitBranch className="w-5 h-5" />
            心智圖生成
          </Button>
        </div>
      </div>
    </div>
  )
}
