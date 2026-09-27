import { useState, useEffect, useCallback } from 'react';
import { fetchAdminPayments, refundOrderPayment } from '../../services/paymentAdminApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminPayments.module.css';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Payment Statuses' },
  { value: 'PAID', label: 'Paid / Captured' },
  { value: 'PENDING', label: 'Pending Payment' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED', label: 'Failed' },
];

const METHOD_OPTIONS = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'RAZORPAY', label: 'Razorpay Test Mode' },
  { value: 'COD', label: 'Cash on Delivery (COD)' },
];

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    successfulCount: 0,
    pendingCount: 0,
    refundedCount: 0,
    averageOrderValue: 0,
    totalTransactions: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Refund Modal
  const [refundingPayment, setRefundingPayment] = useState(null);
  const [refundReason, setRefundReason] = useState('Customer cancellation & refund');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminPayments({
        status: statusFilter,
        method: methodFilter,
        search: searchQuery,
        page,
        limit: pageSize,
      });

      setPayments(data.payments || []);
      setTotalCount(data.total || 0);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      setError(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, searchQuery, page]);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchAdminPayments({
          status: statusFilter,
          method: methodFilter,
          search: searchQuery,
          page,
          limit: pageSize,
        });
        if (isMounted) {
          setPayments(data.payments || []);
          setTotalCount(data.total || 0);
          if (data.metrics) setMetrics(data.metrics);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load payments.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, [statusFilter, methodFilter, searchQuery, page]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied!`);
    } catch {
      showToast(`Copied: ${text}`);
    }
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundingPayment) return;
    setRefundSubmitting(true);
    try {
      await refundOrderPayment(refundingPayment.orderId, refundReason);
      showToast(`Order #${refundingPayment.orderId} marked as REFUNDED.`);
      setRefundingPayment(null);
      await loadPayments();
    } catch (err) {
      showToast(`Refund error: ${err.message}`);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (payments.length === 0) {
      showToast('No payment records to export.');
      return;
    }

    const headers = ['Transaction ID', 'Order ID', 'Customer Name', 'Phone', 'Amount (INR)', 'Payment Status', 'Method', 'Date'];
    const rows = payments.map((p) => [
      p.paymentId,
      p.orderId,
      `"${p.customerName.replace(/"/g, '""')}"`,
      p.customerPhone,
      p.amount,
      p.paymentStatus,
      p.paymentMethod,
      new Date(p.createdAt).toISOString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `drinkit-payments-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Payment ledger exported to CSV!');
  };

  return (
    <div className={styles.container}>
      {toast && <div className={styles.toast}>✨ {toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <span>💳</span> Payment Transactions & Settlements
          </h1>
          <p>Audit Razorpay Test Mode gateway payments, settlement status, and cash receivables</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadPayments} disabled={loading}>
            🔄 Refresh
          </button>
          <button className={styles.secondaryBtn} onClick={handleExportCSV}>
            📥 Export Ledger
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#10b981' }}>
              {formatINR(metrics.totalVolume)}
            </span>
            <span className={styles.statLabel}>Captured Volume</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{metrics.successfulCount}</span>
            <span className={styles.statLabel}>Successful Payments</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏳</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#fbbf24' }}>
              {metrics.pendingCount}
            </span>
            <span className={styles.statLabel}>Pending / COD</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{formatINR(metrics.averageOrderValue)}</span>
            <span className={styles.statLabel}>Avg Transaction Value</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by Payment ID, Order ID, Customer name, Phone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Loading financial transactions...</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Failed to Load Transactions</h3>
          <p>{error}</p>
          <button className={styles.refreshBtn} onClick={loadPayments}>
            Try Again
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h3>No Transactions Found</h3>
          <p>No payment records matching the selected search query or filters.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.paymentTable}>
            <thead>
              <tr>
                <th>Transaction / Gateway</th>
                <th>Order Ref</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment Status</th>
                <th>Timestamp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const isRazorpay = p.paymentMethod === 'RAZORPAY';
                return (
                  <tr key={p.id} className={styles.paymentRow}>
                    <td>
                      <div className={styles.txIdCell}>
                        <div className={styles.txId}>
                          <span>{p.paymentId}</span>
                          <button
                            className={styles.copyMiniBtn}
                            onClick={() => handleCopy(p.paymentId, 'Transaction ID')}
                            title="Copy ID"
                          >
                            📋
                          </button>
                        </div>
                        <span
                          className={`${styles.gatewayBadge} ${
                            !isRazorpay ? styles.gatewayCod : ''
                          }`}
                        >
                          {isRazorpay ? '⚡ Razorpay Test Mode' : '💵 Cash on Delivery'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.orderRef}>#{p.orderId}</span>
                    </td>
                    <td>
                      <div className={styles.customerCell}>
                        <span className={styles.customerName}>{p.customerName}</span>
                        <span className={styles.customerMeta}>
                          {p.customerPhone} • {p.city}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.amountText}>{formatINR(p.amount)}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          styles[`status${p.paymentStatus}`] || ''
                        }`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <div className={styles.timeCell}>
                        <span className={styles.dateText}>
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                        <span className={styles.timeText}>
                          {new Date(p.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      {p.paymentStatus === 'PAID' ? (
                        <button
                          className={styles.refundBtn}
                          onClick={() => setRefundingPayment(p)}
                        >
                          ↩️ Refund
                        </button>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className={styles.paginationBar}>
            <span className={styles.pageInfo}>
              Showing page {page} of {totalPages} ({totalCount} total transactions)
            </span>
            <div className={styles.pageBtns}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundingPayment && (
        <div className={styles.modalOverlay} onClick={() => setRefundingPayment(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Issue Refund: Order #{refundingPayment.orderId}</h2>
              <button className={styles.closeBtn} onClick={() => setRefundingPayment(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleRefundSubmit}>
              <div className={styles.modalBody}>
                <p>
                  You are refunding <strong>{formatINR(refundingPayment.amount)}</strong> to customer{' '}
                  <strong>{refundingPayment.customerName}</strong> ({refundingPayment.customerPhone}).
                </p>
                <div className={styles.formGroup}>
                  <label>Refund Reason</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason for issuing refund..."
                    required
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setRefundingPayment(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.refundSubmitBtn}
                  disabled={refundSubmitting}
                >
                  {refundSubmitting ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
