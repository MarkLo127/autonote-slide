'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '@/contexts/app-state';
import { SectionShell, EmptySurface } from '@/components/section-shell';
import styles from './keywords.module.css';

export default function KeywordsPage() {
  const { documents } = useAppState();
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

  if (!documents.length) {
    return (
      <SectionShell
        title="關鍵字擷取管理"
        subtitle="管理您的文檔關鍵字"
        totalLabel="總關鍵字集合"
        totalCount={0}
      >
        <EmptySurface icon="🔖" title="還沒有擷取任何關鍵字" description="開始處理文檔並擷取您的第一組關鍵字" />
      </SectionShell>
    );
  }

  const items = activeDoc?.paragraph_keywords ?? [];
  return (
    <SectionShell
      title="關鍵字擷取管理"
      subtitle="管理您的文檔關鍵字"
      totalLabel="總集合"
      totalCount={items.length}
    >
      <div className={styles.wrapper}>
        <div>
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

        <div className={styles.grid}>
          {items.map((item) => (
            <article key={item.paragraph_index} className={styles.card}>
              <h3>段落 {item.paragraph_index + 1}</h3>
              <div className={styles.keywordList}>
                {item.keywords.map((keyword) => (
                  <span key={keyword} className={styles.keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
