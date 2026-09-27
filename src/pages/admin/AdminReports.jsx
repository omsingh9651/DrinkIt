import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAnalytics, downloadOrdersCsv } from '../../services/reportAdminApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminReports.module.css';

export default function AdminReports() {
  const [range, setRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnalytics({
        range,
        startDate: range === 'custom' ? startDate : undefined,
        endDate: range === 'custom' ? endDate : undefined,
      });
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate]);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const res = await fetchAnalytics({
          range,
          startDate: range === 'custom' ? startDate : undefined,
          endDate: range === 'custom' ? endDate : undefined,
        });
        if (isMounted) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load report analytics.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, [range, startDate, endDate]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadOrdersCsv({
        range,
        startDate: range === 'custom' ? startDate : undefined,
        endDate: range === 'custom' ? endDate : undefined,
      });
      showToast('Sales report CSV downloaded successfully.');
    } catch (err) {
      showToast(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!data || !data.summary) return [];
    const s = data.summary;
    return [
      {
        label: 'Total Revenue',
        value: formatINR(s.totalRevenue || 0),
        sub: `${s.totalOrders || 0} valid orders`,
        icon: '💰',
      },
      {
        label: 'Bottles Delivered',
        value: (s.totalBottlesSold || 0).toLocaleString(),
        sub: 'Across all verified categories',
        icon: '🍾',
      },
      {
        label: 'Average Order Value (AOV)',
        value: formatINR(s.averageOrderValue || 0),
        sub: 'Revenue per transaction',
        icon: '📊',
      },
      {
        label: 'Registered Customers',
        value: (s.totalCustomers || 0).toLocaleString(),
        sub: 'Active client base',
        icon: '👥',
      },
    ];
  }, [data]);

  // Compute maximum daily revenue for bar chart scaling
  const maxTimelineRevenue = useMemo(() => {
    if (!data || !data.timeline || data.timeline.length === 0) return 1;
    const max = Math.max(...data.timeline.map((t) => t.revenue || 0));
    return max > 0 ? max : 1;
  }, [data]);

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header & Controls */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports & Sales Analytics</h1>
          <p className={styles.subtitle}>
            Financial trends, consumer volume, order status velocities, and SKU performance.
          </p>
        </div>

        {/* Range Buttons & Export */}
        <div className={styles.headerActions}>
          <div className={styles.rangeSelector}>
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                className={`${styles.rangeBtn} ${range === r.id ? styles.activeRangeBtn : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportCsv}
            disabled={exporting || loading}
          >
            <span>📥</span> {exporting ? 'Generating...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Custom Date Pickers */}
      {range === 'custom' && (
        <div className={styles.customDateBar}>
          <div className={styles.dateInputGroup}>
            <label className={styles.dateLabel}>Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <div className={styles.dateInputGroup}>
            <label className={styles.dateLabel}>End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <button type="button" onClick={loadReport} className={styles.applyBtn}>
            Apply Filter
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={loadReport} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Crunching sales telemetry and generating reports...</p>
        </div>
      ) : !data ? (
        <div className={styles.emptyState}>
          <p>No report analytics available.</p>
        </div>
      ) : (
        <>
          {/* Executive Summary Cards */}
          <div className={styles.summaryGrid}>
            {summaryCards.map((card, idx) => (
              <div key={idx} className={styles.summaryCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>{card.label}</span>
                  <span className={styles.cardIcon}>{card.icon}</span>
                </div>
                <div className={styles.cardValue}>{card.value}</div>
                <div className={styles.cardSub}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Sales Timeline Visualization */}
          <div className={styles.sectionCard}>
            <div className={styles.cardTop}>
              <div>
                <h3 className={styles.sectionTitle}>Sales & Revenue Trends</h3>
                <span className={styles.sectionSub}>Daily performance progression</span>
              </div>
              <div className={styles.timelineLegend}>
                <span className={styles.legendDot} /> Revenue (INR)
              </div>
            </div>

            {(!data.timeline || data.timeline.length === 0) ? (
              <div className={styles.emptyChart}>No daily activity in this range.</div>
            ) : (
              <div className={styles.chartContainer}>
                <div className={styles.barChart}>
                  {data.timeline.map((point, pIdx) => {
                    const heightPercent = Math.max(
                      6,
                      Math.round((point.revenue / maxTimelineRevenue) * 100)
                    );
                    return (
                      <div key={pIdx} className={styles.barColumn}>
                        <div className={styles.barTooltip}>
                          <strong>{point.label}</strong>
                          <span>{formatINR(point.revenue)}</span>
                          <small>{point.orders} orders ({point.bottles} bottles)</small>
                        </div>
                        <div
                          className={styles.barFill}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className={styles.barLabel}>{point.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Two-Column Grid: Top Products & Category Distribution */}
          <div className={styles.twoColGrid}>
            {/* Top Selling Products */}
            <div className={styles.sectionCard}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.sectionTitle}>Top-Selling Curations</h3>
                  <span className={styles.sectionSub}>By gross sales revenue</span>
                </div>
              </div>

              {(!data.topProducts || data.topProducts.length === 0) ? (
                <div className={styles.emptyChart}>No product sales recorded in period.</div>
              ) : (
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Brand</th>
                        <th>Bottles</th>
                        <th className={styles.thRight}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, idx) => (
                        <tr key={p.id || idx}>
                          <td>
                            <div className={styles.prodNameCell}>
                              <span className={styles.rankNum}>#{idx + 1}</span>
                              <span className={styles.prodName}>{p.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.brandName}>{p.brand}</span>
                          </td>
                          <td>
                            <span className={styles.bottleBadge}>{p.quantitySold} units</span>
                          </td>
                          <td className={styles.thRight}>
                            <span className={styles.revenueText}>{formatINR(p.revenue)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Category Revenue Distribution */}
            <div className={styles.sectionCard}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.sectionTitle}>Category Revenue Share</h3>
                  <span className={styles.sectionSub}>Portfolio distribution</span>
                </div>
              </div>

              {(!data.categoryDistribution || data.categoryDistribution.length === 0) ? (
                <div className={styles.emptyChart}>No category revenue recorded.</div>
              ) : (
                <div className={styles.categoryList}>
                  {data.categoryDistribution.map((cat, idx) => (
                    <div key={idx} className={styles.categoryRow}>
                      <div className={styles.categoryHeader}>
                        <span className={styles.catName}>{cat.category}</span>
                        <span className={styles.catRev}>
                          {formatINR(cat.revenue)} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className={styles.progressTrack}>
                        <div
                          className={styles.progressBar}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                      <span className={styles.catBottles}>{cat.bottles} bottles dispatched</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order Status Velocity Breakdown */}
          <div className={styles.sectionCard}>
            <div className={styles.cardTop}>
              <div>
                <h3 className={styles.sectionTitle}>Order Velocity & Fulfillment Status</h3>
                <span className={styles.sectionSub}>Lifecycle distribution across active orders</span>
              </div>
            </div>

            {(!data.orderStatusBreakdown || data.orderStatusBreakdown.length === 0) ? (
              <div className={styles.emptyChart}>No orders recorded in period.</div>
            ) : (
              <div className={styles.statusGrid}>
                {data.orderStatusBreakdown.map((st, idx) => (
                  <div key={idx} className={styles.statusCard}>
                    <span className={styles.statusName}>{st.status}</span>
                    <span className={styles.statusCount}>{st.count} orders</span>
                    <span className={styles.statusPercent}>{st.percentage}% of volume</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

