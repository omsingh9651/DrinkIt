import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchInventorySummary,
  fetchInventoryItems,
  adjustProductStock,
  fetchStockHistory,
} from '../../services/inventoryApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminInventory.module.css';

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

export default function AdminInventory() {
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    threshold: 5,
    totalValuation: 0,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Settings
  const [threshold, setThreshold] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedHealthFilter, setSelectedHealthFilter] = useState('All');
  const [toast, setToast] = useState(null);

  // Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustMode, setAdjustMode] = useState('delta'); // 'delta' | 'set'
  const [adjustQty, setAdjustQty] = useState('10');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState(null);

  // History Modal
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const refreshData = useCallback(async () => {
    try {
      const [sum, prodItems] = await Promise.all([
        fetchInventorySummary(threshold),
        fetchInventoryItems({
          threshold,
          status: selectedHealthFilter,
          category: selectedCategory,
          q: searchQuery,
        }),
      ]);
      setSummary(sum);
      setItems(prodItems);
      setError(null);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      setError(err.message || 'Error loading inventory catalog.');
    } finally {
      setLoading(false);
    }
  }, [threshold, selectedHealthFilter, selectedCategory, searchQuery]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchInventorySummary(threshold),
      fetchInventoryItems({
        threshold,
        status: selectedHealthFilter,
        category: selectedCategory,
        q: searchQuery,
      }),
    ])
      .then(([sum, prodItems]) => {
        if (isMounted) {
          setSummary(sum);
          setItems(prodItems);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load inventory data:', err);
          setError(err.message || 'Error loading inventory catalog.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [threshold, selectedHealthFilter, selectedCategory, searchQuery]);

  // Client-side quick filtering for instantaneous response
  const displayedItems = useMemo(() => {
    let filtered = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(
        (p) => p.category && p.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (selectedHealthFilter === 'low_stock') {
      filtered = filtered.filter((p) => p.inventoryHealth === 'low_stock');
    } else if (selectedHealthFilter === 'out_of_stock') {
      filtered = filtered.filter((p) => p.inventoryHealth === 'out_of_stock');
    } else if (selectedHealthFilter === 'healthy') {
      filtered = filtered.filter((p) => p.inventoryHealth === 'healthy');
    } else if (selectedHealthFilter === 'inactive') {
      filtered = filtered.filter((p) => p.status === 'inactive');
    }

    return filtered;
  }, [items, searchQuery, selectedCategory, selectedHealthFilter]);

  // Quick delta button click (+1, -1, +5, -5)
  const handleQuickDelta = async (product, delta) => {
    const currentStock = Number(product.stockQuantity ?? product.stock ?? 0);
    const targetStock = currentStock + delta;

    if (targetStock < 0) {
      showToast(`Cannot reduce stock below 0 for ${product.name}.`);
      return;
    }

    try {
      const { product: updated } = await adjustProductStock({
        productId: product.id,
        quantity: delta,
        adjustmentType: 'delta',
        reason: `Quick adjustment (${delta > 0 ? '+' : ''}${delta} units)`,
      });

      // Update in local state
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === product.id) {
            const newStock = Number(updated.stockQuantity);
            const isOut = newStock <= 0;
            const isLow = newStock > 0 && newStock <= (item.lowStockThreshold || threshold);
            return {
              ...item,
              ...updated,
              stockQuantity: newStock,
              stock: newStock,
              inventoryHealth: isOut ? 'out_of_stock' : isLow ? 'low_stock' : 'healthy',
              isOutOfStock: isOut,
              isLowStock: isLow,
            };
          }
          return item;
        })
      );

      // Refresh summary
      fetchInventorySummary(threshold).then(setSummary).catch(console.warn);
      showToast(`Stock updated for ${product.name} (Now: ${updated.stockQuantity}).`);
    } catch (err) {
      console.error('Quick delta failed:', err);
      showToast(err.message || 'Failed to adjust stock.');
    }
  };

  // Open Adjust Modal
  const handleOpenAdjust = (product) => {
    setAdjustingProduct(product);
    setAdjustMode('delta');
    setAdjustQty('10');
    setAdjustReason('Supplier replenishment');
    setAdjustError(null);
  };

  // Handle Submit Adjust Modal
  const handleSubmitAdjust = async (e) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const numQty = Number(adjustQty);
    if (isNaN(numQty) || !Number.isInteger(numQty)) {
      setAdjustError('Please enter a valid whole number.');
      return;
    }

    const currentStock = Number(adjustingProduct.stockQuantity ?? adjustingProduct.stock ?? 0);
    const targetStock = adjustMode === 'set' ? numQty : currentStock + numQty;

    if (targetStock < 0) {
      setAdjustError(`Negative inventory prohibited. Target stock would be ${targetStock}.`);
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError(null);

    try {
      const { product: updated } = await adjustProductStock({
        productId: adjustingProduct.id,
        quantity: numQty,
        adjustmentType: adjustMode,
        reason: adjustReason || (adjustMode === 'set' ? `Set stock to ${numQty}` : `Delta ${numQty}`),
      });

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === adjustingProduct.id) {
            const newStock = Number(updated.stockQuantity);
            const isOut = newStock <= 0;
            const isLow = newStock > 0 && newStock <= (item.lowStockThreshold || threshold);
            return {
              ...item,
              ...updated,
              stockQuantity: newStock,
              stock: newStock,
              inventoryHealth: isOut ? 'out_of_stock' : isLow ? 'low_stock' : 'healthy',
              isOutOfStock: isOut,
              isLowStock: isLow,
            };
          }
          return item;
        })
      );

      fetchInventorySummary(threshold).then(setSummary).catch(console.warn);
      showToast(`Inventory updated for ${adjustingProduct.name}. New stock: ${updated.stockQuantity}.`);
      setAdjustingProduct(null);
    } catch (err) {
      console.error('Stock adjustment error:', err);
      setAdjustError(err.message || 'Failed to update stock.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Open History Modal
  const handleOpenHistory = async (product) => {
    setHistoryProduct(product);
    setHistoryLogs([]);
    setHistoryLoading(true);

    try {
      const { logs } = await fetchStockHistory({ productId: product.id, limit: 50 });
      setHistoryLogs(logs || []);
    } catch (err) {
      console.error('Fetch history error:', err);
      showToast('Could not load stock history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast Feedback */}
      {toast && (
        <div className={styles.toast}>
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <span>📦</span> Inventory &amp; Stock Management
          </h1>
          <p>
            Monitor real-time cellar stock, configure low-inventory alerts, and safely restock spirits.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" onClick={refreshData} className={styles.refreshBtn} title="Refresh Inventory Data">
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrapper}>🍾</div>
          <div className={styles.statDetails}>
            <span className={styles.statLabel}>Total Products</span>
            <span className={styles.statValue}>{summary.totalProducts}</span>
            <span className={styles.statSubtext}>Catalog SKUs</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ color: '#4ade80' }}>📦</div>
          <div className={styles.statDetails}>
            <span className={styles.statLabel}>Available Stock</span>
            <span className={styles.statValue}>{summary.totalStock.toLocaleString()}</span>
            <span className={styles.statSubtext}>Total units ready to ship</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${summary.lowStockCount > 0 ? styles.statCardAlert : ''}`}>
          <div className={styles.statIconWrapper} style={{ color: '#fbbf24' }}>⚠️</div>
          <div className={styles.statDetails}>
            <span className={styles.statLabel}>Low Stock Alerts</span>
            <span className={styles.statValue}>{summary.lowStockCount}</span>
            <span className={styles.statSubtext}>Stock &le; {threshold} units</span>
          </div>
        </div>

        <div className={`${styles.statCard} ${summary.outOfStockCount > 0 ? styles.statCardDanger : ''}`}>
          <div className={styles.statIconWrapper} style={{ color: '#f87171' }}>⛔</div>
          <div className={styles.statDetails}>
            <span className={styles.statLabel}>Out of Stock</span>
            <span className={styles.statValue}>{summary.outOfStockCount}</span>
            <span className={styles.statSubtext}>0 units available</span>
          </div>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTopRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search product, brand, category, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.thresholdCard}>
            <label htmlFor="inventory-threshold-input" className={styles.thresholdLabel}>
              Low-Stock Alert Threshold:
            </label>
            <input
              id="inventory-threshold-input"
              type="number"
              min="1"
              max="100"
              value={threshold}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                setThreshold(val);
              }}
              className={styles.thresholdInput}
              title="Change warning threshold for low stock alert badges"
            />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>units</span>
          </div>
        </div>

        <div className={styles.toolbarBottomRow}>
          {/* Quick Filter Pills */}
          <div className={styles.filterPills}>
            <button
              type="button"
              className={`${styles.pillBtn} ${selectedHealthFilter === 'All' ? styles.pillBtnActive : ''}`}
              onClick={() => setSelectedHealthFilter('All')}
            >
              All Items
              <span className={styles.pillBadge}>{summary.totalProducts}</span>
            </button>

            <button
              type="button"
              className={`${styles.pillBtn} ${selectedHealthFilter === 'low_stock' ? styles.pillBtnActive : ''}`}
              onClick={() => setSelectedHealthFilter('low_stock')}
            >
              ⚠️ Low Stock
              <span className={styles.pillBadge}>{summary.lowStockCount}</span>
            </button>

            <button
              type="button"
              className={`${styles.pillBtn} ${selectedHealthFilter === 'out_of_stock' ? styles.pillBtnActive : ''}`}
              onClick={() => setSelectedHealthFilter('out_of_stock')}
            >
              ⛔ Out of Stock
              <span className={styles.pillBadge}>{summary.outOfStockCount}</span>
            </button>

            <button
              type="button"
              className={`${styles.pillBtn} ${selectedHealthFilter === 'healthy' ? styles.pillBtnActive : ''}`}
              onClick={() => setSelectedHealthFilter('healthy')}
            >
              ● In Stock
              <span className={styles.pillBadge}>{summary.healthyStockCount}</span>
            </button>
          </div>

          {/* Category Dropdown */}
          <div className={styles.selectGroup}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.select}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}>⏳</div>
            <p>Loading DrinkIt inventory matrix...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p style={{ color: '#f87171' }}>⚠️ {error}</p>
            <button type="button" onClick={refreshData} className={styles.refreshBtn} style={{ margin: '12px auto' }}>
              Retry
            </button>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No products match your selected inventory filters.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product &amp; SKU</th>
                  <th>Category</th>
                  <th>Price (INR)</th>
                  <th>Stock Health</th>
                  <th>Quantity</th>
                  <th>Quick Adjustment</th>
                  <th>Store Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((p) => {
                  const stock = Number(p.stockQuantity ?? p.stock ?? 0);
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && stock <= (p.lowStockThreshold || threshold);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.productCell}>
                          {p.image || p.imageUrl || p.thumbnail ? (
                            <img
                              src={p.image || p.imageUrl || p.thumbnail}
                              alt={p.name}
                              className={styles.thumbImg}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className={styles.thumbEmoji}>{p.emoji || '🥃'}</span>
                          )}
                          <div className={styles.productText}>
                            <span className={styles.productName}>{p.name}</span>
                            <span className={styles.productMeta}>
                              {p.brand} {p.volume ? `• ${p.volume}` : ''} {p.sku ? `• SKU: ${p.sku}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>{p.category}</td>

                      <td>
                        <span style={{ fontWeight: 600 }}>{formatINR(p.price)}</span>
                      </td>

                      <td>
                        {isOut ? (
                          <span className={styles.badgeOutOfStock}>⛔ Sold Out</span>
                        ) : isLow ? (
                          <span className={styles.badgeLowStock}>⚠️ Low Stock ({stock})</span>
                        ) : (
                          <span className={styles.badgeHealthy}>● Healthy</span>
                        )}
                      </td>

                      <td>
                        <div className={styles.stockCell}>
                          <span className={styles.stockCount}>{stock}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>units</span>
                        </div>
                      </td>

                      <td>
                        <div className={styles.quickDeltaRow}>
                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, -5)}
                            disabled={stock < 5}
                            className={`${styles.quickBtn} ${styles.quickBtnMinus}`}
                            title="Decrease stock by 5 units"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, -1)}
                            disabled={stock < 1}
                            className={`${styles.quickBtn} ${styles.quickBtnMinus}`}
                            title="Decrease stock by 1 unit"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, 1)}
                            className={`${styles.quickBtn} ${styles.quickBtnPlus}`}
                            title="Increase stock by 1 unit"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, 5)}
                            className={`${styles.quickBtn} ${styles.quickBtnPlus}`}
                            title="Increase stock by 5 units"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, 10)}
                            className={`${styles.quickBtn} ${styles.quickBtnPlus}`}
                            title="Increase stock by 10 units"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: p.status === 'inactive' ? '#94a3b8' : '#4ade80',
                          }}
                        >
                          {p.status === 'inactive' ? '○ Inactive' : '● Active'}
                        </span>
                      </td>

                      <td>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(p)}
                            className={styles.adjustBtn}
                            title="Open Stock Adjustment Modal"
                          >
                            ✏️ Adjust
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(p)}
                            className={styles.historyBtn}
                            title="View Stock Audit History"
                          >
                            📈 History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div className={styles.modalBackdrop} onClick={() => setAdjustingProduct(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Adjust Inventory Stock</h2>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setAdjustingProduct(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAdjust}>
              <div className={styles.modalBody}>
                {adjustError && <div className={styles.errorBanner}>⚠️ {adjustError}</div>}

                {/* Product Snapshot */}
                <div className={styles.productSummaryCard}>
                  {adjustingProduct.image || adjustingProduct.imageUrl ? (
                    <img
                      src={adjustingProduct.image || adjustingProduct.imageUrl}
                      alt={adjustingProduct.name}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.8rem' }}>🥃</span>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{adjustingProduct.name}</div>
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Current Stock: <strong>{adjustingProduct.stockQuantity} units</strong> • {adjustingProduct.brand}
                    </div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Adjustment Mode</label>
                  <div className={styles.modeSwitch}>
                    <button
                      type="button"
                      className={`${styles.modeBtn} ${adjustMode === 'delta' ? styles.modeBtnActive : ''}`}
                      onClick={() => setAdjustMode('delta')}
                    >
                      ± Add / Deduct (Delta)
                    </button>
                    <button
                      type="button"
                      className={`${styles.modeBtn} ${adjustMode === 'set' ? styles.modeBtnActive : ''}`}
                      onClick={() => setAdjustMode('set')}
                    >
                      = Set Absolute Total
                    </button>
                  </div>
                </div>

                {/* Quantity Input */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    {adjustMode === 'delta'
                      ? 'Quantity Change (e.g. +20 to restock, -5 for damage)'
                      : 'New Total Stock Quantity'}
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className={styles.input}
                    placeholder={adjustMode === 'delta' ? '10' : '50'}
                  />
                </div>

                {/* Calculation Preview Banner */}
                {(() => {
                  const num = Number(adjustQty);
                  if (!isNaN(num) && Number.isInteger(num)) {
                    const current = Number(adjustingProduct.stockQuantity ?? adjustingProduct.stock ?? 0);
                    const target = adjustMode === 'set' ? num : current + num;
                    return (
                      <div className={styles.calcBanner}>
                        <span>Preview New Stock:</span>
                        <strong
                          style={{
                            color: target < 0 ? '#f87171' : target === 0 ? '#fbbf24' : '#4ade80',
                            fontSize: '1rem',
                          }}
                        >
                          {current} {adjustMode === 'delta' ? (num >= 0 ? `+ ${num}` : `- ${Math.abs(num)}`) : '→'}{' '}
                          = {target} units {target < 0 ? '(Negative prohibited!)' : ''}
                        </strong>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Reason / Notes */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Reason / Reference Note</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Supplier Batch #402, Damage inspection, Cellar audit"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className={styles.submitBtn}
                >
                  {adjustSubmitting ? 'Saving...' : 'Apply Stock Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Audit Trail Modal */}
      {historyProduct && (
        <div className={styles.modalBackdrop} onClick={() => setHistoryProduct(null)}>
          <div className={`${styles.modal} ${styles.historyModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                Stock Audit History • {historyProduct.name}
              </h2>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setHistoryProduct(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {historyLoading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}>⏳</div>
                  <p>Fetching immutable stock records...</p>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No audit records logged yet for this item.</p>
                </div>
              ) : (
                <div className={styles.historyList}>
                  {historyLogs.map((log) => {
                    const isPos = log.change > 0;
                    let typeClass = styles.typeAdjustment;
                    if (log.type === 'RESTOCK') typeClass = styles.typeRestock;
                    if (log.type === 'ORDER_PLACED') typeClass = styles.typeOrderPlaced;
                    if (log.type === 'ORDER_CANCELLED') typeClass = styles.typeOrderCancelled;

                    return (
                      <div key={log.id} className={styles.historyItem}>
                        <div className={styles.historyHeader}>
                          <span className={`${styles.historyTypeBadge} ${typeClass}`}>
                            {log.type}
                          </span>
                          <span>
                            {new Date(log.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        <div className={styles.historyContent}>
                          <div className={styles.historyStockTransition}>
                            <span>{log.previousStock} units</span>
                            <span>→</span>
                            <span className={isPos ? styles.deltaPositive : styles.deltaNegative}>
                              {isPos ? `+${log.change}` : log.change}
                            </span>
                            <span>→</span>
                            <span style={{ color: '#f8fafc', fontWeight: 700 }}>
                              {log.newStock} units
                            </span>
                          </div>
                        </div>

                        <div className={styles.historyReason}>
                          {log.reason || 'Manual adjustment'}
                        </div>

                        <div className={styles.historyActor}>
                          By: <strong>{log.performedBy || 'ADMIN'}</strong>
                          {log.referenceId ? ` • Ref: #${log.referenceId}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setHistoryProduct(null)}
                className={styles.cancelBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
