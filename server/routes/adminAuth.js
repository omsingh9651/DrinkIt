import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAdmin, ADMIN_ROLES } from '../middleware/adminAuth.js';
import { adminUserRepository } from '../repositories/adminUserRepository.js';
import { activityLogRepository } from '../repositories/activityLogRepository.js';

const router = Router();

const COOKIE_NAME = 'admin_token';
const TOKEN_EXPIRY = '24h';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Helper to build standard cookie options
 */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
}

/**
 * POST /api/admin/auth/login
 * Admin sign-in with email & password. Authenticates against adminUserRepository, sets HTTP-only secure cookie.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password.',
      });
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
      console.error('CRITICAL: ADMIN_JWT_SECRET missing in server environment.');
      return res.status(503).json({
        success: false,
        error: 'Admin authentication is not configured on the server.',
      });
    }

    const normalizedInputEmail = String(email).trim().toLowerCase();

    // Check adminUserRepository first
    let adminRecord = await adminUserRepository.getByEmail(normalizedInputEmail);

    // Fallback: check environment variable if not yet registered in adminUserRepository
    const configEmail = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim().toLowerCase() : null;
    const configHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminRecord && configEmail && normalizedInputEmail === configEmail && configHash) {
      adminRecord = {
        email: configEmail,
        passwordHash: configHash,
        role: ADMIN_ROLES.SUPER_ADMIN,
        name: 'Super Administrator',
        isActive: true,
      };
    }

    if (!adminRecord) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator email or password.',
      });
    }

    if (adminRecord.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'This administrator account has been deactivated. Contact a Super Admin.',
      });
    }

    // Compare password with bcrypt hash
    const isMatch = await bcrypt.compare(String(password), adminRecord.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator email or password.',
      });
    }

    // Update lastLogin
    await adminUserRepository.updateLastLogin(adminRecord.email);

    // Create signed JWT
    const tokenPayload = {
      id: adminRecord.id || adminRecord._id,
      email: adminRecord.email,
      name: adminRecord.name || 'Administrator',
      role: adminRecord.role || ADMIN_ROLES.SUPER_ADMIN,
    };

    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: TOKEN_EXPIRY });

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    // Record login audit in ActivityLog
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    await activityLogRepository.logAction({
      adminEmail: adminRecord.email,
      adminRole: adminRecord.role || 'admin',
      action: 'LOGIN',
      module: 'AUTH',
      targetId: adminRecord.email,
      description: `Administrator ${adminRecord.name || adminRecord.email} signed in successfully`,
      metadata: { role: adminRecord.role },
      ipAddress: clientIp,
    });

    // Return safe user payload (NO tokens, NO hashes in JSON)
    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful.',
      admin: {
        id: adminRecord.id || adminRecord._id,
        email: adminRecord.email,
        name: adminRecord.name || 'Administrator',
        role: adminRecord.role || ADMIN_ROLES.SUPER_ADMIN,
      },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected authentication error occurred. Please try again.',
    });
  }
});

/**
 * POST /api/admin/auth/logout
 * Clears the HTTP-only admin cookie.
 */
router.post('/logout', (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Admin session terminated successfully.',
    });
  } catch (err) {
    console.error('Admin logout error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to logout session.',
    });
  }
});

/**
 * GET /api/admin/auth/me
 * Returns current authenticated admin profile. Protected.
 */
router.get('/me', requireAdmin, async (req, res) => {
  try {
    const freshRecord = await adminUserRepository.getByEmail(req.admin.email);
    return res.status(200).json({
      success: true,
      admin: {
        id: freshRecord?.id || req.admin.id,
        email: req.admin.email,
        name: freshRecord?.name || req.admin.name || 'Administrator',
        role: freshRecord?.role || req.admin.role,
        isActive: freshRecord?.isActive !== false,
      },
    });
  } catch {
    return res.status(200).json({
      success: true,
      admin: {
        email: req.admin.email,
        role: req.admin.role,
      },
    });
  }
});

export default router;
