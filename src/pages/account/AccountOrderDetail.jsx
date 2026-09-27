import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { getOrderById, cancelCustomerOrder } from '../../services/orderApi';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordPaymentFailure,
  simulateTestPayment,
  loadRazorpayScript,
} from '../../services/paymentService';
import { formatINR } from '../../utils/formatters';
import styles from './AccountOrderDetail.module.css';

const TIMELINE_STAGES = [
  { key: 'PENDING', label: 'Order Placed', desc: 'Order received' },
  { key: 'CONFIRMED', label: 'Confirmed', desc: 'Cellar verified' },
  { key: 'PROCESSING', label: 'Processing', desc: 'Bottling & Packaging' },
  { key: 'READY', label: 'Ready', desc: 'Awaiting dispatch' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'On courier route' },
  { key: 'DELIVERED', label: 'Delivered', desc: 'Doorstep handoff' },
];

const CANCELLATION_REASONS = [
  'Placed order by mistake',
  'Incorrect delivery address',
  'Want to change order items',
  'Expected earlier delivery time',
  'Payment or billing issue',
  'Other reason',
];

export default function AccountOrderDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isConfirmedParam = searchParams.get('confirmed') === 'true';
  const [showCelebration, setShowCelebration] = useState(isConfirmedParam);

  const { orders, refreshOrders } = useUser();
  const { user } = useAuth();
  const phoneNumber = user?.phoneNumber;

  const [order, setOrder] = useState(() => orders.find((o) => o.id === id) || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Retry payment state
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [retrySimulatorData, setRetrySimulatorData] = useState(null);
  const [isSimulatingRetry, setIsSimulatingRetry] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? '' : c));
    }, 3500);
  };

  useEffect(() => {
    let isMounted = true;
    // If order already found from user context, we still refresh to get latest status
    getOrderById(id, phoneNumber)
      .then((data) => {
        if (isMounted && data) {
          setOrder(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError((prevErr) => prevErr || err.message || 'Unable to load order details.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, phoneNumber]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingBox}>
          <span>Loading DrinkIt order details...</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.container}>
        <div className={styles.backRow}>
          <Link to="/account/orders" className={styles.backBtn}>
            ← Back to Orders
          </Link>
        </div>
        <div className={styles.emptyState}>
          <h2 style={{ color: '#fff' }}>Order #{id} Not Found</h2>
          <p style={{ color: '#8c8594' }}>
            {error || 'This order does not exist or does not belong to your account.'}
          </p>
          <Link to="/products" className={styles.backBtn} style={{ marginTop: '1rem' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = order.orderStatus || order.status || 'PENDING';
  const isCancelled = currentStatus === 'CANCELLED';
  const canCancel = currentStatus === 'PENDING' || currentStatus === 'CONFIRMED';

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!order) return;

    setIsCancelling(true);
    setCancelError(null);

    const finalReason =
      cancelReason === 'Other reason' && customReason.trim()
        ? customReason.trim()
        : cancelReason;

    try {
      const updatedOrder = await cancelCustomerOrder(order.id, phoneNumber, finalReason);
      setOrder(updatedOrder);
      if (refreshOrders) {
        await refreshOrders();
      }
      setCancelModalOpen(false);
      showToast('Your order has been cancelled and stock has been restored to cellar inventory.');
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel order. Please try again or contact support.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!order || isRetryingPayment) return;
    setIsRetryingPayment(true);

    try {
      const { razorpayOrder, keyId } = await createRazorpayOrder(
        { orderId: order.id },
        phoneNumber
      );

      const scriptLoaded = await loadRazorpayScript();

      // Check if genuine order was created on api.razorpay.com
      const isRealRazorpayOrder = Boolean(
        !razorpayOrder.isSimulated &&
        razorpayOrder.id &&
        !razorpayOrder.id.startsWith('order_test_')
      );

      if (isRealRazorpayOrder && scriptLoaded && typeof window !== 'undefined' && window.Razorpay) {
        const cleanContact = (phoneNumber || '').replace(/\D/g, '').slice(-10);

        const options = {
          key: keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency || 'INR',
          name: 'DrinkIt Reserve',
          description: `Order #${order.id} Payment Retry`,
          order_id: razorpayOrder.id,
          image: `${window.location.origin}/favicon.ico`,
          handler: async function (response) {
            try {
              console.log('✅ [Razorpay Retry] Payment verified by popup, verifying signature...');
              await verifyRazorpayPayment(
                {
                  orderId: order.id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpayOrderId: response.razorpay_order_id || razorpayOrder.id,
                  razorpaySignature: response.razorpay_signature,
                },
                phoneNumber
              );

              showToast('Payment verified successfully! Order is confirmed.');
              const refreshed = await getOrderById(order.id, phoneNumber);
              if (refreshed) setOrder(refreshed);
              if (refreshOrders) refreshOrders();
            } catch (err) {
              console.error('❌ Razorpay retry verification failed:', err);
              showToast(`Payment verification error: ${err.message}`);
            }
          },
          prefill: {
            name: order.customerName || 'Customer',
            contact: cleanContact,
            email: user?.email || 'customer@drinkit.com',
          },
          theme: { color: '#e5a84b' },
          modal: {
            ondismiss: async function () {
              try {
                await recordPaymentFailure(
                  {
                    orderId: order.id,
                    reason: 'Customer cancelled payment retry popup.',
                    razorpayOrderId: razorpayOrder.id,
                  },
                  phoneNumber
                );
              } catch (e) {
                console.warn(e);
              }
              showToast('Payment retry cancelled.');
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async function (response) {
          try {
            console.error('❌ [Razorpay Retry] payment.failed:', response.error?.description);
            await recordPaymentFailure(
              {
                orderId: order.id,
                reason: response.error?.description || 'Payment retry failed',
                razorpayPaymentId: response.error?.metadata?.payment_id,
                razorpayOrderId: razorpayOrder.id,
              },
              phoneNumber
            );
          } catch (e) {
            console.warn(e);
          }
          showToast(`Payment declined: ${response.error?.description || 'Error'}`);
          const refreshed = await getOrderById(order.id, phoneNumber);
          if (refreshed) setOrder(refreshed);
        });

        rzp.open();
      } else {
        setRetrySimulatorData({
          order,
          razorpayOrder,
          reason: razorpayOrder.simulationReason,
        });
      }
    } catch (err) {
      showToast(`Unable to start payment retry: ${err.message}`);
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleSimulateRetrySuccess = async () => {
    if (!retrySimulatorData) return;
    setIsSimulatingRetry(true);

    try {
      await simulateTestPayment(
        retrySimulatorData.order.id,
        retrySimulatorData.razorpayOrder.id,
        phoneNumber
      );

      showToast('Payment verified successfully via Sandbox Simulation!');
      const refreshed = await getOrderById(order.id, phoneNumber);
      if (refreshed) setOrder(refreshed);
      if (refreshOrders) refreshOrders();
      setRetrySimulatorData(null);
    } catch (err) {
      showToast(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulatingRetry(false);
    }
  };

  // Calculate timeline active step index (0-5)
  const currentStageIndex = TIMELINE_STAGES.findIndex((s) => s.key === currentStatus);
  const activeStepIdx = currentStageIndex === -1 ? 0 : currentStageIndex;

  const getStatusClass = (st) => {
    switch (st?.toUpperCase()) {
      case 'CONFIRMED':
        return styles.statusConfirmed;
      case 'PROCESSING':
        return styles.statusProcessing;
      case 'READY':
        return styles.statusReady;
      case 'OUT_FOR_DELIVERY':
        return styles.statusOutForDelivery;
      case 'DELIVERED':
        return styles.statusDelivered;
      case 'CANCELLED':
        return styles.statusCancelled;
      default:
        return styles.statusPending;
    }
  };

  // Calculate total MRP savings across items
  const totalMrpSavings =
    order.items?.reduce((acc, item) => {
      if (item.mrp && item.mrp > item.price) {
        return acc + (item.mrp - item.price) * item.quantity;
      }
      return acc;
    }, 0) || 0;

  return (
    <div className={styles.container}>
      {/* Toast Alert */}
      {toastMessage && <div className={styles.toastAlert}>✓ {toastMessage}</div>}

      {/* Immediate Order Confirmation Celebration Screen */}
      {showCelebration && (
        <div className={styles.confirmationHero}>
          <div className={styles.confirmationLeft}>
            <span className={styles.confirmationEmoji}>🎉</span>
            <div className={styles.confirmationTexts}>
              <h2>Order Placed Successfully!</h2>
              <p>
                Your cellar selection has been verified and registered. Our fulfillment team is packaging your order with climate-controlled care.
              </p>
              <div className={styles.confirmationPills}>
                <span className={styles.confirmationOrderBadge}>Order #{order.id}</span>
                <span className={styles.confirmationEtaBadge}>⚡ Estimated Delivery: 25–35 Mins</span>
              </div>
            </div>
          </div>
          <div className={styles.confirmationActions}>
            <Link to={`/account/orders/${order.id}/track`} className={styles.confirmationTrackBtn}>
              <span>🛵</span>
              <span>Track Live Delivery →</span>
            </Link>
            <Link to="/products" className={styles.confirmationShopBtn}>
              <span>🛍️</span>
              <span>Continue Shopping</span>
            </Link>
            <button
              type="button"
              className={styles.confirmationDismissBtn}
              onClick={() => setShowCelebration(false)}
            >
              Dismiss banner
            </button>
          </div>
        </div>
      )}

      {/* Navigation & Header */}
      <div className={styles.backRow}>
        <Link to="/account/orders" className={styles.backBtn}>
          ← Back to My Orders
        </Link>
        <span style={{ fontSize: '0.82rem', color: '#8c8594' }}>
          Placed on{' '}
          {new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className={styles.orderHeader}>
        <div className={styles.titleArea}>
          <h1>#{order.id}</h1>
          <div className={styles.orderMeta}>
            <span>{order.items?.length || 0} Products</span>
            <span>•</span>
            <span>Total: <strong>{formatINR(order.total || order.totalAmount)}</strong></span>
          </div>
        </div>

        <div className={styles.statusBadges}>
          <span className={`${styles.statusPill} ${getStatusClass(currentStatus)}`}>
            {currentStatus.replace(/_/g, ' ')}
          </span>
          <span className={styles.payPill}>
            Payment: {order.paymentStatus || 'PENDING'}
          </span>
          {canCancel ? (
            <button
              type="button"
              className={styles.cancelOrderHeaderBtn}
              onClick={() => {
                setCancelModalOpen(true);
                setCancelError(null);
                setCancelReason(CANCELLATION_REASONS[0]);
                setCustomReason('');
              }}
            >
              Cancel Order
            </button>
          ) : !isCancelled && currentStatus !== 'DELIVERED' ? (
            <span
              style={{
                fontSize: '0.74rem',
                color: '#8c8594',
                background: 'rgba(255,255,255,0.04)',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              🔒 Cancellation closed (In fulfillment)
            </span>
          ) : null}
        </div>
      </div>

      {/* Live Tracking Banner for OUT_FOR_DELIVERY, READY, and DELIVERED */}
      {(currentStatus === 'OUT_FOR_DELIVERY' || currentStatus === 'READY' || currentStatus === 'DELIVERED') && (
        <div className={styles.liveTrackingBanner}>
          <div className={styles.liveTrackingInfo}>
            <span className={styles.liveTrackingIcon}>{currentStatus === 'DELIVERED' ? '🎉' : '🛵'}</span>
            <div>
              <strong className={styles.liveTrackingTitle}>
                {currentStatus === 'DELIVERED'
                  ? 'Your order has been delivered!'
                  : currentStatus === 'OUT_FOR_DELIVERY'
                  ? 'Your order is out for delivery!'
                  : 'Your order is packed & ready for dispatch!'}
              </strong>
              <p className={styles.liveTrackingDesc}>
                Delivery Partner: <strong>{order.deliveryPartnerName || 'Suraj Singh'}</strong>{' '}
                {currentStatus === 'DELIVERED'
                  ? 'completed the doorstep handover.'
                  : currentStatus === 'OUT_FOR_DELIVERY'
                  ? 'is on the way.'
                  : 'is assigned.'}
              </p>
            </div>
          </div>
          <Link to={`/account/orders/${order.id}/track`} className={styles.liveTrackingBtn}>
            {currentStatus === 'DELIVERED' ? '🗺️ View Delivery Route →' : '🛵 Track Live Delivery →'}
          </Link>
        </div>
      )}

      {/* Visual Order Timeline */}
      <div className={styles.timelineCard}>
        <h2 className={styles.timelineTitle}>
          <span>📦</span>
          <span>Order Fulfillment Progress</span>
        </h2>

        {isCancelled ? (
          <div className={styles.cancelledBanner}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div>
              <strong>This order has been CANCELLED.</strong>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                {order.statusHistory?.find((s) => s.status === 'CANCELLED')?.note ||
                  'Inventory has been restored to the cellar. Please contact support if you need assistance.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.timelineSteps}>
            <div
              className={styles.stepConnector}
              aria-hidden="true"
            >
              <div
                className={styles.stepConnectorFill}
                style={{
                  width: `${(activeStepIdx / (TIMELINE_STAGES.length - 1)) * 100}%`,
                }}
              />
            </div>

            {TIMELINE_STAGES.map((stage, idx) => {
              const isCompleted = idx < activeStepIdx;
              const isCurrent = idx === activeStepIdx;

              let stepClass = '';
              if (isCompleted) stepClass = styles.stepComplete;
              else if (isCurrent) stepClass = styles.stepActive;

              return (
                <div key={stage.key} className={`${styles.stepItem} ${stepClass}`}>
                  <div className={styles.stepDot}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <div className={styles.stepLabel}>{stage.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-Column Detail Grid */}
      <div className={styles.detailGrid}>
        {/* Left Column: Products Snapshot */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Bottles in this Order</h2>
          <div className={styles.itemsList}>
            {order.items?.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <div className={styles.itemInfo}>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className={styles.itemThumb}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={styles.itemThumbEmoji}
                    style={{ display: item.image ? 'none' : 'flex' }}
                  >
                    🥃
                  </div>
                  <div className={styles.itemTexts}>
                    {item.brand && <span className={styles.itemBrand}>{item.brand}</span>}
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemMeta}>
                      {formatINR(item.price)}
                      {item.mrp && item.mrp > item.price && (
                        <span className={styles.itemMrp}>{formatINR(item.mrp)}</span>
                      )}
                      {item.mrp && item.mrp > item.price && (
                        <span className={styles.itemSavingsTag}>
                          Save {formatINR(item.mrp - item.price)}
                        </span>
                      )}
                      {' '}× {item.quantity} {item.volume && `· ${item.volume}`}
                    </span>
                  </div>
                </div>

                <div className={styles.itemTotal}>
                  {formatINR(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Delivery Address, Payment & Financial Summary */}
        <div className={styles.sidebarArea}>
          {/* Delivery Address Snapshot */}
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Delivery Destination</h2>
            {order.deliveryAddress ? (
              <div className={styles.addressDetails}>
                <span className={styles.addressName}>{order.deliveryAddress.fullName}</span>
                <span className={styles.addressPhone}>+91 {order.deliveryAddress.mobileNumber}</span>
                <span>
                  {order.deliveryAddress.house}, {order.deliveryAddress.street}
                </span>
                {order.deliveryAddress.landmark && (
                  <span>Landmark: {order.deliveryAddress.landmark}</span>
                )}
                <span>
                  {order.deliveryAddress.city}, {order.deliveryAddress.state} -{' '}
                  {order.deliveryAddress.pinCode}
                </span>
                {order.deliveryAddress.type && (
                  <span className={styles.addressTag}>{order.deliveryAddress.type}</span>
                )}
              </div>
            ) : (
              <p style={{ color: '#8c8594', fontSize: '0.88rem' }}>No address snapshot available.</p>
            )}
          </div>

          {/* Payment Details */}
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Payment Method</h2>
            <div className={styles.paymentDetailBox}>
              <div>
                <strong style={{ color: '#fff', display: 'block', fontSize: '0.92rem' }}>
                  {order.paymentMethod === 'RAZORPAY'
                    ? '💳 Razorpay (Online Test Sandbox)'
                    : '💵 Cash on Delivery (Doorstep Verification)'}
                </strong>
                <span style={{ fontSize: '0.78rem', color: '#8c8594' }}>
                  Status: <strong>{order.paymentStatus || 'PENDING'}</strong>
                </span>
              </div>
              <span className={styles.payPill}>{order.paymentStatus || 'PENDING'}</span>
            </div>

            {order.paymentMethod === 'RAZORPAY' && (
              <div className={styles.paymentMetaDetails}>
                {order.razorpayOrderId && (
                  <div className={styles.paymentMetaRow}>
                    <span>Gateway Order ID:</span>
                    <code>{order.razorpayOrderId}</code>
                  </div>
                )}
                {order.razorpayPaymentId && (
                  <div className={styles.paymentMetaRow}>
                    <span>Payment ID:</span>
                    <code>{order.razorpayPaymentId}</code>
                  </div>
                )}
                {order.paidAt && (
                  <div className={styles.paymentMetaRow}>
                    <span>Verified & Paid At:</span>
                    <span style={{ color: '#2ed573' }}>
                      {new Date(order.paidAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}

                {order.paymentFailureReason && (
                  <div className={styles.paymentFailureAlert}>
                    ⚠️ <strong>Payment Issue:</strong> {order.paymentFailureReason}
                  </div>
                )}

                {order.paymentStatus !== 'PAID' && !isCancelled && (
                  <button
                    type="button"
                    onClick={handleRetryPayment}
                    disabled={isRetryingPayment}
                    className={styles.retryPaymentBtn}
                  >
                    {isRetryingPayment ? 'Launching Gateway...' : '💳 Complete / Retry Payment (Razorpay)'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Financial Summary */}
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Order Payment Breakdown</h2>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal || order.total || order.totalAmount)}</span>
            </div>

            {totalMrpSavings > 0 && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>MRP Retail Savings</span>
                <span>-{formatINR(totalMrpSavings)}</span>
              </div>
            )}

            {order.discount > 0 && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>Coupon Discount {order.promoCode && `(${order.promoCode})`}</span>
                <span>-{formatINR(order.discount)}</span>
              </div>
            )}

            <div className={styles.summaryRow}>
              <span>Delivery Fee</span>
              <span>
                {order.deliveryFee === 0 || (order.total || order.totalAmount) >= 999 ? (
                  <strong className={styles.freeTag}>FREE</strong>
                ) : (
                  formatINR(order.deliveryFee || 99)
                )}
              </span>
            </div>

            <div className={`${styles.summaryRow} ${styles.taxesRow}`}>
              <span>Taxes & Cellar Fees</span>
              <span>₹0.00 (Inclusive of excise & GST)</span>
            </div>

            <div className={styles.divider} />

            <div className={styles.grandTotalRow}>
              <span>Grand Total</span>
              <span className={styles.grandTotalAmount}>
                {formatINR(order.total || order.totalAmount)}
              </span>
            </div>

            {(totalMrpSavings > 0 || order.discount > 0) && (
              <div className={styles.savingsSummaryRow}>
                <span>🎉 Total Order Savings</span>
                <span>{formatINR(totalMrpSavings + (order.discount || 0))}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Cancellation Modal */}
      {cancelModalOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !isCancelling && setCancelModalOpen(false)}
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Cancel Order #{order.id}</h3>
                <p className={styles.modalSubtitle}>
                  Please choose a reason for cancelling this order.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !isCancelling && setCancelModalOpen(false)}
                disabled={isCancelling}
              >
                ✕
              </button>
            </div>

            {cancelError && (
              <div className={styles.modalErrorBox}>
                ⚠️ {cancelError}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className={styles.cancelForm}>
              <div className={styles.reasonList}>
                {CANCELLATION_REASONS.map((reason) => (
                  <label key={reason} className={styles.reasonOption}>
                    <input
                      type="radio"
                      name="cancellationReason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      disabled={isCancelling}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {cancelReason === 'Other reason' && (
                <div className={styles.customReasonBox}>
                  <textarea
                    className={styles.customReasonInput}
                    placeholder="Tell us why you are cancelling this order..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={3}
                    disabled={isCancelling}
                  />
                </div>
              )}

              <div className={styles.cancelWarningBox}>
                ⚠️ <strong>Note:</strong> Once cancelled, this order cannot be reopened. Any reserved bottles will be returned to cellar inventory.
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalKeepBtn}
                  onClick={() => setCancelModalOpen(false)}
                  disabled={isCancelling}
                >
                  Keep My Order
                </button>
                <button
                  type="submit"
                  className={styles.modalConfirmCancelBtn}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling Order...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Razorpay Test Simulator Modal for Retry Payment */}
      {retrySimulatorData && (
        <div className={styles.simulatorOverlay}>
          <div className={styles.simulatorModal}>
            <div className={styles.simulatorHeader}>
              <h3 className={styles.simulatorTitle}>
                <span>💳</span>
                <span>Razorpay Test Sandbox</span>
              </h3>
              <span className={styles.simulatorBadge}>Retry Mode</span>
            </div>

            <div className={styles.simulatorBody}>
              <div className={styles.simulatorNotice}>
                DrinkIt is running in <strong>Razorpay Test Mode</strong>.
                {retrySimulatorData.reason ? (
                  <div style={{ marginTop: '0.45rem', fontSize: '0.8rem', color: '#f0c040' }}>
                    ℹ️ <strong>Gateway Status:</strong> {retrySimulatorData.reason}.
                    <div style={{ marginTop: '0.25rem', color: '#cfcad6' }}>
                      You can complete and cryptographically verify this retry payment right now using the simulator below.
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
                  <strong>#{retrySimulatorData.order.id}</strong>
                </div>
                <div className={styles.simulatorRow}>
                  <span>Razorpay Order ID:</span>
                  <code>{retrySimulatorData.razorpayOrder.id}</code>
                </div>
                <div className={styles.simulatorRow}>
                  <span>Amount Payable:</span>
                  <strong style={{ color: '#e5a84b', fontSize: '1.05rem' }}>
                    {formatINR(retrySimulatorData.order.total || retrySimulatorData.order.totalAmount)}
                  </strong>
                </div>
              </div>

              <div className={styles.simulatorActions}>
                <button
                  type="button"
                  className={styles.simulatorSuccessBtn}
                  onClick={handleSimulateRetrySuccess}
                  disabled={isSimulatingRetry}
                >
                  {isSimulatingRetry ? 'Verifying Signature...' : '✓ Complete Payment (Sandbox Simulation)'}
                </button>

                <button
                  type="button"
                  className={styles.simulatorFailureBtn}
                  onClick={() => setRetrySimulatorData(null)}
                  disabled={isSimulatingRetry}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

