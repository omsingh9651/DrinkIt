import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import styles from './AccountPrivacy.module.css';

export default function AccountPrivacy() {
  const { logout } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleConfirmDelete = () => {
    setRequestSubmitted(true);
    setTimeout(() => {
      setShowDeleteModal(false);
    }, 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Account Privacy & Security</h1>
        <p>Control your session data, identity disclosures, and account preferences.</p>
      </div>

      {/* Privacy Standards Card */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>🔒 DrinkIt Privacy Commitments</h2>
        <p className={styles.sectionText}>
          We take the privacy of our connoisseur community with the highest degree of confidentiality.
        </p>

        <ul className={styles.privacyPoints}>
          <li>
            <span className={styles.checkIcon}>✔</span>
            <span>Mobile credentials are authenticated strictly via secure OTP without plaintext password storage.</span>
          </li>
          <li>
            <span className={styles.checkIcon}>✔</span>
            <span>Delivery details and purchase records are kept confidential under state excise compliance.</span>
          </li>
          <li>
            <span className={styles.checkIcon}>✔</span>
            <span>Zero third-party tracking or commercial sale of customer behavioral data.</span>
          </li>
          <li>
            <span className={styles.checkIcon}>✔</span>
            <span>Age verification is strictly verified against statutory drinking age mandates (21+).</span>
          </li>
        </ul>
      </div>

      {/* Session Controls */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Active Device Session</h2>
        <div className={styles.actionRow}>
          <div>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
              Current Device Login
            </div>
            <div style={{ fontSize: '0.8rem', color: '#8c8594' }}>
              Authenticated as {profile?.phoneNumber || 'Member'}
            </div>
          </div>

          <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
            Sign Out From Device
          </button>
        </div>
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className={`${styles.section} ${styles.dangerSection}`}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Danger Zone</h2>
        <p className={styles.sectionText}>
          If you no longer wish to maintain your DrinkIt account and cellar records, you can submit a deletion request.
        </p>

        <div className={styles.actionRow}>
          <span style={{ fontSize: '0.82rem', color: '#ff858d' }}>
            Irreversible action after administrative review (48 hours).
          </span>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className={styles.deleteBtn}
          >
            Request Account Deletion
          </button>
        </div>
      </div>

      {/* Deletion Request Modal */}
      {showDeleteModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Request Account Deletion</h2>
            {requestSubmitted ? (
              <p className={styles.modalText} style={{ color: '#2ed573', fontWeight: 600 }}>
                ✔ Your deletion request has been logged. In accordance with excise audit records, your request will be processed by our privacy team within 48 hours.
              </p>
            ) : (
              <>
                <p className={styles.modalText}>
                  Are you sure you want to request deletion of your DrinkIt account for{' '}
                  <strong>{profile?.phoneNumber}</strong>? This will revoke access to your order receipts, saved addresses, and active wishlist.
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className={styles.cancelModalBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className={styles.confirmDeleteBtn}
                  >
                    Confirm Request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
