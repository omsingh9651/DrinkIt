import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'customer_token';

/**
 * Extract customer token from Authorization header or cookie
 * Explicit Authorization: Bearer <token> takes precedence over ambient cookies
 */
export function extractCustomerToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

/**
 * Extract admin token from Authorization header or admin_token cookie
 */
export function extractAdminToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }
  return null;
}

/**
 * Middleware: Require valid Customer JWT
 * Rejects with 401 if missing, invalid, expired, or tampered.
 */
export function requireCustomerAuth(req, res, next) {
  const token = extractCustomerToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in with your mobile number.',
      code: 'AUTH_REQUIRED',
    });
  }

  const secret = process.env.CUSTOMER_JWT_SECRET;
  if (!secret) {
    console.error('CRITICAL: CUSTOMER_JWT_SECRET is not configured on the backend server.');
    return res.status(500).json({
      success: false,
      error: 'Server security configuration error.',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.phone) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication session payload. Please sign in again.',
      });
    }

    const cleanPhone = String(decoded.phone).replace(/\D/g, '').slice(-10);

    req.user = {
      id: decoded.id || `user_${cleanPhone}`,
      phone: cleanPhone,
      role: decoded.role || 'customer',
      token,
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication session expired. Please sign in again.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid or tampered authentication token.',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Middleware: Allow request if authenticated as EITHER Admin OR Customer
 * Sets req.admin if valid admin JWT, or req.user if valid customer JWT.
 * Rejects with 401 if neither is valid.
 */
export function requireAdminOrCustomerAuth(req, res, next) {
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  const customerSecret = process.env.CUSTOMER_JWT_SECRET;

  // 1. Try admin authentication
  const adminToken = extractAdminToken(req);
  if (adminToken && adminSecret) {
    try {
      const decodedAdmin = jwt.verify(adminToken, adminSecret);
      if (decodedAdmin && decodedAdmin.email && decodedAdmin.role) {
        req.admin = {
          id: decodedAdmin.id,
          email: decodedAdmin.email,
          role: decodedAdmin.role,
        };
        return next();
      }
    } catch {
      // Not a valid admin token, proceed to check customer token
    }
  }

  // 2. Try customer authentication
  const customerToken = extractCustomerToken(req);
  if (customerToken && customerSecret) {
    try {
      const decodedCustomer = jwt.verify(customerToken, customerSecret);
      if (decodedCustomer && decodedCustomer.phone) {
        const cleanPhone = String(decodedCustomer.phone).replace(/\D/g, '').slice(-10);
        req.user = {
          id: decodedCustomer.id || `user_${cleanPhone}`,
          phone: cleanPhone,
          role: decodedCustomer.role || 'customer',
          token: customerToken,
        };
        return next();
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Authentication session expired. Please sign in again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid or tampered authentication token.',
        code: 'INVALID_TOKEN',
      });
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please sign in to proceed.',
    code: 'AUTH_REQUIRED',
  });
}

export default {
  requireCustomerAuth,
  requireAdminOrCustomerAuth,
  extractCustomerToken,
  extractAdminToken,
};

