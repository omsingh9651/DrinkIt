import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema(
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
      required: [true, 'Product name is required'],
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: 'DrinkIt Reserve',
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true,
      trim: true,
    },
    subcategory: {
      type: String,
      trim: true,
      default: '',
    },
    subCategory: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    shortDescription: {
      type: String,
      default: '',
    },
    longDescription: {
      type: String,
      default: '',
    },
    images: [{ type: String }],
    image: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    thumbnail: {
      type: String,
      default: '',
    },
    volume: {
      type: String,
      default: '750 ml',
    },
    bottleSizeInMl: {
      type: Number,
      min: [0, 'Bottle size cannot be negative'],
      default: 750,
    },
    unit: {
      type: String,
      default: 'bottle',
    },
    abv: {
      type: String,
      default: '40.0%',
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    mrp: {
      type: Number,
      required: [true, 'MRP is required'],
      min: [0, 'MRP cannot be negative'],
    },
    originalPrice: {
      type: Number,
      min: [0, 'Original price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    stock: {
      type: Number,
      required: true,
      default: 25,
      min: [0, 'Stock cannot be negative'],
    },
    stockQuantity: {
      type: Number,
      default: 25,
      min: [0, 'Stock quantity cannot be negative'],
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    popular: {
      type: Boolean,
      default: false,
    },
    badge: {
      type: String,
      default: null,
    },
    origin: {
      type: String,
      default: 'India',
    },
    tastingNotes: [{ type: String }],
    foodPairing: {
      type: String,
      default: '',
    },
    currency: {
      type: String,
      default: '₹',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        // Normalize alias fields for consistent customer frontend consumption
        ret.price = ret.sellingPrice !== undefined ? ret.sellingPrice : ret.price;
        ret.sellingPrice = ret.price;
        ret.discountPrice = ret.discountPrice !== undefined ? ret.discountPrice : ret.price;
        ret.originalPrice = ret.mrp !== undefined ? ret.mrp : ret.originalPrice;
        ret.mrp = ret.originalPrice;
        ret.stock = ret.stockQuantity !== undefined ? ret.stockQuantity : ret.stock;
        ret.stockQuantity = ret.stock;
        ret.inStock = ret.stock > 0;
        ret.bottleSizeInMl = ret.bottleSizeInMl || (ret.volume ? parseInt(ret.volume, 10) : 750) || 750;
        ret.status = ret.status || 'active';
        ret.subCategory = ret.subCategory || ret.subcategory;
        ret.subcategory = ret.subCategory;
        ret.reviewCount = ret.reviewsCount !== undefined ? ret.reviewsCount : ret.reviewCount;
        ret.reviewsCount = ret.reviewCount;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to synchronize aliases
ProductSchema.pre('save', function (next) {
  if (this.discountPrice !== undefined && this.price === undefined && this.sellingPrice === undefined) {
    this.price = this.discountPrice;
    this.sellingPrice = this.discountPrice;
  }
  if (this.price !== undefined && this.sellingPrice === undefined) {
    this.sellingPrice = this.price;
  }
  if (this.sellingPrice !== undefined && this.price === undefined) {
    this.price = this.sellingPrice;
  }
  if (this.discountPrice === undefined && (this.sellingPrice !== undefined || this.price !== undefined)) {
    this.discountPrice = this.sellingPrice !== undefined ? this.sellingPrice : this.price;
  }
  if (this.mrp !== undefined && this.originalPrice === undefined) {
    this.originalPrice = this.mrp;
  }
  if (this.originalPrice !== undefined && this.mrp === undefined) {
    this.mrp = this.originalPrice;
  }
  if (this.bottleSizeInMl && (!this.volume || this.volume === '750 ml')) {
    this.volume = `${this.bottleSizeInMl} ml`;
  } else if (this.volume && !this.bottleSizeInMl) {
    const parsed = parseInt(this.volume, 10);
    if (!isNaN(parsed) && parsed > 0) {
      this.bottleSizeInMl = parsed;
    }
  }
  if (this.stockQuantity !== undefined) {
    this.stock = this.stockQuantity;
  } else if (this.stock !== undefined) {
    this.stockQuantity = this.stock;
  }
  this.inStock = (this.stockQuantity || this.stock || 0) > 0;
  if (!this.status) this.status = 'active';
  if (!this.subCategory && this.subcategory) this.subCategory = this.subcategory;
  if (!this.subcategory && this.subCategory) this.subcategory = this.subCategory;
  if (typeof next === 'function') next();
});

// Composite text search index for fast product search
ProductSchema.index({
  name: 'text',
  brand: 'text',
  category: 'text',
  subcategory: 'text',
  description: 'text',
});

export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;

