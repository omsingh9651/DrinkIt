import { useState } from 'react';
import { useUser } from '../../context/UserContext';
import styles from './AccountProfile.module.css';

const AVATAR_OPTIONS = ['🥃', '🍷', '🍸', '🍺', '🍾', '🥂', '👤'];

export default function AccountProfile() {
  const { profile, updateProfile } = useUser();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [gender, setGender] = useState(profile?.gender || 'Prefer not to say');
  const [profileImage, setProfileImage] = useState(profile?.profileImage || '🥃');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await updateProfile({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        dateOfBirth,
        gender,
        profileImage,
      });
      showToast('✔ Profile details updated successfully!');
    } catch (err) {
      console.error('Failed to update profile:', err);
      showToast('⚠️ Error updating profile details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {toastMessage && (
        <div className={styles.toast}>
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className={styles.header}>
        <h1>Personal Profile</h1>
        <p>Review and edit your DrinkIt customer details.</p>
      </div>

      <form onSubmit={handleSave} className={styles.form}>
        {/* Avatar Selection */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarPreview}>{profileImage}</div>
          <div>
            <div className={styles.label} style={{ marginBottom: '0.4rem' }}>
              Connoisseur Badge
            </div>
            <div className={styles.avatarOptions}>
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.avatarBtn} ${
                    profileImage === opt ? styles.avatarBtnActive : ''
                  }`}
                  onClick={() => setProfileImage(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div className={styles.fieldGroup}>
          <label htmlFor="fullName" className={styles.label}>
            Full Name *
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={styles.input}
          />
        </div>

        {/* Email */}
        <div className={styles.fieldGroup}>
          <label htmlFor="email" className={styles.label}>
            Email Address *
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
        </div>

        {/* Mobile Number (Read-only) */}
        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label htmlFor="phone" className={styles.label}>
              Verified Mobile Number
            </label>
            <span className={styles.verifiedBadge}>✔ Verified via OTP</span>
          </div>
          <input
            id="phone"
            type="text"
            readOnly
            value={profile?.phoneNumber || ''}
            className={`${styles.input} ${styles.readOnlyInput}`}
          />
        </div>

        {/* Date of Birth & Gender */}
        <div className={styles.grid2}>
          <div className={styles.fieldGroup}>
            <label htmlFor="dob" className={styles.label}>
              Date of Birth
            </label>
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="gender" className={styles.label}>
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={styles.input}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <button type="submit" className={styles.saveBtn} disabled={submitting}>
          {submitting ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
