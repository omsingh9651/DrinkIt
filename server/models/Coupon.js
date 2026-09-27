import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Coupon ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      required: true,
      default: 'PERCENTAGE',
    },
    discountValue: {
      type: Number,
      required: true,
      min: [1, 'Discount value must be greater than 0'],
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // null means no cap for percentage
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      default: null, // null means never expires
    },
    usageLimit: {
      type: Number,
      default: null, // total lifetime usage limit across all users
    },
    perCustomerLimit: {
      type: Number,
      default: 1, // maximum redemptions per customer phone
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    usedBy: [
      {
        customerPhone: { type: String, required: true },
        orderId: { type: String, required: true },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
export default Coupon;

