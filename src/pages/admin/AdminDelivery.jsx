import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  fetchAdminOrders,
  fetchDeliveryStores,
  fetchDeliveryPartners,
  assignDeliveryPartnerAndStore,
  resetDeliveryLocation,
  updateAdminOrderStatus,
} from '../../services/orderApi';
import { socketService } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';
import styles from './AdminDelivery.module.css';

/**
 * Custom Leaflet Map Markers
 */
function createStoreMarkerIcon(code = 'CVL-01') {
  return L.divIcon({
    className: styles.markerWrapper,
    html: `
      <div class="${styles.storePin}" title="DrinkIt Store (${code})">
        <span>🏪</span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

function createCustomerMarkerIcon() {
  return L.divIcon({
    className: styles.markerWrapper,
    html: `
      <div class="${styles.customerPin}" title="Customer Dropoff Location">
        <span>🏠</span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

function createRiderMarkerIcon(heading = 0, name = 'Suraj Singh') {
  return L.divIcon({
    className: styles.markerWrapper,
    html: `
      <div class="${styles.riderPinWrapper}">
        <div class="${styles.riderPulseRing}"></div>
        <div class="${styles.riderPin}" style="transform: rotate(${heading}deg);" title="${name}">
          <span>🛵</span>
        </div>
      </div>
      <div class="${styles.riderTooltipLabel}">
        🛵 ${name} <span style="color:#50c878;font-size:0.68rem;">● Live</span>
      </div>
    `,
    iconSize: [90, 60],
    iconAnchor: [45, 22],
    popupAnchor: [0, -22],
  });
}

export default function AdminDelivery() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [partners, setPartners] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED'
  const [speedMultiplier, setSpeedMultiplier] = useState(2); // 1x, 2x, 5x
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Real GPS Mode
  const [watchId, setWatchId] = useState(null);
  const [isWatchingGps, setIsWatchingGps] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // Live Simulation Logs
  const [logMessages, setLogMessages] = useState([]);

  // Map and Marker Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const storeMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const intervalTimerRef = useRef(null);
  const currentStepRef = useRef(0);

  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogMessages((prev) => [
      { text: `[${time}] ${msg}`, type, id: `${Date.now()}-${Math.random()}` },
      ...prev.slice(0, 30),
    ]);
  }, []);

  // Last updated seconds ticker
  useEffect(() => {
    if (!lastUpdatedTime) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastUpdatedTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedTime]);

  // Load initial orders, stores, and partners
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchAdminOrders({ status: 'ALL', limit: 100 }),
      fetchDeliveryStores().catch(() => []),
      fetchDeliveryPartners().catch(() => []),
    ])
      .then(([orderRes, storeList, partnerList]) => {
        if (!isMounted) return;
        const list = Array.isArray(orderRes) ? orderRes : (orderRes?.orders || []);
        setOrders(list);
        setStores(storeList);
        setPartners(partnerList);
        if (list.length > 0) {
          const active =
            list.find((o) => o.orderStatus === 'OUT_FOR_DELIVERY' || o.orderStatus === 'READY') ||
            list[0];
          setSelectedOrderId(active.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load delivery center data:', err);
        setActionError('Failed to load orders or delivery partners.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const reloadData = async () => {
    try {
      const [orderRes, storeList, partnerList] = await Promise.all([
        fetchAdminOrders({ status: 'ALL', limit: 100 }),
        fetchDeliveryStores().catch(() => []),
        fetchDeliveryPartners().catch(() => []),
      ]);
      setOrders(Array.isArray(orderRes) ? orderRes : (orderRes?.orders || []));
      setStores(storeList);
      setPartners(partnerList);
    } catch (err) {
      console.error('Failed to reload delivery center data:', err);
    }
  };

  // Currently selected order
  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Route Coordinates from order or calculated fallback points
  const routePoints = useMemo(() => {
    if (!selectedOrder) return [];

    if (selectedOrder.route?.coordinates && selectedOrder.route.coordinates.length > 1) {
      return selectedOrder.route.coordinates.map((c) => ({
        latitude: c[1],
        longitude: c[0],
      }));
    }

    const pickup = selectedOrder.pickupLocation || { latitude: 26.4715, longitude: 80.3440 };
    const dropoff = selectedOrder.dropoffLocation || { latitude: 26.5037, longitude: 80.2525 };

    const pts = [];
    const steps = 35;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      pts.push({
        latitude: pickup.latitude + (dropoff.latitude - pickup.latitude) * frac,
        longitude: pickup.longitude + (dropoff.longitude - pickup.longitude) * frac,
      });
    }
    return pts;
  }, [selectedOrder]);

  // Current assigned partner info
  const assignedPartner = useMemo(() => {
    if (!selectedOrder) return null;
    return (
      partners.find((p) => p.id === selectedOrder.deliveryPartnerId) || {
        id: selectedOrder.deliveryPartnerId || 'DP-2081',
        name: selectedOrder.deliveryPartnerName || 'Suraj Singh',
        vehicleType: 'Electric Cargo Scooter',
        vehicleNumber: 'UP-78-EV-2081',
        rating: 4.9,
      }
    );
  }, [selectedOrder, partners]);

  // Current assigned store info
  const assignedStore = useMemo(() => {
    if (!selectedOrder) return null;
    return (
      stores.find((s) => s.id === selectedOrder.pickupLocation?.id) ||
      selectedOrder.pickupLocation || {
        id: 'store-1',
        name: 'DrinkIt Flagship Reserve Cellar — Civil Lines',
        code: 'CVL-01',
        address: 'The Mall Road, Civil Lines, Kanpur, Uttar Pradesh 208001',
        latitude: 26.4715,
        longitude: 80.3440,
      }
    );
  }, [selectedOrder, stores]);

  // Initialize or Re-center Map on selected order change
  useEffect(() => {
    if (!mapContainerRef.current || !selectedOrder) return;

    const pickup = selectedOrder.pickupLocation || { latitude: 26.4715, longitude: 80.3440 };
    const dropoff = selectedOrder.dropoffLocation || { latitude: 26.5037, longitude: 80.2525 };
    const riderStart =
      selectedOrder.currentDeliveryLocation || routePoints[0] || pickup;

    // Destroy prior map instance if existing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [riderStart.latitude, riderStart.longitude],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // 1. Store Marker (🏪)
    const store = L.marker([pickup.latitude, pickup.longitude], {
      icon: createStoreMarkerIcon(assignedStore?.code || 'CVL-01'),
    }).addTo(map);
    store.bindPopup(
      `<strong>🏪 ${pickup.name || 'DrinkIt Hub'}</strong><br/>${pickup.address || 'Kanpur'}`
    );
    storeMarkerRef.current = store;

    // 2. Customer Marker (🏠)
    const customer = L.marker([dropoff.latitude, dropoff.longitude], {
      icon: createCustomerMarkerIcon(),
    }).addTo(map);
    customer.bindPopup(
      `<strong>🏠 Destination</strong><br/>${selectedOrder.deliveryAddress?.house || ''}, ${
        selectedOrder.deliveryAddress?.street || ''
      }, ${selectedOrder.deliveryAddress?.city || 'Kanpur'}`
    );
    customerMarkerRef.current = customer;

    // 3. High-visibility OSRM Road Route Polyline
    const latLngs = routePoints.map((p) => [p.latitude, p.longitude]);
    const polyline = L.polyline(latLngs, {
      color: '#f0c040',
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(map);
    routePolylineRef.current = polyline;

    // 4. Moving Rider Marker (🛵)
    const rider = L.marker([riderStart.latitude, riderStart.longitude], {
      icon: createRiderMarkerIcon(0, assignedPartner?.name || 'Suraj Singh'),
      zIndexOffset: 1000,
    }).addTo(map);
    rider.bindPopup(
      `<strong>🛵 ${assignedPartner?.name || 'Suraj Singh'}</strong><br/>${
        assignedPartner?.vehicleType || 'Electric Cargo Scooter'
      } (${assignedPartner?.vehicleNumber || 'UP-78-EV-2081'})`
    );
    riderMarkerRef.current = rider;

    // Fit map view to cover both ends with padding
    if (latLngs.length > 1) {
      map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
    }

    mapInstanceRef.current = map;
    setCurrentCoords(riderStart);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      storeMarkerRef.current = null;
      customerMarkerRef.current = null;
      riderMarkerRef.current = null;
      routePolylineRef.current = null;
    };
  }, [selectedOrder, routePoints, assignedPartner, assignedStore]);

  // Recenter / Fit bounds helper
  const handleFitBounds = () => {
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.fitBounds(routePolylineRef.current.getBounds(), { padding: [50, 50] });
    }
  };

  // Socket room synchronization for selected order
  useEffect(() => {
    if (!selectedOrderId) return;
    const cleanup = socketService.joinOrderTracking(
      selectedOrderId,
      { adminToken: 'session' },
      {
        onLocationUpdate: (payload) => {
          setLastUpdatedTime(Date.now());
          if (payload.location && !isSimulating) {
            setCurrentCoords(payload.location);
            if (riderMarkerRef.current) {
              riderMarkerRef.current.setLatLng([payload.location.latitude, payload.location.longitude]);
              riderMarkerRef.current.setIcon(
                createRiderMarkerIcon(payload.location.heading || 0, assignedPartner?.name || 'Suraj Singh')
              );
            }
          }
        },
        onStatusUpdate: () => {
          setLastUpdatedTime(Date.now());
        },
      }
    );
    return () => {
      cleanup();
    };
  }, [selectedOrderId, isSimulating, assignedPartner]);

  // Simulation execution loop
  useEffect(() => {
    if (!isSimulating || routePoints.length === 0 || !selectedOrderId) {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      return;
    }

    const intervalMs = Math.round(1500 / speedMultiplier);

    intervalTimerRef.current = setInterval(() => {
      const prevIdx = currentStepRef.current;
      const nextIdx = prevIdx + 1;

      if (nextIdx >= routePoints.length) {
        setIsSimulating(false);
        setIsPaused(false);
        setSimulationStatus('COMPLETED');
        addLog(`✓ Reached customer doorstep! Simulation completed for Order #${selectedOrderId}`, 'success');
        socketService.stopDeliverySharing(selectedOrderId).catch(() => {});
        return;
      }

      currentStepRef.current = nextIdx;
      setCurrentStepIndex(nextIdx);

      const point = routePoints[nextIdx];
      const prevPoint = routePoints[prevIdx] || routePoints[0];
      setCurrentCoords(point);
      setLastUpdatedTime(Date.now());

      // Heading calculation in degrees
      const heading =
        Math.atan2(point.longitude - prevPoint.longitude, point.latitude - prevPoint.latitude) *
        (180 / Math.PI);

      // Update Leaflet rider marker position and rotation directly
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([point.latitude, point.longitude]);
        riderMarkerRef.current.setIcon(
          createRiderMarkerIcon(heading, assignedPartner?.name || 'Suraj Singh')
        );
      }

      // Calculate progress telemetry
      const progressFrac = nextIdx / (routePoints.length - 1);
      const totalDistance = selectedOrder?.distanceRemainingKm || 4.5;
      const remainingDist = Number(Math.max(0.1, totalDistance * (1 - progressFrac)).toFixed(1));
      const remainingEta = Math.max(1, Math.round((remainingDist / 25) * 60));

      // Broadcast to customer Socket.IO room
      socketService.sendLocationUpdate({
        orderId: selectedOrderId,
        latitude: point.latitude,
        longitude: point.longitude,
        heading,
        speed: 28, // km/h
        accuracy: 5,
        distanceRemainingKm: remainingDist,
        etaMinutes: remainingEta,
        isSimulator: true,
      });

      addLog(
        `Step ${nextIdx}/${routePoints.length - 1}: (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}) · ETA: ${remainingEta}m · Dist: ${remainingDist}km`
      );
    }, intervalMs);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
    };
  }, [isSimulating, routePoints, selectedOrderId, speedMultiplier, selectedOrder, assignedPartner, addLog]);

  // Simulation Controls
  const handleStartSimulation = async () => {
    setIsWatchingGps(false);
    if (currentStepRef.current >= routePoints.length - 1) {
      currentStepRef.current = 0;
      setCurrentStepIndex(0);
    }
    setIsSimulating(true);
    setIsPaused(false);
    setSimulationStatus('RUNNING');
    setActionSuccess('');
    setActionError('');
    setLastUpdatedTime(Date.now());
    addLog(`▶ Simulation started for Order #${selectedOrderId} at ${speedMultiplier}x speed`);

    // Ensure order is in OUT_FOR_DELIVERY status on backend so customer live radar activates
    if (selectedOrder && selectedOrder.orderStatus !== 'OUT_FOR_DELIVERY' && selectedOrder.orderStatus !== 'DELIVERED') {
      try {
        await updateAdminOrderStatus(selectedOrderId, {
          orderStatus: 'OUT_FOR_DELIVERY',
          note: 'Simulation dispatched order out for delivery.',
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === selectedOrderId ? { ...o, orderStatus: 'OUT_FOR_DELIVERY' } : o))
        );
      } catch (err) {
        console.warn('Order status advance note:', err.message);
      }
    }

    // Emit start sharing event
    socketService.startDeliverySharing({
      orderId: selectedOrderId,
      partnerId: assignedPartner?.id,
      partnerName: assignedPartner?.name,
      initialLocation: routePoints[currentStepRef.current] || selectedOrder?.pickupLocation,
      isSimulator: true,
    }).catch(() => {});
  };

  const handlePauseSimulation = () => {
    setIsSimulating(false);
    setIsPaused(true);
    setSimulationStatus('PAUSED');
    socketService.pauseSimulation(selectedOrderId);
    addLog(`⏸ Simulation paused at step ${currentStepRef.current}/${routePoints.length - 1}`);
  };

  const handleResumeSimulation = () => {
    setIsSimulating(true);
    setIsPaused(false);
    setSimulationStatus('RUNNING');
    socketService.resumeSimulation(selectedOrderId);
    addLog(`▶ Resumed simulation from step ${currentStepRef.current}/${routePoints.length - 1}`);
  };

  const handleResetSimulation = async () => {
    setIsSimulating(false);
    setIsPaused(false);
    setSimulationStatus('IDLE');
    currentStepRef.current = 0;
    setCurrentStepIndex(0);
    try {
      await resetDeliveryLocation(selectedOrderId);
      await socketService.resetTracking(selectedOrderId);
      const startPt = routePoints[0];
      if (startPt && riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([startPt.latitude, startPt.longitude]);
        riderMarkerRef.current.setIcon(
          createRiderMarkerIcon(0, assignedPartner?.name || 'Suraj Singh')
        );
        setCurrentCoords(startPt);
      }
      addLog(`↺ Delivery tracking reset to pickup store for Order #${selectedOrderId}`, 'warn');
      await reloadData();
    } catch (err) {
      console.error('Reset error:', err);
      setActionError('Failed to reset delivery tracking.');
    }
  };

  const handleStopSimulation = async () => {
    setIsSimulating(false);
    setIsPaused(false);
    setSimulationStatus('IDLE');
    if (selectedOrderId) {
      try {
        await socketService.stopDeliverySharing(selectedOrderId);
        addLog(`⏹ Stopped tracking broadcast for Order #${selectedOrderId}`, 'warn');
      } catch (err) {
        console.error('Stop sharing error:', err);
      }
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedOrderId) return;
    try {
      await updateAdminOrderStatus(selectedOrderId, {
        orderStatus: 'DELIVERED',
        note: `Order handed over by ${assignedPartner?.name || 'Delivery Partner'}.`,
      });
      await handleStopSimulation();
      setSimulationStatus('COMPLETED');
      setActionSuccess(`Order #${selectedOrderId} marked DELIVERED successfully.`);
      addLog(`🎉 Order #${selectedOrderId} marked DELIVERED. Session closed.`, 'success');
      await reloadData();
    } catch (err) {
      console.error('Mark delivered error:', err);
      setActionError(err.message || 'Failed to update order to Delivered.');
    }
  };

  // Switch Delivery Partner
  const handlePartnerChange = async (newPartnerId) => {
    if (!selectedOrderId) return;
    try {
      await assignDeliveryPartnerAndStore(selectedOrderId, { partnerId: newPartnerId });
      setActionSuccess(`Assigned delivery partner updated to ${newPartnerId}.`);
      addLog(`Rider reassigned to ${newPartnerId} for Order #${selectedOrderId}`);
      await reloadData();
    } catch (err) {
      console.error('Partner reassignment error:', err);
      setActionError(err.message || 'Failed to update delivery partner.');
    }
  };

  // Switch Pickup Store Hub
  const handleStoreChange = async (newStoreId) => {
    if (!selectedOrderId) return;
    try {
      await assignDeliveryPartnerAndStore(selectedOrderId, { storeId: newStoreId });
      setActionSuccess(`Pickup store updated to ${newStoreId}. Route recalculated.`);
      addLog(`Store hub changed to ${newStoreId}. Road route recomputed.`);
      await reloadData();
    } catch (err) {
      console.error('Store reassignment error:', err);
      setActionError(err.message || 'Failed to change store hub.');
    }
  };

  // Real Device GPS Watch Flow
  const handleConfirmStartGps = () => {
    setGpsModalOpen(false);
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsSimulating(false);
    setIsPaused(false);
    setIsWatchingGps(true);
    addLog(`🛰️ Real GPS mode activated. Requesting device location permission...`);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading = 0, speed = 0, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        setCurrentCoords({ latitude, longitude });

        if (riderMarkerRef.current) {
          riderMarkerRef.current.setLatLng([latitude, longitude]);
          riderMarkerRef.current.setIcon(
            createRiderMarkerIcon(heading || 0, assignedPartner?.name || 'Suraj Singh')
          );
        }

        socketService.sendLocationUpdate({
          orderId: selectedOrderId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed ? Math.round(speed * 3.6) : 0,
          accuracy,
          isCourier: true,
        });

        addLog(`Device GPS: (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) · Acc: ±${Math.round(accuracy)}m`);
      },
      (err) => {
        console.error('Device GPS error:', err);
        addLog(`⚠️ Device GPS error: ${err.message}`, 'warn');
        setIsWatchingGps(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    setWatchId(id);
  };

  const handleStopGps = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsWatchingGps(false);
    addLog(`🛰️ Device GPS mode deactivated.`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#f0c040', fontWeight: 600 }}>
          Loading Delivery Logistics Control Center...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Delivery Logistics Control Center</h1>
          <p className={styles.subtitle}>
            Live dispatch monitor, real-time OSRM GPS simulation, and customer tracking radar.
          </p>
        </div>

        <div className={styles.headerBadges}>
          <div className={styles.simulationNoticeBadge}>
            DEMO SIMULATION — NOT REAL DELIVERY GPS
          </div>
        </div>
      </div>

      {actionSuccess && <div className={styles.successBanner}>✓ {actionSuccess}</div>}
      {actionError && <div className={styles.errorBanner}>⚠️ {actionError}</div>}

      {/* Two-Panel Layout */}
      <div className={styles.dashboardGrid}>
        {/* Left Panel: Controls, Config, & Logs */}
        <div className={styles.leftPanel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>⚙️ Dispatch Controls</h2>
          </div>

          {/* 1. Order Selector */}
          <div className={styles.cardSection}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>Select Order for Live Control:</label>
              <select
                className={styles.selectInput}
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  setIsSimulating(false);
                  setIsPaused(false);
                  setSimulationStatus('IDLE');
                  currentStepRef.current = 0;
                  setCurrentStepIndex(0);
                }}
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id} — {o.customerName || 'Customer'} [{o.orderStatus}]
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Order Summary Snapshot */}
            {selectedOrder && (
              <div className={styles.orderDetailCard}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Status:</span>
                  <span
                    className={`${styles.orderStatusBadge} ${
                      selectedOrder.orderStatus === 'OUT_FOR_DELIVERY'
                        ? styles.badgeOut
                        : selectedOrder.orderStatus === 'DELIVERED'
                        ? styles.badgeDelivered
                        : styles.badgeReady
                    }`}
                  >
                    {selectedOrder.orderStatus}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Customer:</span>
                  <span className={styles.detailValue}>
                    {selectedOrder.customerName} ({selectedOrder.customerPhone})
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Destination:</span>
                  <span className={styles.detailValue}>
                    📍 {selectedOrder.deliveryAddress?.house}, {selectedOrder.deliveryAddress?.street},{' '}
                    {selectedOrder.deliveryAddress?.city}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Total Bill:</span>
                  <span className={styles.detailValue}>
                    {formatINR(selectedOrder.total || selectedOrder.grandTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Store & Partner Assignment */}
          <div className={styles.cardSection}>
            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>🏪 Pickup Store Hub:</label>
              <select
                className={styles.selectInput}
                value={assignedStore?.id || ''}
                onChange={(e) => handleStoreChange(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>🛵 Delivery Partner:</label>
              <select
                className={styles.selectInput}
                value={assignedPartner?.id || ''}
                onChange={(e) => handlePartnerChange(e.target.value)}
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.vehicleType} · {p.vehicleNumber}) [★ {p.rating}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Route Summary */}
          <div className={styles.cardSection}>
            <label className={styles.controlLabel}>🗺️ OSRM Road Metrics:</label>
            <div className={styles.routeMetricsGrid}>
              <div className={styles.metricBox}>
                <span className={styles.metricBoxLabel}>Distance</span>
                <span className={styles.metricBoxValue}>
                  {selectedOrder?.distanceRemainingKm ? `${selectedOrder.distanceRemainingKm} km` : '4.2 km'}
                </span>
              </div>
              <div className={styles.metricBox}>
                <span className={styles.metricBoxLabel}>Live ETA</span>
                <span className={styles.metricBoxValue}>
                  {selectedOrder?.estimatedMinutes ? `${selectedOrder.estimatedMinutes} m` : '14 m'}
                </span>
              </div>
              <div className={styles.metricBox}>
                <span className={styles.metricBoxLabel}>Waypoints</span>
                <span className={styles.metricBoxValue}>
                  {routePoints.length > 0 ? `${currentStepIndex + 1}/${routePoints.length}` : '0'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Simulation Controls */}
          <div className={styles.cardSection}>
            <label className={styles.controlLabel}>🎮 GPS Simulation Controls:</label>
            <div className={styles.simActionsGrid}>
              {!isSimulating && !isPaused && (
                <button
                  type="button"
                  className={styles.primaryActionBtn}
                  onClick={handleStartSimulation}
                  disabled={!selectedOrder}
                >
                  ▶ Start Simulation
                </button>
              )}

              {isSimulating && (
                <button
                  type="button"
                  className={styles.primaryActionBtn}
                  onClick={handlePauseSimulation}
                >
                  ⏸ Pause Simulation
                </button>
              )}

              {!isSimulating && isPaused && (
                <button
                  type="button"
                  className={styles.primaryActionBtn}
                  onClick={handleResumeSimulation}
                >
                  ▶ Resume Simulation
                </button>
              )}

              <button
                type="button"
                className={styles.secondaryActionBtn}
                onClick={handleResetSimulation}
                disabled={!selectedOrder}
              >
                ↺ Reset to Store
              </button>

              <button
                type="button"
                className={styles.secondaryActionBtn}
                onClick={handleStopSimulation}
                disabled={!selectedOrder}
              >
                ⏹ Stop Sharing
              </button>

              <button
                type="button"
                className={styles.deliverBtn}
                onClick={handleMarkDelivered}
                disabled={!selectedOrder}
                title="Mark order delivered and stop tracking"
              >
                ✓ Mark Delivered
              </button>
            </div>

            {/* Speed Multiplier */}
            <div className={styles.speedRow}>
              <span className={styles.speedLabel}>Playback Speed:</span>
              <div className={styles.speedButtons}>
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={`${styles.speedBtn} ${speedMultiplier === speed ? styles.speedBtnActive : ''}`}
                    onClick={() => setSpeedMultiplier(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Real Device GPS Mode Foundation */}
          <div className={styles.gpsToggleSection}>
            <label className={styles.controlLabel}>🛰️ Real Device GPS Mode:</label>
            {!isWatchingGps ? (
              <button
                type="button"
                className={styles.gpsToggleBtn}
                onClick={() => setGpsModalOpen(true)}
              >
                Enable Real Device GPS Mode
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className={styles.gpsActiveBadge}>
                  ● Real GPS Active {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                </div>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
                  onClick={handleStopGps}
                >
                  Stop Device GPS
                </button>
              </div>
            )}
          </div>

          {/* 6. Live Logs */}
          <div className={styles.cardSection}>
            <label className={styles.controlLabel}>📡 Telemetry Event Stream:</label>
            <div className={styles.logsContainer}>
              {logMessages.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Awaiting simulation dispatch events...
                </span>
              ) : (
                logMessages.map((log) => (
                  <div
                    key={log.id}
                    className={`${styles.logEntry} ${
                      log.type === 'success'
                        ? styles.logEntrySuccess
                        : log.type === 'warn'
                        ? styles.logEntryWarn
                        : ''
                    }`}
                  >
                    {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Large Live Map Viewport */}
        <div className={styles.rightPanel}>
          <div className={styles.mapViewport}>
            <div ref={mapContainerRef} className={styles.leafletContainer} />

            {/* Floating Live Telemetry Badge */}
            <div className={styles.mapOverlayCard}>
              <div className={styles.overlayHeader}>
                <div className={styles.overlayRiderName}>
                  🛵 {assignedPartner?.name || 'Suraj Singh'}
                </div>
                <div
                  className={`${styles.liveBadge} ${
                    simulationStatus === 'RUNNING'
                      ? styles.liveBadgeRunning
                      : simulationStatus === 'PAUSED'
                      ? styles.liveBadgePaused
                      : simulationStatus === 'COMPLETED'
                      ? styles.liveBadgeCompleted
                      : isWatchingGps
                      ? styles.liveBadgeRunning
                      : styles.liveBadgeStandby
                  }`}
                >
                  <span className={styles.livePulseDot} />
                  <span>
                    {simulationStatus === 'RUNNING'
                      ? 'RUNNING'
                      : simulationStatus === 'PAUSED'
                      ? 'PAUSED'
                      : simulationStatus === 'COMPLETED'
                      ? 'COMPLETED'
                      : isWatchingGps
                      ? 'REAL GPS'
                      : 'STANDBY'}
                  </span>
                </div>
              </div>

              <div className={styles.overlayStatsRow}>
                <div className={styles.overlayStat}>
                  <span className={styles.overlayStatLabel}>Speed</span>
                  <span className={styles.overlayStatVal}>
                    {isSimulating ? `${Math.round(28 * (speedMultiplier > 1 ? speedMultiplier * 0.8 : 1))} km/h` : '0 km/h'}
                  </span>
                </div>
                <div className={styles.overlayStat}>
                  <span className={styles.overlayStatLabel}>Distance</span>
                  <span className={styles.overlayStatVal}>
                    {selectedOrder?.distanceRemainingKm || '4.2'} km
                  </span>
                </div>
                <div className={styles.overlayStat}>
                  <span className={styles.overlayStatLabel}>ETA</span>
                  <span className={styles.overlayStatVal}>
                    {selectedOrder?.estimatedMinutes || 14} min
                  </span>
                </div>
              </div>

              {currentCoords && (
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                  GPS: {currentCoords.latitude.toFixed(4)}° N, {currentCoords.longitude.toFixed(4)}° E
                </div>
              )}

              {lastUpdatedTime && (
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)' }}>
                  ⏱ Updated {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
                </div>
              )}

              <div style={{ fontSize: '0.68rem', color: '#f0c040', fontWeight: 700 }}>
                DEMO SIMULATION — NOT REAL DELIVERY GPS
              </div>
            </div>

            {/* Recenter / Fit Bounds Button */}
            <button
              type="button"
              className={styles.recenterMapBtn}
              onClick={handleFitBounds}
              title="Fit map to full delivery route"
              aria-label="Fit map bounds"
            >
              🎯
            </button>
          </div>
        </div>
      </div>

      {/* Real Device GPS Confirmation Modal */}
      {gpsModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Enable Real Device GPS Mode</h3>
            <p className={styles.modalText}>
              This will request permission to access your device's live hardware GPS coordinates via
              the browser Geolocation API and broadcast them over Socket.IO to the customer tracking
              screen.
            </p>
            <p className={styles.modalText} style={{ color: '#f0c040', fontWeight: 600 }}>
              Note: This overrides simulated OSRM movements with your physical device coordinates.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setGpsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleConfirmStartGps}
              >
                Allow & Start GPS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
