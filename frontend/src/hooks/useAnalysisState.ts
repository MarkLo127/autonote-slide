"use client";

import { useCallback, useEffect, useState } from "react";

export type PageSummary = {
  page_number: number;
  classification: string;
  bullets: string[];
  keywords: string[];
  skipped: boolean;
  skip_reason?: string | null;
};

export type GlobalSummaryExpansions = {
  key_conclusions: string;
  core_data: string;
  risks_and_actions: string;
};

export type GlobalSummary = {
  bullets: string[];
  expansions: GlobalSummaryExpansions;
};

export type AnalysisResult = {
  language: string;
  total_pages: number;
  page_summaries: PageSummary[];
  global_summary: GlobalSummary;
  system_prompt?: string | null;
  wordcloud_image_url: string | null;
  document_name?: string;
};

const STORAGE_KEY = "autonote:analysis_result";

export function useAnalysisState() {
  const [analysisResult, setAnalysisResultState] =
    useState<AnalysisResult | null>(null);

  useEffect(() => {
    // Load from sessionStorage on mount
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setAnalysisResultState(JSON.parse(stored));
        } catch (error) {
          console.error("Failed to parse stored analysis result:", error);
        }
      }
    }
  }, []);

  const setAnalysisResult = useCallback((result: AnalysisResult | null) => {
    setAnalysisResultState(result);
    
    if (typeof window !== "undefined") {
      if (result) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const clearAnalysisResult = useCallback(() => {
    setAnalysisResultState(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    analysisResult,
    setAnalysisResult,
    clearAnalysisResult,
  };
}
