import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    fullName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    house: { type: String, required: true },
    street: { type: String, required: true },
    landmark: { type: String, default: '' },
    city: { type: String, required: true },
    district: { type: String, default: '' },
    state: { type: String, default: 'Uttar Pradesh' },
    pinCode: { type: String, required: true },
    type: { type: String, enum: ['Home', 'Work', 'Other'], default: 'Home' },
    isDefault: { type: Boolean, default: false },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
  },
  { _id: false, timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    dateOfBirth: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Non-Binary', 'Prefer not to say', ''],
      default: '',
    },
    ageVerified: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      default: '🥃',
    },
    phoneVerified: {
      type: Boolean,
      default: true,
    },
    savedAddresses: [AddressSchema],
    wishlist: [{ type: String }],
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
      transform: (_, ret) => {
        ret.id = ret.id || `user_${ret.phone}`;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Fallback index on email if present
UserSchema.index({ email: 1 }, { sparse: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;

