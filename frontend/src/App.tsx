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
type Level = 'light' | 'medium' | 'deep'

interface Config {
  provider: string
  apiKey: string
  model: string
  analysisLevel: Level
  enableVision: boolean
  customBaseUrl: string
}

interface PageSummary {
  page_number: number
  classification: string
  bullets: string[]
  keywords: string[]
  skipped: boolean
  skip_reason: string | null
}

interface AnalysisResult {
  language: string
  total_pages: number
  page_summaries: PageSummary[]
  global_summary: {
    bullets: string[]
    expansions: {
      key_conclusions: string
      core_data: string
      risks_and_actions: string
    }
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

const DEFAULT_LEVEL_MAPPING: Record<string, Record<Level, string>> = {
  openai:   { light: 'gpt-5-nano-2025-08-07',      medium: 'gpt-5-mini-2025-08-07',    deep: 'gpt-5.1-2025-11-13' },
  claude:   { light: 'claude-3-7-sonnet-20250219',  medium: 'claude-sonnet-4-20250514', deep: 'claude-sonnet-4-5-20250929' },
  gemini:   { light: 'gemini-2.5-flash-lite',       medium: 'gemini-2.5-flash',         deep: 'gemini-2.5-pro' },
  deepseek: { light: 'deepseek-chat',               medium: 'deepseek-chat',            deep: 'deepseek-reasoner' },
  qwen:     { light: 'qwen-flash',                  medium: 'qwen-plus',                deep: 'qwen3-max' },
  grok:     { light: 'grok-3-mini',                 medium: 'grok-4',                   deep: 'grok-4-1-fast-reasoning' },
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
  normal: 'Content',
  toc: 'Table of Contents',
  blank: 'Blank',
  cover: 'Cover',
  pure_image: 'Image Only',
  photo_page: 'Photo',
  reference: 'References',
}

const LEVEL_LABELS: Record<Level, string> = {
  light: 'Light',
  medium: 'Medium',
  deep: 'Deep',
}

const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  light: 'Fastest, uses smallest model',
  medium: 'Balanced speed & quality',
  deep: 'Most thorough, slowest',
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
  const [progressMsg, setProgressMsg] = useState('Starting analysis…')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [showBaseUrl, setShowBaseUrl] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set())
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>(DEFAULT_PROVIDERS)
  const [levelMapping, setLevelMapping] = useState<Record<string, Record<Level, string>>>(DEFAULT_LEVEL_MAPPING)
  const [config, setConfig] = useState<Config>({
    provider: 'openai',
    apiKey: '',
    model: DEFAULT_LEVEL_MAPPING.openai.medium,
    analysisLevel: 'medium',
    enableVision: false,
    customBaseUrl: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

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
        setLevelMapping(prev => ({ ...prev, ...(data.level_mapping ?? {}) }))
      })
      .catch(() => { /* backend not reachable, static defaults are used */ })
  }, [])

  // When provider or level changes, auto-select the mapped model (skip for custom)
  useEffect(() => {
    if (config.provider === 'custom') return
    const mapped = levelMapping[config.provider]?.[config.analysisLevel]
    if (mapped) setConfig(c => ({ ...c, model: mapped }))
  }, [config.provider, config.analysisLevel, levelMapping])

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
    setProgressMsg('Starting analysis…')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('llm_api_key', config.apiKey)
    formData.append('llm_model', config.model)
    formData.append('llm_provider', config.provider)
    formData.append('analysis_level', config.analysisLevel)
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
    setProgressMsg('Starting analysis…')
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-40 no-print">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-foreground text-[15px] tracking-tight">
              AutoNote<span className="text-[#2563EB]">&Slide</span>
            </span>
          </div>
          {(appState === 'done' || appState === 'analyzing') && (
            <div className="flex items-center gap-2">
              {appState === 'done' && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#334155] hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  aria-label="Print or export as PDF"
                >
                  <Printer className="w-4 h-4" />
                  Export
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#334155] hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                aria-label="Start a new analysis"
              >
                <RotateCcw className="w-4 h-4" />
                New Analysis
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
                Analyze your PDF instantly
              </h1>
              <p className="mt-2 text-muted-fg text-sm sm:text-base">
                Upload a document and get structured summaries, keyword extraction, and a visual word cloud.
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
                  ? 'border-accent bg-blue-50/60 scale-[1.01]'
                  : file
                    ? 'border-accent/40 bg-white'
                    : 'border-[#CBD5E1] hover:border-[#93C5FD] bg-white',
              ].join(' ')}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={handleFileInput}
                aria-label="PDF file input"
              />
              {file ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#2563EB]" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{file.name}</p>
                    <p className="text-xs text-muted-fg mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); setShowPreview(false); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-fg hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
                    aria-label="Remove selected file"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  tabIndex={0}
                  aria-label="Upload PDF file. Click or press Enter to browse."
                  onKeyDown={handleDropZoneKey}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 cursor-pointer bg-transparent border-0 p-0"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
                    <CloudUpload className="w-6 h-6 text-[#2563EB]" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {isDragging ? 'Drop your PDF here' : 'Drop PDF here or click to browse'}
                    </p>
                    <p className="text-xs text-muted-fg mt-0.5">PDF only · Max 50 MB</p>
                  </div>
                </button>
              )}
            </div>

            {/* PDF Preview */}
            {file && previewUrl && (
              <div className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-muted flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    PDF Preview
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPreview(v => !v)}
                    className="flex items-center gap-1 text-xs text-muted-fg hover:text-secondary transition-colors cursor-pointer"
                  >
                    {showPreview
                      ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</>
                      : <><ChevronDown className="w-3.5 h-3.5" /> Show</>}
                  </button>
                </div>
                {showPreview && (
                  <div className="p-3">
                    <iframe
                      src={previewUrl}
                      title="PDF preview"
                      className="w-full h-[70vh] rounded-lg border border-border"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Config panel */}
            <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-5">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                LLM Configuration
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Provider */}
                <div>
                  <label htmlFor="provider-select" className="block text-xs font-medium text-[#475569] mb-1.5">
                    Provider
                  </label>
                  <select
                    id="provider-select"
                    value={config.provider}
                    onChange={e => {
                      const p = e.target.value
                      setConfig(c => ({ ...c, provider: p, model: p === 'custom' ? '' : c.model }))
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
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
                  <label htmlFor={config.provider === 'custom' ? 'model-input' : 'model-select'} className="block text-xs font-medium text-[#475569] mb-1.5">
                    Model {config.provider === 'custom' && <span className="text-destructive" aria-hidden>*</span>}
                  </label>
                  {config.provider === 'custom' ? (
                    <input
                      id="model-input"
                      type="text"
                      value={config.model}
                      onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                      placeholder="e.g. gpt-4o, llama-3.1-70b"
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-accent"
                      aria-required="true"
                    />
                  ) : (
                    <select
                      id="model-select"
                      title="Select model"
                      value={config.model}
                      onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                    >
                      {providerModels.map(m => <option key={m} value={m}>{modelLabel(m)}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Analysis Level — hidden for custom provider (no level mapping available) */}
              {config.provider !== 'custom' && (
              <fieldset>
                <legend className="text-xs font-medium text-[#475569] mb-2">Analysis Level</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'medium', 'deep'] as Level[]).map(level => (
                    <label
                      key={level}
                      className={[
                        'relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150',
                        config.analysisLevel === level
                          ? 'border-[#2563EB] bg-blue-50/60 text-[#2563EB]'
                          : 'border-border hover:border-[#93C5FD] text-muted-fg',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="analysisLevel"
                        value={level}
                        checked={config.analysisLevel === level}
                        onChange={() => setConfig(c => ({ ...c, analysisLevel: level }))}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold">{LEVEL_LABELS[level]}</span>
                      <span className="text-[10px] text-center leading-tight opacity-70">{LEVEL_DESCRIPTIONS[level]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              )}

              {/* API Key */}
              <div>
                <label htmlFor="api-key-input" className="block text-xs font-medium text-[#475569] mb-1.5">
                  API Key <span className="text-[#DC2626]" aria-hidden>*</span>
                </label>
                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={config.apiKey}
                    onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))}
                    placeholder={`Your ${config.provider} API key`}
                    autoComplete="off"
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-border bg-white text-sm text-foreground placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-accent"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-[#94A3B8] hover:text-[#475569] transition-colors cursor-pointer"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
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
                    <div className="w-9 h-5 rounded-full bg-[#CBD5E1] peer-checked:bg-[#2563EB] transition-colors duration-150" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm text-[#334155]">
                    <span className="font-medium">Enable Vision Analysis</span>
                    <span className="text-[#94A3B8] ml-1 text-xs">(analyzes images in PDF, uses more tokens)</span>
                  </span>
                </label>

                {config.provider !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => setShowBaseUrl(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-fg hover:text-secondary transition-colors cursor-pointer"
                  >
                    {showBaseUrl ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Custom Base URL (optional)
                  </button>
                )}

                {(config.provider === 'custom' || showBaseUrl) && (
                  <div>
                    <label htmlFor="base-url-input" className="block text-xs font-medium text-[#475569] mb-1.5">
                      Base URL {config.provider === 'custom' && <span className="text-destructive" aria-hidden>*</span>}
                    </label>
                    <input
                      id="base-url-input"
                      type="url"
                      value={config.customBaseUrl}
                      onChange={e => setConfig(c => ({ ...c, customBaseUrl: e.target.value }))}
                      placeholder="https://api.example.com/v1"
                      required={config.provider === 'custom'}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-accent"
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
                  ? 'bg-accent hover:bg-accent-hover active:scale-[0.98] text-white cursor-pointer shadow-sm shadow-blue-200'
                  : 'bg-border text-[#94A3B8] cursor-not-allowed',
              ].join(' ')}
            >
              <Zap className="w-4 h-4" />
              Analyze PDF
            </button>
          </div>
        )}

        {/* ── State: analyzing ────────────────────────────────────────────── */}
        {appState === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 no-print">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
                <FileText className="w-10 h-10 text-accent" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Loader className="w-6 h-6 text-accent animate-spin" />
              </div>
            </div>

            <div className="w-full max-w-md space-y-4 text-center">
              <h2 className="text-lg font-semibold text-foreground">Analyzing your document…</h2>
              <p className="text-sm text-muted-fg min-h-6">{progressMsg}</p>

              <div className="space-y-2">
                <div
                  role="progressbar"
                  aria-label={`Analysis progress: ${progress}%`}
                  className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden"
                >
                  <div
                    className="progress-fill h-full bg-accent rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-[#2563EB] tabular-nums">{progress}%</p>
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
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-[#DC2626]" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Analysis failed</h2>
              <p className="text-sm text-[#DC2626] max-w-md">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.97] text-white text-sm font-medium rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {/* ── State: done ──────────────────────────────────────────────────── */}
        {appState === 'done' && result && (
          <div className="space-y-6">

            {/* Meta badges */}
            <div className="flex items-center gap-2 flex-wrap no-print">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Analysis complete
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-medium border border-border">
                {langLabel(result.language)}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F1F5F9] text-[#475569] text-xs font-medium border border-border">
                {result.total_pages} pages
              </span>
            </div>

            {/* Global summary */}
            <section aria-labelledby="global-summary-heading" className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F1F5F9]">
                <h2 id="global-summary-heading" className="font-semibold text-foreground text-base">Global Summary</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                <ul className="space-y-2">
                  {result.global_summary.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-[#334155]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Accordion sections */}
                <div className="space-y-2 pt-2">
                  {([
                    { key: 'key_conclusions', label: 'Key Conclusions', icon: <CheckCircle2 className="w-4 h-4" /> },
                    { key: 'core_data', label: 'Core Data', icon: <BarChart2 className="w-4 h-4" /> },
                    { key: 'risks_and_actions', label: 'Risks & Actions', icon: <AlertTriangle className="w-4 h-4" /> },
                  ] as const).map(({ key, label, icon }) => {
                    const content = result.global_summary.expansions[key]
                    const expanded = expandedSections.has(key)
                    return (
                      <div key={key} className="rounded-xl border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleSection(key)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                            <span className="text-accent">{icon}</span>
                            {label}
                          </span>
                          {expanded
                            ? <ChevronUp className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />}
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 pt-1 text-sm text-[#475569] leading-relaxed border-t border-[#F1F5F9] whitespace-pre-wrap">
                            {content}
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
              <section aria-label="Word cloud visualization" className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-muted">
                  <h2 className="font-semibold text-foreground text-base">Keyword Cloud</h2>
                </div>
                <div className="p-4">
                  <img
                    src={`${BACKEND}${result.wordcloud_image_url}`}
                    alt="Word cloud of document keywords"
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
              <h2 id="pages-heading" className="font-semibold text-foreground text-base mb-3">
                Page Summaries
                <span className="ml-2 text-xs font-normal text-muted-fg">
                  ({result.page_summaries.filter(p => !p.skipped).length} analyzed · {result.page_summaries.filter(p => p.skipped).length} skipped)
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
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-white opacity-50"
                      >
                        <span className="text-xs font-mono text-[#94A3B8] w-12 shrink-0">p.{page.page_number}</span>
                        <span className="text-xs italic text-[#94A3B8]">{classLabel} — {page.skip_reason ?? 'skipped'}</span>
                      </div>
                    )
                  }

                  return (
                    <div key={page.page_number} className="rounded-xl border border-border bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => togglePage(page.page_number)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-mono text-[#94A3B8] w-12 shrink-0">p.{page.page_number}</span>
                        <span className="flex-1 text-sm font-medium text-secondary truncate">
                          {page.bullets[0] ?? classLabel}
                        </span>
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-fg">
                          {classLabel}
                        </span>
                        {expanded
                          ? <ChevronUp className="w-4 h-4 text-[#94A3B8] shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[#94A3B8] shrink-0" />}
                      </button>

                      {expanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-muted space-y-3">
                          <ul className="space-y-1.5">
                            {page.bullets.map((b, i) => (
                              <li key={i} className="flex gap-2.5 text-sm text-[#475569]">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#93C5FD] shrink-0" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                          {page.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {page.keywords.map(kw => (
                                <span
                                  key={kw}
                                  className="px-2 py-0.5 rounded-md bg-[#EFF6FF] text-accent text-xs font-medium"
                                >
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
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-secondary hover:bg-muted active:scale-[0.97] transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Export / Print
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground hover:bg-primary active:scale-[0.97] text-white text-sm font-medium transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Analyze Another
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
