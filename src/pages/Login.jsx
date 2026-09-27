import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendOtp, verifyOtp, retryOtp } from '../services/authApi';
import { getCustomerProfile } from '../services/userApi';
import styles from './Login.module.css';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_SECONDS = 60;
const STANDARD_COOLDOWN_SECONDS = 30;
const RATE_LIMIT_MESSAGE = 'Too many OTP attempts. Please try again after 15 minutes.';
const RATE_LIMIT_STORAGE_KEY = 'drinkit_otp_rate_limit_until';

/**
 * Helper to format seconds to MM:SS string
 */
function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function Login() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loginUser, logout, isServerConfigured } = useAuth();

  // Screen state: 'phone' (Screen 1) | 'otp' (Screen 2) | 'success' (Screen 3)
  const [step, setStep] = useState('phone');

  // Phone input state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Request ID from server sendOtp
  const [reqId, setReqId] = useState(null);

  // OTP state (array of 4 strings)
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Rate limit countdown (15 minutes / 900 seconds)
  const [rateLimitSeconds, setRateLimitSeconds] = useState(() => {
    try {
      const storedUntil = sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (storedUntil) {
        const remaining = Math.ceil((Number(storedUntil) - Date.now()) / 1000);
        if (remaining > 0) return remaining;
        sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return 0;
  });

  // Standard cooldown timer for Send OTP button (e.g. 30s)
  const [sendCooldown, setSendCooldown] = useState(0);

  // Countdown timer for Resend OTP (canResend when timer is 0)
  const [timer, setTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const canResend = timer === 0;

  // Rapid double-click protection ref
  const isSubmittingRef = useRef(false);

  // General error or info banner
  const [generalError, setGeneralError] = useState(() => {
    try {
      const storedUntil = sessionStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (storedUntil && Number(storedUntil) > Date.now()) {
        return RATE_LIMIT_MESSAGE;
      }
    } catch {
      // Ignore storage errors
    }
    return '';
  });
  const [successMessage, setSuccessMessage] = useState('');

  // Refs for OTP input boxes
  const otpInputsRef = useRef([]);

  // Rate limit countdown effect
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
          } catch {
            // Ignore storage errors
          }
          setGeneralError((err) => (err === RATE_LIMIT_MESSAGE ? '' : err));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  // Standard Send OTP button cooldown effect
  useEffect(() => {
    if (sendCooldown <= 0) return;
    const interval = setInterval(() => {
      setSendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [sendCooldown]);

  // 60-second countdown effect for Screen 2
  useEffect(() => {
    if (step !== 'otp' || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  // Focus first OTP input when transitioning to Screen 2
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        if (otpInputsRef.current[0]) {
          otpInputsRef.current[0].focus();
        }
      }, 150);
    }
  }, [step]);

  /**
   * Helper to activate rate limit countdown
   */
  const triggerRateLimit = (seconds = 900) => {
    const duration = Number(seconds) > 0 ? Number(seconds) : 900;
    const until = Date.now() + duration * 1000;
    try {
      sessionStorage.setItem(RATE_LIMIT_STORAGE_KEY, String(until));
    } catch {
      // Ignore storage error
    }
    setRateLimitSeconds(duration);
    setGeneralError(RATE_LIMIT_MESSAGE);
  };

  /**
   * Helper to format masked mobile number:
   * e.g. "9876543210" -> "+91 98765 •••••"
   */
  const getMaskedPhone = (num) => {
    if (!num || num.length < 10) return '+91 ••••• •••••';
    return `+91 ${num.slice(0, 5)} •••••`;
  };

  /**
   * Phone number input change handler:
   * Restricts to numbers only and max 10 digits
   */
  const handlePhoneChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (rawVal.length <= 10) {
      setPhoneNumber(rawVal);
      if (phoneError) setPhoneError('');
      if (generalError && rateLimitSeconds <= 0) setGeneralError('');
    }
  };

  /**
   * Screen 1: Send OTP handler via DrinkIt Backend API
   */
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();

    // Prevent duplicate API requests caused by double-clicking or rapid clicks
    if (isSubmittingRef.current || isSendingOtp || rateLimitSeconds > 0 || sendCooldown > 0) {
      return;
    }

    // Validation for 10-digit Indian numbers starting with 6-9
    if (!phoneNumber) {
      setPhoneError('Please enter your 10-digit mobile number.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      setPhoneError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSendingOtp(true);
    setPhoneError('');
    setGeneralError('');

    try {
      const response = await sendOtp(phoneNumber);
      if (response.reqId) {
        setReqId(response.reqId);
      }
      setStep('otp');
      setTimer(RESEND_COOLDOWN_SECONDS);
      setSendCooldown(STANDARD_COOLDOWN_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      setOtpError('');
    } catch (err) {
      console.error('sendOtp error:', err);
      const isRateLimit =
        err.status === 429 ||
        err.statusCode === 429 ||
        /too many|rate limit|15 minutes/i.test(err.message || '');

      if (isRateLimit) {
        triggerRateLimit(err.retryAfter || 900);
      } else {
        setGeneralError(err.message || 'Failed to send OTP. Please try again.');
        setSendCooldown(STANDARD_COOLDOWN_SECONDS);
      }
    } finally {
      setIsSendingOtp(false);
      isSubmittingRef.current = false;
    }
  };

  /**
   * Screen 2: OTP input change handler for individual boxes
   */
  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      // Clear current digit
      const nextOtp = [...otp];
      nextOtp[index] = '';
      setOtp(nextOtp);
      return;
    }

    // If pasted string with multiple digits
    if (cleaned.length > 1) {
      const digits = cleaned.slice(0, OTP_LENGTH).split('');
      const nextOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < OTP_LENGTH) nextOtp[i] = d;
      });
      setOtp(nextOtp);
      if (otpError) setOtpError('');
      // Focus last filled box
      const nextFocus = Math.min(digits.length, OTP_LENGTH - 1);
      if (otpInputsRef.current[nextFocus]) {
        otpInputsRef.current[nextFocus].focus();
      }
      return;
    }

    // Single digit input
    const nextOtp = [...otp];
    nextOtp[index] = cleaned[0];
    setOtp(nextOtp);
    if (otpError) setOtpError('');

    // Advance focus to next input
    if (index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  /**
   * Handle Backspace navigation across OTP boxes
   */
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  /**
   * Handle pasting full OTP into any box
   */
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasteData) return;

    const digits = pasteData.slice(0, OTP_LENGTH).split('');
    const nextOtp = [...otp];
    digits.forEach((d, i) => {
      nextOtp[i] = d;
    });
    setOtp(nextOtp);
    if (otpError) setOtpError('');

    const targetIndex = Math.min(digits.length - 1, OTP_LENGTH - 1);
    otpInputsRef.current[targetIndex]?.focus();
  };

  /**
   * Screen 2: Verify OTP via DrinkIt Backend API
   */
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();

    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      setOtpError('Please enter the complete 4-digit OTP sent to your phone.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');
    setGeneralError('');

    try {
      const response = await verifyOtp({
        mobileNumber: phoneNumber,
        otp: otpCode,
        reqId,
      });

      // Check if user has already completed profile
      const userProfile = await getCustomerProfile(phoneNumber);
      const hasCompletedProfile = Boolean(
        userProfile && userProfile.profileCompleted && userProfile.fullName && userProfile.email
      );

      // Authenticate user in DrinkIt app
      loginUser({
        ...(response.user || {}),
        token: response.token || response.user?.token,
        phoneNumber: `+91 ${phoneNumber}`,
        fullName: userProfile?.fullName || '',
      });

      setStep('success');
      setSuccessMessage(`Welcome to DrinkIt! Authenticated as +91 ${phoneNumber}`);

      // Redirect user: First time -> /profile/setup, Returning -> /account
      setTimeout(() => {
        if (hasCompletedProfile) {
          navigate('/account', { replace: true });
        } else {
          navigate('/profile/setup', { replace: true });
        }
      }, 1100);
    } catch (err) {
      console.error('verifyOtp error:', err);
      setOtpError(err.message || 'Invalid verification code. Please check your SMS and try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  /**
   * Screen 2: Resend OTP via DrinkIt Backend API
   */
  const handleResendOtp = async () => {
    if (!canResend || isSendingOtp || isSubmittingRef.current || rateLimitSeconds > 0) return;

    isSubmittingRef.current = true;
    setIsSendingOtp(true);
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setGeneralError('');

    try {
      await retryOtp({
        mobileNumber: phoneNumber,
        reqId,
      });
      setTimer(RESEND_COOLDOWN_SECONDS);
      setSendCooldown(STANDARD_COOLDOWN_SECONDS);
    } catch (err) {
      console.error('retryOtp error:', err);
      const isRateLimit =
        err.status === 429 ||
        err.statusCode === 429 ||
        /too many|rate limit|15 minutes/i.test(err.message || '');

      if (isRateLimit) {
        triggerRateLimit(err.retryAfter || 900);
      } else {
        setGeneralError(err.message || 'Failed to resend OTP. Please try again.');
        setTimer(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setIsSendingOtp(false);
      isSubmittingRef.current = false;
    }
  };

  /**
   * Screen 2: Change Mobile Number (back to Screen 1)
   */
  const handleChangeNumber = () => {
    setStep('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setGeneralError('');
  };

  // If already authenticated and visiting /login directly
  if (isAuthenticated && step !== 'success') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              🥃 DrinkIt
            </Link>
            <div className={styles.avatarIcon}>👤</div>
            <h1 className={styles.title}>You are Logged In</h1>
            <p className={styles.loggedInPhone}>
              {user?.phoneNumber || `+91 ${phoneNumber}` || 'Connoisseur Member'}
            </p>
          </div>

          <div className={styles.buttonStack}>
            <Link to="/products" className={styles.primaryActionBtn}>
              Explore The Cellar →
            </Link>
            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={async () => {
                await logout();
                setStep('phone');
              }}
            >
              Sign Out of Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Brand Header */}
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>
            🥃 DrinkIt
          </Link>
        </div>

        {/* Global Config Warning Banner */}
        {!isServerConfigured && !generalError && rateLimitSeconds <= 0 && (
          <div className={styles.alertError} role="alert">
            <span className={styles.alertIcon}>ℹ️</span>
            <div className={styles.alertBody}>
              <p>
                DrinkIt backend is active. Please configure <strong>MSG91_AUTH_KEY</strong> and{' '}
                <strong>MSG91_WIDGET_ID</strong> in <code>server/.env</code> to send real SMS OTPs.
              </p>
            </div>
          </div>
        )}

        {/* Rate Limit Active Banner with Live Countdown */}
        {rateLimitSeconds > 0 && (
          <div className={styles.alertRateLimit} role="alert">
            <span className={styles.alertIcon}>⏳</span>
            <div className={styles.alertBody}>
              <p className={styles.rateLimitHeading}>Too many OTP attempts. Please try again after 15 minutes.</p>
              <div className={styles.rateLimitBadge}>
                <span className={styles.rateLimitBadgePulse} />
                <span>Try again in <strong>{formatCountdown(rateLimitSeconds)}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {generalError && rateLimitSeconds <= 0 && (
          <div className={styles.alertError} role="alert">
            <span className={styles.alertIcon}>⚠️</span>
            <div className={styles.alertBody}>
              <p>{generalError}</p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 1: ENTER MOBILE NUMBER */}
        {/* ========================================================================= */}
        {step === 'phone' && (
          <div className={styles.screenContent}>
            <div className={styles.titleGroup}>
              <h1 className={styles.title}>Login to DrinkIt</h1>
              <p className={styles.subtitle}>Enter your mobile number to receive a secure OTP</p>
            </div>

            <form onSubmit={handleSendOtp} className={styles.form} noValidate>
              <div className={styles.inputSection}>
                <label htmlFor="phone-input" className={styles.inputLabel}>
                  Mobile Number
                </label>

                <div
                  className={`${styles.phoneInputRow} ${
                    phoneError ? styles.inputRowError : ''
                  }`}
                >
                  {/* Country Code Selector (Fixed to +91 India) */}
                  <div className={styles.countryPicker} title="India (+91)">
                    <span className={styles.flagIcon} aria-hidden="true">
                      🇮🇳
                    </span>
                    <span className={styles.countryCode}>+91</span>
                    <span className={styles.countryDivider} />
                  </div>

                  {/* 10-Digit Mobile Number Input */}
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className={styles.phoneField}
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    maxLength={10}
                    autoFocus
                  />
                </div>

                {phoneError && (
                  <span className={styles.errorText} role="alert">
                    {phoneError}
                  </span>
                )}
                {!phoneError && (
                  <span className={styles.helperText}>
                    Enter 10-digit number starting with 6, 7, 8, or 9
                  </span>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={
                  isSendingOtp ||
                  phoneNumber.length !== 10 ||
                  rateLimitSeconds > 0 ||
                  sendCooldown > 0
                }
              >
                {isSendingOtp ? (
                  <span className={styles.btnLoading}>
                    <span className={styles.spinner} /> Sending OTP...
                  </span>
                ) : rateLimitSeconds > 0 ? (
                  <span>Try again in {formatCountdown(rateLimitSeconds)}</span>
                ) : sendCooldown > 0 ? (
                  <span>Wait {sendCooldown}s</span>
                ) : (
                  'Send OTP →'
                )}
              </button>
            </form>

            <div className={styles.privacyNote}>
              <span>🔒 By continuing, you agree to DrinkIt&apos;s Terms of Service &amp; Privacy Policy.</span>
              <span className={styles.legalAgeNotice}>🔞 Must be 18+ to enter and place orders.</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 2: VERIFY OTP */}
        {/* ========================================================================= */}
        {step === 'otp' && (
          <div className={styles.screenContent}>
            <div className={styles.titleGroup}>
              <h1 className={styles.title}>Verify Mobile Number</h1>
              <div className={styles.maskedNumberRow}>
                <span className={styles.maskedText}>
                  OTP sent to <strong>{getMaskedPhone(phoneNumber)}</strong>
                </span>
                <button
                  type="button"
                  className={styles.changeNumberBtn}
                  onClick={handleChangeNumber}
                >
                  Edit
                </button>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className={styles.form}>
              <div className={styles.otpSection}>
                <label className={styles.inputLabel}>Enter 4-Digit Code</label>

                {/* 4 Individual Digit Inputs */}
                <div className={styles.otpInputsContainer} onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputsRef.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      className={`${styles.otpBox} ${
                        digit ? styles.otpBoxFilled : ''
                      } ${otpError ? styles.otpBoxError : ''}`}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                {otpError && (
                  <span className={styles.errorText} role="alert">
                    {otpError}
                  </span>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isVerifyingOtp || otp.join('').length !== OTP_LENGTH}
              >
                {isVerifyingOtp ? (
                  <span className={styles.btnLoading}>
                    <span className={styles.spinner} /> Verifying &amp; Signing In...
                  </span>
                ) : (
                  'Verify & Continue →'
                )}
              </button>

              {/* Resend OTP Section */}
              <div className={styles.resendSection}>
                {rateLimitSeconds > 0 ? (
                  <div className={styles.rateLimitNotice}>
                    <span>Rate limit active: Resend locked for </span>
                    <strong className={styles.timerCount}>{formatCountdown(rateLimitSeconds)}</strong>
                  </div>
                ) : canResend ? (
                  <button
                    type="button"
                    className={styles.resendBtnActive}
                    onClick={handleResendOtp}
                    disabled={isSendingOtp}
                  >
                    {isSendingOtp ? 'Sending new OTP...' : 'Resend OTP'}
                  </button>
                ) : (
                  <span className={styles.resendTimerText}>
                    Resend OTP in <strong className={styles.timerCount}>{timer}s</strong>
                  </span>
                )}
              </div>

              <div className={styles.changeNumberBottom}>
                <button
                  type="button"
                  className={styles.changeNumberLink}
                  onClick={handleChangeNumber}
                >
                  ← Change mobile number
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCREEN 3: SUCCESS STATE */}
        {/* ========================================================================= */}
        {step === 'success' && (
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>Verification Successful</h2>
            <p className={styles.successSubtitle}>{successMessage}</p>
            <div className={styles.redirectIndicator}>
              <span className={styles.spinner} />
              <span>Redirecting to the Cellar...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
