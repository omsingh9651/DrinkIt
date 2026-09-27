import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String, default: 'DrinkIt Reserve' },
    category: { type: String, default: 'Spirits' },
    volume: { type: String, default: '750 ml' },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    mrp: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const StatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: String, default: 'SYSTEM' },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: 'Valued Customer',
    },
    customerDetails: {
      fullName: String,
      phoneNumber: String,
      email: String,
    },
    deliveryAddress: {
      fullName: { type: String, required: true },
      mobileNumber: { type: String, required: true },
      house: { type: String, required: true },
      street: { type: String, required: true },
      landmark: { type: String, default: '' },
      city: { type: String, required: true },
      district: { type: String, default: '' },
      state: { type: String, default: 'Uttar Pradesh' },
      pinCode: { type: String, required: true },
      type: { type: String, default: 'Home' },
      latitude: Number,
      longitude: Number,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    items: [OrderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    promoCode: {
      type: String,
      default: null,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxesOrFees: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
    },
    grandTotal: {
      type: Number,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'RAZORPAY', 'DEMO_PAYMENT'],
      default: 'COD',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    // Razorpay Test Mode Audit & Cryptographic Fields
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paymentFailureReason: {
      type: String,
      default: null,
    },
    orderStatus: {
      type: String,
      enum: [
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'PENDING',
      index: true,
    },
    statusHistory: [StatusHistorySchema],
    // Store & Hub Assignment
    assignedStore: { type: String, default: null },
    storeId: { type: String, default: null },
    storeName: { type: String, default: null },
    // Courier & Delivery Partner Assignment
    assignedDeliveryPartner: { type: String, default: null },
    deliveryPartnerId: { type: String, default: null },
    deliveryPartnerName: { type: String, default: null },
    deliveryPartnerPhone: { type: String, default: null },
    deliveryPartnerVehicle: { type: String, default: null },
    // Dispatch Telemetry & Locations
    pickupLocation: {
      id: String,
      name: String,
      address: String,
      phone: String,
      latitude: Number,
      longitude: Number,
    },
    dropoffLocation: {
      address: String,
      latitude: Number,
      longitude: Number,
    },
    currentDeliveryLocation: {
      latitude: Number,
      longitude: Number,
      heading: Number,
      speed: Number,
      timestamp: Date,
    },
    route: mongoose.Schema.Types.Mixed,
    estimatedMinutes: { type: Number, default: null },
    distanceRemainingKm: { type: Number, default: null },
    deliveryStatus: {
      type: String,
      enum: ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVING', 'DELIVERED', null],
      default: null,
    },
    trackingStartedAt: { type: Date, default: null },
    trackingStoppedAt: { type: Date, default: null },
    lastLocationUpdateAt: { type: Date, default: null },
    // Inventory Lifecycle Safeguard: prevents duplicate stock restoration on repeated or concurrent cancellations
    stockRestored: { type: Boolean, default: false, index: true },
    stockRestoredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.totalAmount = ret.totalAmount !== undefined ? ret.totalAmount : ret.total;
        ret.grandTotal = ret.total;
        ret.deliveryCharge = ret.deliveryFee;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-validate hook to ensure coordinates and required aliases are set
OrderSchema.pre('validate', function (next) {
  if (this.latitude === undefined && this.deliveryAddress?.latitude !== undefined) {
    this.latitude = Number(this.deliveryAddress.latitude);
  }
  if (this.longitude === undefined && this.deliveryAddress?.longitude !== undefined) {
    this.longitude = Number(this.deliveryAddress.longitude);
  }
  if (this.latitude === undefined) this.latitude = 26.4715;
  if (this.longitude === undefined) this.longitude = 80.3440;
  if (typeof next === 'function') next();
});

// Pre-save hook to normalize aliases
OrderSchema.pre('save', function (next) {
  if (this.total !== undefined && this.totalAmount === undefined) {
    this.totalAmount = this.total;
  }
  if (this.totalAmount !== undefined && this.total === undefined) {
    this.total = this.totalAmount;
  }
  this.grandTotal = this.total;
  if (this.deliveryFee !== undefined && this.deliveryCharge === undefined) {
    this.deliveryCharge = this.deliveryFee;
  }
  if (typeof next === 'function') next();
});

OrderSchema.index({ customerPhone: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export default Order;

