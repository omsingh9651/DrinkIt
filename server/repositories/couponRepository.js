import { Coupon } from '../models/Coupon.js';
import { isDbConnected } from '../config/db.js';

const INITIAL_COUPONS = [
  {
    id: 'coup-drinkit10',
    code: 'DRINKIT10',
    title: '10% Off Reserve Catalog',
    description: 'Get 10% instant discount up to ₹500 on all orders above ₹999.',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderValue: 999,
    maxDiscountAmount: 500,
    startDate: new Date('2026-01-01T00:00:00Z'),
    expiryDate: new Date('2026-12-31T23:59:59Z'),
    usageLimit: 10000,
    perCustomerLimit: 5,
    usedCount: 142,
    usedBy: [],
    isActive: true,
  },
  {
    id: 'coup-welcome50',
    code: 'WELCOME50',
    title: 'First Sip Welcome ₹50',
    description: 'Flat ₹50 off on orders of ₹499 and above for all customers.',
    discountType: 'FIXED',
    discountValue: 50,
    minOrderValue: 499,
    maxDiscountAmount: 50,
    startDate: new Date('2026-01-01T00:00:00Z'),
    expiryDate: new Date('2026-12-31T23:59:59Z'),
    usageLimit: 5000,
    perCustomerLimit: 1,
    usedCount: 384,
    usedBy: [],
    isActive: true,
  },
  {
    id: 'coup-reserve20',
    code: 'RESERVE20',
    title: 'VIP Reserve 20% Privilege',
    description: 'Enjoy 20% discount up to ₹1,000 on luxury spirits & wine orders over ₹2,499.',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderValue: 2499,
    maxDiscountAmount: 1000,
    startDate: new Date('2026-01-01T00:00:00Z'),
    expiryDate: new Date('2026-12-31T23:59:59Z'),
    usageLimit: 1000,
    perCustomerLimit: 2,
    usedCount: 56,
    usedBy: [],
    isActive: true,
  },
  {
    id: 'coup-flat200',
    code: 'FLAT200',
    title: 'Weekend Party Flat ₹200',
    description: 'Instant ₹200 price drop on basket values crossing ₹1,499.',
    discountType: 'FIXED',
    discountValue: 200,
    minOrderValue: 1499,
    maxDiscountAmount: 200,
    startDate: new Date('2026-01-01T00:00:00Z'),
    expiryDate: new Date('2026-12-31T23:59:59Z'),
    usageLimit: 2000,
    perCustomerLimit: 3,
    usedCount: 89,
    usedBy: [],
    isActive: true,
  },
];

class CouponRepository {
  constructor() {
    this.memoryCoupons = JSON.parse(JSON.stringify(INITIAL_COUPONS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Coupon.countDocuments();
      if (count === 0) {
        await Coupon.insertMany(INITIAL_COUPONS);
        console.log('[CouponRepository] Seeded initial coupons into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[CouponRepository] Failed to seed coupons to MongoDB:', err.message);
    }
  }

  async getAll({ includeInactive = false, search = '' } = {}) {
    await this.seedDatabaseIfEmpty();

    let list;
    if (isDbConnected()) {
      const query = {};
      if (!includeInactive) {
        query.isActive = true;
      }
      if (search && search.trim()) {
        const term = search.trim();
        query.$or = [
          { code: new RegExp(term, 'i') },
          { title: new RegExp(term, 'i') },
          { description: new RegExp(term, 'i') },
        ];
      }
      const docs = await Coupon.find(query).sort({ createdAt: -1 }).lean();
      list = docs.map((d) => ({
        ...d,
        id: d.id || d._id?.toString(),
      }));
    } else {
      list = [...this.memoryCoupons];
      if (!includeInactive) {
        list = list.filter((c) => c.isActive !== false);
      }
      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (c) =>
            c.code.toLowerCase().includes(term) ||
            c.title.toLowerCase().includes(term) ||
            (c.description && c.description.toLowerCase().includes(term))
        );
      }
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return list;
  }

  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Coupon.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }).lean();
      if (doc) return { ...doc, id: doc.id || doc._id.toString() };
    }
    return this.memoryCoupons.find((c) => c.id === id) || null;
  }

  async getByCode(code) {
    await this.seedDatabaseIfEmpty();
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    if (isDbConnected()) {
      const doc = await Coupon.findOne({ code: cleanCode }).lean();
      if (doc) return { ...doc, id: doc.id || doc._id.toString() };
    }
    return this.memoryCoupons.find((c) => c.code.toUpperCase() === cleanCode) || null;
  }

  async create(data) {
    const cleanCode = String(data.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const newCoupon = {
      id: data.id || `coup-${cleanCode.toLowerCase()}-${Date.now().toString(36)}`,
      code: cleanCode,
      title: data.title.trim(),
      description: data.description || '',
      discountType: data.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
      discountValue: Number(data.discountValue) || 10,
      minOrderValue: Number(data.minOrderValue) || 0,
      maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
      perCustomerLimit: Number(data.perCustomerLimit) || 1,
      usedCount: 0,
      usedBy: [],
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isDbConnected()) {
      const doc = await Coupon.create(newCoupon);
      const res = doc.toJSON();
      this.memoryCoupons.unshift(res);
      return res;
    }

    this.memoryCoupons.unshift(newCoupon);
    return newCoupon;
  }

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Coupon with ID "${id}" not found.`);
    }

    const updates = { ...data, updatedAt: new Date() };
    if (updates.code) {
      updates.code = String(updates.code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    if (isDbConnected()) {
      const updated = await Coupon.findOneAndUpdate(
        { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      if (updated) {
        const memIdx = this.memoryCoupons.findIndex((c) => c.id === id);
        if (memIdx !== -1) {
          this.memoryCoupons[memIdx] = { ...this.memoryCoupons[memIdx], ...updated };
        }
        return { ...updated, id: updated.id || updated._id.toString() };
      }
    }

    const memIdx = this.memoryCoupons.findIndex((c) => c.id === id);
    if (memIdx !== -1) {
      this.memoryCoupons[memIdx] = { ...this.memoryCoupons[memIdx], ...updates };
      return this.memoryCoupons[memIdx];
    }

    throw new Error(`Coupon with ID "${id}" could not be updated.`);
  }

  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Coupon with ID "${id}" not found.`);
    }

    if (isDbConnected()) {
      await Coupon.deleteOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    }

    this.memoryCoupons = this.memoryCoupons.filter((c) => c.id !== id);
    return { success: true, id, message: `Coupon "${existing.code}" deleted successfully.` };
  }

  /**
   * Record coupon redemption atomically
   */
  async recordUsage({ code, customerPhone, orderId }) {
    const coupon = await this.getByCode(code);
    if (!coupon) return;

    const record = {
      customerPhone: String(customerPhone).slice(-10),
      orderId: String(orderId),
      usedAt: new Date(),
    };

    if (isDbConnected()) {
      try {
        await Coupon.updateOne(
          { code: coupon.code },
          {
            $inc: { usedCount: 1 },
            $push: { usedBy: record },
          }
        );
      } catch (err) {
        console.warn('[CouponRepository] DB recordUsage failed:', err.message);
      }
    }

    const mem = this.memoryCoupons.find((c) => c.code === coupon.code);
    if (mem) {
      mem.usedCount = (mem.usedCount || 0) + 1;
      if (!mem.usedBy) mem.usedBy = [];
      mem.usedBy.push(record);
    }
  }
}

export const couponRepository = new CouponRepository();
export default couponRepository;
