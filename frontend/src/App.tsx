import { useEffect, useState } from "react";
import "./App.css";
import { analyzeStream, getResult, type AnalyzeResult } from "./lib/api";
import { t, type Lang } from "./lib/i18n";
import { AlertIcon, FileIcon, HistoryIcon, MoonIcon, SunIcon } from "./components/icons";
import UploadZone from "./components/UploadZone";
import Progress from "./components/Progress";
import Results from "./components/Results";
import History from "./components/History";

type Phase = "idle" | "running" | "done" | "error";
type Theme = "light" | "dark";
type Screen = "analyze" | "history";

export default function App() {
  const [lang, setLang] = useState<Lang>("zh-Hant");
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [lastFeatures, setLastFeatures] = useState<string[]>([]);
  const [screen, setScreen] = useState<Screen>("analyze");
  const [fromHistory, setFromHistory] = useState(false);

  const tr = t(lang);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const runAnalyze = async (file: File, features: string[], refresh = false) => {
    setLastFile(file);
    setLastFeatures(features);
    setFromHistory(false);
    setScreen("analyze");
    setPhase("running");
    setProgress(0);
    setMessage("");
    setError("");
    setResult(null);
    try {
      await analyzeStream(
        file,
        features,
        (e) => {
          setProgress(e.progress);
          setMessage(e.message);
          if (e.type === "result" && e.data) {
            setResult(e.data);
            setPhase("done");
          } else if (e.type === "error") {
            setError(e.message);
            setPhase("error");
          }
        },
        refresh,
      );
    } catch (err) {
      setError(String(err));
      setPhase("error");
    }
  };

  const analyze = (file: File, features: string[]) => runAnalyze(file, features, false);
  const reanalyze = () => {
    if (lastFile) runAnalyze(lastFile, lastFeatures, true);
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError("");
    setFromHistory(false);
    setScreen("analyze");
  };

  const viewHistoryItem = async (docId: string) => {
    setScreen("analyze");
    setPhase("running");
    setMessage(tr.loading);
    setProgress(100);
    try {
      const r = await getResult(docId);
      setResult(r);
      setFromHistory(true);
      setPhase("done");
    } catch (err) {
      setError(String(err));
      setPhase("error");
    }
  };

  return (
    <div className="app">
      <header className="hdr">
        <button className="hdr-brand" type="button" onClick={reset} aria-label={tr.title}>
          <span className="hdr-logo"><FileIcon size={22} /></span>
          <span className="hdr-titles">
            <span className="hdr-title">{tr.title}</span>
            <span className="hdr-sub">{tr.subtitle}</span>
          </span>
        </button>
        <button
          className={`icon-btn${screen === "history" ? " active" : ""}`}
          type="button"
          onClick={() => setScreen(screen === "history" ? "analyze" : "history")}
          aria-label={tr.history}
          title={tr.history}
        >
          <HistoryIcon size={18} />
        </button>
        <button
          className="pill-btn"
          type="button"
          onClick={() => setLang(lang === "zh-Hant" ? "en" : "zh-Hant")}
          aria-label="language"
        >
          {tr.langName}
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="theme"
        >
          {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </header>

      <main>
        {/* 上傳用寬版兩欄；其餘閱讀內容用窄版好讀 */}
        {screen === "analyze" && phase === "idle" && <UploadZone t={tr} onAnalyze={analyze} />}

        {screen === "history" && (
          <div className="reading">
            <History t={tr} onView={viewHistoryItem} />
          </div>
        )}
        {screen === "analyze" && phase === "running" && (
          <div className="reading">
            <Progress t={tr} progress={progress} message={message} />
          </div>
        )}
        {screen === "analyze" && phase === "done" && result && (
          <div className="reading">
            <Results
              t={tr}
              result={result}
              onReset={reset}
              onReanalyze={fromHistory ? undefined : reanalyze}
            />
          </div>
        )}
        {screen === "analyze" && phase === "error" && (
          <div className="reading">
            <div className="card">
              <div className="err">
                <AlertIcon size={22} />
                <div>
                  <b>{tr.errorTitle}</b>
                  {error}
                </div>
              </div>
              <button className="cta" type="button" onClick={reset} style={{ marginTop: 20 }}>
                {tr.retry}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
