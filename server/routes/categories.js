import express from 'express';
import { categoryService } from '../services/categoryService.js';

const router = express.Router();

/**
 * GET /api/categories
 * Public endpoint to list active categories
 */
router.get('/', async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories({ includeInactive: false });
    res.json({
      success: true,
      data: categories,
      total: categories.length,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch categories.',
    });
  }
});

/**
 * GET /api/categories/:slug
 * Public endpoint to get category details
 */
router.get('/:slug', async (req, res) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    res.json({
      success: true,
      data: category,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch category.',
    });
  }
});

export default router;

