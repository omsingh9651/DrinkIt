import express from 'express';
import { brandService } from '../services/brandService.js';

const router = express.Router();

/**
 * GET /api/brands
 * Public endpoint to list active brands
 */
router.get('/', async (req, res) => {
  try {
    const brands = await brandService.getAllBrands({ includeInactive: false });
    res.json({
      success: true,
      data: brands,
      total: brands.length,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch brands.',
    });
  }
});

/**
 * GET /api/brands/:slug
 * Public endpoint to get brand details
 */
router.get('/:slug', async (req, res) => {
  try {
    const brand = await brandService.getBrandBySlug(req.params.slug);
    res.json({
      success: true,
      data: brand,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch brand.',
    });
  }
});

export default router;

