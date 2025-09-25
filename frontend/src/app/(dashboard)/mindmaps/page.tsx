'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { SectionShell, EmptySurface } from '@/components/section-shell';
import { useAppState } from '@/contexts/app-state';
import styles from './mindmaps.module.css';

export default function MindmapsPage() {
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
        title="心智圖生成管理"
        subtitle="管理您的心智圖"
        totalLabel="總心智圖"
        totalCount={0}
      >
        <EmptySurface icon="🧠" title="還沒有生成任何心智圖" description="開始處理文檔並生成您的第一張心智圖" />
      </SectionShell>
    );
  }

  const imageUrl = activeDoc?.wordcloud_image_url;
  return (
    <SectionShell
      title="心智圖生成管理"
      subtitle="管理您的心智圖"
      totalLabel="總心智圖"
      totalCount={documents.length}
    >
      <div className={styles.wrapper}>
        <div className={styles.selectRow}>
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

        <div className={styles.imagePanel}>
          <h3>{activeDoc?.filename}</h3>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="文字雲"
              width={640}
              height={480}
              style={{ width: '100%', height: 'auto', borderRadius: '16px' }}
            />
          ) : (
            <div className={styles.placeholder}>尚無圖片</div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
