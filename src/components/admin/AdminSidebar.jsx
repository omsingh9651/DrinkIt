import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import styles from './AdminSidebar.module.css';

export default function AdminSidebar({ isOpen, onClose }) {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (onClose) onClose();
    try {
      await logout();
      navigate('/admin/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navSections = [
    {
      title: 'GENERAL',
      items: [
        { name: 'Dashboard', path: '/admin/dashboard', icon: '📊', enabled: true },
      ],
    },
    {
      title: 'CATALOG',
      items: [
        { name: 'Products', path: '/admin/products', icon: '🍾', enabled: true },
        { name: 'Categories', path: '/admin/categories', icon: '🏷️', enabled: true },
        { name: 'Brands', path: '/admin/brands', icon: '🏛️', enabled: true },
        { name: 'Media', path: '/admin/media', icon: '🖼️', enabled: true },
      ],
    },
    {
      title: 'INVENTORY',
      items: [
        { name: 'Inventory', path: '/admin/inventory', icon: '📦', enabled: true },
        { name: 'Stock History', path: '/admin/stock-history', icon: '📈', enabled: true },
      ],
    },
    {
      title: 'SALES',
      items: [
        { name: 'Orders', path: '/admin/orders', icon: '🛒', enabled: true },
        { name: 'Deliveries', path: '/admin/delivery', icon: '🛵', enabled: true },
        { name: 'Payments', path: '/admin/payments', icon: '💳', enabled: true },
        { name: 'Coupons', path: '/admin/coupons', icon: '🎟️', enabled: true },
      ],
    },
    {
      title: 'CUSTOMERS',
      items: [
        { name: 'Customers', path: '/admin/customers', icon: '👥', enabled: true },
      ],
    },
    {
      title: 'CONTENT',
      items: [
        { name: 'Banners', path: '/admin/banners', icon: '🎨', enabled: true },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { name: 'Reports', path: '/admin/reports', icon: '📉', enabled: true },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { name: 'Admin Users', path: '/admin/admin-users', icon: '🛡️', enabled: true },
        { name: 'Activity Logs', path: '/admin/activity-logs', icon: '📜', enabled: true },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', icon: '⚙️', enabled: false },
      ],
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        {/* Brand Header */}
        <div className={styles.brandArea}>
          <NavLink
            to="/admin/dashboard"
            className={styles.brandLogo}
            onClick={onClose}
          >
            <span className={styles.brandIcon}>🥃</span>
            <span className={styles.brandTitle}>DrinkIt</span>
          </NavLink>
          <div className={styles.brandRightControls}>
            <span className={styles.versionBadge}>Admin</span>
            <button
              type="button"
              className={styles.closeDrawerBtn}
              onClick={onClose}
              aria-label="Close admin drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className={styles.navigation}>
          {navSections.map((section) => (
            <div key={section.title} className={styles.section}>
              <div className={styles.sectionTitle}>{section.title}</div>
              <ul className={styles.navGroup}>
                {section.items.map((item) => (
                  <li key={item.name}>
                    {item.enabled ? (
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`
                        }
                        onClick={onClose}
                      >
                        <div className={styles.navLabelGroup}>
                          <span className={styles.navIcon}>{item.icon}</span>
                          <span>{item.name}</span>
                        </div>
                      </NavLink>
                    ) : (
                      <div className={styles.disabledItem} title="Planned for upcoming phase">
                      <div className={styles.navLabelGroup}>
                        <span className={styles.navIcon}>{item.icon}</span>
                        <span>{item.name}</span>
                      </div>
                      <span className={styles.soonBadge}>Soon</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Footer Profile */}
      <div className={styles.userProfile}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>👤</div>
          <div className={styles.userDetails}>
            <div className={styles.userEmail} title={admin?.email || 'Admin'}>
              {admin?.email || 'Administrator'}
            </div>
            <div className={styles.userRole}>
              {admin?.role?.replace('_', ' ') || 'Super Admin'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className={styles.logoutBtn}
          title="Sign out of Admin Control Center"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
    </>
  );
}
