import jwt from 'jsonwebtoken';
import { orderService } from './orderService.js';
import { routingService } from './routingService.js';
import { deliveryPartnerService } from './deliveryPartnerService.js';
import env from '../config/env.js';

// Rate limiting tracking: socketId -> lastUpdateTime
const lastUpdateMap = new Map();
const MIN_UPDATE_INTERVAL_MS = 800; // 800ms rate limit

/**
 * Helper to extract any token from handshake
 */
function extractHandshakeToken(socket) {
  if (socket.handshake.auth?.token) return socket.handshake.auth.token;
  if (socket.handshake.auth?.adminToken) return socket.handshake.auth.adminToken;
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = socket.handshake.headers?.cookie;
  if (cookieHeader) {
    const adminMatch = cookieHeader.match(/admin_token=([^;]+)/);
    if (adminMatch) return decodeURIComponent(adminMatch[1]);
    const customerMatch = cookieHeader.match(/customer_token=([^;]+)/);
    if (customerMatch) return decodeURIComponent(customerMatch[1]);
  }
  return null;
}

export function setupDeliveryTrackingSocket(io) {
  // ----------------------------------------------------
  // Middleware: Require valid signed JWT for all socket connections
  // ----------------------------------------------------
  io.use(async (socket, next) => {
    try {
      const token = extractHandshakeToken(socket);
      if (!token) {
        return next(new Error('Authentication required: Valid JWT required for Socket.IO connection.'));
      }

      const adminSecret = env.ADMIN_JWT_SECRET;
      const customerSecret = env.CUSTOMER_JWT_SECRET || adminSecret;

      // 1. Try verifying as Admin
      if (adminSecret) {
        try {
          const decodedAdmin = jwt.verify(token, adminSecret);
          if (decodedAdmin && decodedAdmin.email && decodedAdmin.role) {
            socket.data = {
              isAuthorized: true,
              role: 'admin',
              admin: decodedAdmin,
            };
            return next();
          }
        } catch {
          // Not an admin token, continue
        }
      }

      // 2. Try verifying as Customer
      if (customerSecret) {
        try {
          const decodedCustomer = jwt.verify(token, customerSecret);
          if (decodedCustomer && decodedCustomer.phone) {
            const cleanPhone = String(decodedCustomer.phone).replace(/\D/g, '').slice(-10);
            socket.data = {
              isAuthorized: true,
              role: 'customer',
              user: decodedCustomer,
              customerPhone: cleanPhone,
            };
            return next();
          }
        } catch (err) {
          if (err.name === 'TokenExpiredError') {
            return next(new Error('Authentication session expired: Please sign in again.'));
          }
        }
      }

      return next(new Error('Invalid or expired authentication token.'));
    } catch (err) {
      return next(new Error(`Socket authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    // ----------------------------------------------------
    // Event: delivery:join-order
    // Joins the order-specific tracking room after strict ownership verification
    // ----------------------------------------------------
    socket.on('delivery:join-order', async (data = {}, callback) => {
      try {
        const { orderId } = data;
        if (!orderId) {
          if (callback) callback({ success: false, error: 'Order ID is required.' });
          return;
        }

        const order = await orderService.getOrderById(orderId);
        if (!order) {
          if (callback) callback({ success: false, error: `Order #${orderId} not found.` });
          return;
        }

        // Authorization check: Admin has full access; customer can ONLY join their own order
        const isAdmin = socket.data?.role === 'admin';
        const isCustomer = socket.data?.role === 'customer';

        if (!isAdmin && isCustomer) {
          const cleanOrderPhone = String(order.customerPhone || '').replace(/\D/g, '').slice(-10);
          if (!socket.data.customerPhone || socket.data.customerPhone !== cleanOrderPhone) {
            if (callback) {
              callback({
                success: false,
                error: 'Unauthorized: You do not have permission to track this order.',
              });
            }
            return;
          }
        } else if (!isAdmin) {
          if (callback) {
            callback({
              success: false,
              error: 'Unauthorized: Authentication required to join order tracking.',
            });
          }
          return;
        }

        // Associate orderId with socket session
        socket.data.orderId = orderId;

        const roomName = `order:${orderId}`;
        socket.join(roomName);

        // Ensure OSRM route is computed if order is in delivery state and missing
        if (!order.route && order.pickupLocation && order.dropoffLocation) {
          try {
            const calculatedRoute = await routingService.calculateDeliveryRoute(
              order.currentDeliveryLocation || order.pickupLocation,
              order.dropoffLocation
            );
            order.route = calculatedRoute.geometry;
            order.estimatedMinutes = calculatedRoute.etaMinutes;
            order.distanceRemainingKm = calculatedRoute.distanceKm;
          } catch (err) {
            console.warn('Failed to pre-compute initial route:', err.message);
          }
        }

        const isDelivered = order.orderStatus === 'DELIVERED' || order.deliveryStatus === 'DELIVERED';

        const partnerInfo = order.deliveryPartnerId
          ? deliveryPartnerService.getPartnerById(order.deliveryPartnerId)
          : deliveryPartnerService.getFirstAvailablePartner();

        const trackingPayload = {
          orderId: order.id,
          orderStatus: order.orderStatus,
          deliveryStatus: isDelivered
            ? 'DELIVERED'
            : order.deliveryStatus || (order.orderStatus === 'OUT_FOR_DELIVERY' ? 'ON_THE_WAY' : 'PENDING'),
          deliveryPartner: {
            id: order.deliveryPartnerId || partnerInfo?.id || 'DP-2081',
            name: order.deliveryPartnerName || partnerInfo?.name || 'Suraj Singh',
            phone: order.deliveryPartnerPhone || partnerInfo?.cleanPhone || '9876543210',
            vehicleType: partnerInfo?.vehicleType || 'Electric Cargo Scooter',
            vehicleNumber: partnerInfo?.vehicleNumber || 'UP-78-EV-2081',
            vehicle: order.deliveryPartnerVehicle || (partnerInfo ? `${partnerInfo.vehicleType} (${partnerInfo.vehicleNumber})` : 'Electric Cargo Scooter (UP-78-EV-2081)'),
            avatar: partnerInfo?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            rating: partnerInfo?.rating || 4.9,
            isDemo: true,
          },
          pickupLocation: order.pickupLocation,
          dropoffLocation: order.dropoffLocation,
          currentDeliveryLocation: order.currentDeliveryLocation || {
            latitude: order.pickupLocation?.latitude || 26.4715,
            longitude: order.pickupLocation?.longitude || 80.3440,
            heading: 0,
            speed: 0,
            timestamp: new Date().toISOString(),
          },
          route: order.route,
          etaMinutes: isDelivered ? 0 : (order.estimatedMinutes || 15),
          distanceRemainingKm: isDelivered ? 0 : (order.distanceRemainingKm || 3.5),
          lastUpdated: order.lastLocationUpdateAt || new Date().toISOString(),
          role: socket.data?.role || 'customer',
        };

        if (callback) {
          callback({
            success: true,
            data: trackingPayload,
          });
        }

        // Notify client with active tracking state
        socket.emit('delivery:tracking-started', trackingPayload);
      } catch (err) {
        console.error('delivery:join-order error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:start-sharing (Admin only)
    // ----------------------------------------------------
    socket.on('delivery:start-sharing', async (data = {}, callback) => {
      try {
        const { orderId, partnerId, partnerName, initialLocation } = data;
        if (socket.data?.role !== 'admin') {
          if (callback) callback({ success: false, error: 'Unauthorized: Admin access required to start delivery sharing.' });
          return;
        }

        const order = await orderService.getOrderById(orderId);
        if (!order) {
          if (callback) callback({ success: false, error: 'Order not found.' });
          return;
        }

        // Calculate initial road route from current rider location to destination
        const fromLoc = initialLocation || order.pickupLocation;
        const routeData = await routingService.calculateDeliveryRoute(fromLoc, order.dropoffLocation);

        await orderService.updateDeliveryTracking(orderId, {
          location: fromLoc,
          route: routeData.geometry,
          estimatedMinutes: routeData.etaMinutes,
          distanceRemainingKm: routeData.distanceKm,
          deliveryStatus: 'ON_THE_WAY',
        });

        const partnerInfo = (partnerId || order.deliveryPartnerId)
          ? deliveryPartnerService.getPartnerById(partnerId || order.deliveryPartnerId)
          : deliveryPartnerService.getFirstAvailablePartner();

        const roomName = `order:${orderId}`;
        const trackingPayload = {
          orderId,
          deliveryPartner: {
            id: partnerId || order.deliveryPartnerId || partnerInfo?.id,
            name: partnerName || order.deliveryPartnerName || partnerInfo?.name,
            phone: order.deliveryPartnerPhone || partnerInfo?.cleanPhone || '9876543210',
            vehicleType: partnerInfo?.vehicleType || 'Electric Cargo Scooter',
            vehicleNumber: partnerInfo?.vehicleNumber || 'UP-78-EV-2081',
            vehicle: order.deliveryPartnerVehicle || (partnerInfo ? `${partnerInfo.vehicleType} (${partnerInfo.vehicleNumber})` : 'Electric Cargo Scooter (UP-78-EV-2081)'),
            avatar: partnerInfo?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            rating: partnerInfo?.rating || 4.9,
            isDemo: true,
          },
          pickupLocation: order.pickupLocation,
          dropoffLocation: order.dropoffLocation,
          currentDeliveryLocation: fromLoc,
          route: routeData.geometry,
          etaMinutes: routeData.etaMinutes,
          distanceRemainingKm: routeData.distanceKm,
          deliveryStatus: 'ON_THE_WAY',
          timestamp: new Date().toISOString(),
        };

        io.to(roomName).emit('delivery:tracking-started', trackingPayload);
        io.to(roomName).emit('delivery:status-updated', {
          orderId,
          orderStatus: 'OUT_FOR_DELIVERY',
          deliveryStatus: 'ON_THE_WAY',
          deliveryPartner: trackingPayload.deliveryPartner,
          currentDeliveryLocation: fromLoc,
          route: routeData.geometry,
          etaMinutes: routeData.etaMinutes,
          distanceRemainingKm: routeData.distanceKm,
        });

        if (callback) callback({ success: true, data: trackingPayload });
      } catch (err) {
        console.error('delivery:start-sharing error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:location-update (Admin only)
    // Real-time GPS coordinate stream from simulation
    // ----------------------------------------------------
    socket.on('delivery:location-update', async (data = {}, callback) => {
      try {
        const {
          orderId,
          latitude,
          longitude,
          heading = 0,
          speed = 0,
          accuracy = 10,
          etaMinutes,
          distanceRemainingKm,
        } = data;

        // Security authorization check: Strictly admin only
        if (socket.data?.role !== 'admin') {
          if (callback) {
            callback({
              success: false,
              error: 'Unauthorized: Only administrators can broadcast delivery simulation coordinates.',
            });
          }
          return;
        }

        if (!orderId || latitude === undefined || longitude === undefined) {
          if (callback) callback({ success: false, error: 'Invalid location payload' });
          return;
        }

        const lat = Number(latitude);
        const lng = Number(longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          if (callback) callback({ success: false, error: 'Coordinates out of bounds.' });
          return;
        }

        // Rate limiting check (relaxed for simulator ticks to support 2x and 5x speeds)
        const minInterval = data.isSimulator ? 100 : MIN_UPDATE_INTERVAL_MS;
        const now = Date.now();
        const lastTime = lastUpdateMap.get(socket.id) || 0;
        if (now - lastTime < minInterval) {
          if (callback) callback({ success: true, throttled: true });
          return;
        }
        lastUpdateMap.set(socket.id, now);

        const locationPayload = {
          latitude: lat,
          longitude: lng,
          heading: Number(heading) || 0,
          speed: Number(speed) || 0,
          accuracy: Number(accuracy) || 10,
          timestamp: new Date().toISOString(),
        };

        // Persist tracking telemetry in database / memory
        await orderService.updateDeliveryTracking(orderId, {
          location: locationPayload,
          estimatedMinutes: etaMinutes,
          distanceRemainingKm,
          deliveryStatus: 'ON_THE_WAY',
          orderStatus: 'OUT_FOR_DELIVERY',
        });

        // Broadcast to order room (io.to emits to ALL participants in the room)
        const roomName = `order:${orderId}`;
        io.to(roomName).emit('delivery:location-updated', {
          orderId,
          location: locationPayload,
          etaMinutes,
          distanceRemainingKm,
          deliveryStatus: 'ON_THE_WAY',
          orderStatus: 'OUT_FOR_DELIVERY',
          timestamp: locationPayload.timestamp,
        });

        if (callback) callback({ success: true, timestamp: locationPayload.timestamp });
      } catch (err) {
        console.error('delivery:location-update error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:pause-simulation (Admin only)
    // ----------------------------------------------------
    socket.on('delivery:pause-simulation', (data = {}) => {
      if (socket.data?.role !== 'admin') return;
      const { orderId } = data;
      if (orderId) {
        const roomName = `order:${orderId}`;
        io.to(roomName).emit('delivery:simulation-paused', {
          orderId,
          status: 'PAUSED',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:resume-simulation (Admin only)
    // ----------------------------------------------------
    socket.on('delivery:resume-simulation', (data = {}) => {
      if (socket.data?.role !== 'admin') return;
      const { orderId } = data;
      if (orderId) {
        const roomName = `order:${orderId}`;
        io.to(roomName).emit('delivery:simulation-resumed', {
          orderId,
          status: 'RUNNING',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:reset-tracking (Admin only)
    // ----------------------------------------------------
    socket.on('delivery:reset-tracking', async (data = {}, callback) => {
      try {
        if (socket.data?.role !== 'admin') {
          if (callback) callback({ success: false, error: 'Unauthorized: Admin access required.' });
          return;
        }

        const { orderId } = data;
        if (orderId) {
          await orderService.resetDeliveryLocation(orderId);
          const roomName = `order:${orderId}`;
          io.to(roomName).emit('delivery:tracking-reset', {
            orderId,
            timestamp: new Date().toISOString(),
          });
        }
        if (callback) callback({ success: true });
      } catch (err) {
        console.error('delivery:reset-tracking error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:recalculate-route (Admin only)
    // Recalculates road path from current rider pos to customer
    // ----------------------------------------------------
    socket.on('delivery:recalculate-route', async (data = {}, callback) => {
      try {
        if (socket.data?.role !== 'admin') {
          if (callback) callback({ success: false, error: 'Unauthorized: Admin access required.' });
          return;
        }

        const { orderId, currentLoc } = data;
        const order = await orderService.getOrderById(orderId);
        if (!order) {
          if (callback) callback({ success: false, error: 'Order not found.' });
          return;
        }

        const origin = currentLoc || order.currentDeliveryLocation || order.pickupLocation;
        const routeData = await routingService.calculateDeliveryRoute(origin, order.dropoffLocation);

        await orderService.updateDeliveryTracking(orderId, {
          route: routeData.geometry,
          estimatedMinutes: routeData.etaMinutes,
          distanceRemainingKm: routeData.distanceKm,
        });

        const roomName = `order:${orderId}`;
        io.to(roomName).emit('delivery:route-updated', {
          orderId,
          route: routeData.geometry,
          etaMinutes: routeData.etaMinutes,
          distanceRemainingKm: routeData.distanceKm,
        });

        if (callback) callback({ success: true, data: routeData });
      } catch (err) {
        console.error('delivery:recalculate-route error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Event: delivery:stop-sharing (Admin only)
    // ----------------------------------------------------
    socket.on('delivery:stop-sharing', async (data = {}, callback) => {
      try {
        if (socket.data?.role !== 'admin') {
          if (callback) callback({ success: false, error: 'Unauthorized: Admin access required.' });
          return;
        }

        const { orderId } = data;
        if (orderId) {
          await orderService.updateDeliveryTracking(orderId, {
            deliveryStatus: 'DELIVERED',
            estimatedMinutes: 0,
            distanceRemainingKm: 0,
          });

          const roomName = `order:${orderId}`;
          io.to(roomName).emit('delivery:tracking-stopped', {
            orderId,
            stoppedAt: new Date().toISOString(),
          });
          io.to(roomName).emit('delivery:status-updated', {
            orderId,
            deliveryStatus: 'DELIVERED',
            orderStatus: 'DELIVERED',
          });
        }
        if (callback) callback({ success: true });
      } catch (err) {
        console.error('delivery:stop-sharing error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      lastUpdateMap.delete(socket.id);
    });
  });
}

