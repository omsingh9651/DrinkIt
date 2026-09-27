import express from 'express';
import { couponService } from '../services/couponService.js';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';

const router = express.Router();

router.use(requireAdmin);

/**
 * GET /api/admin/coupons
 * Fetch all coupons (including inactive and stats)
 */
router.get('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const { search } = req.query;
    const coupons = await couponService.getAllCoupons({ includeInactive: true, search });
    res.json({
      success: true,
      data: coupons,
      total: coupons.length,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch coupons.',
    });
  }
});

/**
 * GET /api/admin/coupons/:id
 */
router.get('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const coupon = await couponService.getCouponById(req.params.id);
    res.json({
      success: true,
      data: coupon,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Coupon not found.',
    });
  }
});

/**
 * POST /api/admin/coupons
 * Create new coupon
 */
router.post('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const coupon = await couponService.createCoupon(req.body);
    res.status(201).json({
      success: true,
      message: `Coupon code "${coupon.code}" created successfully.`,
      data: coupon,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to create coupon.',
    });
  }
});

/**
 * PUT /api/admin/coupons/:id
 */
router.put('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const updated = await couponService.updateCoupon(req.params.id, req.body);
    res.json({
      success: true,
      message: `Coupon "${updated.code}" updated successfully.`,
      data: updated,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update coupon.',
    });
  }
});

/**
 * DELETE /api/admin/coupons/:id
 */
router.delete('/:id', requireRole([ADMIN_ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const result = await couponService.deleteCoupon(req.params.id);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to delete coupon.',
    });
  }
});

export default router;

