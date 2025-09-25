"use client"

import { useState } from "react"
import { X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const savedBaseUrl = typeof window !== "undefined" ? localStorage.getItem("baseUrl") || "" : ""
  const [apiKey, setApiKey] = useState(typeof window !== "undefined" ? localStorage.getItem("apiKey") || "" : "")
  const [llmModel, setLlmModel] = useState(
    typeof window !== "undefined" ? localStorage.getItem("llmModel") || "gpt-4o-mini" : "gpt-4o-mini",
  )
  const [useCustomBaseUrl, setUseCustomBaseUrl] = useState(savedBaseUrl !== "")
  const [baseUrl, setBaseUrl] = useState(savedBaseUrl)

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("apiKey", apiKey)
      localStorage.setItem("llmModel", llmModel)
      if (useCustomBaseUrl && baseUrl.trim()) {
        localStorage.setItem("baseUrl", baseUrl.trim())
      } else {
        localStorage.removeItem("baseUrl")
      }
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel rounded-2xl p-6 w-full max-w-md animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-primary">設定</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="glass-button">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-foreground">
              API Key
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder="請輸入您的 API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="glass-panel border-glass-border bg-transparent"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-model" className="text-foreground">
              LLM 模型
            </Label>
            <Input
              id="llm-model"
              placeholder="gpt-4o-mini"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="glass-panel border-glass-border bg-transparent"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="use-custom-base-url" className="text-foreground">
                使用自訂 Base URL
              </Label>
              <Switch
                id="use-custom-base-url"
                checked={useCustomBaseUrl}
                onCheckedChange={(checked) => setUseCustomBaseUrl(Boolean(checked))}
              />
            </div>
            {useCustomBaseUrl ? (
              <div className="space-y-2">
                <Label htmlFor="base-url" className="text-foreground text-sm">
                  Base URL
                </Label>
                <Input
                  id="base-url"
                  type="url"
                  placeholder="https://your-openai-proxy.example/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="glass-panel border-glass-border bg-transparent"
                />
                <p className="text-sm text-muted-foreground">請輸入符合 OpenAI API 格式的 Base URL。</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">未啟用時將使用官方 https://api.openai.com/v1。</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="glass-button">
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="glass-button bg-primary/20 hover:bg-primary/30 text-primary border-primary/30"
          >
            <Save className="w-4 h-4 mr-2" />
            儲存
          </Button>
        </div>
      </div>
    </div>
  )
}
