import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { createOrder } from '../services/orderApi';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_DETAILS,
  loadRazorpayScript,
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordPaymentFailure,
  simulateTestPayment,
} from '../services/paymentService';
import { formatINR } from '../utils/formatters';
import styles from './Checkout.module.css';

const INITIAL_ADDRESS_FORM = {
  fullName: '',
  mobileNumber: '',
  house: '',
  street: '',
  landmark: '',
  city: '',
  state: 'Uttar Pradesh',
  pinCode: '',
  type: 'Home',
  isDefault: false,
};

export default function Checkout() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {
    addresses,
    addAddress,
    editAddress,
    deleteAddress,
    setDefaultAddress,
    profile,
    refreshOrders,
  } = useUser();
  const { items, subtotal, shipping, clearCart } = useCart();
  const { selectedLocation, openLocationPicker, serviceability } = useLocation();

  // Selected address ID state override
  const [selectedAddressIdOverride, setSelectedAddressIdOverride] = useState(null);

  // Derive active selected address ID smoothly
  const selectedAddressId = useMemo(() => {
    if (selectedAddressIdOverride && addresses.some((a) => a.id === selectedAddressIdOverride)) {
      return selectedAddressIdOverride;
    }
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    return defaultAddr ? defaultAddr.id : null;
  }, [addresses, selectedAddressIdOverride]);

  // Address Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressFormData, setAddressFormData] = useState(INITIAL_ADDRESS_FORM);
  const [addressFormError, setAddressFormError] = useState('');

  // Payment Method Foundation ('COD' or 'RAZORPAY')
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.COD);

  // Mandatory 21+ Age Verification
  const [isAgeVerified, setIsAgeVerified] = useState(false);

  // Promo Code
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');

  // Submission & Payment State
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [simulatorData, setSimulatorData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Preload Razorpay script
  useEffect(() => {
    loadRazorpayScript().catch(() => {});
  }, []);

  // Map Preview Refs
  const mapPreviewContainerRef = useRef(null);
  const mapPreviewInstanceRef = useRef(null);
  const previewMarkerRef = useRef(null);

  // If customer is not authenticated, redirect to login
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/checkout', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Selected address object
  const selectedAddress = useMemo(() => {
    return addresses.find((a) => a.id === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  // Pricing calculations
  const discountAmount = useMemo(() => {
    const code = appliedPromo.toUpperCase();
    if (code === 'DRINKIT10') {
      return Math.round(subtotal * 0.1);
    }
    if (code === 'WELCOME50') {
      return Math.min(subtotal, 50);
    }
    return 0;
  }, [appliedPromo, subtotal]);

  // Total MRP savings across all items
  const totalMrpSavings = useMemo(() => {
    return items.reduce((sum, { product, quantity }) => {
      const mrp = Number(product.originalPrice || product.mrp || product.price);
      const price = Number(product.price);
      return sum + Math.max(0, (mrp - price) * quantity);
    }, 0);
  }, [items]);

  const finalGrandTotal = Math.max(0, subtotal - discountAmount + shipping);

  // Map coordinates for preview
  const previewCoords = useMemo(() => {
    const lat = Number(selectedAddress?.latitude || selectedLocation?.latitude);
    const lng = Number(selectedAddress?.longitude || selectedLocation?.longitude);
    if (!isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
    return { lat: 26.5037, lng: 80.2525 };
  }, [selectedAddress, selectedLocation]);

  // Leaflet Map Preview Initialization
  useEffect(() => {
    if (!mapPreviewContainerRef.current) return;

    if (!mapPreviewInstanceRef.current) {
      const map = L.map(mapPreviewContainerRef.current, {
        center: [previewCoords.lat, previewCoords.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: styles.markerContainer,
        html: `<div class="${styles.mapPin}"><span>🏠</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([previewCoords.lat, previewCoords.lng], { icon: markerIcon }).addTo(map);
      previewMarkerRef.current = marker;
      mapPreviewInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    } else {
      mapPreviewInstanceRef.current.setView([previewCoords.lat, previewCoords.lng], 14);
      if (previewMarkerRef.current) {
        previewMarkerRef.current.setLatLng([previewCoords.lat, previewCoords.lng]);
      }
    }
  }, [previewCoords]);

  useEffect(() => {
    return () => {
      if (mapPreviewInstanceRef.current) {
        mapPreviewInstanceRef.current.remove();
        mapPreviewInstanceRef.current = null;
      }
    };
  }, []);

  // Address Modal Openers
  const handleOpenAdd = () => {
    setEditingAddressId(null);
    setAddressFormData({
      ...INITIAL_ADDRESS_FORM,
      fullName: profile?.fullName || '',
      mobileNumber: (user?.phoneNumber || '').replace(/\D/g, '').slice(-10),
      city: selectedLocation?.city || '',
      state: selectedLocation?.state || 'Uttar Pradesh',
      pinCode: selectedLocation?.postalCode || '',
      street: selectedLocation?.street || selectedLocation?.locality || '',
      landmark: selectedLocation?.landmark || '',
      isDefault: addresses.length === 0,
    });
    setAddressFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (addr, e) => {
    if (e) e.stopPropagation();
    setEditingAddressId(addr.id);
    setAddressFormData({ ...addr });
    setAddressFormError('');
    setModalOpen(true);
  };

  const handleDeleteAddress = async (addrId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Remove this address from your saved addresses?')) {
      await deleteAddress(addrId);
    }
  };

  const handleSetDefault = async (addrId, e) => {
    if (e) e.stopPropagation();
    await setDefaultAddress(addrId);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressFormError('');

    if (!addressFormData.fullName.trim()) {
      setAddressFormError('Full name is required.');
      return;
    }
    if (!addressFormData.mobileNumber || addressFormData.mobileNumber.replace(/\D/g, '').length < 10) {
      setAddressFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (
      !addressFormData.house.trim() ||
      !addressFormData.street.trim() ||
      !addressFormData.city.trim() ||
      !addressFormData.pinCode.trim()
    ) {
      setAddressFormError('Please provide complete house/flat, street, city, and pincode.');
      return;
    }

    try {
      if (editingAddressId) {
        await editAddress(editingAddressId, addressFormData);
      } else {
        await addAddress(addressFormData);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save address:', err);
      setAddressFormError('Failed to save address. Please try again.');
    }
  };

  const handleApplyPromo = (e) => {
    e.preventDefault();
    setOrderError('');
    const code = promoCode.trim().toUpperCase();
    if (code === 'DRINKIT10') {
      setAppliedPromo('DRINKIT10');
      setPromoCode('');
    } else if (code === 'WELCOME50') {
      setAppliedPromo('WELCOME50');
      setPromoCode('');
    } else {
      setOrderError('Invalid promo code. Try "DRINKIT10" (10% off) or "WELCOME50" (₹50 off)!');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo('');
    setOrderError('');
  };

  // Place Order Action (COD or Razorpay Test Mode)
  const handlePlaceOrder = async () => {
    setOrderError('');

    if (!selectedAddress) {
      setOrderError('Please select or add a delivery address to proceed.');
      return;
    }

    if (!isAgeVerified) {
      setOrderError('Mandatory: Please check the 21+ age verification confirmation box to proceed.');
      return;
    }

    if (items.length === 0) {
      setOrderError('Your cart is empty.');
      return;
    }

    setIsPlacingOrder(true);

    const orderPayload = {
      customerPhone: user.phoneNumber,
      customerName: selectedAddress.fullName || profile?.fullName,
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
      deliveryAddress: {
        fullName: selectedAddress.fullName,
        mobileNumber: selectedAddress.mobileNumber,
        house: selectedAddress.house,
        street: selectedAddress.street,
        landmark: selectedAddress.landmark || '',
        city: selectedAddress.city,
        state: selectedAddress.state || selectedLocation?.state || 'Uttar Pradesh',
        pinCode: selectedAddress.pinCode,
        type: selectedAddress.type || 'Home',
        latitude: previewCoords.lat,
        longitude: previewCoords.lng,
      },
      paymentMethod,
      promoCode: appliedPromo,
    };

    // 1. Cash on Delivery Flow
    if (paymentMethod === PAYMENT_METHODS.COD) {
      try {
        const res = await createOrder(orderPayload, user.phoneNumber);
        clearCart();
        if (refreshOrders) {
          await refreshOrders();
        }
        navigate(`/account/orders/${res.order.id}?confirmed=true`, { replace: true });
      } catch (err) {
        console.error('Checkout COD place order error:', err);
        setOrderError(err.message || 'Failed to place COD order. Please try again.');
        setIsPlacingOrder(false);
      }
      return;
    }

    // 2. Razorpay Test Mode Flow
    try {
      const { order, razorpayOrder, keyId } = await createRazorpayOrder(
        orderPayload,
        user.phoneNumber
      );

      const scriptLoaded = await loadRazorpayScript();

      // Check if genuine order was created on api.razorpay.com
      const isRealRazorpayOrder = Boolean(
        !razorpayOrder.isSimulated &&
        razorpayOrder.id &&
        !razorpayOrder.id.startsWith('order_test_')
      );

      if (isRealRazorpayOrder && scriptLoaded && typeof window !== 'undefined' && window.Razorpay) {
        const cleanContact = (user?.phoneNumber || selectedAddress?.mobileNumber || '').replace(/\D/g, '').slice(-10);

        const options = {
          key: keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency || 'INR',
          name: 'DrinkIt Reserve',
          description: `Order #${order.id} (Test Mode)`,
          order_id: razorpayOrder.id,
          image: `${window.location.origin}/favicon.ico`,
          handler: async function (response) {
            try {
              setIsPlacingOrder(true);
              console.log('✅ [Razorpay Checkout] Payment confirmed by modal. Verifying cryptographic signature...');

              await verifyRazorpayPayment(
                {
                  orderId: order.id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id || razorpayOrder.id,
                  razorpaySignature: response.razorpay_signature,
                },
                user.phoneNumber
              );

              clearCart();
              if (refreshOrders) {
                await refreshOrders();
              }
              navigate(`/account/orders/${order.id}?confirmed=true`, { replace: true });
            } catch (vErr) {
              console.error('❌ Razorpay signature verification failed:', vErr);
              setOrderError(vErr.message || 'Cryptographic payment verification failed.');
              setIsPlacingOrder(false);
            }
          },
          prefill: {
            name: selectedAddress.fullName || profile?.fullName || 'Customer',
            contact: cleanContact,
            email: user?.email || profile?.email || 'customer@drinkit.com',
          },
          theme: {
            color: '#e5a84b',
          },
          modal: {
            ondismiss: async function () {
              try {
                await recordPaymentFailure(
                  {
                    orderId: order.id,
                    reason: 'Customer closed Razorpay checkout popup without completing payment.',
                    razorpayOrderId: razorpayOrder.id,
                  },
                  user.phoneNumber
                );
              } catch (e) {
                console.warn(e);
              }
              setOrderError(
                'Payment was not completed. Your order has been saved and items reserved. You can complete payment anytime from My Orders.'
              );
              setIsPlacingOrder(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async function (response) {
          try {
            console.error('❌ [Razorpay Checkout] payment.failed:', response.error?.description);
            await recordPaymentFailure(
              {
                orderId: order.id,
                reason: response.error?.description || 'Razorpay payment failed.',
                razorpayPaymentId: response.error?.metadata?.payment_id,
                razorpayOrderId: razorpayOrder.id,
              },
              user.phoneNumber
            );
          } catch (e) {
            console.warn(e);
          }
          setOrderError(
            `Payment failed: ${
              response.error?.description || 'Transaction declined'
            }. Items are reserved; you can retry payment from My Orders.`
          );
          setIsPlacingOrder(false);
        });

        rzp.open();
      } else {
        // Fallback for demo placeholder keys or offline/sandboxed environments:
        // Do NOT attempt to pass a simulated order ID to window.Razorpay (which causes "Oops! Something went wrong")
        // Instead, open the interactive DrinkIt Test Mode Simulator modal!
        setIsPlacingOrder(false);
        setSimulatorData({
          order,
          razorpayOrder,
          reason: razorpayOrder.simulationReason,
        });
      }
    } catch (err) {
      console.error('Razorpay order initialization error:', err);
      setOrderError(err.message || 'Failed to initialize Razorpay payment. Please try again.');
      setIsPlacingOrder(false);
    }
  };

  // Simulator Modal Handlers
  const handleSimulateSuccess = async () => {
    if (!simulatorData) return;
    setIsSimulating(true);
    setOrderError('');

    try {
      await simulateTestPayment(
        simulatorData.order.id,
        simulatorData.razorpayOrder.id,
        user.phoneNumber
      );

      clearCart();
      if (refreshOrders) {
        await refreshOrders();
      }
      setSimulatorData(null);
      navigate(`/account/orders/${simulatorData.order.id}?confirmed=true`, { replace: true });
    } catch (err) {
      console.error('Payment simulation verification error:', err);
      setOrderError(err.message || 'Payment simulation verification failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateCancel = async () => {
    if (!simulatorData) return;
    setIsSimulating(true);

    try {
      await recordPaymentFailure(
        {
          orderId: simulatorData.order.id,
          reason: 'Payment cancelled by customer in sandbox test simulator.',
          razorpayOrderId: simulatorData.razorpayOrder.id,
        },
        user.phoneNumber
      );
      setOrderError(
        'Payment was cancelled. Your order has been saved and items reserved. You can retry payment anytime from My Orders.'
      );
    } catch (err) {
      console.warn(err);
    } finally {
      setIsSimulating(false);
      setSimulatorData(null);
    }
  };

  // Empty cart fallback
  if (items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.sectionCard} style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <span style={{ fontSize: '3.5rem' }}>🛒</span>
          <h1 className={styles.title} style={{ marginTop: '1rem' }}>
            Your Cart is Empty
          </h1>
          <p className={styles.subtitle}>
            Please select bottles from the cellar catalog before proceeding to checkout.
          </p>
          <Link
            to="/products"
            className={styles.placeOrderBtn}
            style={{ width: 'auto', margin: '1.5rem auto 0', textDecoration: 'none' }}
          >
            Browse DrinkIt Catalog →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Secure Cellar Checkout</h1>
        <p className={styles.subtitle}>
          Review your order, confirm your doorstep delivery address, and complete your reservation.
        </p>
      </header>

      <div className={styles.checkoutGrid}>
        {/* Left Column: Customer Info, Delivery Address & Payment */}
        <div className={styles.mainCol}>
          {/* 1. Customer Information Card */}
          <div className={styles.customerInfoCard}>
            <div className={styles.customerAvatar}>👤</div>
            <div className={styles.customerDetails}>
              <div className={styles.customerNameRow}>
                <span className={styles.customerName}>
                  {profile?.fullName || user?.fullName || 'Verified DrinkIt Customer'}
                </span>
                <span className={styles.customerVerifiedBadge}>✓ Verified Customer</span>
              </div>
              <span className={styles.customerPhone}>
                📱 +91 {(user?.phoneNumber || '').replace(/\D/g, '').slice(-10)}
              </span>
            </div>
          </div>

          {/* Blinkit-style Location Bar */}
          <div className={styles.locationBannerCard}>
            <div className={styles.locationBannerLeft}>
              <span className={styles.locationBannerIcon}>📍</span>
              <div className={styles.locationBannerDetails}>
                <div className={styles.locationBannerHeading}>
                  Deliver to:{' '}
                  <strong>
                    {selectedLocation
                      ? selectedLocation.locality || selectedLocation.city
                      : 'Kanpur Delivery Zone'}
                  </strong>
                </div>
                <div className={styles.locationBannerAddress}>
                  {selectedLocation ? (
                    selectedLocation.formattedAddress ||
                    `${selectedLocation.locality || ''}, ${selectedLocation.city}, ${selectedLocation.state}, India`
                  ) : (
                    'Defaulting to central cellar fulfillment dispatch.'
                  )}
                </div>
                {selectedLocation && (
                  <div className={styles.locationBannerServiceability}>
                    <span className={styles.serviceBadge}>{serviceability.badgeText}</span>
                    <span className={styles.serviceEst}>{serviceability.estimatedTimeText}</span>
                    <span className={styles.serviceMsg}>• {serviceability.message}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className={styles.locationChangeActionBtn}
              onClick={openLocationPicker}
            >
              {selectedLocation ? 'Change Area' : 'Select Area'}
            </button>
          </div>

          {/* 2 & 3. Saved Addresses Selection + Add New Address */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span>📍</span>
                <span>Delivery Address</span>
              </h2>
              <button
                type="button"
                className={styles.addAddressBtn}
                onClick={handleOpenAdd}
              >
                + Add New Address
              </button>
            </div>

            {addresses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#8c8594' }}>
                <p>No saved delivery addresses found.</p>
                <button
                  type="button"
                  className={styles.addAddressBtn}
                  onClick={handleOpenAdd}
                  style={{ marginTop: '0.5rem' }}
                >
                  Add Your Delivery Address
                </button>
              </div>
            ) : (
              <div className={styles.addressGrid}>
                {addresses.map((addr) => {
                  const isSelected = addr.id === selectedAddressId;
                  return (
                    <div
                      key={addr.id}
                      className={`${styles.addressCard} ${
                        isSelected ? styles.addressCardSelected : ''
                      }`}
                      onClick={() => setSelectedAddressIdOverride(addr.id)}
                    >
                      <div className={styles.addressTop}>
                        <div className={styles.addressNameRow}>
                          <span className={styles.addressName}>{addr.fullName}</span>
                          {addr.type && (
                            <span className={styles.typeBadge}>{addr.type}</span>
                          )}
                          {addr.isDefault && (
                            <span className={styles.defaultBadge}>Default</span>
                          )}
                        </div>
                        <div className={styles.addressRadio}>
                          {isSelected && <div className={styles.addressRadioInner} />}
                        </div>
                      </div>

                      <p className={styles.addressLines}>
                        {addr.house}, {addr.street}
                        {addr.landmark ? `, Near ${addr.landmark}` : ''}
                        <br />
                        {addr.city}, {addr.state} - {addr.pinCode}
                      </p>

                      <div className={styles.addressPhone}>
                        📞 +91 {addr.mobileNumber}
                      </div>

                      <div className={styles.addressActions}>
                        <button
                          type="button"
                          className={styles.addrActionBtn}
                          onClick={(e) => handleOpenEdit(addr, e)}
                        >
                          Edit
                        </button>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            className={styles.addrActionBtn}
                            onClick={(e) => handleSetDefault(addr.id, e)}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${styles.addrActionBtn} ${styles.addrActionBtnDanger}`}
                          onClick={(e) => handleDeleteAddress(addr.id, e)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. Delivery Location Map Preview */}
            {selectedAddress && (
              <div className={styles.mapPreviewWrapper}>
                <div className={styles.mapPreviewHeader}>
                  <span>🗺️ Delivery Location Map Preview</span>
                  <span className={styles.mapPreviewCoords}>
                    {previewCoords.lat.toFixed(4)}° N, {previewCoords.lng.toFixed(4)}° E
                  </span>
                </div>
                <div ref={mapPreviewContainerRef} className={styles.mapPreviewContainer} />
                <div className={styles.mapPreviewFooter}>
                  <span>
                    📍 Dropoff Pin: {selectedAddress.house}, {selectedAddress.street},{' '}
                    {selectedAddress.city} - {selectedAddress.pinCode}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 14. Payment Method Selection */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span>💳</span>
                <span>Payment Method</span>
              </h2>
              <span className={styles.testModeTag}>Zero Real Money Charged</span>
            </div>

            <div className={styles.paymentOptions}>
              {PAYMENT_METHOD_DETAILS.map((method) => {
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    className={`${styles.paymentOption} ${
                      isSelected ? styles.paymentOptionSelected : ''
                    }`}
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    <div className={styles.payRadio}>
                      {isSelected && <div className={styles.addressRadioInner} />}
                    </div>
                    <div className={styles.payInfo}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span className={styles.payTitle}>
                          {method.icon} {method.name}
                        </span>
                        <span className={method.isTest ? styles.testModeTag : styles.defaultBadge}>
                          {method.badge}
                        </span>
                      </div>
                      <p className={styles.payDesc}>{method.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Order Items Summary & Place Order */}
        <div className={styles.summaryCol}>
          <div className={styles.summaryCard}>
            <h2 className={styles.sectionTitle}>
              <span>📋</span>
              <span>Order Summary ({items.length} {items.length === 1 ? 'Item' : 'Items'})</span>
            </h2>

            {/* 5, 6, 7, 8. Order items with quantities, price, MRP & discount */}
            <div className={styles.itemsSummary}>
              {items.map(({ product, quantity }) => {
                const mrp = Number(product.originalPrice || product.mrp || product.price);
                const price = Number(product.price);
                return (
                  <div key={product.id} className={styles.summaryItemRow}>
                    <div className={styles.summaryItemInfo}>
                      {product.image || product.imageUrl || product.thumbnail ? (
                        <img
                          src={product.image || product.imageUrl || product.thumbnail}
                          alt={product.name}
                          className={styles.summaryItemThumb}
                        />
                      ) : (
                        <span
                          className={styles.summaryItemThumb}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          🥃
                        </span>
                      )}
                      <div>
                        <div className={styles.summaryItemName}>{product.name}</div>
                        <div className={styles.summaryItemPrices}>
                          {mrp > price && (
                            <span className={styles.summaryItemMrp}>MRP {formatINR(mrp)}</span>
                          )}
                          <span className={styles.summaryItemPrice}>
                            {formatINR(price)} each × {quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={styles.summaryItemTotal}>
                      {formatINR(price * quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total MRP Savings Banner */}
            {totalMrpSavings > 0 && (
              <div className={styles.mrpSavingsBanner}>
                🎉 Total Catalog Savings: {formatINR(totalMrpSavings + discountAmount)}
              </div>
            )}

            <div className={styles.divider} />

            {/* Promo Code Box */}
            {appliedPromo ? (
              <div className={styles.appliedPromoBox}>
                <div className={styles.appliedPromoText}>
                  <span>🎟️</span>
                  <span>
                    Coupon <strong>{appliedPromo}</strong> applied (-{formatINR(discountAmount)})
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.removePromoBtn}
                  onClick={handleRemovePromo}
                  title="Remove coupon"
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyPromo} className={styles.promoForm}>
                <input
                  type="text"
                  placeholder="Coupon (DRINKIT10 or WELCOME50)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className={styles.promoInput}
                />
                <button type="submit" className={styles.promoBtn}>
                  Apply
                </button>
              </form>
            )}

            <div className={styles.divider} />

            {/* 9, 10, 11, 12. Breakdown: Subtotal, Delivery, Taxes, Grand Total */}
            <div className={styles.breakdownRow}>
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className={`${styles.breakdownRow} ${styles.discountRow}`}>
                <span>Coupon Discount ({appliedPromo})</span>
                <span className={styles.discountValue}>-{formatINR(discountAmount)}</span>
              </div>
            )}

            <div className={styles.breakdownRow}>
              <span>Express Cellar Delivery</span>
              <span>
                {shipping === 0 ? (
                  <strong className={styles.freeDelivery}>FREE</strong>
                ) : (
                  formatINR(shipping)
                )}
              </span>
            </div>

            <div className={styles.breakdownRow}>
              <span>Taxes & Handling Fees</span>
              <span className={styles.taxIncludedText}>Included (₹0)</span>
            </div>

            <div className={styles.divider} />

            <div className={styles.totalRow}>
              <span>Grand Total</span>
              <span className={styles.totalAmount}>{formatINR(finalGrandTotal)}</span>
            </div>

            {/* 13. Mandatory 21+ Age Verification Confirmation */}
            <div className={styles.ageVerificationBox}>
              <label className={styles.ageCheckLabel}>
                <input
                  type="checkbox"
                  checked={isAgeVerified}
                  onChange={(e) => setIsAgeVerified(e.target.checked)}
                  className={styles.ageCheckbox}
                />
                <span>
                  <strong>🔞 21+ Age Confirmation:</strong> I confirm that I and the delivery
                  recipient are 21 years of age or older and will present valid photo identification
                  upon delivery.
                </span>
              </label>
            </div>

            {orderError && <div className={styles.errorBanner}>⚠️ {orderError}</div>}

            {/* 15. Place Order CTA */}
            <button
              type="button"
              className={styles.placeOrderBtn}
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || !isAgeVerified || !selectedAddress}
            >
              {isPlacingOrder
                ? 'Processing Order...'
                : !selectedAddress
                ? 'Select Delivery Address'
                : !isAgeVerified
                ? 'Confirm 21+ Age to Proceed'
                : `Place Order • ${formatINR(finalGrandTotal)}`}
            </button>

            <div className={styles.trustFootnote}>
              <span>🔒 256-Bit SSL Encrypted & Trusted Checkout</span>
              <span>🔞 Mandatory 21+ physical ID check upon doorstep handoff</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Address Modal */}
      {modalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingAddressId ? 'Edit Delivery Address' : 'Add Delivery Address'}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {addressFormError && (
              <div className={styles.errorBanner}>{addressFormError}</div>
            )}

            {selectedLocation && (
              <button
                type="button"
                className={styles.autofillLocationBtn}
                onClick={() => {
                  setAddressFormData((prev) => ({
                    ...prev,
                    city: selectedLocation.city || prev.city,
                    state: selectedLocation.state || prev.state,
                    pinCode: selectedLocation.postalCode || prev.pinCode,
                    street: selectedLocation.street || selectedLocation.locality || prev.street,
                    landmark: selectedLocation.landmark || prev.landmark,
                  }));
                }}
              >
                📍 Autofill using detected area ({selectedLocation.locality || selectedLocation.city})
              </button>
            )}

            <form onSubmit={handleSaveAddress}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={addressFormData.fullName}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, fullName: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="e.g. Om Singh"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>10-Digit Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addressFormData.mobileNumber}
                    onChange={(e) =>
                      setAddressFormData({
                        ...addressFormData,
                        mobileNumber: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className={styles.formInput}
                    placeholder="e.g. 9876543210"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Flat / House / Building *</label>
                  <input
                    type="text"
                    required
                    value={addressFormData.house}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, house: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="e.g. Flat 402, Signature Towers"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Street / Sector / Area *</label>
                  <input
                    type="text"
                    required
                    value={addressFormData.street}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, street: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="e.g. Mall Road, Civil Lines"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Landmark (Optional)</label>
                  <input
                    type="text"
                    value={addressFormData.landmark}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, landmark: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="e.g. Near Z Square Mall"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>City *</label>
                  <input
                    type="text"
                    required
                    value={addressFormData.city}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, city: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="e.g. Kanpur"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>State *</label>
                  <input
                    type="text"
                    required
                    value={addressFormData.state}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, state: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="e.g. Uttar Pradesh"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={addressFormData.pinCode}
                    onChange={(e) =>
                      setAddressFormData({
                        ...addressFormData,
                        pinCode: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className={styles.formInput}
                    placeholder="e.g. 208001"
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <label>Address Type</label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    {['Home', 'Work', 'Other'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={styles.addrActionBtn}
                        style={{
                          background:
                            addressFormData.type === t
                              ? 'rgba(229, 168, 75, 0.18)'
                              : 'rgba(255, 255, 255, 0.05)',
                          border:
                            addressFormData.type === t
                              ? '1px solid #e5a84b'
                              : '1px solid rgba(255, 255, 255, 0.1)',
                          color: addressFormData.type === t ? '#e5a84b' : '#cfcad6',
                          padding: '0.45rem 0.95rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                        }}
                        onClick={() => setAddressFormData({ ...addressFormData, type: t })}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroupFull} style={{ marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={addressFormData.isDefault}
                      onChange={(e) =>
                        setAddressFormData({ ...addressFormData, isDefault: e.target.checked })
                      }
                      style={{ accentColor: '#e5a84b' }}
                    />
                    <span>Set as primary default delivery address</span>
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveAddressBtn}>
                  {editingAddressId ? 'Save Changes' : 'Add Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Razorpay Test Mode Offline / Sandbox Simulator Modal */}
      {simulatorData && (
        <div className={styles.simulatorOverlay}>
          <div className={styles.simulatorModal}>
            <div className={styles.simulatorHeader}>
              <h3 className={styles.simulatorTitle}>
                <span>💳</span>
                <span>Razorpay Test Sandbox</span>
              </h3>
              <span className={styles.simulatorBadge}>Test Mode</span>
            </div>

            <div className={styles.simulatorBody}>
              <div className={styles.simulatorNotice}>
                DrinkIt is running in <strong>Razorpay Test Mode</strong>.
                {simulatorData.reason ? (
                  <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', color: '#f0c040' }}>
                    ℹ️ <strong>Gateway Status:</strong> {simulatorData.reason}.
                    <div style={{ marginTop: '0.25rem', color: '#cfcad6' }}>
                      You can complete and cryptographically verify this payment right now using the simulator below.
                      To enable the official Razorpay checkout popup, add your registered Test Keys from{' '}
                      <a
                        href="https://dashboard.razorpay.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#e5a84b', textDecoration: 'underline' }}
                      >
                        dashboard.razorpay.com
                      </a>{' '}
                      into <code>server/.env</code>.
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.25rem' }}>
                    Simulate payment completion with authentic cryptographic HMAC-SHA256 signature verification on the backend.
                  </div>
                )}
              </div>

              <div className={styles.simulatorDetails}>
                <div className={styles.simulatorRow}>
                  <span>Order Reference:</span>
                  <strong>#{simulatorData.order.id}</strong>
                </div>
                <div className={styles.simulatorRow}>
                  <span>Razorpay Order ID:</span>
                  <code>{simulatorData.razorpayOrder.id}</code>
                </div>
                <div className={styles.simulatorRow}>
                  <span>Amount Payable:</span>
                  <strong style={{ color: '#e5a84b', fontSize: '1.05rem' }}>
                    {formatINR(simulatorData.order.total)}
                  </strong>
                </div>
                <div className={styles.simulatorRow}>
                  <span>Mode:</span>
                  <span>Sandbox (Zero Real Money)</span>
                </div>
              </div>

              <div className={styles.simulatorActions}>
                <button
                  type="button"
                  className={styles.simulatorSuccessBtn}
                  onClick={handleSimulateSuccess}
                  disabled={isSimulating}
                >
                  {isSimulating ? (
                    'Verifying Cryptographic Signature...'
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Simulate Successful Payment (₹{simulatorData.order.total})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className={styles.simulatorFailureBtn}
                  onClick={handleSimulateCancel}
                  disabled={isSimulating}
                >
                  Simulate Failed / Cancelled Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
