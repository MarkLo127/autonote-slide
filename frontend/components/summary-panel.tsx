"use client"

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface SummaryPanelProps {
  summary: string[]
  isProcessing: boolean
  onSummaryClick: (index: number) => void
}

export function SummaryPanel({ summary, isProcessing, onSummaryClick }: SummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-primary">AI 摘要</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="glass-button">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {isProcessing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            summary.map((item, index) => (
              <div
                key={index}
                onClick={() => onSummaryClick(index)}
                className="p-4 glass-button rounded-lg cursor-pointer hover:bg-primary/10 transition-all duration-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm font-medium">{index + 1}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{item}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
