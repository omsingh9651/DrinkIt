import { productRepository } from '../repositories/productRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { deliveryPartnerRepository } from '../repositories/deliveryPartnerRepository.js';
import { deliveryTrackingRepository } from '../repositories/deliveryTrackingRepository.js';
import { routingService } from './routingService.js';
import { razorpayService } from './razorpayService.js';
import { getRazorpayConfig } from '../config/razorpay.js';
import { couponService } from './couponService.js';

export const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

class OrderService {
  cleanPhone(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  generateOrderId() {
    const timestampPart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `DKT-${timestampPart}-${randomPart}`;
  }

  /**
   * Create new Order with atomic stock reservation and trusted backend calculations
   */
  async createOrder({
    customerPhone,
    customerName,
    items,
    deliveryAddress,
    paymentMethod = 'COD',
    promoCode = '',
    latitude,
    longitude,
  }) {
    const cleanCustomerPhone = this.cleanPhone(customerPhone);
    if (!cleanCustomerPhone) {
      throw new Error('Authenticated customer phone number is required.');
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      throw new Error('A valid delivery address is required.');
    }

    const resolvedFullName = deliveryAddress.fullName || customerName || 'DrinkIt Customer';
    deliveryAddress.fullName = resolvedFullName;

    if (
      !deliveryAddress.house ||
      !deliveryAddress.street ||
      !deliveryAddress.city ||
      !deliveryAddress.pinCode
    ) {
      throw new Error('Incomplete delivery address. Please provide full street, house, city, and pincode.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Your cart is empty. Please add items before placing an order.');
    }

    // 1. Fetch products, verify availability, build line snapshots
    const itemSnapshots = [];
    let subtotal = 0;

    for (const item of items) {
      const productId = item.productId || item.product?.id || item.id;
      const quantity = parseInt(item.quantity, 10);

      if (!productId || isNaN(quantity) || quantity <= 0) {
        throw new Error('Invalid cart item provided.');
      }

      const product = await productRepository.getById(productId);
      if (!product) {
        throw new Error(`Product "${productId}" is no longer available in the DrinkIt catalog.`);
      }

      if (product.status === 'inactive' || product.active === false) {
        throw new Error(`Product "${product.name}" is currently inactive and cannot be ordered.`);
      }

      const availableStock = product.stockQuantity !== undefined ? Number(product.stockQuantity) : Number(product.stock || 0);

      if (availableStock < quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${quantity}.`
        );
      }

      const itemPrice = Number(product.sellingPrice || product.price);
      const lineSubtotal = itemPrice * quantity;
      subtotal += lineSubtotal;

      itemSnapshots.push({
        productId: product.id,
        name: product.name,
        brand: product.brand || 'DrinkIt Reserve',
        category: product.category || 'Spirits',
        volume: product.volume || '750 ml',
        image:
          product.thumbnail ||
          (Array.isArray(product.images) && product.images[0]) ||
          product.image ||
          product.imageUrl ||
          '',
        price: itemPrice,
        originalPrice: product.mrp || product.originalPrice || itemPrice,
        mrp: product.mrp || product.originalPrice || itemPrice,
        quantity,
        subtotal: lineSubtotal,
      });
    }

    // 2. Server-side calculations
    // Free delivery on orders >= ₹999, else ₹99
    const deliveryFee = subtotal >= 999 ? 0 : 99;

    // Promo code discount dynamically computed via couponService
    let discount = 0;
    let appliedPromo = null;
    const cleanPromo = String(promoCode || '').trim().toUpperCase();
    if (cleanPromo) {
      try {
        const valRes = await couponService.validateAndCalculateDiscount({
          code: cleanPromo,
          subtotal,
          customerPhone: cleanCustomerPhone,
        });
        if (valRes.isValid) {
          discount = valRes.discount;
          appliedPromo = valRes.coupon.code;
        }
      } catch (couponErr) {
        console.warn(`[OrderService] Promo code ${cleanPromo} validation note:`, couponErr.message);
      }
    }

    const total = Math.max(0, subtotal - discount + deliveryFee);
    const orderId = this.generateOrderId();

    // 3. Atomic Stock Reservation with Rollback on failure
    const reservedItems = [];
    try {
      for (const snap of itemSnapshots) {
        await productRepository.atomicDecreaseStock(snap.productId, snap.quantity, {
          referenceId: orderId,
          performedBy: `CUSTOMER (+91 ${cleanCustomerPhone})`,
          reason: `Customer order #${orderId}`,
        });
        reservedItems.push(snap);
      }
    } catch (stockErr) {
      // Rollback any items already deducted
      for (const resItem of reservedItems) {
        await productRepository.atomicRestoreStock(resItem.productId, resItem.quantity, {
          referenceId: orderId,
          performedBy: 'SYSTEM (Order Rollback)',
          reason: `Rollback reservation for order #${orderId}`,
        });
      }
      throw stockErr;
    }

    // 4. Coordinates & Nearest Store Assignment
    const rawLat = latitude !== undefined ? latitude : deliveryAddress?.latitude;
    const numLat = Number(rawLat);
    const finalLat = !isNaN(numLat) && numLat >= -90 && numLat <= 90 ? numLat : 26.5037;

    const rawLng = longitude !== undefined ? longitude : deliveryAddress?.longitude;
    const numLng = Number(rawLng);
    const finalLng = !isNaN(numLng) && numLng >= -180 && numLng <= 180 ? numLng : 80.2525;

    const nearestStore = await storeRepository.findNearest(finalLat, finalLng);

    // 5. Build and save order
    const orderDoc = {
      id: orderId,
      customerId: cleanCustomerPhone,
      customerPhone: cleanCustomerPhone,
      customerName: customerName || deliveryAddress.fullName || `Customer +91 ${cleanCustomerPhone}`,
      customerDetails: {
        fullName: customerName || deliveryAddress.fullName,
        phoneNumber: `+91 ${cleanCustomerPhone}`,
      },
      items: itemSnapshots,
      deliveryAddress: {
        fullName: deliveryAddress.fullName,
        mobileNumber: this.cleanPhone(deliveryAddress.mobileNumber) || cleanCustomerPhone,
        house: deliveryAddress.house,
        street: deliveryAddress.street,
        landmark: deliveryAddress.landmark || '',
        city: deliveryAddress.city,
        state: deliveryAddress.state || 'Uttar Pradesh',
        pinCode: deliveryAddress.pinCode,
        type: deliveryAddress.type || 'Home',
        latitude: finalLat,
        longitude: finalLng,
      },
      subtotal,
      discount,
      deliveryFee,
      deliveryCharge: deliveryFee,
      taxesOrFees: 0,
      total,
      grandTotal: total,
      totalAmount: total,
      promoCode: cleanPromo || null,
      paymentMethod: paymentMethod === 'RAZORPAY' ? 'RAZORPAY' : 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      statusHistory: [
        {
          status: 'PENDING',
          timestamp: new Date().toISOString(),
          note: 'Order placed successfully by customer.',
          updatedBy: 'CUSTOMER',
        },
      ],
      latitude: finalLat,
      longitude: finalLng,
      assignedStore: nearestStore?.id,
      storeId: nearestStore?.id,
      storeName: nearestStore?.name,
      assignedDeliveryPartner: null,
      deliveryPartnerId: null,
      deliveryPartnerName: null,
      deliveryPartnerPhone: null,
      deliveryPartnerVehicle: null,
      pickupLocation: {
        id: nearestStore.id,
        name: nearestStore.name,
        address: nearestStore.address,
        phone: nearestStore.phone,
        latitude: nearestStore.latitude,
        longitude: nearestStore.longitude,
      },
      dropoffLocation: {
        address: `${deliveryAddress.house}, ${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.pinCode}`,
        latitude: finalLat,
        longitude: finalLng,
      },
      currentDeliveryLocation: null,
      route: null,
      estimatedMinutes: null,
      distanceRemainingKm: null,
    };

    const createdOrder = await orderRepository.create(orderDoc);

    if (appliedPromo) {
      couponService
        .recordCouponUsage({
          code: appliedPromo,
          customerPhone: cleanCustomerPhone,
          orderId: createdOrder.id,
        })
        .catch((err) => console.warn('[OrderService] Failed to record coupon usage:', err.message));
    }

    return createdOrder;
  }

  async getOrdersByCustomer(customerPhone) {
    return orderRepository.getByCustomer(customerPhone);
  }

  async getOrderById(orderId) {
    return orderRepository.getById(orderId);
  }

  async getAllOrders(params = {}) {
    return orderRepository.getAll(params);
  }

  /**
   * Update order status & payment status with automated lifecycle handling
   */
  async updateOrderStatus(orderId, { orderStatus, paymentStatus, note, adminEmail }) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const previousStatus = order.orderStatus;
    const extraFields = {};

    if (orderStatus) {
      const nextStatus = orderStatus.toUpperCase();

      if (nextStatus !== previousStatus) {
        const allowed = ALLOWED_STATUS_TRANSITIONS[previousStatus];
        if (allowed !== undefined && !allowed.includes(nextStatus)) {
          throw new Error(
            `Invalid status transition: Cannot change order status from "${previousStatus}" to "${nextStatus}". Allowed transitions: ${
              allowed.length > 0 ? allowed.join(', ') : 'None (Terminal state)'
            }.`
          );
        }

        // Unpaid online order guard: cannot advance to fulfillment or confirmation without payment
        if (
          order.paymentMethod === 'RAZORPAY' &&
          order.paymentStatus !== 'PAID' &&
          ['CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(nextStatus)
        ) {
          throw new Error(
            `Cannot advance unpaid online order #${orderId} to ${nextStatus}. Payment status is ${order.paymentStatus}; order must be PAID before fulfillment or dispatch.`
          );
        }
      }

      // If cancelling, restore product inventory (idempotent: prevent duplicate restoration)
      if (nextStatus === 'CANCELLED') {
        if (previousStatus !== 'CANCELLED' && !order.stockRestored) {
          for (const item of order.items) {
            await productRepository.atomicRestoreStock(item.productId, item.quantity, {
              referenceId: order.id,
              performedBy: adminEmail ? `ADMIN (${adminEmail})` : 'ADMIN',
              reason: `Order #${order.id} cancelled by admin`,
            });
          }
          extraFields.stockRestored = true;
          extraFields.stockRestoredAt = new Date();
        }
        extraFields.deliveryStatus = null;
        if (order.deliveryPartnerId) {
          await deliveryPartnerRepository.releasePartner(order.deliveryPartnerId, order.id);
        }
      }

      // If moving to OUT_FOR_DELIVERY
      if (nextStatus === 'OUT_FOR_DELIVERY') {
        const existingPartnerId = order.deliveryPartnerId;
        if (!existingPartnerId) {
          const partner = await deliveryPartnerRepository.getFirstAvailable();
          extraFields.deliveryPartnerId = partner.id;
          extraFields.deliveryPartnerName = partner.name;
          extraFields.deliveryPartnerPhone = partner.cleanPhone || partner.phone;
          extraFields.deliveryPartnerVehicle = `${partner.vehicleType} (${partner.vehicleNumber})`;
          await deliveryPartnerRepository.assignOrder(partner.id, order.id);
        } else {
          await deliveryPartnerRepository.assignOrder(existingPartnerId, order.id);
        }

        // Ensure pickup store exists
        if (!order.pickupLocation || !order.pickupLocation.latitude) {
          const nearestStore = await storeRepository.findNearest(
            order.dropoffLocation?.latitude || order.latitude,
            order.dropoffLocation?.longitude || order.longitude
          );
          extraFields.storeId = nearestStore.id;
          extraFields.storeName = nearestStore.name;
          extraFields.pickupLocation = {
            id: nearestStore.id,
            name: nearestStore.name,
            address: nearestStore.address,
            phone: nearestStore.phone,
            latitude: nearestStore.latitude,
            longitude: nearestStore.longitude,
          };
        } else {
          extraFields.storeId = order.pickupLocation.id;
          extraFields.storeName = order.pickupLocation.name;
        }

        // Initialize current delivery location at pickup store if not set
        if (!order.currentDeliveryLocation) {
          const startCoords = extraFields.pickupLocation || order.pickupLocation;
          extraFields.currentDeliveryLocation = {
            latitude: startCoords.latitude,
            longitude: startCoords.longitude,
            heading: 0,
            speed: 0,
            timestamp: new Date().toISOString(),
          };
        }

        // Compute route if missing
        if (!order.route && order.dropoffLocation) {
          try {
            const startLoc = extraFields.currentDeliveryLocation || order.currentDeliveryLocation || extraFields.pickupLocation || order.pickupLocation;
            const calculatedRoute = await routingService.calculateDeliveryRoute(startLoc, order.dropoffLocation);
            extraFields.route = calculatedRoute.geometry?.coordinates || calculatedRoute.geometry;
            extraFields.estimatedMinutes = calculatedRoute.etaMinutes;
            extraFields.distanceRemainingKm = calculatedRoute.distanceKm;
          } catch (err) {
            console.warn('Auto route calculation on OUT_FOR_DELIVERY failed:', err.message);
          }
        }

        extraFields.deliveryStatus = 'ON_THE_WAY';
        extraFields.trackingStartedAt = order.trackingStartedAt || new Date().toISOString();
      } else if (nextStatus === 'DELIVERED') {
        extraFields.deliveryStatus = 'DELIVERED';
        extraFields.estimatedMinutes = 0;
        extraFields.distanceRemainingKm = 0;
        extraFields.trackingStoppedAt = new Date().toISOString();
        if (order.deliveryPartnerId) {
          await deliveryPartnerRepository.releasePartner(order.deliveryPartnerId, order.id);
        }
      }
    }

    return orderRepository.updateStatus(orderId, {
      orderStatus,
      paymentStatus,
      note,
      updatedBy: adminEmail ? `ADMIN (${adminEmail})` : 'ADMIN',
      extraFields,
    });
  }

  /**
   * Cancel order by customer with inventory restoration
   */
  async cancelCustomerOrder(orderId, customerPhone, reason = 'Cancelled by customer') {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error(`Order #${orderId} not found.`);

    const clean = this.cleanPhone(customerPhone);
    if (order.customerPhone !== clean) {
      throw new Error('Unauthorized: You can only cancel your own orders.');
    }

    const currentStatus = order.orderStatus;
    if (currentStatus !== 'PENDING' && currentStatus !== 'CONFIRMED') {
      throw new Error(`Order #${orderId} cannot be cancelled as it is already ${currentStatus}.`);
    }

    // Restore stock (idempotent: prevent duplicate restoration)
    if (!order.stockRestored) {
      for (const item of order.items) {
        await productRepository.atomicRestoreStock(item.productId, item.quantity, {
          referenceId: order.id,
          performedBy: `CUSTOMER (+91 ${clean})`,
          reason: `Customer cancelled order #${order.id}: ${reason}`,
        });
      }
    }

    // Release partner if assigned
    if (order.deliveryPartnerId) {
      await deliveryPartnerRepository.releasePartner(order.deliveryPartnerId, order.id);
    }

    return orderRepository.updateStatus(orderId, {
      orderStatus: 'CANCELLED',
      note: `Customer cancellation: ${reason}`,
      updatedBy: 'CUSTOMER',
      extraFields: {
        deliveryStatus: null,
        stockRestored: true,
        stockRestoredAt: new Date(),
      },
    });
  }

  async updateDeliveryTracking(orderId, updateData = {}) {
    if (!orderId) return null;

    const trackingData = {};

    if (updateData.location) {
      trackingData.currentDeliveryLocation = {
        latitude: Number(updateData.location.latitude),
        longitude: Number(updateData.location.longitude),
        heading: Number(updateData.location.heading) || 0,
        speed: Number(updateData.location.speed) || 0,
        timestamp: updateData.location.timestamp || new Date().toISOString(),
      };
    } else if (updateData.currentDeliveryLocation) {
      trackingData.currentDeliveryLocation = {
        latitude: Number(updateData.currentDeliveryLocation.latitude),
        longitude: Number(updateData.currentDeliveryLocation.longitude),
        heading: Number(updateData.currentDeliveryLocation.heading) || 0,
        speed: Number(updateData.currentDeliveryLocation.speed) || 0,
        timestamp: updateData.currentDeliveryLocation.timestamp || new Date().toISOString(),
      };
    } else if (updateData.latitude !== undefined && updateData.longitude !== undefined) {
      trackingData.currentDeliveryLocation = {
        latitude: Number(updateData.latitude),
        longitude: Number(updateData.longitude),
        heading: Number(updateData.heading) || 0,
        speed: Number(updateData.speed) || 0,
        timestamp: updateData.timestamp || new Date().toISOString(),
      };
    }

    if (updateData.route !== undefined) {
      trackingData.route = updateData.route;
    }
    if (updateData.estimatedMinutes !== undefined && updateData.estimatedMinutes !== null) {
      trackingData.estimatedMinutes = Math.max(0, Number(updateData.estimatedMinutes));
    }
    if (updateData.distanceRemainingKm !== undefined && updateData.distanceRemainingKm !== null) {
      trackingData.distanceRemainingKm = Math.max(0, Number(updateData.distanceRemainingKm));
    }
    if (updateData.deliveryStatus) {
      trackingData.deliveryStatus = updateData.deliveryStatus;
    }
    if (updateData.orderStatus) {
      trackingData.orderStatus = updateData.orderStatus;
    }

    // Persist to both Order and DeliveryTracking collections
    const updatedOrder = await orderRepository.updateTracking(orderId, trackingData);
    await deliveryTrackingRepository.updateTracking(orderId, {
      ...trackingData,
      ...updateData,
      deliveryPartnerId: updatedOrder?.deliveryPartnerId || updateData.deliveryPartnerId,
    });

    return updatedOrder;
  }

  async updateDeliveryCoordinates(orderId, { latitude, longitude, heading, speed, distanceRemainingKm, etaMinutes, status }) {
    return this.updateDeliveryTracking(orderId, {
      latitude,
      longitude,
      heading,
      speed,
      distanceRemainingKm,
      estimatedMinutes: etaMinutes,
      deliveryStatus: status,
    });
  }

  async assignPartnerAndStore(orderId, { partnerId, storeId }) {
    const existingOrder = await this.getOrderById(orderId);
    if (!existingOrder) throw new Error(`Order #${orderId} not found.`);

    const extraFields = {};

    if (partnerId) {
      const partner = typeof deliveryPartnerRepository.getPartnerById === 'function'
        ? await deliveryPartnerRepository.getPartnerById(partnerId)
        : await deliveryPartnerRepository.getById(partnerId);
      if (partner) {
        extraFields.deliveryPartnerId = partner.id;
        extraFields.deliveryPartnerName = partner.name;
        extraFields.deliveryPartnerPhone = partner.cleanPhone || partner.phone;
        extraFields.deliveryPartnerVehicle = `${partner.vehicleType} (${partner.vehicleNumber})`;
        await deliveryPartnerRepository.assignOrder(partner.id, orderId);
      }
    }

    if (storeId) {
      const store = await storeRepository.getById(storeId);
      if (store) {
        extraFields.storeId = store.id;
        extraFields.storeName = store.name;
        extraFields.pickupLocation = {
          id: store.id,
          name: store.name,
          address: store.address,
          phone: store.phone,
          latitude: store.latitude,
          longitude: store.longitude,
        };

        if (!existingOrder.currentDeliveryLocation || existingOrder.deliveryStatus !== 'ON_THE_WAY') {
          extraFields.currentDeliveryLocation = {
            latitude: store.latitude,
            longitude: store.longitude,
            heading: 0,
            speed: 0,
            timestamp: new Date().toISOString(),
          };
        }

        const dropoff = existingOrder.dropoffLocation || {
          latitude: existingOrder.latitude,
          longitude: existingOrder.longitude,
        };
        if (dropoff && dropoff.latitude && dropoff.longitude) {
          try {
            const startLoc = extraFields.currentDeliveryLocation || extraFields.pickupLocation;
            const calculated = await routingService.calculateDeliveryRoute(startLoc, dropoff);
            extraFields.route = calculated.geometry?.coordinates || calculated.geometry;
            extraFields.estimatedMinutes = calculated.etaMinutes;
            extraFields.distanceRemainingKm = calculated.distanceKm;
          } catch (e) {
            console.warn('Recalculate route on store reassignment failed:', e.message);
          }
        }
      }
    }

    return orderRepository.updateStatus(orderId, {
      note: 'Admin assigned courier and store hub',
      updatedBy: 'ADMIN',
      extraFields,
    });
  }

  async assignDeliveryPartner(orderId, { partnerId }) {
    return this.assignPartnerAndStore(orderId, { partnerId });
  }

  async resetDeliveryLocation(orderId) {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error(`Order #${orderId} not found.`);

    const pickup = order.pickupLocation || { latitude: 26.4715, longitude: 80.3440 };
    const trackingData = {
      currentDeliveryLocation: {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        heading: 0,
        speed: 0,
        timestamp: new Date().toISOString(),
      },
      deliveryStatus: 'ON_THE_WAY',
    };

    const dropoff = order.dropoffLocation || {
      latitude: order.latitude,
      longitude: order.longitude,
    };
    if (dropoff && dropoff.latitude && dropoff.longitude) {
      try {
        const calculated = await routingService.calculateDeliveryRoute(pickup, dropoff);
        trackingData.route = calculated.geometry?.coordinates || calculated.geometry;
        trackingData.estimatedMinutes = calculated.etaMinutes;
        trackingData.distanceRemainingKm = calculated.distanceKm;
      } catch (e) {
        console.warn('Recalculate route on reset failed:', e.message);
      }
    }

    return orderRepository.updateTracking(orderId, trackingData);
  }

  /**
   * Create Razorpay Checkout order with trusted server calculations and atomic stock hold
   */
  async createRazorpayCheckoutOrder({
    customerPhone,
    customerName,
    items,
    deliveryAddress,
    promoCode = '',
    latitude,
    longitude,
  }) {
    // 1. Create DrinkIt order (reserves stock, computes server-side trusted pricing, assigns nearest store)
    const order = await this.createOrder({
      customerPhone,
      customerName,
      items,
      deliveryAddress,
      paymentMethod: 'RAZORPAY',
      promoCode,
      latitude,
      longitude,
    });

    // 2. Calculate amount in paise (100 paise = ₹1.00)
    const amountPaise = Math.round(Number(order.total) * 100);

    // 3. Create Razorpay Test Mode order
    const razorpayOrder = await razorpayService.createRazorpayOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.id,
      notes: {
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        orderId: order.id,
      },
    });

    // 4. Associate Razorpay Order ID with DrinkIt order in DB
    const updatedOrder = await orderRepository.updateStatus(order.id, {
      note: `Razorpay test order initialized: ${razorpayOrder.id}`,
      updatedBy: 'SYSTEM (Razorpay Checkout)',
      extraFields: {
        razorpayOrderId: razorpayOrder.id,
      },
    });

    const { keyId } = getRazorpayConfig();

    return {
      order: updatedOrder,
      razorpayOrder,
      keyId,
    };
  }

  /**
   * Cryptographically verify Razorpay payment and confirm order
   */
  async verifyAndConfirmRazorpayPayment({
    orderId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
    customerPhone,
  }) {
    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      throw new Error('Incomplete payment verification payload. All Razorpay payment fields are required.');
    }

    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    // Customer ownership validation
    const cleanPhone = this.cleanPhone(customerPhone);
    if (cleanPhone && order.customerPhone !== cleanPhone) {
      throw new Error('Unauthorized: You do not have permission to verify payment for this order.');
    }

    // Idempotency: If already paid, return safely without duplicate processing
    if (order.paymentStatus === 'PAID') {
      return {
        success: true,
        message: `Order #${orderId} has already been verified and paid.`,
        order,
        alreadyPaid: true,
      };
    }

    // Verify order ID match
    if (order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
      throw new Error(`Razorpay Order ID mismatch. Expected ${order.razorpayOrderId}, received ${razorpayOrderId}.`);
    }

    // Verify cryptographic HMAC-SHA256 signature
    const isValidSignature = razorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValidSignature) {
      // Record verification failure
      await orderRepository.updateStatus(orderId, {
        paymentStatus: 'FAILED',
        note: `Cryptographic HMAC verification failed for Razorpay payment ${razorpayPaymentId}.`,
        updatedBy: 'SYSTEM (Razorpay Security)',
        extraFields: {
          razorpayPaymentId,
          razorpayOrderId,
          paymentFailureReason: 'Invalid HMAC signature',
        },
      });

      throw new Error('Cryptographic signature verification failed. Payment authenticity could not be verified.');
    }

    // Payment is verified: Mark PAID and CONFIRMED
    const confirmedOrder = await orderRepository.updateStatus(orderId, {
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PAID',
      note: `Payment of ₹${order.total} successfully verified via Razorpay Test Mode (Payment ID: ${razorpayPaymentId}).`,
      updatedBy: 'SYSTEM (Razorpay)',
      extraFields: {
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
        paidAt: new Date().toISOString(),
        paymentFailureReason: null,
      },
    });

    return {
      success: true,
      message: `Payment of ₹${order.total} verified successfully. Order #${orderId} is confirmed.`,
      order: confirmedOrder,
    };
  }

  /**
   * Record payment failure or cancellation
   */
  async recordRazorpayPaymentFailure({
    orderId,
    customerPhone,
    reason,
    razorpayPaymentId,
    razorpayOrderId,
  }) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const cleanPhone = this.cleanPhone(customerPhone);
    if (cleanPhone && order.customerPhone !== cleanPhone) {
      throw new Error('Unauthorized: You do not own this order.');
    }

    if (order.paymentStatus === 'PAID') {
      return { success: true, order };
    }

    const failureNote = reason || 'Customer cancelled or payment gateway timed out.';
    const updated = await orderRepository.updateStatus(orderId, {
      paymentStatus: 'FAILED',
      note: `Razorpay payment failed: ${failureNote}`,
      updatedBy: 'SYSTEM (Razorpay)',
      extraFields: {
        paymentFailureReason: failureNote,
        razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId || null,
        razorpayOrderId: razorpayOrderId || order.razorpayOrderId || null,
      },
    });

    return {
      success: true,
      message: 'Payment failure recorded.',
      order: updated,
    };
  }
}

export const orderService = new OrderService();
export default orderService;
