import express from 'express';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';
import { inventoryService } from '../services/inventoryService.js';

const router = express.Router();

// Apply requireAdmin and inventory manager/admin role to all inventory endpoints
router.use(requireAdmin);
router.use(requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.INVENTORY_MANAGER));

/**
 * GET /api/admin/inventory/summary
 * Aggregate inventory KPI stats
 */
router.get('/summary', async (req, res, next) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold, 10) : 5;
    const summary = await inventoryService.getSummary(threshold);
    res.json({
      success: true,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/inventory/items
 * Fetch all inventory items with computed health flags & valuation
 */
router.get('/items', async (req, res, next) => {
  try {
    const { threshold, status, category, q, sortBy } = req.query;
    const items = await inventoryService.getInventoryItems({
      threshold: threshold ? parseInt(threshold, 10) : 5,
      status,
      category,
      q,
      sortBy,
    });

    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/inventory/adjust
 * Adjust stock quantity (set or delta) with validation & immutable history
 */
router.post('/adjust', async (req, res, next) => {
  try {
    const { productId, quantity, adjustmentType = 'delta', reason } = req.body;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid productId is required.',
      });
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || !Number.isInteger(numQty)) {
      return res.status(400).json({
        success: false,
        error: 'Adjustment quantity must be a whole number (integer).',
      });
    }

    if (adjustmentType !== 'set' && adjustmentType !== 'delta') {
      return res.status(400).json({
        success: false,
        error: 'adjustmentType must be either "set" or "delta".',
      });
    }

    if (adjustmentType === 'set' && numQty < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock quantity cannot be negative.',
      });
    }

    const adminEmail = req.admin?.email || 'Admin';
    const performedBy = `ADMIN (${adminEmail})`;

    const result = await inventoryService.adjustStock({
      productId,
      quantity: numQty,
      adjustmentType,
      reason: (reason || 'Manual stock adjustment').trim(),
      performedBy,
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully.',
      product: result.product,
      log: result.log,
    });
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('negative stock')) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next(err);
  }
});

/**
 * GET /api/admin/inventory/history
 * Fetch audit logs for inventory changes
 */
router.get('/history', async (req, res, next) => {
  try {
    const { productId, type, category, search, limit, skip } = req.query;
    const history = await inventoryService.getHistory({
      productId,
      type,
      category,
      search,
      limit,
      skip,
    });

    res.json({
      success: true,
      ...history,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

