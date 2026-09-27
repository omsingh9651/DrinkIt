import { Router } from 'express';
import { orderService } from '../services/orderService.js';
import { requireCustomerAuth, requireAdminOrCustomerAuth } from '../middleware/customerAuth.js';

const router = Router();

/**
 * POST /api/orders
 * Create new customer order (strictly bound to verified customer JWT)
 */
router.post('/', requireCustomerAuth, async (req, res) => {
  try {
    const customerPhone = req.user.phone;

    const { items, deliveryAddress, paymentMethod, promoCode, customerName, latitude, longitude } = req.body;

    const order = await orderService.createOrder({
      customerPhone,
      customerName,
      items,
      deliveryAddress,
      paymentMethod,
      promoCode,
      latitude,
      longitude,
    });

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      order,
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to place order. Please try again.',
    });
  }
});

/**
 * GET /api/orders/my-orders
 * List orders for authenticated customer
 */
router.get('/my-orders', requireCustomerAuth, async (req, res) => {
  try {
    const customerPhone = req.user.phone;
    const orders = await orderService.getOrdersByCustomer(customerPhone);
    return res.json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error('Fetch customer orders error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve order history.',
    });
  }
});

/**
 * GET /api/orders/:orderId
 * Get specific order details (Authorized for order owner or verified admin)
 */
router.get('/:orderId', requireAdminOrCustomerAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${orderId} not found.`,
      });
    }

    // If caller is not an admin, verify customer ownership
    if (!req.admin) {
      if (!req.user || order.customerPhone !== req.user.phone) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You do not have permission to view this order.',
        });
      }
    }

    return res.json({
      success: true,
      order,
    });
  } catch (err) {
    console.error('Fetch order detail error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve order details.',
    });
  }
});

/**
 * PATCH & POST /api/orders/:orderId/cancel
 * Cancel order by customer or admin (Allowed only for PENDING or CONFIRMED orders)
 */
const handleCancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body || {};

    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${orderId} not found.`,
      });
    }

    // If caller is not an admin, verify customer ownership
    if (!req.admin) {
      if (!req.user || order.customerPhone !== req.user.phone) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You can only cancel your own orders.',
        });
      }
    }

    const cancellationPhone = req.admin ? order.customerPhone : req.user.phone;
    const cancelledOrder = await orderService.cancelCustomerOrder(
      orderId,
      cancellationPhone,
      reason || (req.admin ? 'Cancelled by Administrator' : 'Cancelled by customer')
    );

    return res.json({
      success: true,
      message: `Order #${orderId} has been successfully cancelled.`,
      order: cancelledOrder,
    });
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to cancel order.',
    });
  }
};

router.patch('/:orderId/cancel', requireAdminOrCustomerAuth, handleCancelOrder);
router.post('/:orderId/cancel', requireAdminOrCustomerAuth, handleCancelOrder);

/**
 * GET /api/orders/:orderId/track
 * Get live delivery tracking information for an order (Admin or verified owner)
 */
router.get('/:orderId/track', requireAdminOrCustomerAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${orderId} not found.`,
      });
    }

    // Verification: Admin has full access; customer can only track their own order
    if (!req.admin) {
      if (!req.user || order.customerPhone !== req.user.phone) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You do not have permission to track this order.',
        });
      }
    }

    const currentCoords = order.currentDeliveryLocation || order.pickupLocation || {
      latitude: 26.5037,
      longitude: 80.2525,
    };

    const routePolyline = Array.isArray(order.route)
      ? order.route
      : Array.isArray(order.route?.coordinates)
        ? order.route.coordinates
        : order.pickupLocation && order.dropoffLocation
          ? [
              [order.pickupLocation.longitude, order.pickupLocation.latitude],
              [order.dropoffLocation.longitude, order.dropoffLocation.latitude],
            ]
          : [];

    return res.json({
      success: true,
      tracking: {
        orderId: order.id,
        orderStatus: order.orderStatus,
        deliveryStatus: order.deliveryStatus || 'PENDING',
        deliveryPartner: {
          id: order.deliveryPartnerId || 'DP-2081',
          name: order.deliveryPartnerName || 'Suraj Singh (Express Rider)',
          phone: order.deliveryPartnerPhone || '9876543210',
        },
        pickupLocation: order.pickupLocation,
        dropoffLocation: order.dropoffLocation,
        currentCoords,
        currentDeliveryLocation: currentCoords,
        route: order.route,
        routePolyline,
        etaMinutes: order.estimatedMinutes || 20,
        distanceRemainingKm: order.distanceRemainingKm || 4.5,
        lastUpdated: order.lastLocationUpdateAt || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Fetch tracking error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve live tracking data.',
    });
  }
});

export default router;

