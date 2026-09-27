import mongoose from 'mongoose';

const DeliveryPartnerSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      required: true,
    },
    cleanPhone: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 4.9,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    vehicleType: {
      type: String,
      default: 'Electric Cargo Scooter',
    },
    vehicleNumber: {
      type: String,
      default: 'UP-78-EV-2081',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
      default: 'AVAILABLE',
      index: true,
    },
    availabilityStatus: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
      default: 'AVAILABLE',
    },
    onlineStatus: {
      type: Boolean,
      default: true,
    },
    currentLatitude: {
      type: Number,
      default: null,
    },
    currentLongitude: {
      type: Number,
      default: null,
    },
    assignedOrder: {
      type: String,
      default: null,
    },
    currentOrderId: {
      type: String,
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.profileImage = ret.profileImage || ret.avatar;
        ret.avatar = ret.avatar || ret.profileImage;
        ret.currentOrderId = ret.currentOrderId || ret.assignedOrder;
        ret.assignedOrder = ret.assignedOrder || ret.currentOrderId;
        ret.availabilityStatus = ret.availabilityStatus || ret.status;
        delete ret.__v;
        return ret;
      },
    },
  }
);

DeliveryPartnerSchema.pre('save', function (next) {
  if (this.avatar && !this.profileImage) this.profileImage = this.avatar;
  if (this.profileImage && !this.avatar) this.avatar = this.profileImage;
  if (this.status && !this.availabilityStatus) this.availabilityStatus = this.status;
  if (this.availabilityStatus && !this.status) this.status = this.availabilityStatus;
  if (this.currentOrderId && !this.assignedOrder) this.assignedOrder = this.currentOrderId;
  if (this.assignedOrder && !this.currentOrderId) this.currentOrderId = this.assignedOrder;
  if (this.phone && !this.cleanPhone) {
    this.cleanPhone = String(this.phone).replace(/\D/g, '').slice(-10);
  }
  if (typeof next === 'function') next();
});

export const DeliveryPartner =
  mongoose.models.DeliveryPartner || mongoose.model('DeliveryPartner', DeliveryPartnerSchema);
export default DeliveryPartner;

