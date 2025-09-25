'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from './settings-modal.module.css';
import { useAppState } from '@/contexts/app-state';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { apiConfig, setApiConfig } = useAppState();
  const [apiKey, setApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');

  useEffect(() => {
    setApiKey(apiConfig.apiKey ?? '');
    setLlmBaseUrl(apiConfig.llmBaseUrl ?? '');
    setModel(apiConfig.model ?? 'gpt-4o-mini');
  }, [apiConfig, open]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setApiConfig({ apiKey, llmBaseUrl, model });
    onClose();
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>API 設定</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="關閉">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="api-key">API Key *</label>
            <input
              id="api-key"
              type="password"
              placeholder="請輸入您的 API Key"
              value={apiKey}
              required
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="llm-base-url">LLM Base URL（可選）</label>
            <input
              id="llm-base-url"
              type="url"
              placeholder="https://api.example.com (留空使用預設)"
              value={llmBaseUrl}
              onChange={(event) => setLlmBaseUrl(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="model">模型</label>
            <select id="model" value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button type="submit">確認</button>
          </div>
        </form>
      </div>
    </div>
  );
}
