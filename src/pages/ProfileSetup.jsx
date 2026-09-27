import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import styles from './ProfileSetup.module.css';

const AVATAR_OPTIONS = ['🥃', '🍷', '🍸', '🍺', '🍾', '🥂', '👤'];

/**
 * Calculate age from date string (YYYY-MM-DD)
 */
function calculateAge(dobString) {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useUser();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [profileImage, setProfileImage] = useState(profile?.profileImage || '🥃');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Phone number from verified session
  const phoneNumber = user?.phoneNumber || profile?.phoneNumber || '';

  // Age validation
  const calculatedAge = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);
  const isUnderage = calculatedAge !== null && calculatedAge < 21;
  const isEligibleAge = calculatedAge !== null && calculatedAge >= 21;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!dateOfBirth) {
      setErrorMessage('Please provide your date of birth for age verification.');
      return;
    }

    if (calculatedAge === null || calculatedAge > 120 || calculatedAge < 10) {
      setErrorMessage('Please provide a realistic and valid date of birth.');
      return;
    }

    if (calculatedAge < 21) {
      setErrorMessage('You must be at least 21 years of age to purchase alcoholic beverages on DrinkIt.');
      return;
    }

    setSubmitting(true);

    try {
      await updateProfile({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        dateOfBirth,
        gender: gender || 'Prefer not to say',
        profileImage: profileImage || '🥃',
        ageVerificationStatus: 'verified',
        profileCompleted: true,
      });

      // Navigate to customer account dashboard
      navigate('/account', { replace: true });
    } catch (err) {
      console.error('Failed to complete profile setup:', err);
      setErrorMessage(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconBadge}>🍸</div>
          <h1 className={styles.title}>Complete Your Profile</h1>
          <p className={styles.subtitle}>
            Tell us a little about yourself to personalize your DrinkIt experience and enable fast doorstep delivery.
          </p>
        </div>

        {errorMessage && (
          <div className={styles.errorBanner} role="alert">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Avatar Selector */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarPreview}>
              {profileImage}
            </div>
            <div>
              <div className={styles.label} style={{ marginBottom: '0.4rem' }}>
                Choose Your Connoisseur Badge
              </div>
              <div className={styles.avatarOptions}>
                {AVATAR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.avatarChoiceBtn} ${
                      profileImage === opt ? styles.avatarChoiceActive : ''
                    }`}
                    onClick={() => setProfileImage(opt)}
                    aria-label={`Select avatar ${opt}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div className={styles.fieldGroup}>
            <label htmlFor="full-name" className={styles.label}>
              Full Name *
            </label>
            <input
              id="full-name"
              type="text"
              required
              autoFocus
              placeholder="e.g. Vikramaditya Rathore"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.input}
              disabled={submitting}
            />
          </div>

          {/* Email Address */}
          <div className={styles.fieldGroup}>
            <label htmlFor="email-address" className={styles.label}>
              Email Address *
            </label>
            <input
              id="email-address"
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              disabled={submitting}
            />
          </div>

          {/* Mobile Number (Read-only from verified MSG91 session) */}
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="phone-number" className={styles.label}>
                Mobile Number
              </label>
              <span className={styles.verifiedBadge}>
                <span>✔</span> Verified via OTP
              </span>
            </div>
            <input
              id="phone-number"
              type="text"
              readOnly
              value={phoneNumber || 'Verified Mobile'}
              className={`${styles.input} ${styles.readOnlyInput}`}
            />
          </div>

          {/* Date of Birth & Gender Grid */}
          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label htmlFor="dob" className={styles.label}>
                Date of Birth *
              </label>
              <input
                id="dob"
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={styles.input}
                disabled={submitting}
              />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="gender" className={styles.label}>
                  Gender
                </label>
                <span className={styles.optionalTag}>Optional</span>
              </div>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={styles.input}
                disabled={submitting}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Age Verification Compliance Card */}
          <div className={styles.ageNoticeCard}>
            <div className={styles.ageNoticeIcon}>🔞</div>
            <div>
              <div className={styles.ageNoticeTitle}>Statutory Age Verification</div>
              <p className={styles.ageNoticeText}>
                In compliance with state excise laws, alcoholic beverages can only be ordered and received by adults of legal drinking age (21+ years). Physical government ID will be verified upon delivery.
              </p>
              {isEligibleAge && (
                <div className={styles.ageStatusSuccess}>
                  ✔ Age Verified ({calculatedAge} years old) — Eligible for DrinkIt Reserve
                </div>
              )}
              {isUnderage && (
                <div className={styles.ageStatusUnderage}>
                  ⛔ Must be at least 21 years of age. Current age: {calculatedAge} years.
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || isUnderage}
          >
            {submitting ? 'Saving Profile...' : 'Complete Profile & Enter Store →'}
          </button>
        </form>
      </div>
    </div>
  );
}
