'use client';

import { useState } from 'react';
import { SectionShell } from '@/components/section-shell';
import { UploadDropzone } from '@/components/upload-dropzone';
import styles from './upload.module.css';
import { analyzeDocument } from '@/lib/api';
import { useAppState } from '@/contexts/app-state';
import { StoredDocument } from '@/lib/types';

interface UploadStatus {
  id: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
}

const LANG_OPTIONS = ['繁體中文', '簡體中文', 'English'];

export default function UploadPage() {
  const { documents, addDocument, apiConfig } = useAppState();
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string>('繁體中文');

  const handleFilesSelected = async (files: FileList) => {
    if (!apiConfig.apiKey) {
      setError('請先於右上角設定 API Key 後再嘗試上傳。');
      return;
    }
    setError(null);

    const selected = Array.from(files).slice(0, 5);

    const pendingStatuses = selected.map<UploadStatus>((file) => ({
      id: createId(),
      filename: file.name,
      status: 'processing'
    }));

    setStatuses((prev) => [...pendingStatuses, ...prev]);

    for (const entry of pendingStatuses) {
      const file = selected.find((candidate) => candidate.name === entry.filename);
      if (!file) continue;

      try {
        const result = await analyzeDocument(file, apiConfig);
        const doc: StoredDocument = {
          id: entry.id,
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          ...result
        };
        addDocument(doc);
        setStatuses((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: 'completed'
                }
              : item
          )
        );
      } catch (err) {
        setStatuses((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: 'error',
                  message: err instanceof Error ? err.message : '未知錯誤'
                }
              : item
          )
        );
      }
    }
  };

  return (
    <SectionShell
      title="智能文檔處理平台"
      subtitle="上傳您的文檔，讓 AI 為您生成摘要、擷取關鍵字、建立心智圖"
      totalLabel="總計"
      totalCount={documents.length}
      searchPlaceholder="搜尋已上傳的檔案..."
      languages={['全部語言', ...LANG_OPTIONS]}
      activeLanguage={activeLanguage}
      onLanguageChange={setActiveLanguage}
    >
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.heroHeader}>
            <div>
              <div className={styles.badge}>目前僅支援繁體語言優先使用</div>
              <h1 className={styles.heroTitle}>上傳您的檔案</h1>
              <p className={styles.heroDescription}>
                將檔案拖放至下方區域或點擊瀏覽。系統會自動分析文本並提供摘要、關鍵字與心智圖。
              </p>
            </div>
          </div>
          <div className={styles.actions}>
            {LANG_OPTIONS.map((language) => (
              <div key={language} className={styles.actionCard}>
                {language}
              </div>
            ))}
          </div>
          <UploadDropzone onFilesSelected={handleFilesSelected} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {statuses.length > 0 && (
          <div className={styles.statusList}>
            {statuses.map((status) => (
              <div key={status.id} className={styles.status}>
                <span>{status.filename}</span>
                <strong>
                  {status.status === 'processing' && '處理中...'}
                  {status.status === 'completed' && '已完成'}
                  {status.status === 'error' && `錯誤：${status.message ?? ''}`}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionShell>
  );
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
