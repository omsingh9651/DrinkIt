import { useState, useEffect, useCallback } from 'react';
import { fetchStockHistory } from '../../services/inventoryApi';
import styles from './AdminStockHistory.module.css';

const CATEGORIES = [
  'All',
  'Wine',
  'Whisky',
  'Beer',
  'Vodka',
  'Rum',
  'Brandy',
  'Champagne',
  'Cocktails',
  'Premium Spirits',
];

const EVENT_TYPES = [
  { value: 'ALL', label: 'All Event Types' },
  { value: 'RESTOCK', label: 'Restock / Warehouse' },
  { value: 'ORDER_PLACED', label: 'Order Deduction' },
  { value: 'ORDER_CANCELLED', label: 'Order Restored' },
  { value: 'ADJUSTMENT', label: 'Manual Adjustment' },
];

export default function AdminStockHistory() {
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    restockCount: 0,
    orderCount: 0,
    cancelCount: 0,
    netDelta: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockHistory({
        type: selectedType,
        category: selectedCategory,
        search: searchQuery,
        limit: pageSize,
        skip: page * pageSize,
      });

      setLogs(data.logs || []);
      setTotalCount(data.total || 0);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch stock audit trail.');
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, searchQuery, page]);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchStockHistory({
          type: selectedType,
          category: selectedCategory,
          search: searchQuery,
          limit: pageSize,
          skip: page * pageSize,
        });
        if (isMounted) {
          setLogs(data.logs || []);
          setTotalCount(data.total || 0);
          if (data.metrics) setMetrics(data.metrics);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to fetch stock audit trail.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, [selectedType, selectedCategory, searchQuery, page]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // CSV Export
  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('No logs to export.');
      return;
    }

    const headers = ['Timestamp', 'Product Name', 'Category', 'Event Type', 'Previous Stock', 'New Stock', 'Delta', 'Reason', 'Ref ID', 'Performed By'];
    const rows = logs.map((l) => [
      new Date(l.createdAt).toISOString(),
      `"${l.productName.replace(/"/g, '""')}"`,
      l.category || '',
      l.type,
      l.previousStock,
      l.newStock,
      l.change,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      l.referenceId || '',
      `"${(l.performedBy || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `drinkit-inventory-audit-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit log exported to CSV!');
  };

  return (
    <div className={styles.container}>
      {toast && <div className={styles.toast}>✨ {toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <span>📜</span> Stock History & Audit Trail
          </h1>
          <p>
            Immutable ledger tracking all warehouse restocks, customer purchases, order cancellations, and manual adjustments
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadHistory} disabled={loading}>
            🔄 Refresh
          </button>
          <button className={styles.secondaryBtn} onClick={handleExportCSV}>
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📋</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{metrics.totalEvents}</span>
            <span className={styles.statLabel}>Total Events</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📥</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#10b981' }}>
              {metrics.restockCount}
            </span>
            <span className={styles.statLabel}>Restock Inflows</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🛒</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#60a5fa' }}>
              {metrics.orderCount}
            </span>
            <span className={styles.statLabel}>Order Deductions</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⚖️</div>
          <div className={styles.statInfo}>
            <span
              className={styles.statValue}
              style={{ color: metrics.netDelta >= 0 ? '#10b981' : '#ef4444' }}
            >
              {metrics.netDelta >= 0 ? `+${metrics.netDelta}` : metrics.netDelta}
            </span>
            <span className={styles.statLabel}>Net Flow Units</span>
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
            placeholder="Search by product, reason, reference ID, admin email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(0);
            }}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(0);
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Loading inventory audit trail...</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Failed to Load Stock History</h3>
          <p>{error}</p>
          <button className={styles.refreshBtn} onClick={loadHistory}>
            Try Again
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h3>No Audit Records Found</h3>
          <p>No inventory shift matching the selected filters has been recorded.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>Event Type</th>
                <th>Stock Shift</th>
                <th>Delta</th>
                <th>Reason & Reference</th>
                <th>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const dateObj = new Date(log.createdAt);
                const isPositive = (log.change || 0) > 0;
                return (
                  <tr key={log.id} className={styles.historyRow}>
                    <td>
                      <div className={styles.timeCell}>
                        <span className={styles.dateText}>{dateObj.toLocaleDateString()}</span>
                        <span className={styles.timeText}>{dateObj.toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.productCell}>
                        <span className={styles.productName}>{log.productName}</span>
                        <span className={styles.productCategory}>{log.category || 'Spirits'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.typeBadge} ${styles[`badge${log.type}`] || ''}`}>
                        {log.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className={styles.stockShiftCell}>
                        <span className={styles.oldStock}>{log.previousStock}</span>
                        <span className={styles.arrow}>→</span>
                        <span className={styles.newStock}>{log.newStock}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.deltaBadge} ${
                          isPositive ? styles.deltaPositive : styles.deltaNegative
                        }`}
                      >
                        {isPositive ? `+${log.change}` : log.change}
                      </span>
                    </td>
                    <td>
                      <div className={styles.reasonCell}>
                        <span className={styles.reasonText}>{log.reason}</span>
                        {log.referenceId && (
                          <span className={styles.refId}>Ref: {log.referenceId}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.actorBadge}>{log.performedBy}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className={styles.paginationBar}>
            <span className={styles.pageInfo}>
              Showing page {page + 1} of {totalPages} ({totalCount} total entries)
            </span>
            <div className={styles.pageBtns}>
              <button
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Previous
              </button>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
