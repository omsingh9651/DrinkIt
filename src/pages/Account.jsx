import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/formatters';
import styles from './Account.module.css';

export default function Account() {
  const { profile, addresses, wishlist, orders, unreadNotificationsCount } = useUser();
  const { totalItems, subtotal } = useCart();

  const firstName = profile?.fullName ? profile.fullName.split(' ')[0] : 'Member';

  // Default address preview
  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;

  return (
    <div className={styles.dashboard}>
      {/* Top Profile Hero */}
      <div className={styles.profileHero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroAvatar}>
            {profile?.profileImage || '🥃'}
          </div>
          <div className={styles.heroMeta}>
            <h1>Hello, {firstName} 👋</h1>
            <div className={styles.heroContactRow}>
              <span>{profile?.phoneNumber || 'Mobile Not Verified'}</span>
              <span className={styles.verifiedPill}>
                <span>✔</span> Verified Member
              </span>
              {profile?.email && <span>• {profile.email}</span>}
              {profile?.ageVerificationStatus === 'verified' && (
                <span className={styles.complianceBadge}>
                  🔞 21+ Age Verified
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <Link to="/account/profile" className={styles.editProfileBtn}>
            <span>✏️</span>
            <span>Edit Profile</span>
          </Link>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className={styles.statsRow}>
        <Link to="/cart" className={styles.statCard}>
          <div className={styles.statIconWrapper}>🛒</div>
          <div className={styles.statInfo}>
            <span className={styles.statNumber}>{totalItems}</span>
            <span className={styles.statLabel}>Items in Cart ({formatINR(subtotal)})</span>
          </div>
        </Link>

        <Link to="/account/orders" className={styles.statCard}>
          <div className={styles.statIconWrapper}>📦</div>
          <div className={styles.statInfo}>
            <span className={styles.statNumber}>{orders.length}</span>
            <span className={styles.statLabel}>Total Orders Placed</span>
          </div>
        </Link>

        <Link to="/account/wishlist" className={styles.statCard}>
          <div className={styles.statIconWrapper}>❤️</div>
          <div className={styles.statInfo}>
            <span className={styles.statNumber}>{wishlist.length}</span>
            <span className={styles.statLabel}>Saved in Wishlist</span>
          </div>
        </Link>

        <Link to="/account/addresses" className={styles.statCard}>
          <div className={styles.statIconWrapper}>📍</div>
          <div className={styles.statInfo}>
            <span className={styles.statNumber}>{addresses.length}</span>
            <span className={styles.statLabel}>Saved Addresses</span>
          </div>
        </Link>
      </div>

      {/* Account Sections Grid */}
      <div>
        <h2 className={styles.sectionTitle}>
          <span>⚙️</span>
          <span>Account Settings & Services</span>
        </h2>

        <div className={styles.cardsGrid}>
          {/* My Profile */}
          <Link to="/account/profile" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>👤</div>
              <div>
                <h3 className={styles.cardTitle}>My Profile</h3>
                <p className={styles.cardDesc}>
                  Manage your personal details, email, birthday, and connoisseur badge.
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>Manage Profile</span>
              <span>→</span>
            </div>
          </Link>

          {/* Saved Addresses */}
          <Link to="/account/addresses" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>📍</div>
              <div>
                <h3 className={styles.cardTitle}>Saved Addresses</h3>
                <p className={styles.cardDesc}>
                  {defaultAddress
                    ? `Default: ${defaultAddress.city}, ${defaultAddress.state} (${defaultAddress.pinCode})`
                    : 'Add and manage your home, office, and party delivery destinations.'}
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>Manage Addresses ({addresses.length})</span>
              <span>→</span>
            </div>
          </Link>

          {/* My Orders */}
          <Link to="/account/orders" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>📦</div>
              <div>
                <h3 className={styles.cardTitle}>My Orders</h3>
                <p className={styles.cardDesc}>
                  Track your wine and spirits deliveries, view invoices, and reorder favorites.
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>View Orders</span>
              <span>→</span>
            </div>
          </Link>

          {/* Wishlist */}
          <Link to="/account/wishlist" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>❤️</div>
              <div>
                <h3 className={styles.cardTitle}>Wishlist</h3>
                <p className={styles.cardDesc}>
                  Keep track of premium reserves and special bottles you plan to taste next.
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>View Wishlist ({wishlist.length})</span>
              <span>→</span>
            </div>
          </Link>

          {/* Coupons & Offers */}
          <Link to="/account/coupons" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>🎟️</div>
              <div>
                <h3 className={styles.cardTitle}>Coupons & Offers</h3>
                <p className={styles.cardDesc}>
                  Active promotional discount vouchers and member-only rewards.
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>View Coupons</span>
              <span>→</span>
            </div>
          </Link>

          {/* Notifications */}
          <Link to="/account/notifications" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>🔔</div>
              <div>
                <h3 className={styles.cardTitle}>Notifications</h3>
                <p className={styles.cardDesc}>
                  {unreadNotificationsCount > 0
                    ? `You have ${unreadNotificationsCount} unread update(s).`
                    : 'Stay tuned for order milestones and release alerts.'}
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>View Alerts</span>
              <span>→</span>
            </div>
          </Link>

          {/* Account Privacy */}
          <Link to="/account/privacy" className={styles.actionCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardIcon}>🔒</div>
              <div>
                <h3 className={styles.cardTitle}>Account Privacy</h3>
                <p className={styles.cardDesc}>
                  Manage your data permissions, device sessions, and account deletion requests.
                </p>
              </div>
            </div>
            <div className={styles.cardLinkText}>
              <span>Privacy Controls</span>
              <span>→</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
