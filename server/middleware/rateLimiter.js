import rateLimit from 'express-rate-limit';

export const RATE_LIMIT_MESSAGE = 'Too many OTP attempts. Please try again after 15 minutes.';

/**
 * Rate limiter for sending/retrying OTPs
 * Max 5 OTP requests per 15-minute window per IP to prevent SMS spam and billing abuse.
 */
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  statusCode: 429,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: RATE_LIMIT_MESSAGE,
      retryAfter: 900,
    });
  },
});

/**
 * Rate limiter for verifying OTPs
 * Max 10 verification attempts per 15-minute window per IP to prevent brute-force attacks.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many verification attempts. Please wait a few minutes before trying again.',
      retryAfter: 900,
    });
  },
});

