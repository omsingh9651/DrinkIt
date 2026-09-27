import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
  fetchDeliveryStores,
  fetchDeliveryPartners,
  assignDeliveryPartnerAndStore,
} from '../../services/orderApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminOrders.module.css';

const ORDER_STATUSES = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const PAYMENT_STATUSES = ['ALL', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'];

const DATE_PRESETS = [
  { key: 'ALL', label: 'All Dates' },
  { key: 'TODAY', label: 'Today' },
  { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { key: 'LAST_30_DAYS', label: 'Last 30 Days' },
];

const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // Terminal
  CANCELLED: [], // Terminal
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [datePreset, setDatePreset] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [serverMetrics, setServerMetrics] = useState(null);

  // Selected Order for Detail/Manage Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [targetOrderStatus, setTargetOrderStatus] = useState('');
  const [targetPaymentStatus, setTargetPaymentStatus] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [confirmCancelChecked, setConfirmCancelChecked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? '' : c));
    }, 3200);
  };

  useEffect(() => {
    let isMounted = true;

    const startDate =
      datePreset === 'TODAY'
        ? new Date().toISOString().slice(0, 10)
        : datePreset === 'LAST_7_DAYS'
          ? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
          : datePreset === 'LAST_30_DAYS'
            ? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
            : '';

    Promise.all([
      fetchAdminOrders({
        status: selectedStatus,
        paymentStatus: selectedPaymentStatus,
        search: searchQuery,
        startDate,
        page,
        limit,
      }),
      fetchDeliveryStores().catch(() => []),
      fetchDeliveryPartners().catch(() => []),
    ])
      .then(([ordersRes, storesData, partnersData]) => {
        if (isMounted) {
          const list = ordersRes.orders || [];
          setOrders(list);
          setTotalOrders(ordersRes.total !== undefined ? ordersRes.total : list.length);
          setTotalPages(ordersRes.totalPages || 1);
          if (ordersRes.metrics) setServerMetrics(ordersRes.metrics);
          setStores(storesData || []);
          setPartners(partnersData || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load admin orders or dispatch metadata:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStatus, selectedPaymentStatus, datePreset, searchQuery, page, limit]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const startDate =
        datePreset === 'TODAY'
          ? new Date().toISOString().slice(0, 10)
          : datePreset === 'LAST_7_DAYS'
            ? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
            : datePreset === 'LAST_30_DAYS'
              ? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
              : '';
      const res = await fetchAdminOrders({
        status: selectedStatus,
        paymentStatus: selectedPaymentStatus,
        search: searchQuery,
        startDate,
        page,
        limit,
      });
      setOrders(res.orders || []);
      setTotalOrders(res.total !== undefined ? res.total : (res.orders || []).length);
      setTotalPages(res.totalPages || 1);
      if (res.metrics) setServerMetrics(res.metrics);
    } catch (err) {
      console.error('Failed to load admin orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute Store Metrics
  const metrics = useMemo(() => {
    if (serverMetrics) return serverMetrics;
    const total = totalOrders || orders.length;
    const pending = orders.filter((o) => o.orderStatus === 'PENDING').length;
    const inTransit = orders.filter(
      (o) =>
        o.orderStatus === 'CONFIRMED' ||
        o.orderStatus === 'PROCESSING' ||
        o.orderStatus === 'READY' ||
        o.orderStatus === 'OUT_FOR_DELIVERY'
    ).length;
    const delivered = orders.filter((o) => o.orderStatus === 'DELIVERED').length;
    const totalRevenue = orders
      .filter((o) => o.orderStatus !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    return { total, pending, inTransit, delivered, totalRevenue };
  }, [serverMetrics, totalOrders, orders]);

  const handleOpenManageModal = (order) => {
    setSelectedOrder(order);
    setTargetOrderStatus(order.orderStatus);
    setTargetPaymentStatus(order.paymentStatus || 'PENDING');
    setSelectedPartnerId(order.deliveryPartnerId || (partners[0]?.id || ''));
    setSelectedStoreId(order.storeId || (stores[0]?.id || ''));
    setAdminNote('');
    setConfirmCancelChecked(false);
    setUpdateError('');
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (
      targetOrderStatus === 'CANCELLED' &&
      selectedOrder.orderStatus !== 'CANCELLED' &&
      !confirmCancelChecked
    ) {
      setUpdateError(
        'Please check the cancellation safeguard box to confirm returning reserved bottles to cellar stock.'
      );
      return;
    }

    setIsUpdating(true);
    setUpdateError('');

    try {
      // If dispatch assignment changed or status is moving to OUT_FOR_DELIVERY
      if (
        (targetOrderStatus === 'OUT_FOR_DELIVERY' || selectedPartnerId || selectedStoreId) &&
        (selectedPartnerId !== selectedOrder.deliveryPartnerId || selectedStoreId !== selectedOrder.storeId)
      ) {
        try {
          await assignDeliveryPartnerAndStore(selectedOrder.id, {
            partnerId: selectedPartnerId,
            storeId: selectedStoreId,
          });
        } catch (assignErr) {
          console.warn('Could not assign delivery partner/store:', assignErr);
        }
      }

      const res = await updateAdminOrderStatus(selectedOrder.id, {
        orderStatus: targetOrderStatus,
        paymentStatus: targetPaymentStatus,
        note: adminNote,
      });

      showToast(`Order #${selectedOrder.id} status updated to ${res.order.orderStatus}.`);

      // Update in local state
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? res.order : o))
      );

      setSelectedOrder(null);
    } catch (err) {
      console.error('Admin update order error:', err);
      setUpdateError(err.message || 'Failed to update order status.');
    } finally {
      setIsUpdating(false);
    }
  };

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

  return (
    <div className={styles.ordersContainer}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Customer Orders Management</h1>
          <p>Inspect incoming orders, track dispatches, and manage fulfillment stages.</p>
        </div>

        <div className={styles.headerActions}>
          <Link to="/admin/delivery" className={styles.deliveryCenterLink}>
            <span>🗺️</span>
            <span>Open Delivery Center & GPS</span>
          </Link>
          <button type="button" className={styles.refreshBtn} onClick={handleRefresh}>
            <span>🔄</span>
            <span>Refresh Orders</span>
          </button>
        </div>
      </div>

      {toastMessage && <div className={styles.toastAlert}>✓ {toastMessage}</div>}

      {/* Metrics Row */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Orders</span>
          <span className={styles.metricValue}>{metrics.total}</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Pending Verification</span>
          <span className={styles.metricValue} style={{ color: '#ffaa00' }}>
            {metrics.pending}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>In Fulfillment / Transit</span>
          <span className={styles.metricValue} style={{ color: '#00ced1' }}>
            {metrics.inTransit}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Completed Hand-offs</span>
          <span className={styles.metricValue} style={{ color: '#2ed573' }}>
            {metrics.delivered}
          </span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Cellar Sales</span>
          <span className={styles.metricValue} style={{ color: '#e5a84b' }}>
            {formatINR(metrics.totalRevenue)}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by Order ID, customer name, mobile, city..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.statusFilterGroup}>
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              className={`${styles.filterTab} ${
                selectedStatus === st ? styles.filterTabActive : ''
              }`}
              onClick={() => {
                setSelectedStatus(st);
                setPage(1);
              }}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className={styles.filterSelectGroup}>
          <div className={styles.filterSelectBox}>
            <label>Payment:</label>
            <select
              className={styles.filterSelect}
              value={selectedPaymentStatus}
              onChange={(e) => {
                setSelectedPaymentStatus(e.target.value);
                setPage(1);
              }}
            >
              {PAYMENT_STATUSES.map((ps) => (
                <option key={ps} value={ps}>
                  {ps}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterSelectBox}>
            <label>Date:</label>
            <select
              className={styles.filterSelect}
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
            >
              {DATE_PRESETS.map((dp) => (
                <option key={dp.key} value={dp.key}>
                  {dp.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterSelectBox}>
            <label>Show:</label>
            <select
              className={styles.filterSelect}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Bottles</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Order Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                  Loading DrinkIt orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyTableState}>
                  No orders found matching the selected criteria.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const payStatus = order.paymentStatus || 'PENDING';
                const payClass =
                  payStatus === 'PAID'
                    ? styles.payPaid
                    : payStatus === 'FAILED'
                      ? styles.payFailed
                      : styles.payPending;

                return (
                  <tr key={order.id} className={styles.orderRow}>
                    <td>
                      <span className={styles.orderIdText}>#{order.id}</span>
                    </td>
                    <td>
                      <div className={styles.orderDateText}>
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <br />
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td>
                      <div className={styles.customerText}>
                        {order.customerName || order.deliveryAddress?.fullName || 'Connoisseur'}
                      </div>
                      <div className={styles.customerPhoneText}>
                        +91 {order.customerPhone}
                        {order.deliveryAddress?.city ? ` · ${order.deliveryAddress.city}` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {order.items?.map((i) => `${i.name} (${i.quantity})`).join(', ') || '0 bottles'}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: '#fff' }}>{formatINR(order.total)}</strong>
                    </td>
                    <td>
                      <span className={`${styles.payPill} ${payClass}`}>
                        {order.paymentMethod === 'RAZORPAY' ? '💳 ' : '💵 '}
                        {payStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${getStatusClass(order.orderStatus)}`}>
                        {order.orderStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => handleOpenManageModal(order)}
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className={styles.paginationRow}>
        <div className={styles.pageSummary}>
          Showing {totalOrders === 0 ? 0 : (page - 1) * limit + 1} to{' '}
          {Math.min(page * limit, totalOrders)} of {totalOrders} orders
        </div>
        <div className={styles.pageControls}>
          <button
            type="button"
            className={`${styles.pageBtn} ${page <= 1 ? styles.pageBtnDisabled : ''}`}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => (
              <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {idx > 0 && arr[idx - 1] !== p - 1 && (
                  <span style={{ color: '#8c8594', padding: '0 0.25rem' }}>…</span>
                )}
                <button
                  type="button"
                  className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            type="button"
            className={`${styles.pageBtn} ${page >= totalPages ? styles.pageBtnDisabled : ''}`}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Manage Order Modal */}
      {selectedOrder && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Manage Order #{selectedOrder.id}</h2>
                <span style={{ fontSize: '0.82rem', color: '#8c8594' }}>
                  Customer: {selectedOrder.customerName} (+91 {selectedOrder.customerPhone})
                </span>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
            </div>

            {updateError && (
              <div style={{ background: 'rgba(255,77,79,0.15)', color: '#ff7875', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                {updateError}
              </div>
            )}

            {/* Order Items Snapshot */}
            {/* Order Items Snapshot */}
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Order Items</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {selectedOrder.items?.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.88rem',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {item.image ? (
                        <img src={item.image} alt={item.name} className={styles.modalItemImg} />
                      ) : (
                        <span style={{ fontSize: '1.4rem' }}>🥃</span>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff' }}>{item.name}</div>
                        <div style={{ color: '#8c8594', fontSize: '0.78rem' }}>
                          {item.brand && `${item.brand} · `}
                          {item.volume && `${item.volume} · `}
                          {formatINR(item.price)} × {item.quantity}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#e5a84b' }}>
                      {formatINR(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary & Payment Gateway Details */}
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Order Payment Summary & Gateway Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8c8594' }}>Payment Method:</span>
                  <strong style={{ color: '#fff' }}>
                    {selectedOrder.paymentMethod === 'RAZORPAY'
                      ? '💳 Razorpay Test Mode (Online)'
                      : '💵 Cash on Delivery (COD)'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8c8594' }}>Payment Status:</span>
                  <span
                    className={`${styles.statusBadge} ${
                      selectedOrder.paymentStatus === 'PAID'
                        ? styles.paymentPaid
                        : selectedOrder.paymentStatus === 'FAILED'
                        ? styles.paymentFailed
                        : styles.paymentPending
                    }`}
                  >
                    {selectedOrder.paymentStatus || 'PENDING'}
                  </span>
                </div>

                {selectedOrder.paymentMethod === 'RAZORPAY' && (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    {selectedOrder.razorpayOrderId && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8c8594' }}>Razorpay Order ID:</span>
                        <code style={{ color: '#e5a84b' }}>{selectedOrder.razorpayOrderId}</code>
                      </div>
                    )}
                    {selectedOrder.razorpayPaymentId && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8c8594' }}>Razorpay Payment ID:</span>
                        <code style={{ color: '#e5a84b' }}>{selectedOrder.razorpayPaymentId}</code>
                      </div>
                    )}
                    {selectedOrder.paidAt && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8c8594' }}>Payment Timestamp:</span>
                        <span style={{ color: '#2ed573' }}>
                          {new Date(selectedOrder.paidAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                    {selectedOrder.paymentFailureReason && (
                      <div style={{ color: '#f87171', marginTop: '0.2rem' }}>
                        ⚠️ <strong>Gateway Issue:</strong> {selectedOrder.paymentFailureReason}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ color: '#8c8594' }}>Subtotal:</span>
                  <strong style={{ color: '#fff' }}>
                    {formatINR(selectedOrder.subtotal || selectedOrder.total)}
                  </strong>
                </div>
                {selectedOrder.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ed573' }}>
                    <span>Coupon Discount {selectedOrder.promoCode && `(${selectedOrder.promoCode})`}:</span>
                    <span>-{formatINR(selectedOrder.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8c8594' }}>Delivery Fee:</span>
                  <span style={{ color: selectedOrder.deliveryFee === 0 ? '#2ed573' : '#fff' }}>
                    {selectedOrder.deliveryFee === 0 ? 'FREE' : formatINR(selectedOrder.deliveryFee || 99)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '0.45rem',
                    fontWeight: 800,
                  }}
                >
                  <span style={{ color: '#fff' }}>Grand Total:</span>
                  <span style={{ color: '#e5a84b', fontSize: '1.05rem' }}>
                    {formatINR(selectedOrder.total || selectedOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Destination */}
            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Delivery Address</h3>
              {selectedOrder.deliveryAddress ? (
                <div style={{ fontSize: '0.85rem', color: '#cfcad6', lineHeight: 1.45 }}>
                  <strong style={{ color: '#fff' }}>{selectedOrder.deliveryAddress.fullName}</strong> (📞 +91 {selectedOrder.deliveryAddress.mobileNumber})<br />
                  {selectedOrder.deliveryAddress.house}, {selectedOrder.deliveryAddress.street}<br />
                  {selectedOrder.deliveryAddress.landmark && `Landmark: ${selectedOrder.deliveryAddress.landmark}, `}
                  {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} - {selectedOrder.deliveryAddress.pinCode}
                </div>
              ) : (
                <span style={{ color: '#8c8594', fontSize: '0.85rem' }}>No address snapshot available.</span>
              )}
            </div>

            {/* Status Audit History Timeline */}
            {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
              <div className={styles.modalSection}>
                <h3 className={styles.modalSectionTitle}>
                  Status Audit Trail ({selectedOrder.statusHistory.length})
                </h3>
                <div className={styles.auditTimelineList}>
                  {selectedOrder.statusHistory.map((hist, idx) => (
                    <div key={idx} className={styles.auditItem}>
                      <div className={styles.auditItemHeader}>
                        <span className={styles.auditBadge}>{hist.status}</span>
                        <span className={styles.auditTime}>
                          {new Date(hist.timestamp).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {hist.note && <p className={styles.auditNote}>{hist.note}</p>}
                      {hist.updatedBy && (
                        <span className={styles.auditAuthor}>Updated by: {hist.updatedBy}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Update Form */}
            <form onSubmit={handleUpdateStatus} className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Update Order & Payment Lifecycle</h3>

              {selectedOrder.paymentMethod === 'RAZORPAY' && selectedOrder.paymentStatus !== 'PAID' && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                    lineHeight: 1.45,
                  }}
                >
                  ⚠️ <strong>Unpaid Online Order Guard:</strong> This order was placed via Razorpay Online but is currently{' '}
                  <strong>{selectedOrder.paymentStatus}</strong>. System guardrails strictly prevent moving unpaid orders to{' '}
                  <em>PROCESSING, READY, OUT_FOR_DELIVERY,</em> or <em>DELIVERED</em> until payment is marked as <strong>PAID</strong>.
                </div>
              )}

              <div className={styles.manageFormRow}>
                <div className={styles.manageFormGroup}>
                  <label>Order Status *</label>
                  {selectedOrder.orderStatus === 'DELIVERED' || selectedOrder.orderStatus === 'CANCELLED' ? (
                    <div className={styles.terminalWarning}>
                      🔒 Terminal State ({selectedOrder.orderStatus}). Order lifecycle is closed and status cannot be modified.
                    </div>
                  ) : (
                    <select
                      className={styles.selectInput}
                      value={targetOrderStatus}
                      onChange={(e) => setTargetOrderStatus(e.target.value)}
                    >
                      {[
                        selectedOrder.orderStatus,
                        ...(ALLOWED_STATUS_TRANSITIONS[selectedOrder.orderStatus] || []),
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')} {s === selectedOrder.orderStatus ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className={styles.manageFormGroup}>
                  <label>Payment Status</label>
                  <select
                    className={styles.selectInput}
                    value={targetPaymentStatus}
                    onChange={(e) => setTargetPaymentStatus(e.target.value)}
                  >
                    {PAYMENT_STATUSES.filter((ps) => ps !== 'ALL').map((ps) => (
                      <option key={ps} value={ps}>
                        {ps}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dispatch & Delivery Partner Assignment */}
              <div className={styles.dispatchBox}>
                <div className={styles.dispatchHeader}>
                  <span className={styles.dispatchTitle}>
                    <span>🛵</span>
                    <span>Delivery Partner & Store Hub Assignment</span>
                  </span>
                  <Link
                    to={`/admin/delivery?orderId=${selectedOrder.id}`}
                    className={styles.dispatchLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open GPS Simulator ↗
                  </Link>
                </div>

                {(selectedOrder.deliveryPartnerName || selectedOrder.storeName) && (
                  <div className={styles.dispatchInfoCurrent}>
                    <span>
                      Rider: <strong>{selectedOrder.deliveryPartnerName || 'Suraj Singh'}</strong>
                      {selectedOrder.deliveryPartnerPhone ? ` (📞 +91 ${selectedOrder.deliveryPartnerPhone})` : ''}
                    </span>
                    <span>
                      Hub: <strong>{selectedOrder.storeName || 'DrinkIt Cellar Store'}</strong>
                    </span>
                  </div>
                )}

                <div className={styles.manageFormRow}>
                  <div className={styles.manageFormGroup}>
                    <label>Assign Delivery Partner (Rider)</label>
                    <select
                      className={styles.selectInput}
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                    >
                      <option value="">-- Choose Courier Rider --</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.vehicleType || 'Bike'} · {p.rating || '4.9'}★)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.manageFormGroup}>
                    <label>Assign Pickup Store Hub</label>
                    <select
                      className={styles.selectInput}
                      value={selectedStoreId}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                    >
                      <option value="">-- Choose Store Hub --</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code || s.city || 'Hub'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.manageFormGroup}>
                <label>Admin Internal Audit Note (Optional)</label>
                <textarea
                  className={styles.textareaInput}
                  placeholder="e.g. Courier handed off to Bluedart Express AWB #92841"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>

              {targetOrderStatus === 'CANCELLED' && selectedOrder.orderStatus !== 'CANCELLED' && (
                <div className={styles.cancelSafeguardBox}>
                  <div className={styles.cancelSafeguardTitle}>
                    <span>⚠️</span>
                    <strong>Inventory Restoration Safeguard</strong>
                  </div>
                  <p className={styles.cancelSafeguardDesc}>
                    Changing status to <strong>CANCELLED</strong> will automatically restore{' '}
                    <strong>
                      {selectedOrder.items?.reduce((acc, i) => acc + i.quantity, 0)} bottle(s)
                    </strong>{' '}
                    back into cellar stock inventory.
                  </p>
                  <label className={styles.safeguardCheckLabel}>
                    <input
                      type="checkbox"
                      checked={confirmCancelChecked}
                      onChange={(e) => setConfirmCancelChecked(e.target.checked)}
                    />
                    <span>
                      I verify that this order should be cancelled and inventory restored.
                    </span>
                  </label>
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setSelectedOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={
                    targetOrderStatus === 'CANCELLED' && selectedOrder.orderStatus !== 'CANCELLED'
                      ? styles.cancelConfirmBtn
                      : styles.updateBtn
                  }
                  disabled={isUpdating}
                >
                  {isUpdating
                    ? 'Updating...'
                    : targetOrderStatus === 'CANCELLED' && selectedOrder.orderStatus !== 'CANCELLED'
                      ? 'Confirm Cancellation & Stock Return'
                      : 'Save Lifecycle Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
