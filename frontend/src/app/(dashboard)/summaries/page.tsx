'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '@/contexts/app-state';
import { SectionShell, EmptySurface } from '@/components/section-shell';
import styles from './summaries.module.css';

export default function SummariesPage() {
  const { documents } = useAppState();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);

  const activeDoc = useMemo(() => documents.find((doc) => doc.id === selectedId) ?? documents[0], [
    documents,
    selectedId
  ]);

  useEffect(() => {
    if (!documents.length) {
      setSelectedId(null);
      return;
    }
    const exists = selectedId ? documents.some((doc) => doc.id === selectedId) : false;
    if (!selectedId || !exists) {
      setSelectedId(documents[0].id);
    }
  }, [documents, selectedId]);

  const summaries = useMemo(() => {
    if (!activeDoc) return [];
    return activeDoc.paragraph_summaries.filter((item) =>
      query ? item.summary.toLowerCase().includes(query.toLowerCase()) : true
    );
  }, [activeDoc, query]);

  if (!documents.length) {
    return (
      <SectionShell
        title="摘要整理管理"
        subtitle="管理您的文檔摘要"
        totalLabel="總摘要"
        totalCount={0}
        searchPlaceholder="搜尋摘要內容..."
        onSearch={setQuery}
      >
        <EmptySurface icon="📘" title="還沒有生成任何摘要" description="開始處理文檔並生成您的第一個摘要" />
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title="摘要整理管理"
      subtitle="管理您的文檔摘要"
      totalLabel="段落摘要"
      totalCount={activeDoc ? activeDoc.paragraph_summaries.length : 0}
      searchPlaceholder="搜尋摘要內容..."
      onSearch={setQuery}
    >
      <div className={styles.wrapper}>
        <div className={styles.selector}>
          <span>選擇文檔：</span>
          <select
            value={activeDoc?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.summaryList}>
          {summaries.map((item) => {
            const paragraph = activeDoc?.paragraphs.find((p) => p.index === item.paragraph_index);
            return (
              <article key={item.paragraph_index} className={styles.summaryItem}>
                <header>
                  <span>段落 {item.paragraph_index + 1}</span>
                  <span>{paragraph?.text.length ?? 0} 字</span>
                </header>
                <p>{item.summary}</p>
              </article>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
