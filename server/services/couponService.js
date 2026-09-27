import { couponRepository } from '../repositories/couponRepository.js';

export class CouponService {
  async getAllCoupons(options = {}) {
    return await couponRepository.getAll(options);
  }

  async getCouponById(id) {
    const coupon = await couponRepository.getById(id);
    if (!coupon) {
      const err = new Error('Coupon not found.');
      err.statusCode = 404;
      throw err;
    }
    return coupon;
  }

  async getCouponByCode(code) {
    const coupon = await couponRepository.getByCode(code);
    if (!coupon) {
      const err = new Error('Coupon not found.');
      err.statusCode = 404;
      throw err;
    }
    return coupon;
  }

  async createCoupon(data) {
    if (!data.code || !data.code.trim()) {
      const err = new Error('Coupon code is required.');
      err.statusCode = 400;
      throw err;
    }

    const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existing = await couponRepository.getByCode(cleanCode);
    if (existing) {
      const err = new Error(`Coupon code "${cleanCode}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    return await couponRepository.create({
      ...data,
      code: cleanCode,
    });
  }

  async updateCoupon(id, data) {
    if (data.code) {
      const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const existing = await couponRepository.getByCode(cleanCode);
      if (existing && existing.id !== id) {
        const err = new Error(`Coupon code "${cleanCode}" is already in use.`);
        err.statusCode = 409;
        throw err;
      }
    }

    return await couponRepository.update(id, data);
  }

  async deleteCoupon(id) {
    return await couponRepository.delete(id);
  }

  /**
   * Validate coupon code and calculate discount amount
   */
  async validateAndCalculateDiscount({ code, subtotal, customerPhone = '' }) {
    if (!code || !code.trim()) {
      return { isValid: false, discount: 0, reason: 'No coupon code provided.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await couponRepository.getByCode(cleanCode);

    if (!coupon) {
      return {
        isValid: false,
        discount: 0,
        reason: `Coupon code "${cleanCode}" is invalid.`,
      };
    }

    if (!coupon.isActive) {
      return {
        isValid: false,
        discount: 0,
        reason: `Coupon "${cleanCode}" is currently inactive.`,
      };
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return {
        isValid: false,
        discount: 0,
        reason: `Coupon "${cleanCode}" is not yet active.`,
      };
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      return {
        isValid: false,
        discount: 0,
        reason: `Coupon "${cleanCode}" has expired.`,
      };
    }

    const numSubtotal = Number(subtotal) || 0;
    if (coupon.minOrderValue && numSubtotal < coupon.minOrderValue) {
      return {
        isValid: false,
        discount: 0,
        reason: `Minimum order amount of ₹${coupon.minOrderValue} required for coupon "${cleanCode}".`,
      };
    }

    if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
      return {
        isValid: false,
        discount: 0,
        reason: `Coupon "${cleanCode}" has reached its maximum total redemptions.`,
      };
    }

    if (customerPhone && coupon.perCustomerLimit && coupon.usedBy && Array.isArray(coupon.usedBy)) {
      const cleanPhone = String(customerPhone).slice(-10);
      const userUses = coupon.usedBy.filter((u) => u.customerPhone === cleanPhone).length;
      if (userUses >= coupon.perCustomerLimit) {
        return {
          isValid: false,
          discount: 0,
          reason: `You have reached the maximum usage limit (${coupon.perCustomerLimit}) for code "${cleanCode}".`,
        };
      }
    }

    let calculatedDiscount;
    if (coupon.discountType === 'PERCENTAGE') {
      calculatedDiscount = Math.round((numSubtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount && calculatedDiscount > coupon.maxDiscountAmount) {
        calculatedDiscount = coupon.maxDiscountAmount;
      }
    } else {
      // FIXED
      calculatedDiscount = Math.min(numSubtotal, coupon.discountValue);
    }

    return {
      isValid: true,
      discount: calculatedDiscount,
      coupon: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
      },
      newSubtotal: Math.max(0, numSubtotal - calculatedDiscount),
    };
  }

  /**
   * Record coupon redemption after successful order creation
   */
  async recordCouponUsage({ code, customerPhone, orderId }) {
    if (!code) return;
    await couponRepository.recordUsage({ code, customerPhone, orderId });
  }
}

export const couponService = new CouponService();
export default couponService;
