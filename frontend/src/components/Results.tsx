import { useState } from "react";
import { reportUrl, type AnalyzeResult, type Segment } from "../lib/api";
import type { Dict } from "../lib/i18n";
import { DownloadIcon } from "./icons";

interface Props {
  t: Dict;
  result: AnalyzeResult;
  onReset: () => void;
  onReanalyze?: () => void;
}

export default function Results({ t, result, onReset, onReanalyze }: Props) {
  const gs = result.global_summary;
  const pdf = reportUrl(result);
  const quads: [string, string | undefined][] = gs
    ? [
        [t.conclusion, gs.conclusion],
        [t.data, gs.data],
        [t.risk, gs.risk],
        [t.action, gs.action],
      ]
    : [];
  const hasQuads = quads.some(([, v]) => v);

  return (
    <div>
      <div className="res-bar">
        <div className="res-meta">
          <b>{result.total_pages}</b> {t.pages} · <b>{result.segments.length}</b> {t.seg}
        </div>
        {pdf && (
          <a className="btn-accent" href={pdf} target="_blank" rel="noreferrer">
            <DownloadIcon size={16} /> {t.downloadPdf}
          </a>
        )}
        {onReanalyze && (
          <button className="pill-btn" type="button" onClick={onReanalyze}>
            {t.reanalyze}
          </button>
        )}
        <button className="pill-btn" type="button" onClick={onReset}>
          {t.newFile}
        </button>
      </div>

      {hasQuads && (
        <>
          <h2 className="section-h">{t.globalSummary}</h2>
          <div className="quad">
            {quads.map(([k, v]) =>
              v ? (
                <div className="quad-cell" key={k}>
                  <div className="quad-k">{k}</div>
                  <div className="quad-v">{v}</div>
                </div>
              ) : null,
            )}
          </div>
        </>
      )}

      {result.wordcloud_image_url && (
        <>
          <h2 className="section-h">{t.wordcloud}</h2>
          <img className="wc-img" src={result.wordcloud_image_url} alt={t.wordcloud} />
        </>
      )}

      {result.keywords.length > 0 && (
        <>
          <h2 className="section-h">{t.keywords}</h2>
          <div className="kw">
            {result.keywords.slice(0, 30).map((k) => (
              <span className="kw-tag" key={k}>{k}</span>
            ))}
          </div>
        </>
      )}

      <h2 className="section-h">{t.segments}</h2>
      {result.segments.map((s) => (
        <SegmentCard key={s.index} t={t} seg={s} />
      ))}
    </div>
  );
}

function SegmentCard({ t, seg }: { t: Dict; seg: Segment }) {
  const tabs = [
    seg.summary ? { key: "summary", label: t.summary, body: seg.summary, cls: "" } : null,
    seg.translated ? { key: "translated", label: t.translated, body: seg.translated, cls: "" } : null,
    { key: "original", label: t.original, body: seg.original, cls: "orig" },
  ].filter(Boolean) as { key: string; label: string; body: string; cls: string }[];

  const [active, setActive] = useState(tabs[0].key);
  const cur = tabs.find((x) => x.key === active) ?? tabs[0];

  return (
    <div className="seg">
      <div className="seg-head">
        {t.seg} {seg.index + 1}
        <div className="seg-tabs" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              className="seg-tab"
              role="tab"
              aria-selected={active === x.key}
              onClick={() => setActive(x.key)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`seg-body ${cur.cls}`}>{cur.body}</div>
    </div>
  );
}
