import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  sendOtp,
  verifyOtp,
  retryOtp,
  isMsg91Configured,
  RATE_LIMIT_MESSAGE,
  isRateLimitResponse,
} from '../services/msg91.js';
import { otpSendLimiter, otpVerifyLimiter } from '../middleware/rateLimiter.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';
import { userRepository } from '../repositories/userRepository.js';

const router = Router();

/**
 * GET /api/auth/status
 * Check if backend has MSG91 properly configured
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    isConfigured: isMsg91Configured(),
  });
});

/**
 * POST /api/auth/send-otp
 * Body: { mobile: '9876543210' }
 */
router.post('/send-otp', otpSendLimiter, async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number is required.',
      });
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);

    // Validate 10-digit Indian number starting with 6-9
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      });
    }

    if (!isMsg91Configured()) {
      return res.status(503).json({
        success: false,
        error: 'MSG91 credentials (MSG91_AUTH_KEY and MSG91_WIDGET_ID) are not configured in server/.env.',
      });
    }

    const result = await sendOtp(cleanMobile);

    return res.status(200).json({
      success: true,
      message: result.message || 'OTP sent successfully.',
      reqId: result.reqId || null,
      mobile: cleanMobile,
    });
  } catch (err) {
    console.error('Server send-otp error:', err);
    const isRateLimit =
      err.isRateLimit ||
      err.statusCode === 429 ||
      isRateLimitResponse(err.statusCode, err.message);

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        error: RATE_LIMIT_MESSAGE,
        retryAfter: err.retryAfter || 900,
      });
    }

    const errorMsg = err.cause
      ? `${err.message} (${err.cause.code || err.cause.message})`
      : (err.message || 'Failed to send OTP. Please try again.');
    return res.status(err.statusCode || 500).json({
      success: false,
      error: errorMsg,
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { mobile: '9876543210', otp: '123456', reqId: '...' }
 */
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    const { mobile, otp, reqId } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        error: 'OTP code is required.',
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{4}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a complete 4-digit OTP.',
      });
    }

    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);

    const result = await verifyOtp({
      reqId,
      otp: cleanOtp,
      mobileNumber: cleanMobile,
    });

    // Issue signed customer JWT with strong 30-day session
    const customerSecret = process.env.CUSTOMER_JWT_SECRET;
    if (!customerSecret) {
      console.error('CRITICAL: CUSTOMER_JWT_SECRET is not configured in server/.env.');
      return res.status(500).json({
        success: false,
        error: 'Server security configuration error.',
      });
    }

    const tokenPayload = {
      id: `user_${cleanMobile}`,
      phone: cleanMobile,
      role: 'customer',
    };
    const token = jwt.sign(tokenPayload, customerSecret, { expiresIn: '30d' });

    // Requirement 8: Ensure customer OTP login creates or updates a User document in MongoDB
    let userDoc = null;
    try {
      userDoc = await userRepository.upsertProfile(cleanMobile, {
        phoneVerified: true,
        lastLoginAt: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn('Could not upsert user profile on verify-otp:', dbErr.message);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('customer_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // Successful authentication
    return res.status(200).json({
      success: true,
      message: result.message || 'Verification successful.',
      token,
      user: {
        id: userDoc?.id || `user_${cleanMobile}`,
        phoneNumber: cleanMobile ? `+91 ${cleanMobile}` : 'Member',
        phone: cleanMobile,
        role: 'customer',
        name: userDoc?.fullName || userDoc?.name || '',
        token,
        authenticatedAt: new Date().toISOString(),
        provider: 'msg91-backend',
      },
    });
  } catch (err) {
    console.error('Server verify-otp error:', err);
    const errorMsg = err.cause
      ? `${err.message} (${err.cause.code || err.cause.message})`
      : (err.message || 'Invalid or expired verification code.');
    return res.status(400).json({
      success: false,
      error: errorMsg,
    });
  }
});

/**
 * POST /api/auth/retry-otp
 * Body: { mobile: '9876543210', reqId: '...' }
 */
router.post('/retry-otp', otpSendLimiter, async (req, res) => {
  try {
    const { mobile, reqId } = req.body;

    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);

    if (!cleanMobile && !reqId) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number or request ID is required for resending OTP.',
      });
    }

    const result = await retryOtp({
      reqId,
      mobileNumber: cleanMobile,
    });

    return res.status(200).json({
      success: true,
      message: result.message || 'OTP resent successfully.',
    });
  } catch (err) {
    console.error('Server retry-otp error:', err);
    const isRateLimit =
      err.isRateLimit ||
      err.statusCode === 429 ||
      isRateLimitResponse(err.statusCode, err.message);

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        error: RATE_LIMIT_MESSAGE,
        retryAfter: err.retryAfter || 900,
      });
    }

    const errorMsg = err.cause
      ? `${err.message} (${err.cause.code || err.cause.message})`
      : (err.message || 'Failed to resend OTP. Please try again.');
    return res.status(err.statusCode || 500).json({
      success: false,
      error: errorMsg,
    });
  }
});

/**
 * GET /api/auth/me
 * Validate current customer JWT and return verified session profile
 */
router.get('/me', requireCustomerAuth, async (req, res) => {
  let profile = null;
  try {
    profile = await userRepository.getByPhone(req.user.phone);
  } catch (e) {
    console.warn('Could not fetch user profile for /me:', e.message);
  }

  return res.json({
    success: true,
    user: {
      id: profile?.id || req.user.id,
      phoneNumber: `+91 ${req.user.phone}`,
      phone: req.user.phone,
      role: req.user.role,
      name: profile?.fullName || profile?.name || '',
      email: profile?.email || '',
      provider: 'msg91-backend',
    },
  });
});

/**
 * POST /api/auth/logout
 * Sign out customer and clear customer session cookie
 */
router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('customer_token', {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  });
  return res.json({
    success: true,
    message: 'Customer session terminated successfully.',
  });
});

export default router;

