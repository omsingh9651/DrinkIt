import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminCustomers,
  fetchCustomerDetails,
  updateCustomerStatus,
} from '../../services/customerAdminApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminCustomers.module.css';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    totalRevenue: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Customer Details Modal
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);

  // Status toggle confirmation
  const [statusTogglingCustomer, setStatusTogglingCustomer] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminCustomers({
        search: searchQuery,
        status: statusFilter,
        page,
        limit: 15,
      });
      setCustomers(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      if (res.metrics) setMetrics(res.metrics);
    } catch (err) {
      setError(err.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, page]);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const res = await fetchAdminCustomers({
          search: searchQuery,
          status: statusFilter,
          page,
          limit: 15,
        });
        if (isMounted) {
          setCustomers(res.data || []);
          setTotal(res.total || 0);
          setTotalPages(res.totalPages || 1);
          if (res.metrics) setMetrics(res.metrics);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load customers.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, [searchQuery, statusFilter, page]);

  // Open Details Modal
  const handleOpenDetails = async (phone) => {
    setSelectedPhone(phone);
    setDetailsLoading(true);
    setCustomerDetails(null);
    try {
      const details = await fetchCustomerDetails(phone);
      setCustomerDetails(details);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTogglingCustomer) return;
    setStatusSubmitting(true);
    try {
      const newStatus = !statusTogglingCustomer.isActive;
      await updateCustomerStatus(statusTogglingCustomer.phone, newStatus);
      showToast(
        `Customer +91 ${statusTogglingCustomer.phone} has been ${
          newStatus ? 'activated' : 'deactivated'
        }.`
      );
      setStatusTogglingCustomer(null);
      loadCustomers();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const filteredMetrics = useMemo(() => {
    return [
      { label: 'Total Customers', value: metrics.totalCustomers, icon: '👥' },
      { label: 'Active Accounts', value: metrics.activeCustomers, icon: '✅' },
      { label: 'Suspended / Inactive', value: metrics.inactiveCustomers, icon: '⏸️' },
      { label: 'Total Customer Spend', value: formatINR(metrics.totalRevenue), icon: '💰' },
    ];
  }, [metrics]);

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Customer Catalog</h1>
          <p className={styles.subtitle}>
            Manage verified client accounts, profile records, and purchasing history.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className={styles.metricGrid}>
        {filteredMetrics.map((m, idx) => (
          <div key={idx} className={styles.metricCard}>
            <div className={styles.metricIcon}>{m.icon}</div>
            <div className={styles.metricInfo}>
              <span className={styles.metricLabel}>{m.label}</span>
              <span className={styles.metricValue}>{m.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Controls: Search and Filters */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by phone, name, email or city..."
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

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="ALL">All Customers</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={loadCustomers} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading registered customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>👤</span>
            <h3>No customers found</h3>
            <p>Try refining your search terms or filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact Info</th>
                  <th>City / Region</th>
                  <th>Orders</th>
                  <th>Lifetime Spend</th>
                  <th>Status</th>
                  <th className={styles.thActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.phone}>
                    <td>
                      <div className={styles.clientCell}>
                        <div className={styles.avatarCircle}>
                          {(c.fullName || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className={styles.clientName}>{c.fullName}</span>
                          <span className={styles.joinDate}>
                            {c.createdAt
                              ? `Joined ${new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                              : 'Registered Member'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.contactCell}>
                        <span className={styles.phoneText}>+91 {c.phone}</span>
                        {c.email ? (
                          <span className={styles.emailText}>{c.email}</span>
                        ) : (
                          <span className={styles.unverifiedEmail}>No email set</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.cityBadge}>{c.city || 'Delhi NCR'}</span>
                    </td>
                    <td>
                      <span className={styles.orderCountBadge}>{c.orderCount || 0} orders</span>
                    </td>
                    <td>
                      <span className={styles.spendText}>{formatINR(c.totalSpend || 0)}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          c.isActive !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {c.isActive !== false ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className={styles.tdActions}>
                      <div className={styles.actionButtons}>
                        <button
                          type="button"
                          className={styles.viewBtn}
                          onClick={() => handleOpenDetails(c.phone)}
                          title="View Customer Profile & Order History"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          className={c.isActive !== false ? styles.suspendBtn : styles.activateBtn}
                          onClick={() => setStatusTogglingCustomer(c)}
                          title={c.isActive !== false ? 'Deactivate Customer Account' : 'Activate Customer Account'}
                        >
                          {c.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
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
              Showing {(page - 1) * 15 + 1} - {Math.min(page * 15, total)} of {total} customers
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

      {/* Customer Details Modal */}
      {selectedPhone && (
        <div className={styles.modalOverlay} onClick={() => setSelectedPhone(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Customer Record</h2>
                <span className={styles.modalSub}>+91 {selectedPhone}</span>
              </div>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setSelectedPhone(null)}
              >
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className={styles.modalLoading}>
                <div className={styles.spinner} />
                <p>Retrieving customer record and orders...</p>
              </div>
            ) : !customerDetails ? (
              <div className={styles.modalError}>Could not retrieve profile information.</div>
            ) : (
              <div className={styles.modalBody}>
                {/* Profile Overview */}
                <div className={styles.profileSummaryCard}>
                  <div className={styles.avatarLarge}>
                    {customerDetails.profile?.profileImage || '🥃'}
                  </div>
                  <div className={styles.profileDetails}>
                    <h3>{customerDetails.profile?.fullName || 'Registered DrinkIt Patron'}</h3>
                    <p className={styles.emailP}>{customerDetails.profile?.email || 'No email attached'}</p>
                    <div className={styles.chipsRow}>
                      <span className={styles.chip}>📱 +91 {customerDetails.profile?.phone}</span>
                      <span className={styles.chip}>
                        {customerDetails.profile?.ageVerified ? '🔞 Age Verified' : 'Age Check Pending'}
                      </span>
                      <span className={styles.chip}>
                        {customerDetails.profile?.isActive !== false ? '✅ Active Status' : '⏸️ Account Suspended'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lifetime Purchasing Stats */}
                <div className={styles.statsSection}>
                  <div className={styles.miniStat}>
                    <span className={styles.miniLabel}>Completed Orders</span>
                    <span className={styles.miniVal}>{customerDetails.stats?.orderCount || 0}</span>
                  </div>
                  <div className={styles.miniStat}>
                    <span className={styles.miniLabel}>Lifetime Purchasing</span>
                    <span className={styles.miniVal}>{formatINR(customerDetails.stats?.totalSpend || 0)}</span>
                  </div>
                  <div className={styles.miniStat}>
                    <span className={styles.miniLabel}>Recent Order</span>
                    <span className={styles.miniVal}>
                      {customerDetails.stats?.lastOrderDate
                        ? new Date(customerDetails.stats.lastOrderDate).toLocaleDateString('en-IN')
                        : 'No orders yet'}
                    </span>
                  </div>
                </div>

                {/* Saved Delivery Addresses */}
                <div className={styles.sectionBlock}>
                  <h4 className={styles.sectionHeading}>Saved Delivery Addresses</h4>
                  {(customerDetails.profile?.savedAddresses || customerDetails.profile?.addresses || []).length === 0 ? (
                    <p className={styles.noData}>No saved delivery addresses found.</p>
                  ) : (
                    <div className={styles.addressGrid}>
                      {(customerDetails.profile?.savedAddresses || customerDetails.profile?.addresses || []).map((addr, aIdx) => (
                        <div key={addr.id || aIdx} className={styles.addressCard}>
                          <span className={styles.addressType}>{addr.type || 'Home'}</span>
                          <p className={styles.addressLine}>
                            {[addr.house, addr.street, addr.city, addr.state, addr.pinCode].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Order History */}
                <div className={styles.sectionBlock}>
                  <h4 className={styles.sectionHeading}>Order History ({customerDetails.orders?.length || 0})</h4>
                  {(customerDetails.orders || []).length === 0 ? (
                    <p className={styles.noData}>Customer has placed no orders yet.</p>
                  ) : (
                    <div className={styles.orderList}>
                      {customerDetails.orders.map((ord) => (
                        <div key={ord.id} className={styles.orderRow}>
                          <div className={styles.orderHead}>
                            <div>
                              <span className={styles.orderId}>{ord.id}</span>
                              <span className={styles.orderDate}>
                                {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className={styles.orderStatusBadge}>{ord.orderStatus}</div>
                          </div>
                          <div className={styles.orderItemsSummary}>
                            {(ord.items || []).map((it, itIdx) => (
                              <span key={itIdx} className={styles.orderItemTag}>
                                {it.quantity}x {it.name}
                              </span>
                            ))}
                          </div>
                          <div className={styles.orderFooter}>
                            <span className={styles.paymentMethod}>Payment: {ord.paymentMethod || 'RAZORPAY'} ({ord.paymentStatus || 'PAID'})</span>
                            <span className={styles.orderTotal}>{formatINR(ord.total || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Toggle Status */}
      {statusTogglingCustomer && (
        <div className={styles.modalOverlay} onClick={() => setStatusTogglingCustomer(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>
              {statusTogglingCustomer.isActive !== false ? 'Deactivate Account?' : 'Activate Account?'}
            </h3>
            <p className={styles.confirmText}>
              Are you sure you want to {statusTogglingCustomer.isActive !== false ? 'suspend' : 're-activate'} the account for{' '}
              <strong>{statusTogglingCustomer.fullName}</strong> (+91 {statusTogglingCustomer.phone})?
            </p>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setStatusTogglingCustomer(null)}
                disabled={statusSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={statusTogglingCustomer.isActive !== false ? styles.dangerBtn : styles.confirmBtn}
                onClick={handleToggleStatus}
                disabled={statusSubmitting}
              >
                {statusSubmitting ? 'Updating...' : statusTogglingCustomer.isActive !== false ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
