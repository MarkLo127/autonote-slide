// API client responsible for communicating with the FastAPI backend

export interface AnalyzeResponse {
  language: string
  paragraphs: Array<{
    index: number
    text: string
    start_char: number
    end_char: number
  }>
  global_summary: string
  paragraph_summaries: Array<{
    paragraph_index: number
    summary: string
  }>
  paragraph_keywords: Array<{
    paragraph_index: number
    keywords: string[]
  }>
  wordcloud_image_url: string
}

class ApiService {
  private readonly fallbackBackendUrl = "http://localhost:8000"
  private readonly fallbackModel = "gpt-4o-mini"

  private getBackendBaseUrl(): string {
    if (typeof window === "undefined") {
      return this.fallbackBackendUrl
    }
    const stored = localStorage.getItem("apiBaseUrl") || this.fallbackBackendUrl
    return stored.replace(/\/+$/, "") || this.fallbackBackendUrl
  }

  private getStored(key: string): string {
    if (typeof window === "undefined") {
      return ""
    }
    return localStorage.getItem(key) || ""
  }

  async analyzeFile(file: File): Promise<AnalyzeResponse> {
    const apiKey = this.getStored("apiKey")
    if (!apiKey) {
      throw new Error("請先在設定中填寫 API Key")
    }

    const backendBaseUrl = this.getBackendBaseUrl()
    const llmBaseUrl = this.getStored("llmBaseUrl")
    const llmModel = this.getStored("llmModel") || this.fallbackModel

    const formData = new FormData()
    formData.append("file", file)
    formData.append("llm_api_key", apiKey)
    formData.append("llm_model", llmModel)
    if (llmBaseUrl) {
      formData.append("llm_base_url", llmBaseUrl)
    }

    const response = await fetch(`${backendBaseUrl}/analyze`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `分析失敗，狀態碼：${response.status}`)
    }

    const data = (await response.json()) as AnalyzeResponse
    if (data.wordcloud_image_url?.startsWith("/")) {
      data.wordcloud_image_url = `${backendBaseUrl}${data.wordcloud_image_url}`
    }
    return data
  }
}

export const apiService = new ApiService()
