"use client"

import { Loader2 } from "lucide-react"

interface DocumentViewerProps {
  content: string
  highlightedParagraph: number | null
  isProcessing: boolean
}

export function DocumentViewer({ content, highlightedParagraph, isProcessing }: DocumentViewerProps) {
  if (isProcessing) {
    return (
      <div className="glass-panel rounded-2xl p-8 h-[600px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">正在處理文件...</p>
        </div>
      </div>
    )
  }

  const paragraphs = content.split("\n\n").filter((p) => p.trim())

  return (
    <div className="glass-panel rounded-2xl p-8 h-[600px] overflow-y-auto">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-primary">文件內容</h2>
        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className={`text-foreground leading-relaxed transition-all duration-300 ${
                highlightedParagraph === index ? "bg-primary/20 p-4 rounded-lg border-l-4 border-primary" : ""
              }`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
