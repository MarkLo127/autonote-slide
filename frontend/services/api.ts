// API service for FastAPI backend integration
// Handles file upload, summarization, and keyword extraction

class ApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = this.getBaseUrl()
  }

  private getBaseUrl(): string {
    if (typeof window !== "undefined") {
      return localStorage.getItem("apiBaseUrl") || "http://localhost:8000"
    }
    return "http://localhost:8000"
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("API request failed:", error)
      throw error
    }
  }

  async uploadFile(file: File): Promise<{ fileId: string; content: string }> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("File upload failed")
    }

    return await response.json()
  }

  async getSummary(fileId: string, language = "auto"): Promise<{ summary: string[] }> {
    return this.makeRequest("/summarize", {
      method: "POST",
      body: JSON.stringify({ fileId, language }),
    })
  }

  async getKeywords(fileId: string, language = "auto"): Promise<{ keywords: string[] }> {
    return this.makeRequest("/keywords", {
      method: "POST",
      body: JSON.stringify({ fileId, language }),
    })
  }
}

export const apiService = new ApiService()
