import express from 'express';
import { brandService } from '../services/brandService.js';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';

const router = express.Router();

router.use(requireAdmin);

/**
 * GET /api/admin/brands
 * List all brands with product counts
 */
router.get('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const brands = await brandService.getAllBrands({ includeInactive: true });
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
 * GET /api/admin/brands/:id
 */
router.get('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const brand = await brandService.getBrandById(req.params.id);
    res.json({
      success: true,
      data: brand,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Brand not found.',
    });
  }
});

/**
 * POST /api/admin/brands
 */
router.post('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const brand = await brandService.createBrand(req.body);
    res.status(201).json({
      success: true,
      message: `Brand "${brand.name}" created successfully.`,
      data: brand,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to create brand.',
    });
  }
});

/**
 * PUT /api/admin/brands/:id
 */
router.put('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const updated = await brandService.updateBrand(req.params.id, req.body);
    res.json({
      success: true,
      message: `Brand "${updated.name}" updated successfully.`,
      data: updated,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update brand.',
    });
  }
});

/**
 * DELETE /api/admin/brands/:id
 */
router.delete('/:id', requireRole([ADMIN_ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const result = await brandService.deleteBrand(req.params.id);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to delete brand.',
    });
  }
});

export default router;

