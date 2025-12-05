"use client";

import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative inline-block">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
        className="appearance-none rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 shadow-sm hover:shadow-md"
      >
        <option value="light">☀️ 亮色</option>
        <option value="dark">🌙 暗色</option>
        <option value="system">💻 系統</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
        <svg
          className="h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
