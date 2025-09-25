'use client';

import { useState } from 'react';
import styles from './top-bar.module.css';
import { SettingsModal } from '@/components/settings-modal';

interface TopBarProps {
  title: string;
  subtitle: string;
  totalLabel: string;
  totalCount: number;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  languages?: string[];
  activeLanguage?: string;
  onLanguageChange?: (value: string) => void;
}

const DEFAULT_LANGUAGES = ['全部語言', '繁體中文', '簡體中文', 'English'];

export function TopBar({
  title,
  subtitle,
  totalLabel,
  totalCount,
  searchPlaceholder = '搜尋...',
  onSearch,
  languages = DEFAULT_LANGUAGES,
  activeLanguage,
  onLanguageChange
}: TopBarProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  const handleLanguageClick = (language: string) => {
    onLanguageChange?.(language);
  };

  return (
    <header className={styles.container}>
      <div className={styles.left}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <div className={styles.search}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.stat}>
          {totalLabel}：{totalCount}
        </span>
        <div className={styles.segmented}>
          {languages.map((language) => (
            <button
              key={language}
              type="button"
              data-active={(activeLanguage ?? languages[0]) === language}
              onClick={() => handleLanguageClick(language)}
            >
              {language}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.settingsButton}
          onClick={() => setIsSettingsOpen(true)}
          aria-label="API 設定"
        >
          ⚙️
        </button>
      </div>

      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
}
