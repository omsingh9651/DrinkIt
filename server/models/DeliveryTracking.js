import mongoose from 'mongoose';

const DeliveryTrackingSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    deliveryPartnerId: {
      type: String,
      default: null,
      index: true,
    },
    currentLatitude: {
      type: Number,
      required: true,
    },
    currentLongitude: {
      type: Number,
      required: true,
    },
    heading: {
      type: Number,
      default: 0,
    },
    speed: {
      type: Number,
      default: 0,
    },
    routeGeometry: mongoose.Schema.Types.Mixed,
    distanceRemainingKm: {
      type: Number,
      default: 0,
    },
    etaMinutes: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    trackingStatus: {
      type: String,
      enum: ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVING', 'DELIVERED', 'STOPPED'],
      default: 'ASSIGNED',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const DeliveryTracking =
  mongoose.models.DeliveryTracking || mongoose.model('DeliveryTracking', DeliveryTrackingSchema);
export default DeliveryTracking;

