import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { userRepository } from '../repositories/userRepository.js';
import { activityLogRepository } from '../repositories/activityLogRepository.js';

const router = Router();

// Apply requireAdmin middleware to all customer management endpoints
router.use(requireAdmin);

/**
 * GET /api/admin/customers
 * List registered customers with spend aggregations, search, and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const result = await userRepository.getAllCustomers({
      search,
      status,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result.customers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      metrics: result.metrics,
    });
  } catch (err) {
    console.error('Error fetching admin customers:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch customers.' });
  }
});

/**
 * GET /api/admin/customers/:phone
 * Get customer profile and complete order history
 */
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const details = await userRepository.getCustomerDetails(phone);

    if (!details || !details.profile) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }

    res.json({
      success: true,
      data: details,
    });
  } catch (err) {
    console.error('Error fetching customer details:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch customer details.' });
  }
});

/**
 * PUT /api/admin/customers/:phone/status
 * Activate or deactivate customer account securely
 */
router.put('/:phone/status', async (req, res) => {
  try {
    const { phone } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ success: false, error: 'isActive boolean is required.' });
    }

    const updated = await userRepository.updateCustomerStatus(phone, { isActive: Boolean(isActive) });

    await activityLogRepository.logAction({
      adminEmail: req.admin?.email || 'admin@drinkit.com',
      adminRole: req.admin?.role || 'admin',
      action: updated.isActive ? 'ACTIVATE' : 'DEACTIVATE',
      module: 'CUSTOMERS',
      targetId: phone,
      description: `${updated.isActive ? 'Activated' : 'Deactivated'} customer account +91 ${phone}`,
      metadata: { phone, isActive: updated.isActive },
    });

    res.json({
      success: true,
      message: `Customer account ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: updated,
    });
  } catch (err) {
    console.error('Error updating customer status:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update customer status.' });
  }
});

export default router;

