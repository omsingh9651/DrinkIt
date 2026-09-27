import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { reportService } from '../services/reportService.js';

const router = Router();

// Apply requireAdmin
router.use(requireAdmin);

/**
 * GET /api/admin/reports/analytics
 * Retrieve calculated sales statistics, charts, top products and category distribution
 */
router.get('/analytics', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const data = await reportService.getAnalytics({ range, startDate, endDate });
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error computing report analytics:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to compute report analytics.' });
  }
});

/**
 * GET /api/admin/reports/export
 * Export sales data as CSV download
 */
router.get('/export', async (req, res) => {
  try {
    const { range, startDate, endDate } = req.query;
    const csvContent = await reportService.generateOrdersCsv({ range, startDate, endDate });

    const filename = `drinkit_orders_${range || 'report'}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error generating report CSV export:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to export CSV report.' });
  }
});

export default router;

