// 精簡 SVG 圖示（stroke 一致 1.75，符合 no-emoji / vector-only 規範）
type P = { size?: number; className?: string };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const FileIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const UploadIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 9l5-5 5 5M12 4v12" />
  </svg>
);

export const DownloadIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export const SunIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const CheckIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const HistoryIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const TrashIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const AlertIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);
