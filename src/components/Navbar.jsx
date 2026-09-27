import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useLocation } from '../context/LocationContext';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { name: 'Home', path: '/' },
  { name: 'Products', path: '/products' },
  { name: 'About', path: '/about' },
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountDropdownRef = useRef(null);

  const { totalItems } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const { profile } = useUser();
  const { selectedLocation, openLocationPicker } = useLocation();
  const navigate = useNavigate();

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
  };

  const handleLogout = async () => {
    handleCloseMenu();
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(e.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatPhoneForNav = (phone) => {
    if (!phone) return 'Member';
    if (phone.length >= 12) {
      return `${phone.slice(0, 5)}•••${phone.slice(-3)}`;
    }
    return phone;
  };

  const displayName = profile?.fullName
    ? profile.fullName.split(' ')[0]
    : formatPhoneForNav(user?.phoneNumber);

  return (
    <nav className={styles.navbar}>
      <div className={styles.leftSection}>
        {/* Brand Logo */}
        <Link to="/" className={styles.logo} onClick={handleCloseMenu}>
          🥃 <span>DrinkIt</span>
        </Link>

        {/* Delivery Location Selector (Blinkit style) */}
        <button
          type="button"
          className={styles.locationSelectorBtn}
          onClick={openLocationPicker}
          aria-label="Change delivery location"
        >
          <span className={styles.locationPinIcon}>📍</span>
          <div className={styles.locationTextWrapper}>
            <span className={styles.locationPrimary}>
              {selectedLocation?.locality || selectedLocation?.city || 'Select location'}
            </span>
            <span className={styles.locationSecondary}>
              {selectedLocation ? (selectedLocation.city || selectedLocation.state || 'India') : 'Choose area'}
              <span className={styles.locationArrow}>▼</span>
            </span>
          </div>
        </button>
      </div>

      {/* Hamburger button — visible on mobile only */}
      <button
        type="button"
        className={styles.hamburger}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
      >
        <span className={menuOpen ? styles.barOpen : styles.bar} />
        <span className={menuOpen ? styles.barOpen : styles.bar} />
        <span className={menuOpen ? styles.barOpen : styles.bar} />
      </button>

      {/* Backdrop overlay on mobile when menu is open */}
      {menuOpen && (
        <div
          className={styles.backdrop}
          onClick={handleCloseMenu}
          aria-hidden="true"
        />
      )}

      {/* Nav links + cart + user/login */}
      <ul className={`${styles.navLinks} ${menuOpen ? styles.navOpen : ''}`}>
        {NAV_LINKS.map((link) => (
          <li key={link.path}>
            <NavLink
              to={link.path}
              end={link.path === '/'}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
              onClick={handleCloseMenu}
            >
              {link.name}
            </NavLink>
          </li>
        ))}

        <li>
          <NavLink
            to="/cart"
            className={({ isActive }) =>
              `${styles.cartIcon} ${isActive ? styles.cartIconActive : ''}`
            }
            aria-label={`Cart with ${totalItems} items`}
            onClick={handleCloseMenu}
          >
            🛒 <span className={styles.cartBadge}>{totalItems}</span>
          </NavLink>
        </li>

        {/* User state / Customer Account Menu */}
        <li className={styles.authItem} ref={accountDropdownRef}>
          {isAuthenticated ? (
            <>
              <button
                type="button"
                className={styles.accountTriggerBtn}
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
              >
                <div className={styles.userAvatarMini}>
                  {profile?.profileImage || '👤'}
                </div>
                <span className={styles.userNameLabel}>{displayName}</span>
                <span
                  className={`${styles.chevron} ${
                    accountMenuOpen ? styles.chevronOpen : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* Account Dropdown Menu */}
              {accountMenuOpen && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownUserTitle}>
                      {profile?.fullName || 'DrinkIt Connoisseur'}
                    </div>
                    <div className={styles.dropdownUserSub}>
                      {user?.phoneNumber || ''}
                    </div>
                  </div>

                  <Link
                    to="/account"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>🏠</span>
                    <span>My Account</span>
                  </Link>

                  <Link
                    to="/account/profile"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>👤</span>
                    <span>My Profile</span>
                  </Link>

                  <Link
                    to="/account/orders"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>📦</span>
                    <span>My Orders</span>
                  </Link>

                  <Link
                    to="/account/addresses"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>📍</span>
                    <span>Saved Addresses</span>
                  </Link>

                  <Link
                    to="/account/wishlist"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>❤️</span>
                    <span>Wishlist</span>
                  </Link>

                  <Link
                    to="/account/coupons"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>🎟️</span>
                    <span>Coupons</span>
                  </Link>

                  <Link
                    to="/account/privacy"
                    className={styles.dropdownItem}
                    onClick={handleCloseMenu}
                  >
                    <span>🔒</span>
                    <span>Account Privacy</span>
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <button
                    type="button"
                    className={styles.dropdownLogoutBtn}
                    onClick={handleLogout}
                  >
                    <span>🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className={styles.loginBtn}
              onClick={() => {
                handleCloseMenu();
                navigate('/login');
              }}
            >
              Login
            </button>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
