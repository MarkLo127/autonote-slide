'use client';

import { useMemo, useState } from 'react';

import { SectionShell, EmptySurface } from '@/components/section-shell';
import { useAppState } from '@/contexts/app-state';
import styles from './documents.module.css';

export default function DocumentsPage() {
  const { documents } = useAppState();
  const [query, setQuery] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('全部語言');

  const languages = useMemo(() => {
    const unique = new Set<string>(['全部語言']);
    documents.forEach((doc) => unique.add(doc.language));
    return Array.from(unique);
  }, [documents]);

  const filteredDocs = documents.filter((doc) => {
    const matchesQuery = query
      ? doc.filename.toLowerCase().includes(query.toLowerCase()) ||
        doc.global_summary.toLowerCase().includes(query.toLowerCase())
      : true;
    const matchesLanguage = activeLanguage === '全部語言' ? true : doc.language === activeLanguage;
    return matchesQuery && matchesLanguage;
  });

  if (!documents.length) {
    return (
      <SectionShell
        title="我的文檔"
        subtitle="管理您已上傳和處理的文檔"
        totalLabel="總計"
        totalCount={0}
        searchPlaceholder="搜尋文檔名稱..."
        onSearch={setQuery}
        languages={languages}
        activeLanguage={activeLanguage}
        onLanguageChange={setActiveLanguage}
      >
        <EmptySurface icon="📄" title="還沒有上傳任何文檔" description="開始上傳檔案並生成您的第一個摘要" />
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title="我的文檔"
      subtitle="管理您已上傳和處理的文檔"
      totalLabel="總計"
      totalCount={documents.length}
      searchPlaceholder="搜尋文檔名稱..."
      onSearch={setQuery}
      languages={languages}
      activeLanguage={activeLanguage}
      onLanguageChange={setActiveLanguage}
    >
      <div className={styles.wrapper}>
        <div className={styles.cardGrid}>
          {filteredDocs.map((doc) => (
            <article key={doc.id} className={styles.card}>
              <h3>{doc.filename}</h3>
              <div className={styles.meta}>
                {doc.language} ・ {new Date(doc.uploadedAt).toLocaleString('zh-TW', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </div>
              <p className={styles.summary}>{truncate(doc.global_summary, 180)}</p>
              <div className={styles.chipList}>
                {doc.paragraph_keywords.slice(0, 4).map((item) => (
                  <span key={item.paragraph_index} className={styles.chip}>
                    {item.keywords.slice(0, 2).join('、')}
                  </span>
                ))}
              </div>
              <div className={styles.actionRow}>
                <button type="button" onClick={() => copySummary(doc.global_summary)}>
                  複製摘要
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function truncate(text: string, length: number) {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

function copySummary(summary: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(summary).catch((error) => {
      console.warn('無法複製到剪貼簿', error);
    });
  } else {
    console.warn('瀏覽器不支援剪貼簿 API');
  }
}
