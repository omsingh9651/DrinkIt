import { Router } from 'express';
import { orderService } from '../services/orderService.js';
import { razorpayService } from '../services/razorpayService.js';
import { getRazorpayConfig } from '../config/razorpay.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';

const router = Router();

/**
 * GET /api/payment/config
 * Returns public Razorpay configuration (strictly NO secrets exposed)
 */
router.get('/config', (req, res) => {
  const config = getRazorpayConfig();
  res.json({
    success: true,
    keyId: config.keyId,
    mode: config.isTestMode ? 'test' : 'live',
    isConfigured: config.isConfigured,
  });
});

/**
 * POST /api/payment/razorpay/create-order
 * Initiates Razorpay Test Mode checkout order with server-calculated totals
 */
router.post('/razorpay/create-order', requireCustomerAuth, async (req, res) => {
  try {
    const customerPhone = req.user.phone;

    const { orderId, items, deliveryAddress, promoCode, customerName, latitude, longitude } = req.body;

    // Flow 1: Retry payment on an existing unpaid order
    if (orderId) {
      const existingOrder = await orderService.getOrderById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          error: `Order #${orderId} not found.`,
        });
      }

      if (existingOrder.customerPhone !== customerPhone) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You do not own this order.',
        });
      }

      if (existingOrder.paymentStatus === 'PAID') {
        return res.status(400).json({
          success: false,
          error: 'Order is already marked as PAID.',
          order: existingOrder,
        });
      }

      if (existingOrder.orderStatus === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          error: 'Cannot pay for a CANCELLED order.',
        });
      }

      const amountPaise = Math.round(Number(existingOrder.total) * 100);
      const razorpayOrder = await razorpayService.createRazorpayOrder({
        amount: amountPaise,
        currency: 'INR',
        receipt: existingOrder.id,
        notes: {
          customerPhone: existingOrder.customerPhone,
          customerName: existingOrder.customerName,
          orderId: existingOrder.id,
          retry: true,
        },
      });

      await orderRepository.updateStatus(existingOrder.id, {
        note: `Razorpay retry order initialized: ${razorpayOrder.id}`,
        updatedBy: 'SYSTEM (Razorpay Retry)',
        extraFields: {
          razorpayOrderId: razorpayOrder.id,
          paymentStatus: 'PENDING',
        },
      });

      const { keyId } = getRazorpayConfig();

      return res.status(200).json({
        success: true,
        order: existingOrder,
        razorpayOrder,
        keyId,
      });
    }

    // Flow 2: Initial checkout order creation
    const result = await orderService.createRazorpayCheckoutOrder({
      customerPhone,
      customerName,
      items,
      deliveryAddress,
      promoCode,
      latitude,
      longitude,
    });

    res.status(201).json({
      success: true,
      order: result.order,
      razorpayOrder: result.razorpayOrder,
      keyId: result.keyId,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to initialize Razorpay checkout order.',
    });
  }
});

/**
 * POST /api/payment/razorpay/verify
 * Cryptographically verifies Razorpay HMAC signature & marks order PAID
 */
router.post('/razorpay/verify', requireCustomerAuth, async (req, res) => {
  try {
    const customerPhone = req.user.phone;
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature',
      });
    }

    const result = await orderService.verifyAndConfirmRazorpayPayment({
      orderId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      customerPhone,
    });

    res.json(result);
  } catch (err) {
    console.error('Razorpay payment verification failed:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Payment verification failed.',
    });
  }
});

/**
 * POST /api/payment/razorpay/failed
 * Records payment failure or cancellation with error reason
 */
router.post('/razorpay/failed', requireCustomerAuth, async (req, res) => {
  try {
    const customerPhone = req.user.phone;
    const { orderId, reason, razorpayPaymentId, razorpayOrderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required.',
      });
    }

    const result = await orderService.recordRazorpayPaymentFailure({
      orderId,
      customerPhone,
      reason,
      razorpayPaymentId,
      razorpayOrderId,
    });

    res.json(result);
  } catch (err) {
    console.error('Error recording payment failure:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to record payment failure.',
    });
  }
});

/**
 * POST /api/payment/razorpay/simulate-success
 * Sandbox-only helper for automated tests and offline simulation
 * Strictly disabled in non-test mode
 */
router.post('/razorpay/simulate-success', requireCustomerAuth, async (req, res) => {
  try {
    const config = getRazorpayConfig();
    if (!config.isTestMode) {
      return res.status(403).json({
        success: false,
        error: 'Payment simulation is strictly forbidden outside of Test Mode.',
      });
    }

    const customerPhone = req.user.phone;
    const { orderId, razorpayOrderId } = req.body;

    if (!orderId || !razorpayOrderId) {
      return res.status(400).json({
        success: false,
        error: 'orderId and razorpayOrderId are required.',
      });
    }

    const simulatedPaymentId = `pay_test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const validSignature = razorpayService.generateTestSignature(razorpayOrderId, simulatedPaymentId);

    const result = await orderService.verifyAndConfirmRazorpayPayment({
      orderId,
      razorpayPaymentId: simulatedPaymentId,
      razorpayOrderId,
      razorpaySignature: validSignature,
      customerPhone,
    });

    res.json({
      ...result,
      isSimulated: true,
      razorpayPaymentId: simulatedPaymentId,
    });
  } catch (err) {
    console.error('Error in simulated test payment:', err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to simulate test payment.',
    });
  }
});

export default router;

