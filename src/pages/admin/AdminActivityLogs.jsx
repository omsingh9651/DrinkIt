import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchActivityLogs } from '../../services/activityLogApi';
import styles from './AdminActivityLogs.module.css';

const MODULES = [
  'ALL',
  'AUTH',
  'ORDERS',
  'INVENTORY',
  'PRODUCTS',
  'CATEGORIES',
  'BRANDS',
  'COUPONS',
  'BANNERS',
  'ADMIN_USERS',
  'CUSTOMERS',
  'MEDIA',
];

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log for JSON Metadata inspection
  const [inspectedLog, setInspectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchActivityLogs({
        module: selectedModule,
        search: searchQuery,
        startDate,
        endDate,
        page,
        limit: 20,
      });
      setLogs(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  }, [selectedModule, searchQuery, startDate, endDate, page]);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const res = await fetchActivityLogs({
          module: selectedModule,
          search: searchQuery,
          startDate,
          endDate,
          page,
          limit: 20,
        });
        if (isMounted) {
          setLogs(res.data || []);
          setTotal(res.total || 0);
          setTotalPages(res.totalPages || 1);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load activity logs.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, [selectedModule, searchQuery, startDate, endDate, page]);

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD')) {
      return <span className={`${styles.actionBadge} ${styles.actionCreate}`}>{act}</span>;
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('RESTOCK') || act.includes('ADJUST')) {
      return <span className={`${styles.actionBadge} ${styles.actionUpdate}`}>{act}</span>;
    }
    if (act.includes('DELETE') || act.includes('DEACTIVATE') || act.includes('CANCEL')) {
      return <span className={`${styles.actionBadge} ${styles.actionDelete}`}>{act}</span>;
    }
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return <span className={`${styles.actionBadge} ${styles.actionAuth}`}>{act}</span>;
    }
    return <span className={`${styles.actionBadge} ${styles.actionDefault}`}>{act}</span>;
  };

  const getModuleBadge = (mod) => {
    return <span className={styles.moduleBadge}>{mod || 'SYSTEM'}</span>;
  };

  const clearFilters = () => {
    setSelectedModule('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const isFiltered = useMemo(() => {
    return selectedModule !== 'ALL' || searchQuery || startDate || endDate;
  }, [selectedModule, searchQuery, startDate, endDate]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Trail & Activity Logs</h1>
          <p className={styles.subtitle}>
            Immutable compliance record of all administrative operations, catalog adjustments, and logins.
          </p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className={styles.refreshBtn}
          title="Refresh activity logs"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Module Pill Tabs */}
      <div className={styles.moduleScrollContainer}>
        <div className={styles.moduleTabs}>
          {MODULES.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.moduleTab} ${selectedModule === m ? styles.activeModuleTab : ''}`}
              onClick={() => {
                setSelectedModule(m);
                setPage(1);
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Date Range Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by admin email, action, target or notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.dateControls}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className={styles.dateInput}
            title="Start Date"
          />
          <span className={styles.dateSep}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className={styles.dateInput}
            title="End Date"
          />
          {isFiltered && (
            <button
              type="button"
              className={styles.resetFilterBtn}
              onClick={clearFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={loadLogs} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Querying immutable activity logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📜</span>
            <h3>No activity logs found</h3>
            <p>Try clearing your active filters or broaden your date range.</p>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Admin Actor</th>
                  <th>Description</th>
                  <th>Target ID</th>
                  <th className={styles.thRight}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className={styles.timeCell}>
                        <span className={styles.dateText}>
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </span>
                        <span className={styles.hourText}>
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td>{getModuleBadge(log.module)}</td>
                    <td>
                      <div className={styles.actorCell}>
                        <span className={styles.actorEmail}>{log.adminEmail}</span>
                        <span className={styles.actorRole}>{log.adminRole}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.descText}>{log.description}</span>
                    </td>
                    <td>
                      {log.targetId ? (
                        <span className={styles.targetPill}>{log.targetId}</span>
                      ) : (
                        <span className={styles.emptyTarget}>—</span>
                      )}
                    </td>
                    <td className={styles.thRight}>
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <button
                          type="button"
                          className={styles.inspectBtn}
                          onClick={() => setInspectedLog(log)}
                        >
                          Inspect
                        </button>
                      ) : (
                        <span className={styles.emptyTarget}>None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className={styles.paginationBar}>
            <span className={styles.pageInfo}>
              Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} of {total} events
            </span>
            <div className={styles.pageButtons}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={styles.pageBtn}
              >
                Previous
              </button>
              <span className={styles.pageIndicator}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={styles.pageBtn}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Inspection Modal */}
      {inspectedLog && (
        <div className={styles.modalOverlay} onClick={() => setInspectedLog(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Audit Event Payload</h3>
                <span className={styles.modalSub}>
                  {inspectedLog.action} · {inspectedLog.module} ({inspectedLog.id})
                </span>
              </div>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setInspectedLog(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.summaryMetaGrid}>
                <div>
                  <span className={styles.metaKey}>Actor</span>
                  <span className={styles.metaVal}>{inspectedLog.adminEmail}</span>
                </div>
                <div>
                  <span className={styles.metaKey}>Role</span>
                  <span className={styles.metaVal}>{inspectedLog.adminRole}</span>
                </div>
                <div>
                  <span className={styles.metaKey}>IP Address</span>
                  <span className={styles.metaVal}>{inspectedLog.ipAddress || '127.0.0.1'}</span>
                </div>
                <div>
                  <span className={styles.metaKey}>Timestamp</span>
                  <span className={styles.metaVal}>
                    {new Date(inspectedLog.createdAt).toISOString()}
                  </span>
                </div>
              </div>

              <div className={styles.jsonSection}>
                <span className={styles.jsonLabel}>Sanitized Context Metadata:</span>
                <pre className={styles.jsonBox}>
                  {JSON.stringify(inspectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
