import { useEffect, useRef, useState } from "react";
import type { Dict } from "../lib/i18n";
import { FileIcon, UploadIcon } from "./icons";

const FEATURES: { key: string; label: keyof Dict }[] = [
  { key: "summary", label: "fSummary" },
  { key: "translate", label: "fTranslate" },
  { key: "wordcloud", label: "fWordcloud" },
  { key: "report", label: "fReport" },
];

interface Props {
  t: Dict;
  onAnalyze: (file: File, features: string[]) => void;
}

export default function UploadZone({ t, onAnalyze }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>(["summary", "translate", "wordcloud", "report"]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | undefined | null) => {
    if (f && f.type === "application/pdf") setFile(f);
  };
  const toggle = (k: string) =>
    setFeatures((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <div className="upload-grid">
      {/* 左：上傳 + 選項 + 分析 */}
      <div className="upload-left">
        <div
          className={`drop${drag ? " drag" : ""}${file ? " has-file" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={t.dropHint}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        >
          <UploadIcon size={30} className="drop-icon" />
          <div className="drop-hint">{t.dropHint}</div>
          <div className="drop-sub">{t.dropSub}</div>
          {file && (
            <div className="drop-file">
              <FileIcon size={16} /> {file.name}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        <div className="opts">
          <div className="opts-label">{t.features}</div>
          <div className="chips">
            {FEATURES.map((f) => (
              <button
                key={f.key}
                className="chip"
                type="button"
                aria-pressed={features.includes(f.key)}
                onClick={() => toggle(f.key)}
              >
                {t[f.label]}
              </button>
            ))}
          </div>
        </div>

        <button
          className="cta"
          type="button"
          disabled={!file || features.length === 0}
          onClick={() => file && onAnalyze(file, features)}
        >
          {t.analyze}
        </button>
      </div>

      {/* 右：PDF 預覽 */}
      <div className="upload-right">
        {previewUrl ? (
          <iframe className="pdf-preview" src={`${previewUrl}#toolbar=0`} title={file?.name ?? "PDF"} />
        ) : (
          <div className="preview-empty">
            <FileIcon size={40} />
            <span>{t.previewHint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
