import jwt from 'jsonwebtoken';

/**
 * Standard Role Definitions for DrinkIt Admin Platform
 */
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STORE_MANAGER: 'admin',
  INVENTORY_MANAGER: 'inventory_manager',
  ORDER_MANAGER: 'order_manager',
  CONTENT_MANAGER: 'content_manager',
};

/**
 * Extract token from HTTP-only cookie or Authorization header
 */
function extractToken(req) {
  const authHeader = req.headers?.authorization;
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
 * Middleware: Verify Admin Authentication
 * Rejects with 401 if missing, expired, or invalid. Rejects with 403 if customer token.
 */
export function requireAdmin(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to the DrinkIt Admin portal.',
    });
  }

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    console.error('CRITICAL: ADMIN_JWT_SECRET is not configured on the backend server.');
    return res.status(500).json({
      success: false,
      error: 'Server security configuration error.',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    // Validate payload
    if (!decoded || !decoded.email || !decoded.role) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session payload. Please log in again.',
      });
    }

    if (decoded.role === 'customer') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Customer accounts are not permitted to perform administrator actions.',
      });
    }

    // Attach verified admin identity to request object
    req.admin = {
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Admin session expired. Please sign in again.',
      });
    }

    // Check if token was signed with customer JWT secret
    const customerSecret = process.env.CUSTOMER_JWT_SECRET;
    if (customerSecret) {
      try {
        const decodedCustomer = jwt.verify(token, customerSecret);
        if (decodedCustomer && (decodedCustomer.phone || decodedCustomer.role === 'customer')) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. Customer accounts are not permitted to perform administrator actions.',
          });
        }
      } catch {
        // Not a valid customer token
      }
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
    });
  }
}

/**
 * Middleware: Role-Based Authorization
 * Checks if authenticated admin has one of the allowed roles.
 *
 * Example:
 *   router.delete('/:id', requireAdmin, requireRole('super_admin', 'admin'), handler);
 */
export function requireRole(...allowedRoles) {
  const flattened = allowedRoles.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    // Super Admin always has full access
    if (req.admin.role === ADMIN_ROLES.SUPER_ADMIN) {
      return next();
    }

    if (flattened.includes(req.admin.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access denied. Requires one of roles: ${flattened.join(', ')}.`,
    });
  };
}
