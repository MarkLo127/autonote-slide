import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CloudUpload, FileText, X, Eye, EyeOff, ChevronDown, ChevronUp,
  RotateCcw, Printer, Loader, AlertCircle, CheckCircle2, Zap,
  BookOpen, BarChart2, AlertTriangle,
} from 'lucide-react'
import './App.css'

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? ''

// ── Types ────────────────────────────────────────────────────────────────────

type AppState = 'idle' | 'analyzing' | 'done' | 'error'

interface Config {
  provider: string
  apiKey: string
  model: string
  enableVision: boolean
  customBaseUrl: string
}

interface PageSummary {
  page_number: number
  classification: string
  summary: string
  findings: string[]
  data: string[]
  actions: string[]
  keywords: string[]
  skipped: boolean
  skip_reason: string | null
}

interface AnalysisResult {
  language: string
  total_pages: number
  page_summaries: PageSummary[]
  global_summary: {
    overview: string
    key_conclusions: string[]
    core_data: string[]
    risks_and_actions: string[]
  }
  wordcloud_image_url: string | null
}

interface ProviderInfo {
  name?: string
  models: string[]
  base_url: string
  api_key_env: string
}

// ── Static provider / model data (mirrors backend/app/models/schemas.py) ─────

const DEFAULT_PROVIDERS: Record<string, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    api_key_env: 'OPENAI_API_KEY',
    models: ['gpt-5.1-2025-11-13', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07'],
  },
  claude: {
    name: 'Claude (Anthropic)',
    base_url: 'https://api.anthropic.com/v1',
    api_key_env: 'ANTHROPIC_API_KEY',
    models: ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219'],
  },
  gemini: {
    name: 'Gemini (Google)',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    api_key_env: 'GEMINI_API_KEY',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  deepseek: {
    name: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    api_key_env: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  qwen: {
    name: 'Qwen (Alibaba)',
    base_url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    api_key_env: 'DASHSCOPE_API_KEY',
    models: ['qwen3-max', 'qwen-plus', 'qwen-flash'],
  },
  grok: {
    name: 'Grok (X.AI)',
    base_url: 'https://api.x.ai/v1',
    api_key_env: 'XAI_API_KEY',
    models: ['grok-4-1-fast-reasoning', 'grok-4', 'grok-3-mini'],
  },
  custom: {
    name: '自訂 (Custom)',
    base_url: '',
    api_key_env: '',
    models: [],
  },
}

// ── Model display names ───────────────────────────────────────────────────────

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // OpenAI
  'gpt-5.1-2025-11-13':    'GPT-5.1',
  'gpt-5-mini-2025-08-07': 'GPT-5 Mini',
  'gpt-5-nano-2025-08-07': 'GPT-5 Nano',
  // Claude
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'claude-sonnet-4-20250514':   'Claude Sonnet 4',
  'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
  // Gemini
  'gemini-2.5-pro':        'Gemini 2.5 Pro',
  'gemini-2.5-flash':      'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  // DeepSeek
  'deepseek-chat':     'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  // Qwen
  'qwen3-max':  'Qwen3 Max',
  'qwen-plus':  'Qwen Plus',
  'qwen-flash': 'Qwen Flash',
  // Grok
  'grok-4-1-fast-reasoning': 'Grok 4.1 Fast',
  'grok-4':     'Grok 4',
  'grok-3-mini': 'Grok 3 Mini',
}

const modelLabel = (id: string) => MODEL_DISPLAY_NAMES[id] ?? id

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLASSIFICATION_LABELS: Record<string, string> = {
  normal: '內容',
  toc: '目錄',
  blank: '空白頁',
  cover: '封面',
  pure_image: '純圖片',
  photo_page: '照片頁',
  reference: '參考資料',
}

function langLabel(lang: string) {
  if (lang === 'zh') return '繁中 / 简中'
  if (lang === 'en') return 'English'
  return lang.toUpperCase()
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('開始分析…')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [showBaseUrl, setShowBaseUrl] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set())
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>(DEFAULT_PROVIDERS)
  const [config, setConfig] = useState<Config>(() => {
    try {
      const saved = localStorage.getItem('autonote_config')
      if (saved) {
        const p = JSON.parse(saved) as Partial<Config>
        return {
          provider:      p.provider      ?? 'openai',
          apiKey:        p.apiKey        ?? '',
          model:         p.model         ?? 'gpt-5-mini-2025-08-07',
          enableVision:  p.enableVision  ?? false,
          customBaseUrl: p.customBaseUrl ?? '',
        }
      }
    } catch { /* ignore */ }
    return { provider: 'openai', apiKey: '', model: 'gpt-5-mini-2025-08-07', enableVision: false, customBaseUrl: '' }
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Persist config (apiKey, customBaseUrl, provider, model) to localStorage
  useEffect(() => {
    try { localStorage.setItem('autonote_config', JSON.stringify(config)) } catch { /* ignore */ }
  }, [config])

  // Revoke blob URL when it changes or component unmounts
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  // Fetch providers from backend and merge with defaults (API may have newer models)
  useEffect(() => {
    fetch(`${BACKEND}/analyze/providers`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        setProviders(prev => ({ ...prev, ...(data.providers ?? {}) }))
      })
      .catch(() => { /* backend not reachable, static defaults are used */ })
  }, [])

  // When provider changes, auto-select the first available model
  useEffect(() => {
    if (config.provider === 'custom') return
    const models = providers[config.provider]?.models ?? []
    if (models.length > 0 && !models.includes(config.model)) {
      setConfig(c => ({ ...c, model: models[0] }))
    }
  }, [config.provider, providers])

  const providerModels = providers[config.provider]?.models ?? []

  // ── File handling ─────────────────────────────────────────────────────────

  const acceptFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setShowPreview(true)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) acceptFile(f)
  }

  const handleDropZoneKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!file || !config.apiKey) return
    setAppState('analyzing')
    setProgress(0)
    setProgressMsg('開始分析…')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('llm_api_key', config.apiKey)
    formData.append('llm_model', config.model)
    formData.append('llm_provider', config.provider)
    formData.append('enable_vision', String(config.enableVision))
    if (config.customBaseUrl) formData.append('llm_base_url', config.customBaseUrl)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const response = await fetch(`${BACKEND}/analyze`, {
        method: 'POST',
        body: formData,
        signal: ctrl.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'progress') {
              setProgress(msg.progress)
              setProgressMsg(msg.message)
            } else if (msg.type === 'result') {
              setResult(msg.data)
              setProgress(100)
              setAppState('done')
            } else if (msg.type === 'error') {
              throw new Error(msg.message)
            }
          } catch (parseErr) {
            // skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setAppState('error')
    }
  }

  const handleReset = () => {
    abortRef.current?.abort()
    setAppState('idle')
    setFile(null)
    setPreviewUrl(null)
    setShowPreview(false)
    setProgress(0)
    setProgressMsg('開始分析…')
    setResult(null)
    setError(null)
    setExpandedSections(new Set())
    setExpandedPages(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const togglePage = (num: number) => {
    setExpandedPages(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  const handlePrint = useCallback(() => {
    if (result) {
      setExpandedPages(new Set(result.page_summaries.filter(p => !p.skipped).map(p => p.page_number)))
      setExpandedSections(new Set(['key_conclusions', 'core_data', 'risks_and_actions']))
    }
    const originalTitle = document.title
    if (file) document.title = file.name.replace(/\.pdf$/i, '')
    setTimeout(() => {
      window.print()
      setTimeout(() => { document.title = originalTitle }, 1000)
    }, 150)
  }, [result, file])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-40 no-print">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center logo-icon">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-foreground text-[15px] tracking-tight">
              AutoNote<span className="text-accent">&Slide</span>
            </span>
          </div>
          {(appState === 'done' || appState === 'analyzing') && (
            <div className="flex items-center gap-2">
              {appState === 'done' && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  aria-label="列印或匯出為 PDF"
                >
                  <Printer className="w-4 h-4" />
                  匯出
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-secondary hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                aria-label="開始新分析"
              >
                <RotateCcw className="w-4 h-4" />
                新分析
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* ── State: idle ─────────────────────────────────────────────────── */}
        {appState === 'idle' && (
          <div className="space-y-6">
            <div className="text-center pt-2 pb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                即時分析您的 PDF
              </h1>
              <p className="mt-2 text-muted-fg text-sm sm:text-base">
                上傳文件，獲取結構化摘要、關鍵字提取與視覺化文字雲。
              </p>
            </div>

            {/* Upload zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={[
                'relative rounded-2xl border-2 border-dashed transition-all duration-150',
                'flex flex-col items-center justify-center gap-3 py-12 px-6 text-center',
                isDragging
                  ? 'border-accent bg-accent/10 scale-[1.01]'
                  : file
                    ? 'border-accent/40 bg-surface'
                    : 'border-border hover:border-accent/40 bg-surface',
              ].join(' ')}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={handleFileInput}
                aria-label="PDF 檔案輸入"
              />
              {file ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{file.name}</p>
                    <p className="text-xs text-muted-fg mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); setShowPreview(false); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-fg hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    aria-label="移除已選擇的檔案"
                  >
                    <X className="w-3.5 h-3.5" /> 移除
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  tabIndex={0}
                  aria-label="上傳 PDF 檔案。點擊或按 Enter 鍵瀏覽。"
                  onKeyDown={handleDropZoneKey}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 cursor-pointer bg-transparent border-0 p-0"
                >
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <CloudUpload className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {isDragging ? '放開以上傳 PDF' : '拖曳 PDF 至此或點擊瀏覽'}
                    </p>
                    <p className="text-xs text-muted-fg mt-0.5">僅支援 PDF · 最大 50 MB</p>
                  </div>
                </button>
              )}
            </div>

            {/* PDF Preview */}
            {file && previewUrl && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    PDF 預覽
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPreview(v => !v)}
                    className="flex items-center gap-1 text-xs text-muted-fg hover:text-secondary transition-colors cursor-pointer"
                  >
                    {showPreview
                      ? <><ChevronUp className="w-3.5 h-3.5" /> 隱藏</>
                      : <><ChevronDown className="w-3.5 h-3.5" /> 顯示</>}
                  </button>
                </div>
                {showPreview && (
                  <div className="p-3">
                    <iframe
                      src={previewUrl}
                      title="PDF 預覽"
                      className="w-full h-[70vh] rounded-lg border border-border"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Config panel */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-display">
                LLM 設定
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Provider */}
                <div>
                  <label htmlFor="provider-select" className="block text-xs font-medium text-secondary mb-1.5">
                    服務商
                  </label>
                  <select
                    id="provider-select"
                    value={config.provider}
                    onChange={e => {
                      const p = e.target.value
                      setConfig(c => ({ ...c, provider: p, model: p === 'custom' ? '' : c.model }))
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  >
                    {Object.keys(providers).length > 0
                      ? Object.keys(providers).map(p => (
                          <option key={p} value={p}>
                            {providers[p].name ?? (p.charAt(0).toUpperCase() + p.slice(1))}
                          </option>
                        ))
                      : <option value="openai">OpenAI</option>
                    }
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label htmlFor={config.provider === 'custom' ? 'model-input' : 'model-select'} className="block text-xs font-medium text-secondary mb-1.5">
                    模型 {config.provider === 'custom' && <span className="text-destructive" aria-hidden>*</span>}
                  </label>
                  {config.provider === 'custom' ? (
                    <input
                      id="model-input"
                      type="text"
                      value={config.model}
                      onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                      placeholder="e.g. gpt-4o, llama-3.1-70b"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-accent"
                      aria-required="true"
                    />
                  ) : (
                    <select
                      id="model-select"
                      title="選擇模型"
                      value={config.model}
                      onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                    >
                      {providerModels.map(m => <option key={m} value={m}>{modelLabel(m)}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label htmlFor="api-key-input" className="block text-xs font-medium text-secondary mb-1.5">
                  API 金鑰 <span className="text-destructive" aria-hidden>*</span>
                </label>
                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
                    placeholder={`您的 ${config.provider} API 金鑰`}
                    autoComplete="off"
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-accent"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-[#94A3B8] hover:text-secondary transition-colors cursor-pointer"
                    aria-label={showKey ? '隱藏 API 金鑰' : '顯示 API 金鑰'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Vision + custom URL */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.enableVision}
                      onChange={e => setConfig(c => ({ ...c, enableVision: e.target.checked }))}
                      className="sr-only peer"
                      id="vision-toggle"
                    />
                    <div className="w-9 h-5 rounded-full bg-[#CBD5E1] peer-checked:bg-accent transition-colors duration-150" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm text-secondary">
                    <span className="font-medium">啟用視覺分析</span>
                    <span className="text-[#94A3B8] ml-1 text-xs">（分析 PDF 中的圖片，消耗較多 token）</span>
                  </span>
                </label>

                {config.provider !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => setShowBaseUrl(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-secondary transition-colors cursor-pointer"
                  >
                    {showBaseUrl ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    自訂 Base URL（選填）
                  </button>
                )}

                {(config.provider === 'custom' || showBaseUrl) && (
                  <div>
                    <label htmlFor="base-url-input" className="block text-xs font-medium text-secondary mb-1.5">
                      Base URL {config.provider === 'custom' && <span className="text-destructive" aria-hidden>*</span>}
                    </label>
                    <input
                      id="base-url-input"
                      type="url"
                      value={config.customBaseUrl}
                      onChange={e => setConfig(c => ({ ...c, customBaseUrl: e.target.value }))}
                      placeholder="https://api.example.com/v1"
                      required={config.provider === 'custom'}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={!file || !config.apiKey}
              onClick={handleSubmit}
              className={[
                'w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150',
                file && config.apiKey
                  ? 'bg-accent hover:bg-accent-hover active:scale-[0.98] text-white cursor-pointer glow-accent'
                  : 'bg-border text-[#94A3B8] cursor-not-allowed',
              ].join(' ')}
            >
              <Zap className="w-4 h-4" />
              分析 PDF
            </button>
          </div>
        )}

        {/* ── State: analyzing ────────────────────────────────────────────── */}
        {appState === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 no-print">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
                <FileText className="w-10 h-10 text-accent" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Loader className="w-6 h-6 text-accent animate-spin" />
              </div>
            </div>

            <div className="w-full max-w-md space-y-4 text-center">
              <h2 className="text-lg font-semibold text-foreground font-display">正在分析您的文件…</h2>
              <p className="text-sm text-muted-fg min-h-6">{progressMsg}</p>

              <div className="space-y-2">
                <div
                  role="progressbar"
                  aria-label={`分析進度：${progress}%`}
                  className="h-2 rounded-full bg-muted overflow-hidden"
                >
                  <div
                    className="progress-fill h-full bg-accent rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-accent tabular-nums font-mono-ui">{progress}%</p>
              </div>
            </div>
          </div>
        )}

        {/* ── State: error ─────────────────────────────────────────────────── */}
        {appState === 'error' && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center min-h-[60vh] gap-6 no-print"
          >
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground font-display">分析失敗</h2>
              <p className="text-sm text-destructive max-w-md">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              重試
            </button>
          </div>
        )}

        {/* ── State: done ──────────────────────────────────────────────────── */}
        {appState === 'done' && result && (
          <div className="space-y-6">

            {/* Meta badges */}
            <div className="flex items-center gap-2 flex-wrap no-print">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium border border-success/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                分析完成
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-fg text-xs font-medium border border-border">
                {langLabel(result.language)}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-fg text-xs font-medium border border-border">
                共 {result.total_pages} 頁
              </span>
            </div>

            {/* Global summary */}
            <section aria-labelledby="global-summary-heading" className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 id="global-summary-heading" className="font-semibold text-foreground text-base font-display">全局摘要</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-secondary leading-relaxed">{result.global_summary.overview}</p>

                {/* Accordion sections */}
                <div className="space-y-2 pt-1">
                  {([
                    { key: 'key_conclusions' as const, label: '關鍵結論', icon: <CheckCircle2 className="w-4 h-4" /> },
                    { key: 'core_data' as const, label: '核心數據', icon: <BarChart2 className="w-4 h-4" /> },
                    { key: 'risks_and_actions' as const, label: '行動建議', icon: <AlertTriangle className="w-4 h-4" /> },
                  ]).map(({ key, label, icon }) => {
                    const items: string[] = result.global_summary[key]
                    const expanded = expandedSections.has(key)
                    return (
                      <div key={key} className="rounded-xl border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection(key)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-secondary">
                            <span className="text-accent">{icon}</span>
                            {label}
                            {items.length > 0 && (
                              <span className="text-xs font-normal text-muted-fg">({items.length})</span>
                            )}
                          </span>
                          {expanded
                            ? <ChevronUp className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />}
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-border">
                            {items.length === 0 ? (
                              <p className="text-sm text-muted-fg italic">無相關內容</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {items.map((item, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-secondary">
                                    <span className="text-accent mt-0.5 flex-shrink-0">›</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Word cloud */}
            {result.wordcloud_image_url && (
              <section aria-label="關鍵字雲視覺化" className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground text-base font-display">關鍵字雲</h2>
                </div>
                <div className="p-4">
                  <img
                    src={`${BACKEND}${result.wordcloud_image_url}`}
                    alt="文件關鍵字雲圖"
                    className="w-full rounded-lg"
                    loading="lazy"
                    width={1200}
                    height={600}
                  />
                </div>
              </section>
            )}

            {/* Page summaries */}
            <section aria-labelledby="pages-heading">
              <h2 id="pages-heading" className="font-semibold text-foreground text-base mb-3 font-display">
                逐頁摘要
                <span className="ml-2 text-xs font-normal text-muted-fg">
                  （{result.page_summaries.filter(p => !p.skipped).length} 頁已分析 · {result.page_summaries.filter(p => p.skipped).length} 頁已略過）
                </span>
              </h2>

              <div className="space-y-2">
                {result.page_summaries.map(page => {
                  const expanded = expandedPages.has(page.page_number)
                  const classLabel = CLASSIFICATION_LABELS[page.classification] ?? page.classification

                  if (page.skipped) {
                    return (
                      <div
                        key={page.page_number}
                        className="flex items-center gap-3 px-4 py-3 glass-card rounded-xl opacity-50"
                      >
                        <span className="text-xs font-mono-ui text-[#94A3B8] w-12 shrink-0">p.{page.page_number}</span>
                        <span className="text-xs italic text-[#94A3B8]">{classLabel} — {page.skip_reason ?? 'skipped'}</span>
                      </div>
                    )
                  }

                  return (
                    <div key={page.page_number} className="glass-card rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => togglePage(page.page_number)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-mono-ui text-[#94A3B8] w-12 shrink-0">p.{page.page_number}</span>
                        <span className="flex-1 text-sm font-medium text-secondary truncate">
                          {page.summary || classLabel}
                        </span>
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-fg">
                          {classLabel}
                        </span>
                        {expanded
                          ? <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />}
                      </button>

                      {expanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
                          {page.findings.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-fg uppercase tracking-wide mb-1.5">關鍵發現</p>
                              <ul className="space-y-1">
                                {page.findings.map((f, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-secondary">
                                    <span className="text-accent shrink-0 mt-0.5">›</span>
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {page.data.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-fg uppercase tracking-wide mb-1.5">核心數據</p>
                              <ul className="space-y-1">
                                {page.data.map((d, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-secondary font-mono">
                                    <span className="text-[#A78BFA] shrink-0 mt-0.5">›</span>
                                    <span>{d}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {page.actions.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-fg uppercase tracking-wide mb-1.5">建議事項</p>
                              <ul className="space-y-1">
                                {page.actions.map((a, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-secondary">
                                    <span className="text-[#FBBF24] shrink-0 mt-0.5">›</span>
                                    <span>{a}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {page.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {page.keywords.map(kw => (
                                <span key={kw} className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium font-mono-ui">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Bottom action bar */}
            <div className="flex justify-center gap-3 pt-4 pb-8 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-secondary hover:bg-muted active:scale-[0.97] transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                匯出 / 列印
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground hover:bg-primary active:scale-[0.97] text-white text-sm font-medium transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                再分析一份
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
