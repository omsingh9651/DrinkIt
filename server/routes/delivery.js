import { Router } from 'express';
import { storeLocationService } from '../services/storeLocationService.js';
import { deliveryPartnerService } from '../services/deliveryPartnerService.js';
import { orderService } from '../services/orderService.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

/**
 * GET /api/delivery/stores
 * Get list of all DrinkIt pickup stores (Public directory)
 */
router.get('/stores', async (req, res) => {
  try {
    const stores = await storeLocationService.getAllStores();
    return res.json({
      success: true,
      stores,
    });
  } catch (err) {
    console.error('Error fetching stores:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve store locations.' });
  }
});

/**
 * GET /api/delivery/partners
 * Get all delivery partners with live status (Admin only)
 */
router.get('/partners', requireAdmin, async (req, res) => {
  try {
    const partners = await deliveryPartnerService.getAllPartners();
    return res.json({
      success: true,
      partners,
    });
  } catch (err) {
    console.error('Error fetching partners:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve delivery partners.' });
  }
});

/**
 * PATCH /api/delivery/orders/:orderId/assign
 * Assign delivery partner and/or store hub to order (Admin only)
 */
router.patch('/orders/:orderId/assign', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { partnerId, storeId } = req.body || {};

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: 'Valid orderId parameter is required.' });
    }

    if (!partnerId && !storeId) {
      return res.status(400).json({ success: false, error: 'partnerId or storeId must be provided for assignment.' });
    }

    const updatedOrder = await orderService.assignPartnerAndStore(orderId.trim(), { partnerId, storeId });

    return res.json({
      success: true,
      message: 'Order delivery assignment updated.',
      order: updatedOrder,
    });
  } catch (err) {
    console.error('Assign delivery order error:', err);
    const status = err.message && err.message.includes('not found') ? 404 : 500;
    return res.status(status).json({ success: false, error: err.message || 'Failed to update order assignment.' });
  }
});

/**
 * POST /api/delivery/orders/:orderId/reset
 * Reset rider location back to store pickup (Admin only)
 */
router.post('/orders/:orderId/reset', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: 'Valid orderId parameter is required.' });
    }

    const updatedOrder = await orderService.resetDeliveryLocation(orderId.trim());

    return res.json({
      success: true,
      message: 'Delivery tracking reset to pickup store.',
      order: updatedOrder,
    });
  } catch (err) {
    console.error('Reset delivery order error:', err);
    const status = err.message && err.message.includes('not found') ? 404 : 500;
    return res.status(status).json({ success: false, error: err.message || 'Failed to reset delivery tracking.' });
  }
});

export default router;
