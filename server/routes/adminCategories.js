import express from 'express';
import { categoryService } from '../services/categoryService.js';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';

const router = express.Router();

// Protect all admin category routes
router.use(requireAdmin);

/**
 * GET /api/admin/categories
 * List all categories including inactive ones with product counts
 */
router.get('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories({ includeInactive: true });
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
 * GET /api/admin/categories/:id
 */
router.get('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.json({
      success: true,
      data: category,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Category not found.',
    });
  }
});

/**
 * POST /api/admin/categories
 * Create new category
 */
router.post('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const { name, slug, emoji, description, image, displayOrder, isActive } = req.body;
    const category = await categoryService.createCategory({
      name,
      slug,
      emoji,
      description,
      image,
      displayOrder,
      isActive,
    });
    res.status(201).json({
      success: true,
      message: `Category "${category.name}" created successfully.`,
      data: category,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to create category.',
    });
  }
});

/**
 * PUT /api/admin/categories/:id
 * Update category
 */
router.put('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.CONTENT_MANAGER), async (req, res) => {
  try {
    const updated = await categoryService.updateCategory(req.params.id, req.body);
    res.json({
      success: true,
      message: `Category "${updated.name}" updated successfully.`,
      data: updated,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update category.',
    });
  }
});

/**
 * DELETE /api/admin/categories/:id
 * Delete category with safety check
 */
router.delete('/:id', requireRole([ADMIN_ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const result = await categoryService.deleteCategory(req.params.id);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to delete category.',
    });
  }
});

export default router;

