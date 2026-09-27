import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { socketService } from '../../services/socketService';
import { getOrderById } from '../../services/orderApi';
import { formatINR } from '../../utils/formatters';
import styles from './OrderTracking.module.css';

/**
 * 5-Stage Fulfillment Timeline for Order Tracking
 */
const TRACKING_STAGES = [
  { key: 'CONFIRMED', label: 'Order Confirmed', icon: '✓' },
  { key: 'PROCESSING', label: 'Processing', icon: '⚙️' },
  { key: 'READY', label: 'Packed & Ready', icon: '📦' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: '🛵' },
  { key: 'DELIVERED', label: 'Delivered', icon: '🎉' },
];

/**
 * Custom Map Markers (OpenStreetMap + Leaflet)
 */
function createStoreIcon() {
  return L.divIcon({
    className: styles.markerContainer,
    html: `
      <div class="${styles.storeMarkerPin}">
        <span>🏪</span>
      </div>
      <div class="${styles.markerLabelText}">DrinkIt Store</div>
    `,
    iconSize: [80, 56],
    iconAnchor: [40, 36],
    popupAnchor: [0, -36],
  });
}

function createHomeIcon() {
  return L.divIcon({
    className: styles.markerContainer,
    html: `
      <div class="${styles.homeMarkerPin}">
        <span>🏠</span>
      </div>
      <div class="${styles.markerLabelText}">Your Location</div>
    `,
    iconSize: [80, 56],
    iconAnchor: [40, 36],
    popupAnchor: [0, -36],
  });
}

function createRiderIcon(heading = 0, name = 'Suraj Singh') {
  return L.divIcon({
    className: styles.markerContainer,
    html: `
      <div class="${styles.riderMarkerWrapper}">
        <div class="${styles.riderPulse}"></div>
        <div class="${styles.riderMarkerPin}" style="transform: rotate(${heading}deg);">
          <span>🛵</span>
        </div>
      </div>
      <div class="${styles.riderLabelBadge}">
        <span>${name}</span>
        <span class="${styles.riderLiveDot}">● Live</span>
      </div>
    `,
    iconSize: [110, 60],
    iconAnchor: [55, 22],
    popupAnchor: [0, -22],
  });
}

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const customerPhone = user?.phoneNumber || '';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'live' | 'connecting' | 'disconnected' | 'error'

  // Live Telemetry
  const [currentRiderLocation, setCurrentRiderLocation] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distanceRemainingKm, setDistanceRemainingKm] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('ON_THE_WAY');
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [routePolylineCoords, setRoutePolylineCoords] = useState([]);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [deliveryPartner, setDeliveryPartner] = useState({
    name: 'Suraj Singh',
    vehicle: 'Electric Cargo Scooter · UP-78-EV-2081',
    phone: '9876543210',
    rating: 4.9,
  });

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastRecalculatedPosRef = useRef(null);

  // Authenticated route protection
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/account/orders/${orderId}/track`, { replace: true });
    }
  }, [isAuthenticated, navigate, orderId]);

  // Initial order fetch
  useEffect(() => {
    let mounted = true;
    getOrderById(orderId, customerPhone)
      .then((data) => {
        if (!mounted) return;
        if (!data) {
          setError(`Order #${orderId} could not be found.`);
          setLoading(false);
          return;
        }

        // Verify customer authorization
        const cleanCustomerPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
        const orderPhone = String(data.customerPhone || '').replace(/\D/g, '').slice(-10);
        if (cleanCustomerPhone && orderPhone && cleanCustomerPhone !== orderPhone) {
          setError('Unauthorized: You do not have permission to track this order.');
          setLoading(false);
          return;
        }

        setOrder(data);
        setDeliveryStatus(
          data.deliveryStatus ||
            (data.orderStatus === 'DELIVERED' ? 'DELIVERED' : 'ON_THE_WAY')
        );
        setEtaMinutes(data.estimatedMinutes || (data.orderStatus === 'DELIVERED' ? 0 : 15));
        setDistanceRemainingKm(
          data.distanceRemainingKm || (data.orderStatus === 'DELIVERED' ? 0 : 3.5)
        );

        if (data.deliveryPartnerName) {
          setDeliveryPartner({
            name: data.deliveryPartnerName,
            vehicle: data.deliveryPartnerVehicle || 'Electric Cargo Scooter · UP-78-EV-2081',
            phone: data.deliveryPartnerPhone || '9876543210',
            rating: 4.9,
          });
        }

        const initialLoc =
          data.currentDeliveryLocation ||
          data.pickupLocation || { latitude: 26.4715, longitude: 80.3440 };
        setCurrentRiderLocation(initialLoc);

        if (data.route?.coordinates) {
          setRoutePolylineCoords(data.route.coordinates.map((c) => [c[1], c[0]]));
        }

        setLastUpdatedTime(Date.now());
        setLoading(false);
      })
      .catch((err) => {
        if (mounted) {
          console.error('Fetch order error:', err);
          setError(err.message || 'Failed to load order tracking details.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [orderId, customerPhone]);

  // Last updated seconds ticker
  useEffect(() => {
    if (!lastUpdatedTime) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - lastUpdatedTime) / 1000));
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedTime]);

  // Timeline active index calculation
  const activeTimelineIdx = useMemo(() => {
    if (!order) return 0;
    const st = order.orderStatus?.toUpperCase() || 'PENDING';
    if (st === 'DELIVERED' || deliveryStatus === 'DELIVERED') return 4;
    if (st === 'OUT_FOR_DELIVERY' || deliveryStatus === 'ON_THE_WAY') return 3;
    if (st === 'READY') return 2;
    if (st === 'PROCESSING') return 1;
    return 0;
  }, [order, deliveryStatus]);

  // Smooth Marker Animation along coordinate trajectory
  const animateMarkerMovement = useCallback(
    (targetLat, targetLng, heading = 0, durationMs = 850) => {
      if (!riderMarkerRef.current) return;

      // Update icon heading immediately so rotation updates without waiting for interpolation
      riderMarkerRef.current.setIcon(
        createRiderIcon(heading, deliveryPartner.name || 'Suraj Singh')
      );

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const startLatLng = riderMarkerRef.current.getLatLng();
      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const ease = 1 - Math.pow(1 - progress, 3);

        const currentLat = startLatLng.lat + (targetLat - startLatLng.lat) * ease;
        const currentLng = startLatLng.lng + (targetLng - startLatLng.lng) * ease;

        if (riderMarkerRef.current) {
          riderMarkerRef.current.setLatLng([currentLat, currentLng]);
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        }
      }

      animationFrameRef.current = requestAnimationFrame(step);
    },
    [deliveryPartner.name]
  );

  // Socket.IO real-time subscription
  useEffect(() => {
    if (!orderId || !order || order.orderStatus === 'CANCELLED') return;

    const cleanup = socketService.joinOrderTracking(
      orderId,
      { customerPhone },
      {
        onConnect: () => {
          setConnectionStatus('live');
        },
        onDisconnect: () => {
          setConnectionStatus('disconnected');
        },
        onStarted: (payload) => {
          setConnectionStatus('live');
          if (payload.orderStatus && payload.orderStatus !== 'DELIVERED') {
            setOrder((prev) => (prev ? { ...prev, orderStatus: payload.orderStatus } : prev));
          }
          if (payload.deliveryPartner) {
            setDeliveryPartner({
              name: payload.deliveryPartner.name || 'Suraj Singh',
              vehicle:
                payload.deliveryPartner.vehicle ||
                `${payload.deliveryPartner.vehicleType || 'Electric Cargo Scooter'} · ${
                  payload.deliveryPartner.vehicleNumber || 'UP-78-EV-2081'
                }`,
              phone: payload.deliveryPartner.phone || '9876543210',
              rating: payload.deliveryPartner.rating || 4.9,
            });
          }
          if (payload.currentDeliveryLocation) {
            const loc = payload.currentDeliveryLocation;
            setCurrentRiderLocation(loc);
            animateMarkerMovement(loc.latitude, loc.longitude, loc.heading || 0);
          }
          if (payload.etaMinutes !== undefined) setEtaMinutes(payload.etaMinutes);
          if (payload.distanceRemainingKm !== undefined)
            setDistanceRemainingKm(payload.distanceRemainingKm);
          if (payload.deliveryStatus) setDeliveryStatus(payload.deliveryStatus);
          if (payload.route?.coordinates) {
            const coords = payload.route.coordinates.map((c) => [c[1], c[0]]);
            setRoutePolylineCoords(coords);
            if (routePolylineRef.current) routePolylineRef.current.setLatLngs(coords);
          }
          setLastUpdatedTime(Date.now());
        },
        onLocationUpdate: (payload) => {
          setConnectionStatus('live');
          if (order?.orderStatus !== 'OUT_FOR_DELIVERY' && order?.orderStatus !== 'DELIVERED') {
            setOrder((prev) => (prev ? { ...prev, orderStatus: 'OUT_FOR_DELIVERY' } : prev));
          }
          if (deliveryStatus !== 'DELIVERED') {
            setDeliveryStatus('ON_THE_WAY');
          }
          if (payload.location) {
            const loc = payload.location;
            setCurrentRiderLocation(loc);
            animateMarkerMovement(loc.latitude, loc.longitude, loc.heading || 0);

            // Trigger OSRM road route recalculation if moved significantly
            const lastPos = lastRecalculatedPosRef.current;
            if (
              !lastPos ||
              Math.hypot(loc.latitude - lastPos.lat, loc.longitude - lastPos.lng) > 0.003
            ) {
              lastRecalculatedPosRef.current = { lat: loc.latitude, lng: loc.longitude };
              socketService.recalculateRoute(orderId, loc).catch(() => {});
            }
          }
          if (payload.etaMinutes !== undefined) setEtaMinutes(payload.etaMinutes);
          if (payload.distanceRemainingKm !== undefined)
            setDistanceRemainingKm(payload.distanceRemainingKm);
          setLastUpdatedTime(Date.now());
        },
        onRouteUpdate: (payload) => {
          if (payload.route?.coordinates) {
            const coords = payload.route.coordinates.map((c) => [c[1], c[0]]);
            setRoutePolylineCoords(coords);
            if (routePolylineRef.current) {
              routePolylineRef.current.setLatLngs(coords);
            }
          }
          if (payload.etaMinutes !== undefined) setEtaMinutes(payload.etaMinutes);
          if (payload.distanceRemainingKm !== undefined)
            setDistanceRemainingKm(payload.distanceRemainingKm);
        },
        onEtaUpdate: (payload) => {
          if (payload.etaMinutes !== undefined) setEtaMinutes(payload.etaMinutes);
          if (payload.distanceRemainingKm !== undefined)
            setDistanceRemainingKm(payload.distanceRemainingKm);
        },
        onStatusUpdate: (payload) => {
          if (payload.orderStatus) {
            setOrder((prev) => (prev ? { ...prev, orderStatus: payload.orderStatus } : prev));
          }
          if (payload.deliveryStatus) setDeliveryStatus(payload.deliveryStatus);
          if (payload.orderStatus === 'DELIVERED') {
            setDeliveryStatus('DELIVERED');
            setEtaMinutes(0);
            setDistanceRemainingKm(0);
          }
          setLastUpdatedTime(Date.now());
        },
        onTrackingReset: () => {
          if (order?.pickupLocation) {
            const pickup = order.pickupLocation;
            setCurrentRiderLocation(pickup);
            if (riderMarkerRef.current) {
              riderMarkerRef.current.setLatLng([pickup.latitude, pickup.longitude]);
              riderMarkerRef.current.setIcon(
                createRiderIcon(0, deliveryPartner.name || 'Suraj Singh')
              );
            }
          }
          setLastUpdatedTime(Date.now());
        },
        onStopped: () => {
          setDeliveryStatus('DELIVERED');
          setEtaMinutes(0);
          setDistanceRemainingKm(0);
        },
        onError: (err) => {
          console.warn('Live tracking socket warning:', err);
        },
      }
    );

    return () => {
      cleanup();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [orderId, order, customerPhone, deliveryStatus, animateMarkerMovement, deliveryPartner.name]);

  // Leaflet Map Initialization
  useEffect(() => {
    const isDelivering =
      order &&
      (order.orderStatus === 'OUT_FOR_DELIVERY' ||
        order.orderStatus === 'READY' ||
        order.orderStatus === 'DELIVERED');

    if (!mapContainerRef.current || !isDelivering || mapInstanceRef.current) return;

    const pickup = order.pickupLocation || { latitude: 26.4715, longitude: 80.3440 };
    const dropoff = order.dropoffLocation || { latitude: 26.5037, longitude: 80.2525 };
    const rider = currentRiderLocation || pickup;

    const map = L.map(mapContainerRef.current, {
      center: [rider.latitude, rider.longitude],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // 1. Store Marker (DrinkIt Store)
    const storeMarker = L.marker([pickup.latitude, pickup.longitude], {
      icon: createStoreIcon(),
    }).addTo(map);
    storeMarker.bindPopup(
      `<strong>🏪 DrinkIt Store</strong><br/>${pickup.name || 'DrinkIt Cellar Hub'}<br/>${
        pickup.address || 'Civil Lines, Kanpur'
      }`
    );

    // 2. Customer Marker (Your Location)
    const homeMarker = L.marker([dropoff.latitude, dropoff.longitude], {
      icon: createHomeIcon(),
    }).addTo(map);
    homeMarker.bindPopup(
      `<strong>🏠 Your Location</strong><br/>${order.deliveryAddress?.house || ''}, ${
        order.deliveryAddress?.street || ''
      }, ${order.deliveryAddress?.city || 'Kanpur'}`
    );

    // 3. Delivery Partner Marker (Scooter with heading + Live badge)
    const riderMarker = L.marker([rider.latitude, rider.longitude], {
      icon: createRiderIcon(rider.heading || 0, deliveryPartner.name),
      zIndexOffset: 1000,
    }).addTo(map);
    riderMarker.bindPopup(
      `<strong>🛵 ${deliveryPartner.name}</strong><br/>${deliveryPartner.vehicle}<br/>Contact: +91 ${deliveryPartner.phone}`
    );
    riderMarkerRef.current = riderMarker;

    // 4. OSRM Road Route Polyline
    const initialCoords =
      routePolylineCoords.length > 0
        ? routePolylineCoords
        : [
            [pickup.latitude, pickup.longitude],
            [rider.latitude, rider.longitude],
            [dropoff.latitude, dropoff.longitude],
          ];

    const polyline = L.polyline(initialCoords, {
      color: '#f0c040',
      weight: 5,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(map);
    routePolylineRef.current = polyline;

    // Fit map bounds to encompass all points
    const bounds = L.latLngBounds([
      [pickup.latitude, pickup.longitude],
      [dropoff.latitude, dropoff.longitude],
      [rider.latitude, rider.longitude],
    ]);
    map.fitBounds(bounds, { padding: [50, 50] });

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      riderMarkerRef.current = null;
      routePolylineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  // Recenter map on courier
  const handleRecenter = () => {
    if (mapInstanceRef.current && currentRiderLocation) {
      mapInstanceRef.current.setView(
        [currentRiderLocation.latitude, currentRiderLocation.longitude],
        15,
        { animate: true }
      );
    }
  };

  // Status headline
  const statusHeadline = useMemo(() => {
    if (deliveryStatus === 'DELIVERED' || order?.orderStatus === 'DELIVERED') {
      return 'Order Delivered Successfully';
    }
    if (
      deliveryStatus === 'NEAR_DESTINATION' ||
      (distanceRemainingKm !== null && distanceRemainingKm <= 0.4)
    ) {
      return 'Arriving at your doorstep';
    }
    if (order?.orderStatus === 'READY') {
      return 'Order packed & awaiting courier pickup';
    }
    return 'Delivery partner is on the way';
  }, [deliveryStatus, order, distanceRemainingKm]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <h2>Connecting to Live Delivery Radar...</h2>
        <p>Fetching real-time GPS coordinates and OpenStreetMap road route.</p>
      </div>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2>Tracking Unavailable</h2>
        <p>{error || 'Unable to load delivery tracking details.'}</p>
        <Link to="/account/orders" className={styles.backBtn}>
          ← Back to My Orders
        </Link>
      </div>
    );
  }

  const isDelivered = deliveryStatus === 'DELIVERED' || order.orderStatus === 'DELIVERED';
  const isPreDelivery =
    !isDelivered &&
    order.orderStatus !== 'OUT_FOR_DELIVERY' &&
    order.orderStatus !== 'READY';

  // Pre-delivery state (PENDING / CONFIRMED / PROCESSING)
  if (isPreDelivery) {
    return (
      <div className={styles.preDeliveryContainer}>
        <div className={styles.preDeliveryCard}>
          <div className={styles.preDeliveryHeader}>
            <Link to={`/account/orders/${order.id}`} className={styles.backLink}>
              ← Order Details
            </Link>
            <span className={styles.orderIdBadge}>#{order.id}</span>
          </div>

          <div className={styles.preDeliveryIcon}>🍷</div>
          <h1 className={styles.preDeliveryTitle}>Cellar Order in Preparation</h1>
          <p className={styles.preDeliveryDesc}>
            Our master sommelier is currently verifying and carefully packaging your reserved bottles.
            Live delivery tracking will activate immediately once the courier dispatches your order.
          </p>

          <div className={styles.timelineBox}>
            <div className={styles.timelineHeader}>Order Fulfillment Status</div>
            <div className={styles.timelineList}>
              {TRACKING_STAGES.map((st, idx) => {
                const isComplete = idx <= activeTimelineIdx;
                const isCurrent = idx === activeTimelineIdx;
                return (
                  <div
                    key={st.key}
                    className={`${styles.timelineItem} ${
                      isComplete ? styles.timelineComplete : ''
                    } ${isCurrent ? styles.timelineCurrent : ''}`}
                  >
                    <div className={styles.timelineDot}>{isComplete ? '✓' : idx + 1}</div>
                    <div className={styles.timelineLabel}>{st.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.preDeliveryActions}>
            <Link to={`/account/orders/${order.id}`} className={styles.viewOrderBtn}>
              View Full Order Breakdown
            </Link>
            <Link to="/products" className={styles.continueShoppingBtn}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.trackingPage}>
      {/* Top Header Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Link to={`/account/orders/${order.id}`} className={styles.backLink}>
            ← Order #{order.id}
          </Link>
          <h1 className={styles.pageTitle}>Track Your Delivery</h1>
          <span className={styles.statusPillBadge}>{order.orderStatus.replace(/_/g, ' ')}</span>
        </div>

        <div className={styles.topBarRight}>
          <div className={styles.simulationNoticeBadge}>
            DEMO SIMULATION — NOT REAL DELIVERY GPS
          </div>

          <div className={styles.connectionBadge}>
            <span
              className={`${styles.connectionDot} ${
                connectionStatus === 'live'
                  ? styles.dotLive
                  : connectionStatus === 'disconnected'
                  ? styles.dotDisconnected
                  : styles.dotPending
              }`}
            />
            <span className={styles.connectionLabel}>
              {connectionStatus === 'live'
                ? 'Live Radar'
                : connectionStatus === 'disconnected'
                ? 'Reconnecting...'
                : 'Connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Disconnection Warning */}
      {connectionStatus === 'disconnected' && (
        <div className={styles.reconnectBanner}>
          <span>⚠️ Live tracking stream paused. Reconnecting to cellar radar...</span>
        </div>
      )}

      {/* Mobile Top Order Summary Header */}
      <div className={styles.mobileTopHeader}>
        <div className={styles.statusHeader}>
          <div className={styles.statusPill}>
            <span className={styles.statusDot} />
            <span>{statusHeadline}</span>
          </div>
          <span className={styles.lastUpdatedText}>
            {secondsAgo === 0 ? 'Updated just now' : `Updated ${secondsAgo}s ago`}
          </span>
        </div>
        {!isDelivered && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: '#f0c040', fontWeight: 700 }}>
              ETA: {etaMinutes !== null ? etaMinutes : 15} mins
            </span>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
              Distance: {distanceRemainingKm !== null ? distanceRemainingKm : '3.5'} km
            </span>
          </div>
        )}
      </div>

      {/* Two-Panel Layout (Desktop: Left Info, Right Map; Mobile: Map in middle) */}
      <div className={styles.contentLayout}>
        {/* Left Panel: Delivery Details & Partner Information */}
        <div className={styles.leftPanelWrapper}>
          {/* Status Headline */}
          <div className={styles.statusHeader}>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} />
              <span>{statusHeadline}</span>
            </div>
            <span className={styles.lastUpdatedText}>
              {secondsAgo === 0 ? 'Updated just now' : `Updated ${secondsAgo}s ago`}
            </span>
          </div>

          {/* 5-Stage Visual Timeline */}
          <div className={styles.progressTimeline}>
            {TRACKING_STAGES.map((st, idx) => {
              const isComplete = idx <= activeTimelineIdx;
              const isCurrent = idx === activeTimelineIdx;
              return (
                <div
                  key={st.key}
                  className={`${styles.stageStep} ${
                    isComplete ? styles.stageComplete : ''
                  } ${isCurrent ? styles.stageCurrent : ''}`}
                >
                  <div className={styles.stageDot}>{isComplete ? '✓' : idx + 1}</div>
                  <span className={styles.stageText}>{st.label}</span>
                </div>
              );
            })}
          </div>

          {/* Metrics Grid: ETA & Distance */}
          {!isDelivered ? (
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>ESTIMATED ARRIVAL</span>
                <div className={styles.metricValue}>
                  <strong>{etaMinutes !== null ? etaMinutes : 15}</strong>
                  <span>mins</span>
                </div>
              </div>

              <div className={styles.metricDivider} />

              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>DISTANCE REMAINING</span>
                <div className={styles.metricValue}>
                  <strong>{distanceRemainingKm !== null ? distanceRemainingKm : '3.5'}</strong>
                  <span>km</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.deliveredCelebrationCard}>
              <span className={styles.deliveredCelebrationEmoji}>🥂</span>
              <div>
                <strong>Delivered to Doorstep!</strong>
                <p>Enjoy your premium beverage selection responsibly (21+).</p>
              </div>
            </div>
          )}

          {/* Live Courier Coordinates Chip */}
          {currentRiderLocation && !isDelivered && (
            <div className={styles.telemetryChip}>
              <span className={styles.telemetryIcon}>📍</span>
              <span>
                Courier GPS:{' '}
                <strong>
                  {currentRiderLocation.latitude.toFixed(4)}° N,{' '}
                  {currentRiderLocation.longitude.toFixed(4)}° E
                </strong>
              </span>
            </div>
          )}

          {/* OSRM Route Notice */}
          <div className={styles.routingNotice}>
            <span>
              🗺️ Standard road navigation via OpenStreetMap (OSRM). Traffic conditions may affect
              actual delivery times.
            </span>
          </div>

          {/* Delivery Partner Profile Card */}
          <div className={styles.partnerCard}>
            <div className={styles.partnerAvatar}>🛵</div>
            <div className={styles.partnerInfo}>
              <div className={styles.partnerNameRow}>
                <span className={styles.partnerName}>{deliveryPartner.name}</span>
                <span className={styles.partnerLiveBadge}>● Live</span>
              </div>
              <span className={styles.partnerVehicleText}>{deliveryPartner.vehicle}</span>
              <span className={styles.partnerRating}>★ {deliveryPartner.rating} (Verified Courier)</span>
            </div>
            {deliveryPartner.phone && (
              <a
                href={`tel:${deliveryPartner.phone}`}
                className={styles.callBtn}
                title="Call delivery courier"
              >
                📞 Call
              </a>
            )}
          </div>

          {/* Store Origin Information */}
          <div className={styles.storeOriginCard}>
            <span className={styles.storeIcon}>🏪</span>
            <div className={styles.storeTexts}>
              <span className={styles.storeLabel}>Dispatched from</span>
              <span className={styles.storeName}>
                {order.pickupLocation?.name || 'DrinkIt Flagship Reserve Cellar — Civil Lines'}
              </span>
              <span className={styles.storeAddress}>
                {order.pickupLocation?.address || 'The Mall Road, Civil Lines, Kanpur'}
              </span>
            </div>
          </div>

          {/* Destination Address Snapshot */}
          <div className={styles.addressSnapshot}>
            <span className={styles.destIcon}>📍</span>
            <div className={styles.destTexts}>
              <span className={styles.destLabel}>Delivering to</span>
              <span className={styles.destAddress}>
                {order.deliveryAddress?.house}, {order.deliveryAddress?.street},{' '}
                {order.deliveryAddress?.city} - {order.deliveryAddress?.pinCode}
              </span>
            </div>
          </div>

          {/* Order Summary Drawer Toggle */}
          <div className={styles.itemsSummary}>
            <button
              type="button"
              className={styles.summaryToggleBtn}
              onClick={() => setShowOrderSummary(!showOrderSummary)}
            >
              <span>
                {order.items?.length || 1}{' '}
                {(order.items?.length || 1) === 1 ? 'Bottle' : 'Bottles'} ·{' '}
                <strong>{formatINR(order.total || order.grandTotal)}</strong>
              </span>
              <span>{showOrderSummary ? '▲ Hide Items' : '▼ View Items'}</span>
            </button>

            {showOrderSummary && (
              <div className={styles.summaryDropdownList}>
                {order.items?.map((item, idx) => (
                  <div key={idx} className={styles.summaryItemRow}>
                    <span>
                      {item.name} × <strong>{item.quantity}</strong>
                    </span>
                    <span>{formatINR(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Support Link */}
          <div className={styles.supportPlaceholder}>
            <span>Need assistance with this delivery? </span>
            <a href="mailto:concierge@drinkit.in" className={styles.supportLink}>
              Contact Cellar Concierge
            </a>
          </div>
        </div>

        {/* Right Panel: Interactive Leaflet Map */}
        <div className={styles.mapViewport}>
          <div ref={mapContainerRef} className={styles.leafletMap} />

          {/* Floating Notice on Map */}
          <div className={styles.mapFloatingBadge}>
            DEMO SIMULATION — NOT REAL DELIVERY GPS
          </div>

          {/* Recenter Action Button */}
          <button
            type="button"
            className={styles.recenterBtn}
            onClick={handleRecenter}
            title="Recenter on delivery courier"
            aria-label="Recenter map"
          >
            🎯
          </button>
        </div>
      </div>
    </div>
  );
}
