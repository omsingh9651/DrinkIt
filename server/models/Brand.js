import mongoose from 'mongoose';

const BrandSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Brand ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    logo: {
      type: String,
      default: '',
      trim: true,
    },
    origin: {
      type: String,
      default: 'India',
      trim: true,
    },
    website: {
      type: String,
      default: '',
      trim: true,
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

export const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
export default Brand;

