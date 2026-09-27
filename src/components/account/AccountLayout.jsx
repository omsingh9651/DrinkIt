import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { useCart } from '../../context/CartContext';
import styles from './AccountLayout.module.css';

export default function AccountLayout() {
  const { logout } = useAuth();
  const { profile, wishlist, unreadNotificationsCount } = useUser();
  const { totalItems } = useCart();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const displayName = profile?.fullName
    ? profile.fullName.split(' ')[0]
    : 'Member';

  return (
    <div className={styles.container}>
      {/* Left Sidebar */}
      <aside className={styles.sidebar}>
        {/* User Card */}
        <div className={styles.userCard}>
          <div className={styles.avatar}>
            {profile?.profileImage || '🥃'}
          </div>
          <div className={styles.userMeta}>
            <span className={styles.greeting}>Welcome, {displayName}</span>
            <span className={styles.userName}>{profile?.fullName || 'DrinkIt Connoisseur'}</span>
            <span className={styles.userPhone}>{profile?.phoneNumber || ''}</span>
          </div>
        </div>

        {/* MY ACCOUNT */}
        <div className={styles.navSection}>
          <span className={styles.sectionTitle}>My Account</span>
          <NavLink
            to="/account"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>🏠</span>
              <span>Overview</span>
            </div>
          </NavLink>

          <NavLink
            to="/account/profile"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>👤</span>
              <span>My Profile</span>
            </div>
          </NavLink>

          <NavLink
            to="/account/addresses"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>📍</span>
              <span>Saved Addresses</span>
            </div>
          </NavLink>

          <NavLink
            to="/account/privacy"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>🔒</span>
              <span>Account Privacy</span>
            </div>
          </NavLink>
        </div>

        {/* MY ORDERS */}
        <div className={styles.navSection}>
          <span className={styles.sectionTitle}>My Orders</span>
          <NavLink
            to="/account/orders"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>📦</span>
              <span>My Orders</span>
            </div>
          </NavLink>
        </div>

        {/* SHOPPING */}
        <div className={styles.navSection}>
          <span className={styles.sectionTitle}>Shopping</span>
          <NavLink
            to="/cart"
            className={styles.navLink}
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>🛒</span>
              <span>Cart</span>
            </div>
            {totalItems > 0 && <span className={styles.badge}>{totalItems}</span>}
          </NavLink>

          <NavLink
            to="/account/wishlist"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>❤️</span>
              <span>Wishlist</span>
            </div>
            {wishlist.length > 0 && (
              <span className={styles.badge}>{wishlist.length}</span>
            )}
          </NavLink>

          <NavLink
            to="/account/coupons"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>🎟️</span>
              <span>Coupons & Offers</span>
            </div>
          </NavLink>

          <NavLink
            to="/account/notifications"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            <div className={styles.linkLeft}>
              <span className={styles.linkIcon}>🔔</span>
              <span>Notifications</span>
            </div>
            {unreadNotificationsCount > 0 && (
              <span className={styles.badge}>{unreadNotificationsCount}</span>
            )}
          </NavLink>
        </div>

        {/* LOGOUT */}
        <button
          type="button"
          onClick={handleLogout}
          className={styles.logoutBtn}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className={styles.contentArea}>
        <Outlet />
      </main>
    </div>
  );
}
