"use client";

import React from "react";
import { analyzeDoc, type AnalyzeResponse } from "@/lib/api";

export default function Analyzer() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

  // 模式：摘要 / 關鍵字 / 心智圖
  const [mode, setMode] = React.useState<"summary" | "keywords" | "mindmap">("summary");
  const title = React.useMemo(
    () => (mode === "summary" ? "摘要整理" : mode === "keywords" ? "關鍵字擷取" : "心智圖生成"),
    [mode]
  );
  const cta = React.useMemo(
    () => (mode === "summary" ? "開始摘要整理" : mode === "keywords" ? "開始關鍵字擷取" : "開始生成心智圖"),
    [mode]
  );

  // 設定
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");

  // 檔案
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  // 狀態
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AnalyzeResponse | null>(null);

  // localStorage：載入／儲存
  React.useEffect(() => {
    const saved = localStorage.getItem("autonote@settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setApiKey(s.apiKey || "");
        setBaseUrl(s.baseUrl || "");
      } catch {}
    }
  }, []);
  const onSave = () => localStorage.setItem("autonote@settings", JSON.stringify({ apiKey, baseUrl }));
  const onReset = () => { setApiKey(""); setBaseUrl(""); localStorage.removeItem("autonote@settings"); };

  // 拖放
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) setFile(f);
  };

  // 送出
  async function onSubmit() {
    setErr(null); setData(null);
    if (!file) return setErr("請先選擇檔案");
    if (!apiKey) return setErr("請輸入 apikey");

    try {
      setLoading(true);
      const resp = await analyzeDoc({ file, llmApiKey: apiKey, llmBaseUrl: baseUrl || undefined });
      setData(resp);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }

  // 對齊資料（展示用）
  const summaryMap = React.useMemo(() => {
    const m = new Map<number, string>();
    data?.paragraph_summaries?.forEach((s) => m.set(s.paragraph_index, s.summary));
    return m;
  }, [data]);
  const kwMap = React.useMemo(() => {
    const m = new Map<number, string[]>();
    data?.paragraph_keywords?.forEach((k) => m.set(k.paragraph_index, k.keywords));
    return m;
  }, [data]);

  return (
    <div className="min-h-screen w-full bg-[#0f1115] text-gray-100 flex">
      {/* 左側欄 */}
      <aside className="w-[280px] shrink-0 bg-[#141821] border-r border-[#1e2430] p-5 flex flex-col gap-4">
        <div className="text-sm text-gray-400">📜 功能選單</div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-300">選擇功能</label>
          <select
            className="bg-[#0f131b] border border-[#2a3242] rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="summary">摘要整理</option>
            <option value="keywords">關鍵字擷取</option>
            <option value="mindmap">心智圖生成</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-300">apikey</label>
          <input
            type="password"
            placeholder="輸入 apikey"
            className="bg-[#0f131b] border border-[#2a3242] rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-300">baseurl</label>
          <input
            type="text"
            placeholder="輸入 baseurl(可選)"
            className="bg-[#0f131b] border border-[#2a3242] rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <button className="w-full bg-indigo-600 hover:bg-indigo-500 transition rounded py-2 font-medium" onClick={onSave}>儲存</button>
          <button className="w-full bg-transparent border border-[#2a3242] hover:bg-[#1a2130] transition rounded py-2" onClick={onReset}>重置</button>
        </div>
      </aside>

      {/* 主內容 */}
      <main className="flex-1 p-10">
        <div className="flex items-center gap-3 mb-10 select-none">
          <div className="text-3xl">📄</div>
          <h1 className="text-3xl font-extrabold tracking-wide">Autonote&Slide</h1>
        </div>

        <div className="mb-6">
          <div className="h-[3px] w-full bg-gradient-to-r from-indigo-400 via-pink-400 to-purple-500 rounded-full opacity-60" />
          <div className="text-center text-xl mt-6 font-semibold text-gray-200">{title}</div>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* 上傳區 */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`rounded-xl border ${dragOver ? "border-indigo-500 bg-[#121725]" : "border-[#2a3242] bg-[#151a24]"} p-6 flex flex-col gap-4`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-300">Drag and drop files here</div>
                <div className="text-xs text-gray-500">Limit 200MB per file • PDF, DOCX, DOC, PPTX, PPT, MD, TXT</div>
              </div>
              <button
                className="px-3 py-1.5 rounded bg-[#0f131b] border border-[#2a3242] hover:bg-[#1a2130] text-sm"
                onClick={() => inputRef.current?.click()}
              >
                Browse files
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.md,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            {file && <div className="text-xs text-gray-400">已選擇：{file.name}</div>}
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={onSubmit}
              disabled={loading}
              className="min-w-[320px] px-4 py-2 rounded bg-transparent border border-[#2a3242] hover:bg-[#1a2130] disabled:opacity-50"
            >
              {loading ? "處理中…" : cta}
            </button>
          </div>

          {err && <p className="text-center text-red-400 mt-4">{err}</p>}

          {/* 驗證結果（可保留做內部測試） */}
          {data && (
            <div className="mt-10 space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-2">全局摘要</h3>
                <p className="whitespace-pre-wrap text-gray-200">{data.global_summary}</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-lg font-semibold">段落摘要 / 關鍵字</h3>
                <div className="space-y-3">
                  {data.paragraphs.map((p) => (
                    <div key={p.index} className="border border-[#2a3242] rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm px-2 py-0.5 bg-[#121725] rounded">段落 #{p.index}</span>
                        <span className="text-xs text-gray-500">[{p.start_char}, {p.end_char}]</span>
                      </div>
                      <p className="mb-2 whitespace-pre-wrap text-gray-300">{p.text}</p>
                      {summaryMap.get(p.index) && (
                        <p className="text-sm text-gray-400"><span className="font-medium text-gray-300">摘要：</span>{summaryMap.get(p.index)}</p>
                      )}
                      {!!(kwMap.get(p.index)?.length) && (
                        <p className="text-sm text-gray-400"><span className="font-medium text-gray-300">關鍵字：</span>{kwMap.get(p.index)!.join("、")}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-lg font-semibold mb-2">文字雲</h3>
                <img src={`${API_BASE}${data.wordcloud_image_url}`} alt="wordcloud" className="border border-[#2a3242] rounded" />
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
