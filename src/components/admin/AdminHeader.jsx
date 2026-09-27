import { useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import styles from './AdminHeader.module.css';

export default function AdminHeader({ onToggleSidebar }) {
  const location = useLocation();
  const { admin } = useAdminAuth();

  const getPageTitle = (pathname) => {
    if (pathname.includes('/admin/products')) return 'Catalog / Products';
    if (pathname.includes('/admin/dashboard')) return 'Overview Dashboard';
    return 'Admin Control Center';
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftArea}>
        <button
          type="button"
          className={styles.menuToggleBtn}
          onClick={onToggleSidebar}
          aria-label="Toggle navigation drawer"
        >
          ☰
        </button>
        <div className={styles.breadcrumb}>
          <span>DrinkIt Admin</span>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{getPageTitle(location.pathname)}</span>
        </div>
      </div>

      <div className={styles.rightArea}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot} />
          <span>Live Store Sync</span>
        </div>

        <span className={styles.rolePill}>
          {admin?.role?.replace('_', ' ') || 'Super Admin'}
        </span>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.viewStoreBtn}
          title="Open Customer Storefront in new tab"
        >
          <span>🛍️ View Storefront</span>
          <span>↗</span>
        </a>
      </div>
    </header>
  );
}
