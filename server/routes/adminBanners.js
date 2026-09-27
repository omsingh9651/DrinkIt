import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { bannerService } from '../services/bannerService.js';

const router = Router();

// Apply requireAdmin to all admin banner routes
router.use(requireAdmin);

/**
 * GET /api/admin/banners
 * List all banners with search & filters
 */
router.get('/', async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const banners = await bannerService.getAllBanners({
      search,
      status,
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const skip = (pageNum - 1) * limitNum;
    const paginated = (Array.isArray(banners) ? banners : []).slice(skip, skip + limitNum);
    const total = Array.isArray(banners) ? banners.length : 0;

    res.json({
      success: true,
      data: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    console.error('Error fetching admin banners:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch banners.' });
  }
});

/**
 * GET /api/admin/banners/:id
 * Retrieve single banner
 */
router.get('/:id', async (req, res) => {
  try {
    const banner = await bannerService.getBannerById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, error: 'Banner not found.' });
    }
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error('Error fetching banner by ID:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch banner.' });
  }
});

/**
 * POST /api/admin/banners
 * Create new promotional banner
 */
router.post('/', async (req, res) => {
  try {
    const created = await bannerService.createBanner(req.body, req.admin);
    res.status(201).json({
      success: true,
      message: 'Banner created successfully.',
      data: created,
    });
  } catch (err) {
    console.error('Error creating banner:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create banner.' });
  }
});

/**
 * PUT /api/admin/banners/:id
 * Update banner
 */
router.put('/:id', async (req, res) => {
  try {
    const updated = await bannerService.updateBanner(req.params.id, req.body, req.admin);
    res.json({
      success: true,
      message: 'Banner updated successfully.',
      data: updated,
    });
  } catch (err) {
    console.error('Error updating banner:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to update banner.' });
  }
});

/**
 * DELETE /api/admin/banners/:id
 * Delete banner
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await bannerService.deleteBanner(req.params.id, req.admin);
    res.json({
      success: true,
      message: 'Banner deleted successfully.',
      data: result,
    });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to delete banner.' });
  }
});

export default router;
