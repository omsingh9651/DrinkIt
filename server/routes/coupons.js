import express from 'express';
import { couponService } from '../services/couponService.js';

const router = express.Router();

/**
 * POST /api/coupons/validate
 * Validate coupon code and return calculated discount for customer checkout
 */
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal, customerPhone } = req.body;
    const result = await couponService.validateAndCalculateDiscount({
      code,
      subtotal,
      customerPhone,
    });

    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        message: result.reason,
        discount: 0,
      });
    }

    res.json({
      success: true,
      message: `Coupon "${result.coupon.code}" applied successfully!`,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to validate coupon code.',
    });
  }
});

/**
 * GET /api/coupons/available
 * List publicly available promo coupons for customer storefront
 */
router.get('/available', async (req, res) => {
  try {
    const coupons = await couponService.getAllCoupons({ includeInactive: false });
    // Filter out expired coupons
    const now = new Date();
    const activeValid = coupons.filter(
      (c) => (!c.expiryDate || new Date(c.expiryDate) >= now) && (!c.startDate || new Date(c.startDate) <= now)
    );

    res.json({
      success: true,
      data: activeValid.map((c) => ({
        code: c.code,
        title: c.title,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderValue: c.minOrderValue,
        maxDiscountAmount: c.maxDiscountAmount,
        expiryDate: c.expiryDate,
      })),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch available coupons.',
    });
  }
});

export default router;

