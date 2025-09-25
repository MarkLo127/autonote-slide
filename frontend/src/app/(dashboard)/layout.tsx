import styles from '@/styles/dashboard-layout.module.css';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
