import { useEffect, useState } from "react";
import { deleteDocument, listDocuments, type DocumentSummary } from "../lib/api";
import type { Dict } from "../lib/i18n";
import { DownloadIcon, FileIcon, TrashIcon } from "./icons";
import { BACKEND } from "../lib/api";

interface Props {
  t: Dict;
  onView: (docId: string) => void;
}

export default function History({ t, onView }: Props) {
  const [items, setItems] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    listDocuments()
      .then(setItems)
      .catch((e) => setError(String(e)));
  };
  useEffect(load, []);

  const remove = async (id: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await deleteDocument(id);
      setItems((prev) => (prev ? prev.filter((x) => x.doc_id !== id) : prev));
    } catch (e) {
      setError(String(e));
    }
  };

  const statusLabel = (s: string) =>
    s === "done" ? t.stDone : s === "error" ? t.stError : t.stProcessing;

  if (error) return <div className="card"><div className="err"><div>{error}</div></div></div>;
  if (items === null) return <div className="card">{t.loading}</div>;
  if (items.length === 0) return <div className="card empty-hist">{t.historyEmpty}</div>;

  return (
    <div className="hist-list">
      {items.map((it) => (
        <div className="hist-row" key={it.doc_id}>
          <FileIcon size={20} className="hist-icon" />
          <div className="hist-main">
            <div className="hist-name" title={it.filename}>{it.filename}</div>
            <div className="hist-meta">
              {new Date(it.created_at * 1000).toLocaleString()} · {it.total_pages} {t.pages}
              <span className={`hist-badge s-${it.status}`}>{statusLabel(it.status)}</span>
            </div>
          </div>
          <div className="hist-actions">
            {it.has_report && (
              <a
                className="icon-btn"
                href={`${BACKEND}/documents/${it.doc_id}/report.pdf`}
                target="_blank"
                rel="noreferrer"
                aria-label={t.downloadPdf}
              >
                <DownloadIcon size={18} />
              </a>
            )}
            {it.status === "done" && (
              <button className="pill-btn" type="button" onClick={() => onView(it.doc_id)}>
                {t.view}
              </button>
            )}
            <button
              className="icon-btn danger"
              type="button"
              onClick={() => remove(it.doc_id)}
              aria-label={t.delete}
            >
              <TrashIcon size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
