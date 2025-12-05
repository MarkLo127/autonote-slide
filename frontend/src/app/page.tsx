"use client";

import { useState } from "react";
import Link from "next/link";
import { saveApiSettings, loadApiSettings } from "@/lib/storage";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [grokKey, setGrokKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [qwenKey, setQwenKey] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // 載入已儲存的設定
  useState(() => {
    const settings = loadApiSettings();
    setOpenaiKey(settings.openai_api_key);
    setGeminiKey(settings.gemini_api_key);
    setAnthropicKey(settings.anthropic_api_key);
    setGrokKey(settings.grok_api_key);
    setDeepseekKey(settings.deepseek_api_key);
    setQwenKey(settings.qwen_api_key);
    setCustomKey(settings.custom_api_key);
    setCustomUrl(settings.custom_base_url);
  });

  const handleSave = () => {
    saveApiSettings({
      openai_api_key: openaiKey,
      gemini_api_key: geminiKey,
      anthropic_api_key: anthropicKey,
      grok_api_key: grokKey,
      deepseek_api_key: deepseekKey,
      qwen_api_key: qwenKey,
      custom_api_key: customKey,
      custom_base_url: customUrl,
    });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 mb-6">
            <span className="text-sm font-medium text-indigo-600">
              ✨ AI 驅動的智慧文檔處理平台
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AutoNote & Slide
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-8">
            智能文件分析與摘要生成系統
          </p>
          
          <p className="text-base text-slate-500 mb-12 max-w-2xl mx-auto">
            自動將 PDF 文件轉換為結構化的摘要報告，支援多語言文檔分析。
            一鍵生成逐頁重點、關鍵字提取、文字雲視覺化。
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-slate-900">
            核心功能
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "📄", title: "PDF 文件解析", description: "支援多種格式 PDF 文件，自動提取文字內容與結構資訊" },
              { icon: "🤖", title: "AI 智能摘要", description: "採用先進 LLM 技術，自動生成高質量逐頁摘要與全局總結" },
              { icon: "🏷️", title: "重點整理", description: "提取關鍵結論、核心數據、風險與行動建議" },
              { icon: "📊", title: "關鍵字提取", description: "自動識別並提取文檔中的重要關鍵詞" },
              { icon: "☁️", title: "文字雲視覺化", description: "生成美觀的文字雲，直觀呈現文檔重點詞彙" },
              { icon: "📑", title: "PDF 報告匯出", description: "一鍵匯出專業格式的分析報告，方便後續使用與分享" },
            ].map((feature, index) => (
              <div
                key={index}
                className="group rounded-2xl bg-white p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-slate-100"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2 text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Settings Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl glass-card-strong p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-slate-900">
              API 設定
            </h2>
            <p className="text-slate-600 mb-6">
              請設定您的 LLM API Key，以便開始分析文件
            </p>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200 mb-6">
              {[
                { id: "openai", label: "OpenAI" },
                { id: "gemini", label: "Gemini" },
                { id: "anthropic", label: "Claude" },
                { id: "grok", label: "Grok" },
                { id: "deepseek", label: "DeepSeek" },
                { id: "qwen", label: "Qwen" },
                { id: "custom", label: "自訂" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
              {activeTab === "openai" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    在 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">OpenAI Platform</a> 取得您的 API Key
                  </p>
                </div>
              )}

              {activeTab === "gemini" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    在 <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Google AI Studio</a> 取得您的 API Key
                  </p>
                </div>
              )}

              {activeTab === "anthropic" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Anthropic API Key (Claude)
                  </label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    在 <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Anthropic Console</a> 取得您的 API Key
                  </p>
                </div>
              )}

              {activeTab === "grok" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Grok API Key (xAI)
                  </label>
                  <input
                    type="password"
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    placeholder="xai-..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    在 <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">xAI Console</a> 取得您的 API Key
                  </p>
                </div>
              )}

              {activeTab === "deepseek" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    DeepSeek API Key
                  </label>
                  <input
                    type="password"
                    value={deepseekKey}
                    onChange={(e) => setDeepseekKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    在 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">DeepSeek Platform</a> 取得您的 API Key
                  </p>
                </div>
              )}

              {activeTab === "qwen" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Qwen API Key (通義千問)
                  </label>
                  <input
                    type="password"
                    value={qwenKey}
                    onChange={(e) => setQwenKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    在 <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">阿里雲百煉控制台</a> 取得您的 API Key
                  </p>
                </div>
              )}

              {activeTab === "custom" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      API Base URL
                    </label>
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="您的 API Key"
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <p className="text-sm text-slate-500">
                    適用於自訂的 OpenAI 相容端點
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleSave}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
              >
                儲存設定
              </button>
              {showSuccess && (
                <span className="text-sm text-emerald-600 font-medium animate-fade-in">
                  ✓ 設定已儲存
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-12 py-4 text-lg font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            開始分析
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}