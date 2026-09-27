import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';
import { productService } from '../services/productService.js';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../public/uploads');

// Ensure uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanBase = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 30);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `product-${cleanBase || 'image'}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, AVIF, GIF) are allowed.'));
    }
  },
});

/**
 * Checks if a URL is an unusable Google search redirect, thumbnail, or proxy link
 */
export function isUnusableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();

  const googlePatterns = [
    'google.com/imgres',
    'google.com/url?',
    'google.co.in/imgres',
    'google.co.in/url?',
    'images.app.goo.gl',
    'encrypted-tbn0.gstatic.com',
    'encrypted-tbn1.gstatic.com',
    'encrypted-tbn2.gstatic.com',
    'encrypted-tbn3.gstatic.com',
    'encrypted-tbn',
    'tbn:and9gc',
  ];

  if (googlePatterns.some((pattern) => trimmed.includes(pattern))) {
    return true;
  }

  // Googleusercontent without direct file extension
  if (trimmed.includes('googleusercontent.com') && !trimmed.match(/\.(jpg|jpeg|png|webp|avif|gif)/i)) {
    return true;
  }

  return false;
}

const router = express.Router();

/**
 * GET /api/categories
 * Returns list of categories with product counts (Public)
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await productService.getCategories();
    res.json({
      success: true,
      categories,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products
 * Query params: category, q, sortBy, inStock, minPrice, maxPrice, status, includeInactive (Public)
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, q, sortBy, inStock, minPrice, maxPrice, status, includeInactive } = req.query;
    const products = await productService.getAll({
      category,
      q,
      sortBy,
      inStock,
      minPrice,
      maxPrice,
      status,
      includeInactive,
    });

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Public product lookup
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await productService.getById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products/upload-image
 * Upload product image from computer (Protected: Admin)
 */
router.post(
  '/upload-image',
  requireAdmin,
  (req, res) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file uploaded. Please select an image file.',
        });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        success: true,
        message: 'Product image uploaded successfully',
        url: fileUrl,
        image: fileUrl,
      });
    });
  }
);

/**
 * POST /api/products
 * Create a new product (Protected: super_admin, admin, inventory_manager)
 */
router.post(
  '/',
  requireAdmin,
  requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.INVENTORY_MANAGER),
  async (req, res, next) => {
    try {
      const {
        name,
        brand,
        category,
        price,
        discountPrice,
        mrp,
        originalPrice,
        stockQuantity,
        volume,
        bottleSizeInMl,
        abv,
        rating,
        status,
        image,
      } = req.body;

      // Comprehensive validation
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Product name is required.' });
      }
      if (!category || typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({ success: false, error: 'Valid category is required.' });
      }

      const effectivePrice = Number(price !== undefined ? price : discountPrice);
      if (isNaN(effectivePrice) || effectivePrice <= 0) {
        return res.status(400).json({ success: false, error: 'Price must be a positive number in INR.' });
      }

      const effectiveMrp = mrp !== undefined ? Number(mrp) : originalPrice !== undefined ? Number(originalPrice) : null;
      if (effectiveMrp !== null && (isNaN(effectiveMrp) || effectiveMrp < effectivePrice)) {
        return res.status(400).json({ success: false, error: 'MRP / Regular price cannot be less than discounted selling price.' });
      }

      const effectiveStock = stockQuantity !== undefined ? Number(stockQuantity) : 25;
      if (isNaN(effectiveStock) || effectiveStock < 0 || !Number.isInteger(effectiveStock)) {
        return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative whole number.' });
      }

      if (rating !== undefined) {
        const r = Number(rating);
        if (isNaN(r) || r < 0 || r > 5) {
          return res.status(400).json({ success: false, error: 'Rating must be between 0 and 5.' });
        }
      }

      // Validate image URL: Reject unusable Google search/redirect URLs
      if (image && isUnusableImageUrl(image)) {
        return res.status(400).json({
          success: false,
          error: 'This is not a usable direct image URL. Please use a direct image link or upload an image.',
        });
      }

      const created = await productService.create({
        ...req.body,
        brand: (brand || 'DrinkIt Reserve').trim(),
        volume: volume || (bottleSizeInMl ? `${bottleSizeInMl} ml` : '750 ml'),
        bottleSizeInMl: bottleSizeInMl || (volume ? parseInt(volume, 10) : 750) || 750,
        abv: abv || '40.0%',
        status: status === 'inactive' ? 'inactive' : 'active',
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product: created,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/products/:id
 * Update existing product (Protected: super_admin, admin, inventory_manager)
 */
router.put(
  '/:id',
  requireAdmin,
  requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.INVENTORY_MANAGER),
  async (req, res, next) => {
    try {
      const {
        name,
        category,
        price,
        discountPrice,
        mrp,
        originalPrice,
        stockQuantity,
        rating,
        image,
      } = req.body;

      if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
        return res.status(400).json({ success: false, error: 'Product name cannot be empty.' });
      }
      if (category !== undefined && (!category || typeof category !== 'string' || !category.trim())) {
        return res.status(400).json({ success: false, error: 'Valid category is required.' });
      }

      if (price !== undefined || discountPrice !== undefined) {
        const p = Number(price !== undefined ? price : discountPrice);
        if (isNaN(p) || p <= 0) {
          return res.status(400).json({ success: false, error: 'Price must be a positive number in INR.' });
        }
      }

      if (mrp !== undefined || originalPrice !== undefined) {
        const m = Number(mrp !== undefined ? mrp : originalPrice);
        const p = Number(price !== undefined ? price : discountPrice);
        if (!isNaN(p) && m < p) {
          return res.status(400).json({ success: false, error: 'MRP / Regular price cannot be less than discounted selling price.' });
        }
      }

      if (stockQuantity !== undefined) {
        const s = Number(stockQuantity);
        if (isNaN(s) || s < 0 || !Number.isInteger(s)) {
          return res.status(400).json({ success: false, error: 'Stock quantity must be a non-negative whole number.' });
        }
      }

      if (rating !== undefined) {
        const r = Number(rating);
        if (isNaN(r) || r < 0 || r > 5) {
          return res.status(400).json({ success: false, error: 'Rating must be between 0 and 5.' });
        }
      }

      // Validate image URL: Reject unusable Google search/redirect URLs
      if (image && isUnusableImageUrl(image)) {
        return res.status(400).json({
          success: false,
          error: 'This is not a usable direct image URL. Please use a direct image link or upload an image.',
        });
      }

      const updated = await productService.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Product not found for update',
        });
      }

      res.json({
        success: true,
        message: 'Product updated successfully',
        product: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/products/:id/stock
 * Fast stock updater (Protected: super_admin, admin, inventory_manager)
 */
router.patch(
  '/:id/stock',
  requireAdmin,
  requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.INVENTORY_MANAGER),
  async (req, res, next) => {
    try {
      const { stockQuantity, stock } = req.body;
      const rawStock = stockQuantity !== undefined ? stockQuantity : stock;
      if (rawStock === undefined || isNaN(Number(rawStock)) || Number(rawStock) < 0 || !Number.isInteger(Number(rawStock))) {
        return res.status(400).json({
          success: false,
          error: 'Stock quantity must be a non-negative whole number.',
        });
      }

      const updated = await productService.updateStock(req.params.id, Number(rawStock));
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      res.json({
        success: true,
        message: 'Stock updated successfully',
        product: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/products/:id/status
 * Fast status updater (Protected: super_admin, admin, inventory_manager)
 */
router.patch(
  '/:id/status',
  requireAdmin,
  requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.INVENTORY_MANAGER),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!status || (status !== 'active' && status !== 'inactive')) {
        return res.status(400).json({
          success: false,
          error: 'Status must be either "active" or "inactive".',
        });
      }

      const updated = await productService.updateStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      res.json({
        success: true,
        message: `Product status updated to ${status}.`,
        product: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/products/:id
 * Delete product (Protected: super_admin, admin)
 */
router.delete(
  '/:id',
  requireAdmin,
  requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const deleted = await productService.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Product not found for deletion',
        });
      }

      res.json({
        success: true,
        message: 'Product deleted successfully',
        product: deleted,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

