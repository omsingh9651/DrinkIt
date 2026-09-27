import mongoose from 'mongoose';

const InventoryLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'Spirits',
      trim: true,
    },
    previousStock: {
      type: Number,
      required: true,
      min: [0, 'Previous stock cannot be negative'],
    },
    newStock: {
      type: Number,
      required: true,
      min: [0, 'New stock cannot be negative'],
    },
    change: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['RESTOCK', 'ADJUSTMENT', 'ORDER_PLACED', 'ORDER_CANCELLED', 'INITIAL'],
      index: true,
    },
    reason: {
      type: String,
      default: 'Manual stock adjustment',
      trim: true,
    },
    referenceId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    performedBy: {
      type: String,
      default: 'SYSTEM',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for querying a product's history chronologically
InventoryLogSchema.index({ productId: 1, createdAt: -1 });
InventoryLogSchema.index({ type: 1, createdAt: -1 });

export const InventoryLog =
  mongoose.models.InventoryLog || mongoose.model('InventoryLog', InventoryLogSchema);

export default InventoryLog;

