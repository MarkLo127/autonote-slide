import type { Dict } from "../lib/i18n";

interface Props {
  t: Dict;
  progress: number;
  message: string;
}

export default function Progress({ t, progress, message }: Props) {
  return (
    <div className="card" role="status" aria-live="polite">
      <div className="prog-msg">
        <span className="spinner" aria-hidden />
        {message || t.analyzing}
      </div>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="prog-pct">{progress}%</div>
    </div>
  );
}
