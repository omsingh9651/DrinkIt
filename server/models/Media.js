import mongoose from 'mongoose';

const MediaSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Media ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },
    originalName: {
      type: String,
      default: '',
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
    },
    mimetype: {
      type: String,
      default: 'image/jpeg',
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ['upload', 'external'],
      default: 'upload',
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

export const Media = mongoose.models.Media || mongoose.model('Media', MediaSchema);
export default Media;

