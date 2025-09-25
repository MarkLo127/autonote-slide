'use client';

import { ReactNode } from 'react';
import { TopBar } from '@/components/top-bar';
import styles from './section-shell.module.css';

interface SectionShellProps {
  title: string;
  subtitle: string;
  totalLabel: string;
  totalCount: number;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  languages?: string[];
  activeLanguage?: string;
  onLanguageChange?: (value: string) => void;
  children: ReactNode;
}

export function SectionShell({
  title,
  subtitle,
  totalLabel,
  totalCount,
  searchPlaceholder,
  onSearch,
  languages,
  activeLanguage,
  onLanguageChange,
  children
}: SectionShellProps) {
  return (
    <div className={styles.wrapper}>
      <TopBar
        title={title}
        subtitle={subtitle}
        totalLabel={totalLabel}
        totalCount={totalCount}
        searchPlaceholder={searchPlaceholder}
        onSearch={onSearch}
        languages={languages}
        activeLanguage={activeLanguage}
        onLanguageChange={onLanguageChange}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export function EmptySurface({
  icon,
  title,
  description
}: {
  icon?: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.surface}>
      <div style={{ fontSize: 44 }}>{icon ?? '🧠'}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
