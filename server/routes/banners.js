import { Router } from 'express';
import { bannerService } from '../services/bannerService.js';

const router = Router();

/**
 * GET /api/banners
 * Public storefront endpoint: returns currently active promotional banners
 */
router.get('/', async (req, res) => {
  try {
    const banners = await bannerService.getActiveBanners();
    res.json({
      success: true,
      data: banners,
    });
  } catch (err) {
    console.error('Error fetching public banners:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve promotional banners.' });
  }
});

export default router;

