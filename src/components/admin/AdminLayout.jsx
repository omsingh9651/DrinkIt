import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import styles from './AdminLayout.module.css';

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.adminContainer}>
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={styles.mainWrapper}>
        <AdminHeader
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main className={styles.contentArea}>
          {children}
        </main>
      </div>
    </div>
  );
}
