import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    adminEmail: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    adminRole: {
      type: String,
      default: 'admin',
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      enum: [
        'AUTH',
        'PRODUCTS',
        'INVENTORY',
        'ORDERS',
        'PAYMENTS',
        'COUPONS',
        'BANNERS',
        'ADMIN_USERS',
        'CUSTOMERS',
        'CATEGORIES',
        'BRANDS',
        'MEDIA',
      ],
      index: true,
    },
    targetId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
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

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ module: 1, createdAt: -1 });

export const ActivityLog =
  mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
export default ActivityLog;

