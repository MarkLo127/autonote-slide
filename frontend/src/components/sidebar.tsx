'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import styles from './sidebar.module.css';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const mainItems: NavItem[] = [
  { label: '上傳檔案', href: '/upload', icon: <IconUpload /> },
  { label: '我的文檔', href: '/documents', icon: <IconDocuments /> }
];

const contentItems: NavItem[] = [
  { label: '摘要整理管理', href: '/summaries', icon: <IconSummary /> },
  { label: '關鍵字擷取管理', href: '/keywords', icon: <IconTag /> },
  { label: '心智圖生成管理', href: '/mindmaps', icon: <IconMindmap /> }
];

export function Sidebar() {
  const pathname = usePathname();

  const renderNav = (items: NavItem[]) => (
    <div className={styles.navList}>
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(styles.navItem, isActive && styles.navItemActive)}
          >
            <span className={styles.iconCircle}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside className={styles.container}>
      <div className={styles.brand}>
        <div className={styles.brandTitle}>
          <IconBrand /> AutoNote & Slide
        </div>
        <div className={styles.brandSubtitle}>智慧化文檔處理平台</div>
      </div>

      <div>
        <div className={styles.sectionTitle}>主要功能</div>
        {renderNav(mainItems)}
      </div>

      <div>
        <div className={styles.sectionTitle}>內容管理</div>
        {renderNav(contentItems)}
      </div>

      <div className={styles.footer}>
        © {new Date().getFullYear()} AutoNote &amp; Slide
      </div>
    </aside>
  );
}

function IconBrand() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="2" width="16" height="16" rx="5" fill="#3f89ff" opacity="0.18" />
      <path
        d="M10 5l3.5 2v6L10 15l-3.5-2V7L10 5z"
        stroke="#3f89ff"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#fff"
      />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 3v10m0 0l-4-4m4 4l4-4M5 15h10"
        stroke="#3f89ff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDocuments() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7 4h6l3 3v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        stroke="#3f89ff"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="white"
      />
      <path d="M7 9h6M7 12h6" stroke="#3f89ff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconSummary() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 5h12M4 10h12M4 15h12"
        stroke="#3f89ff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 4h6l6 6-6 6-6-6V4z"
        stroke="#3f89ff"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="white"
      />
      <circle cx="7" cy="7" r="1" fill="#3f89ff" />
    </svg>
  );
}

function IconMindmap() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3" stroke="#3f89ff" strokeWidth="1.4" />
      <path
        d="M10 7V3m0 10v4m3-4h4m-4-2h4M7 9H3m4 2H3"
        stroke="#3f89ff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
