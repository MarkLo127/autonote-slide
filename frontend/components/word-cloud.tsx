"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WordCloudProps {
  keywords: string[]
  onKeywordHover: (keyword: string) => void
  onToggle: () => void
}

export function WordCloud({ keywords, onKeywordHover, onToggle }: WordCloudProps) {
  const getRandomSize = () => {
    const sizes = ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"]
    return sizes[Math.floor(Math.random() * sizes.length)]
  }

  const getRandomColor = () => {
    const colors = ["text-primary", "text-secondary", "text-foreground", "text-muted-foreground"]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-primary">關鍵詞</h3>
        <Button variant="ghost" size="sm" onClick={onToggle} className="glass-button">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {keywords.map((keyword, index) => (
          <span
            key={index}
            onMouseEnter={() => onKeywordHover(keyword)}
            className={`${getRandomSize()} ${getRandomColor()} font-medium cursor-pointer hover:text-primary transition-colors duration-200 px-2 py-1 rounded-md hover:bg-primary/10`}
          >
            {keyword}
          </span>
        ))}
      </div>
    </div>
  )
}
