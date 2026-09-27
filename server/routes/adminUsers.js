import { Router } from 'express';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';
import { adminUserService } from '../services/adminUserService.js';

const router = Router();

// Apply requireAdmin to all admin user routes
router.use(requireAdmin);

/**
 * GET /api/admin/admin-users
 * List all admin personnel (Super Admin and Admin can view)
 */
router.get('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), async (req, res) => {
  try {
    const admins = await adminUserService.getAllAdmins();
    res.json({
      success: true,
      data: admins,
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch admin users.' });
  }
});

/**
 * GET /api/admin/admin-users/:id
 * Get single admin user
 */
router.get('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), async (req, res) => {
  try {
    const admin = await adminUserService.getAdminById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin user not found.' });
    }
    res.json({
      success: true,
      data: admin,
    });
  } catch (err) {
    console.error('Error fetching admin user by ID:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch admin user.' });
  }
});

/**
 * POST /api/admin/admin-users
 * Create new admin user (Super Admin only)
 */
router.post('/', requireRole(ADMIN_ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const created = await adminUserService.createAdmin(req.body, req.admin);
    res.status(201).json({
      success: true,
      message: `Admin user "${created.email}" created successfully.`,
      data: created,
    });
  } catch (err) {
    console.error('Error creating admin user:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create admin user.' });
  }
});

/**
 * PUT /api/admin/admin-users/:id
 * Update admin user role, status or password (Super Admin only)
 */
router.put('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const updated = await adminUserService.updateAdmin(req.params.id, req.body, req.admin);
    res.json({
      success: true,
      message: `Admin user "${updated.email}" updated successfully.`,
      data: updated,
    });
  } catch (err) {
    console.error('Error updating admin user:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to update admin user.' });
  }
});

/**
 * DELETE /api/admin/admin-users/:id
 * Delete admin user (Super Admin only, protected against deleting last super_admin)
 */
router.delete('/:id', requireRole(ADMIN_ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const result = await adminUserService.deleteAdmin(req.params.id, req.admin);
    res.json({
      success: true,
      message: result.message || 'Admin user deleted successfully.',
      data: result,
    });
  } catch (err) {
    console.error('Error deleting admin user:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to delete admin user.' });
  }
});

export default router;

