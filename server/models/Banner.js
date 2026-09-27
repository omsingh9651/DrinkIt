import mongoose from 'mongoose';

const BannerSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    badgeText: {
      type: String,
      default: 'EXCLUSIVE OFFER',
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    ctaText: {
      type: String,
      default: 'Shop Collection',
      trim: true,
    },
    ctaLink: {
      type: String,
      default: '/products',
      trim: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
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

export const Banner = mongoose.models.Banner || mongoose.model('Banner', BannerSchema);
export default Banner;

