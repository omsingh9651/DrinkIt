import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { activityLogRepository } from '../repositories/activityLogRepository.js';

const router = Router();

// Apply requireAdmin
router.use(requireAdmin);

/**
 * GET /api/admin/activity-logs
 * List centralized admin activity logs with filters, search, and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { module, search, startDate, endDate, page, limit } = req.query;

    const result = await activityLogRepository.getLogs({
      module,
      search,
      startDate,
      endDate,
      page,
      limit,
    });

    res.json({
      success: true,
      data: result.logs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch activity logs.' });
  }
});

export default router;

