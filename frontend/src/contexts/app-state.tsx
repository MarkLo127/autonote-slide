'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ApiConfig, StoredDocument } from '@/lib/types';

interface AppStateContextValue {
  apiConfig: ApiConfig;
  setApiConfig: (config: ApiConfig) => void;
  documents: StoredDocument[];
  addDocument: (doc: StoredDocument) => void;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
}

const initialConfig: ApiConfig = {
  apiKey: '',
  llmBaseUrl: '',
  model: 'gpt-4o-mini'
};

const API_CONFIG_KEY = 'autonote-api-config';
const DOCUMENTS_KEY = 'autonote-documents';

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [apiConfig, setApiConfigState] = useState<ApiConfig>(initialConfig);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);

  useEffect(() => {
    try {
      const storedConfig = window.localStorage.getItem(API_CONFIG_KEY);
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        if (parsed.baseUrl && !parsed.llmBaseUrl) {
          parsed.llmBaseUrl = parsed.baseUrl;
        }
        setApiConfigState({ ...initialConfig, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load API config from localStorage', error);
    }
  }, []);

  useEffect(() => {
    try {
      const storedDocs = window.localStorage.getItem(DOCUMENTS_KEY);
      if (storedDocs) {
        setDocuments(JSON.parse(storedDocs));
      }
    } catch (error) {
      console.warn('Failed to load documents from localStorage', error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(API_CONFIG_KEY, JSON.stringify(apiConfig));
    } catch (error) {
      console.warn('Failed to persist API config', error);
    }
  }, [apiConfig]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    } catch (error) {
      console.warn('Failed to persist documents', error);
    }
  }, [documents]);

  const value = useMemo(
    () => ({
      apiConfig,
      setApiConfig: setApiConfigState,
      documents,
      addDocument: (doc: StoredDocument) => {
        setDocuments((prev) => [doc, ...prev]);
      },
      removeDocument: (id: string) => {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      },
      clearDocuments: () => setDocuments([])
    }),
    [apiConfig, documents]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
