import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { mediaRepository } from '../repositories/mediaRepository.js';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../public/uploads');

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
    cb(null, `drinkit-${cleanBase || 'media'}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, AVIF, GIF, SVG) are allowed.'));
    }
  },
});

const router = express.Router();

router.use(requireAdmin);

/**
 * GET /api/admin/media
 * Fetch all media library assets
 */
router.get('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const { search, source } = req.query;
    const media = await mediaRepository.getAll({ search, source });
    res.json({
      success: true,
      data: media,
      total: media.length,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch media assets.',
    });
  }
});

/**
 * POST /api/admin/media/upload
 * Upload image file(s) via Multer
 */
router.post(
  '/upload',
  requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const newMedia = await mediaRepository.create({
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size,
        source: 'upload',
      });

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully.',
        data: newMedia,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to upload media file.',
      });
    }
  }
);

/**
 * POST /api/admin/media/url
 * Add external image URL to media library
 */
router.post('/url', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const { url, filename, title } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required.',
      });
    }

    const cleanUrl = url.trim();
    const derivedFilename =
      (filename || title || path.basename(new URL(cleanUrl).pathname) || 'external-image')
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-') + '.jpg';

    const newMedia = await mediaRepository.create({
      filename: derivedFilename,
      originalName: title || derivedFilename,
      url: cleanUrl,
      mimetype: 'image/jpeg',
      size: 0,
      source: 'external',
    });

    res.status(201).json({
      success: true,
      message: 'External image added to Media Library.',
      data: newMedia,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to save external image URL.',
    });
  }
});

/**
 * DELETE /api/admin/media/:id
 * Delete media asset
 */
router.delete('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const result = await mediaRepository.delete(req.params.id);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete media asset.',
    });
  }
});

export default router;

