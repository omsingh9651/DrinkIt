import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { orderService } from '../services/orderService.js';

const router = Router();

// Apply requireAdmin to all admin order endpoints
router.use(requireAdmin);

/**
 * GET /api/admin/orders
 * Fetch all orders with filtering and search
 */
router.get('/', async (req, res) => {
  try {
    const { status, paymentStatus, search, startDate, endDate, page, limit } = req.query;
    const result = await orderService.getAllOrders({
      status,
      paymentStatus,
      search,
      startDate,
      endDate,
      page,
      limit,
    });

    return res.json({
      success: true,
      orders: result.orders,
      total: result.total,
      count: result.orders.length,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      metrics: result.metrics,
    });
  } catch (err) {
    console.error('Admin fetch orders error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin orders.',
    });
  }
});

/**
 * GET /api/admin/orders/:orderId
 * Fetch single order with audit trail
 */
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${orderId} not found.`,
      });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error('Admin fetch single order error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve order details.',
    });
  }
});

/**
 * PATCH /api/admin/orders/:orderId/status
 * Update order status and/or payment status
 */
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus, note } = req.body;
    const adminEmail = req.admin?.email || 'Admin';

    const updated = await orderService.updateOrderStatus(orderId, {
      orderStatus,
      paymentStatus,
      note,
      adminEmail,
    });

    return res.json({
      success: true,
      message: `Order #${orderId} updated to ${updated.orderStatus}.`,
      order: updated,
    });
  } catch (err) {
    console.error('Admin update order status error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to update order status.',
    });
  }
});

/**
 * POST /api/admin/orders/:orderId/assign-partner
 * Assign delivery partner to order
 */
router.post('/:orderId/assign-partner', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { partnerId, partnerName, partnerPhone } = req.body;

    const updated = await orderService.assignDeliveryPartner(orderId, {
      partnerId,
      partnerName,
      partnerPhone,
    });

    return res.json({
      success: true,
      message: `Delivery partner ${updated.deliveryPartnerName} assigned to Order #${orderId}.`,
      order: updated,
    });
  } catch (err) {
    console.error('Assign partner error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to assign delivery partner.',
    });
  }
});

export default router;

