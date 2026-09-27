import express from 'express';
import { orderRepository } from '../repositories/orderRepository.js';
import { requireAdmin, requireRole, ADMIN_ROLES } from '../middleware/adminAuth.js';

const router = express.Router();

router.use(requireAdmin);

/**
 * GET /api/admin/payments
 * Retrieve payment transactions aggregated from authentic orders
 */
router.get('/', requireRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN, ADMIN_ROLES.INVENTORY_MANAGER, ADMIN_ROLES.ORDER_MANAGER), async (req, res) => {
  try {
    const { status, method, search, startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);

    // Retrieve full order history to aggregate payment records
    const orderData = await orderRepository.getAll({ page: 1, limit: 1000 });
    const orders = orderData.orders || [];

    // Map orders to financial payment transactions
    let payments = orders.map((order) => {
      const paymentId = order.razorpayPaymentId || `PAY-COD-${order.id}`;
      return {
        id: paymentId,
        paymentId,
        orderId: order.id,
        razorpayOrderId: order.razorpayOrderId || null,
        razorpayPaymentId: order.razorpayPaymentId || null,
        customerName: order.customerName || order.deliveryAddress?.fullName || 'Customer',
        customerPhone: order.customerPhone || order.deliveryAddress?.mobileNumber || '',
        amount: Number(order.total) || 0,
        currency: 'INR',
        paymentMethod: order.paymentMethod || 'COD',
        paymentStatus: order.paymentStatus || (order.orderStatus === 'DELIVERED' ? 'PAID' : 'PENDING'),
        paidAt: order.paidAt || (order.paymentStatus === 'PAID' ? order.createdAt : null),
        createdAt: order.createdAt,
        orderStatus: order.orderStatus,
        itemsCount: order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 1,
        itemsSummary: order.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ') || '',
        city: order.deliveryAddress?.city || 'Delhi NCR',
      };
    });

    // Compute universal metrics across all payments
    let totalCapturedVolume = 0;
    let successfulCount = 0;
    let pendingCount = 0;
    let refundedCount = 0;
    let failedCount = 0;

    for (const p of payments) {
      if (p.paymentStatus === 'PAID') {
        totalCapturedVolume += p.amount;
        successfulCount++;
      } else if (p.paymentStatus === 'PENDING') {
        pendingCount++;
      } else if (p.paymentStatus === 'REFUNDED') {
        refundedCount++;
      } else if (p.paymentStatus === 'FAILED') {
        failedCount++;
      }
    }

    const averageOrderValue = successfulCount > 0 ? Math.round(totalCapturedVolume / successfulCount) : 0;

    const metrics = {
      totalVolume: totalCapturedVolume,
      successfulCount,
      pendingCount,
      refundedCount,
      failedCount,
      averageOrderValue,
      totalTransactions: payments.length,
    };

    // Apply filtering
    if (status && status.toUpperCase() !== 'ALL') {
      const s = status.toUpperCase();
      payments = payments.filter((p) => p.paymentStatus === s);
    }

    if (method && method.toUpperCase() !== 'ALL') {
      const m = method.toUpperCase();
      payments = payments.filter((p) => p.paymentMethod === m);
    }

    if (startDate) {
      const startIso = new Date(startDate).toISOString();
      payments = payments.filter((p) => (p.createdAt || '') >= startIso);
    }

    if (endDate) {
      const end = new Date(endDate);
      if (String(endDate).length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      const endIso = end.toISOString();
      payments = payments.filter((p) => (p.createdAt || '') <= endIso);
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      payments = payments.filter(
        (p) =>
          p.paymentId.toLowerCase().includes(term) ||
          p.orderId.toLowerCase().includes(term) ||
          (p.razorpayOrderId && p.razorpayOrderId.toLowerCase().includes(term)) ||
          p.customerName.toLowerCase().includes(term) ||
          p.customerPhone.includes(term)
      );
    }

    // Sort descending by date
    payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = payments.length;
    const skip = (pageNum - 1) * limitNum;
    const paginated = payments.slice(skip, skip + limitNum);

    res.json({
      success: true,
      payments: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      metrics,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch payment records.',
    });
  }
});

/**
 * POST /api/admin/payments/:orderId/refund
 * Mark an order payment as REFUNDED
 */
router.post('/:orderId/refund', requireRole([ADMIN_ROLES.SUPER_ADMIN]), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await orderRepository.getById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order #${orderId} not found.`,
      });
    }

    const updated = await orderRepository.updateStatus(orderId, {
      paymentStatus: 'REFUNDED',
      note: `Refund issued by admin: ${reason || 'Customer request'}`,
      updatedBy: `ADMIN (${req.admin?.email || 'Admin'})`,
    });

    res.json({
      success: true,
      message: `Payment for order #${orderId} has been marked as REFUNDED.`,
      order: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to process refund.',
    });
  }
});

export default router;
