'use client';

import { AppStateProvider } from './app-state';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
