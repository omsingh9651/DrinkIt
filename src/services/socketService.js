import { io } from 'socket.io-client';
import { SOCKET_URL } from './apiConfig';

let socketInstance = null;

export const socketService = {
  /**
   * Get or create the singleton Socket.IO connection
   */
  getSocket() {
    if (!socketInstance) {
      const getAuthToken = () => {
        return (
          localStorage.getItem('drinkit_customer_token') ||
          localStorage.getItem('admin_token') ||
          ''
        );
      };

      const targetUrl = SOCKET_URL || '/';
      socketInstance = io(targetUrl, {
        transports: ['websocket', 'polling'],
        auth: (cb) => {
          cb({
            token: getAuthToken(),
            adminToken: localStorage.getItem('admin_token') || '',
          });
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketInstance.on('connect', () => {
        console.log('⚡ Socket.IO connected:', socketInstance.id);
      });

      socketInstance.on('connect_error', (err) => {
        console.warn('Socket.IO connection warning:', err.message);
      });
    }
    return socketInstance;
  },

  /**
   * Join an order tracking room and register event listeners
   *
   * @param {string} orderId
   * @param {Object} credentials { customerPhone, adminToken }
   * @param {Object} handlers { onStarted, onLocationUpdate, onRouteUpdate, onEtaUpdate, onStatusUpdate, onStopped }
   * @returns {Function} Cleanup function to leave room and remove listeners
   */
  joinOrderTracking(orderId, credentials = {}, handlers = {}) {
    const socket = this.getSocket();

    const joinPayload = {
      orderId,
      customerPhone: credentials.customerPhone,
      adminToken: credentials.adminToken,
    };

    socket.emit('delivery:join-order', joinPayload, (response) => {
      if (response && response.success && handlers.onStarted) {
        handlers.onStarted(response.data);
      } else if (response && !response.success && handlers.onError) {
        handlers.onError(response.error);
      }
    });

    const handleStarted = (data) => {
      if (handlers.onStarted) handlers.onStarted(data);
    };

    const handleLocationUpdate = (data) => {
      if (handlers.onLocationUpdate) handlers.onLocationUpdate(data);
    };

    const handleRouteUpdate = (data) => {
      if (handlers.onRouteUpdate) handlers.onRouteUpdate(data);
    };

    const handleEtaUpdate = (data) => {
      if (handlers.onEtaUpdate) handlers.onEtaUpdate(data);
    };

    const handleStatusUpdate = (data) => {
      if (handlers.onStatusUpdate) handlers.onStatusUpdate(data);
    };

    const handleStopped = (data) => {
      if (handlers.onStopped) handlers.onStopped(data);
    };

    const handleConnect = () => {
      if (handlers.onConnect) handlers.onConnect();
      // Re-emit join upon reconnect
      socket.emit('delivery:join-order', joinPayload);
    };

    const handleDisconnect = (reason) => {
      if (handlers.onDisconnect) handlers.onDisconnect(reason);
    };

    const handleSimulationPaused = (data) => {
      if (handlers.onSimulationPaused) handlers.onSimulationPaused(data);
    };

    const handleSimulationResumed = (data) => {
      if (handlers.onSimulationResumed) handlers.onSimulationResumed(data);
    };

    const handleTrackingReset = (data) => {
      if (handlers.onTrackingReset) handlers.onTrackingReset(data);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('delivery:tracking-started', handleStarted);
    socket.on('delivery:location-updated', handleLocationUpdate);
    socket.on('delivery:route-updated', handleRouteUpdate);
    socket.on('delivery:eta-updated', handleEtaUpdate);
    socket.on('delivery:status-updated', handleStatusUpdate);
    socket.on('delivery:simulation-paused', handleSimulationPaused);
    socket.on('delivery:simulation-resumed', handleSimulationResumed);
    socket.on('delivery:tracking-reset', handleTrackingReset);
    socket.on('delivery:tracking-stopped', handleStopped);

    // Return cleanup callback
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('delivery:tracking-started', handleStarted);
      socket.off('delivery:location-updated', handleLocationUpdate);
      socket.off('delivery:route-updated', handleRouteUpdate);
      socket.off('delivery:eta-updated', handleEtaUpdate);
      socket.off('delivery:status-updated', handleStatusUpdate);
      socket.off('delivery:simulation-paused', handleSimulationPaused);
      socket.off('delivery:simulation-resumed', handleSimulationResumed);
      socket.off('delivery:tracking-reset', handleTrackingReset);
      socket.off('delivery:tracking-stopped', handleStopped);
    };
  },

  /**
   * Request route recalculation from current delivery coordinates
   */
  recalculateRoute(orderId, currentLoc) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('delivery:recalculate-route', { orderId, currentLoc }, (res) => {
        resolve(res);
      });
    });
  },

  /**
   * Emit a real-time GPS coordinate update (for rider app / simulator)
   */
  sendLocationUpdate(payload) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('delivery:location-update', payload, (res) => {
        resolve(res);
      });
    });
  },

  /**
   * Start delivery sharing session
   */
  startDeliverySharing(payload) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('delivery:start-sharing', payload, (res) => {
        resolve(res);
      });
    });
  },

  /**
   * Pause simulation broadcast
   */
  pauseSimulation(orderId) {
    const socket = this.getSocket();
    socket.emit('delivery:pause-simulation', { orderId });
  },

  /**
   * Resume simulation broadcast
   */
  resumeSimulation(orderId) {
    const socket = this.getSocket();
    socket.emit('delivery:resume-simulation', { orderId });
  },

  /**
   * Reset tracking to store hub
   */
  resetTracking(orderId) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('delivery:reset-tracking', { orderId }, (res) => {
        resolve(res);
      });
    });
  },

  /**
   * Stop delivery sharing session
   */
  stopDeliverySharing(orderId, adminToken) {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      socket.emit('delivery:stop-sharing', { orderId, adminToken }, (res) => {
        resolve(res);
      });
    });
  },

  /**
   * Disconnect and clear socket singleton
   */
  disconnect() {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
  },
};


