import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppProviders } from '@/contexts/app-providers';

export const metadata: Metadata = {
  title: 'AutoNote & Slide'
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
