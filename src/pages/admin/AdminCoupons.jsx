import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../../services/couponApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminCoupons.module.css';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderValue: 999,
    maxDiscountAmount: 500,
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    usageLimit: '',
    perCustomerLimit: 1,
    isActive: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete Modal
  const [deletingCoupon, setDeletingCoupon] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminCoupons();
      setCoupons(data);
    } catch (err) {
      setError(err.message || 'Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchAdminCoupons();
        if (isMounted) {
          setCoupons(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load coupons.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, []);

  // Derived KPIs
  const kpis = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter((c) => c.isActive !== false).length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    const now = new Date();
    const expired = coupons.filter((c) => c.expiryDate && new Date(c.expiryDate) < now).length;
    return { total, active, totalRedemptions, expired };
  }, [coupons]);

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    const now = new Date();
    return coupons.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') matchesStatus = c.isActive !== false;
      if (statusFilter === 'INACTIVE') matchesStatus = c.isActive === false;
      if (statusFilter === 'EXPIRED') matchesStatus = Boolean(c.expiryDate && new Date(c.expiryDate) < now);

      let matchesType = true;
      if (typeFilter !== 'ALL') matchesType = c.discountType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [coupons, searchQuery, statusFilter, typeFilter]);

  const handleOpenAdd = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 999,
      maxDiscountAmount: 500,
      startDate: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      usageLimit: '',
      perCustomerLimit: 1,
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || '',
      title: coupon.title || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'PERCENTAGE',
      discountValue: coupon.discountValue || 10,
      minOrderValue: coupon.minOrderValue || 0,
      maxDiscountAmount: coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined ? coupon.maxDiscountAmount : '',
      startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().slice(0, 10) : '',
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().slice(0, 10) : '',
      usageLimit: coupon.usageLimit !== null && coupon.usageLimit !== undefined ? coupon.usageLimit : '',
      perCustomerLimit: coupon.perCustomerLimit || 1,
      isActive: coupon.isActive !== false,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      setFormError('Coupon code is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perCustomerLimit: Number(formData.perCustomerLimit) || 1,
        startDate: formData.startDate ? new Date(formData.startDate) : new Date(),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
      };

      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, payload);
        showToast(`Coupon "${payload.code}" updated successfully!`);
      } else {
        await createCoupon(payload);
        showToast(`Coupon "${payload.code}" created successfully!`);
      }
      setIsModalOpen(false);
      await loadCoupons();
    } catch (err) {
      setFormError(err.message || 'Failed to save coupon.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      const nextStatus = !coupon.isActive;
      await updateCoupon(coupon.id, { isActive: nextStatus });
      showToast(`Coupon "${coupon.code}" ${nextStatus ? 'Activated' : 'Deactivated'}.`);
      await loadCoupons();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCoupon) return;
    setDeleteSubmitting(true);
    try {
      await deleteCoupon(deletingCoupon.id);
      showToast(`Coupon "${deletingCoupon.code}" deleted.`);
      setDeletingCoupon(null);
      await loadCoupons();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Coupon code ${code} copied!`);
    } catch {
      showToast(`Code: ${code}`);
    }
  };

  return (
    <div className={styles.container}>
      {toast && <div className={styles.toast}>✨ {toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <span>🎟️</span> Coupons & Promotional Discounts
          </h1>
          <p>Create percentage and flat-rate checkout discount codes with security guardrails</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadCoupons} disabled={loading}>
            🔄 Refresh
          </button>
          <button className={styles.primaryBtn} onClick={handleOpenAdd}>
            ➕ Add Coupon
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🎟️</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.total}</span>
            <span className={styles.statLabel}>Total Campaigns</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.active}</span>
            <span className={styles.statLabel}>Active Coupons</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🎉</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#10b981' }}>
              {kpis.totalRedemptions}
            </span>
            <span className={styles.statLabel}>Total Redemptions</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏰</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue} style={{ color: '#ef4444' }}>
              {kpis.expired}
            </span>
            <span className={styles.statLabel}>Expired Campaigns</span>
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
            placeholder="Search coupons by code or campaign title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="EXPIRED">Expired Only</option>
          </select>

          <select
            className={styles.filterSelect}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED">Flat (₹)</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Loading discount campaigns...</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Failed to Load Coupons</h3>
          <p>{error}</p>
          <button className={styles.refreshBtn} onClick={loadCoupons}>
            Try Again
          </button>
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h3>No Coupons Found</h3>
          <p>Create a promotional coupon code to incentivize checkout conversion.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.couponTable}>
            <thead>
              <tr>
                <th>Coupon Code</th>
                <th>Discount</th>
                <th>Min Spend</th>
                <th>Validity</th>
                <th>Redemptions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoupons.map((c) => {
                const now = new Date();
                const isExpired = c.expiryDate && new Date(c.expiryDate) < now;
                return (
                  <tr key={c.id} className={styles.couponRow}>
                    <td>
                      <div className={styles.codeCell}>
                        <div
                          className={styles.codeBadge}
                          onClick={() => handleCopyCode(c.code)}
                          style={{ cursor: 'pointer' }}
                          title="Click to copy code"
                        >
                          🏷️ {c.code}
                        </div>
                        <span className={styles.couponTitle}>{c.title}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.discountHighlight}>
                        {c.discountType === 'PERCENTAGE'
                          ? `${c.discountValue}% OFF`
                          : `${formatINR(c.discountValue)} OFF`}
                      </span>
                      {c.maxDiscountAmount && (
                        <span className={styles.discountCap}>
                          Cap: {formatINR(c.maxDiscountAmount)}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={styles.minSpend}>
                        {c.minOrderValue > 0 ? formatINR(c.minOrderValue) : 'No min'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.validityCell}>
                        <span>
                          {c.expiryDate
                            ? `Expires ${new Date(c.expiryDate).toLocaleDateString()}`
                            : 'No expiration'}
                        </span>
                        {isExpired && (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>Expired</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.usageProgress}>
                        <strong>{c.usedCount || 0}</strong>
                        {c.usageLimit ? ` / ${c.usageLimit}` : ' (Unlimited)'}
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8' }}>
                          Max {c.perCustomerLimit || 1}/user
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          c.isActive !== false && !isExpired
                            ? styles.statusActive
                            : styles.statusInactive
                        }`}
                      >
                        {isExpired ? 'Expired' : c.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleOpenEdit(c)}
                          title="Edit Coupon"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleToggleStatus(c)}
                          title={c.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {c.isActive ? '⏸️' : '▶️'}
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => setDeletingCoupon(c)}
                          title="Delete Coupon"
                        >
                          🗑️
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCoupon ? `Edit Coupon "${editingCoupon.code}"` : 'Create New Promo Coupon'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className={styles.modalBody}>
                {formError && (
                  <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                    ⚠️ {formError}
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Coupon Code *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. SUMMER20"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                        })
                      }
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Campaign Title *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Summer Wine Festival 20%"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Discount Type</label>
                    <select
                      className={styles.formSelect}
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>
                      Discount Value * ({formData.discountType === 'PERCENTAGE' ? '%' : '₹'})
                    </label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      placeholder={formData.discountType === 'PERCENTAGE' ? '15' : '150'}
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Minimum Order Value (₹)</label>
                    <input
                      type="number"
                      min="0"
                      className={styles.formInput}
                      placeholder="e.g. 999"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Max Discount Cap (₹)</label>
                    <input
                      type="number"
                      min="0"
                      className={styles.formInput}
                      placeholder="Optional cap (e.g. 500)"
                      value={formData.maxDiscountAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDiscountAmount: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Total Redemptions Limit</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      placeholder="Optional (e.g. 1000)"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Per-Customer Limit</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      value={formData.perCustomerLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, perCustomerLimit: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    placeholder="Short description displayed on storefront promo banners..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Coupon is Active and ready for redemption
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingCoupon && (
        <div className={styles.modalOverlay} onClick={() => setDeletingCoupon(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete Coupon Code</h2>
              <button className={styles.closeBtn} onClick={() => setDeletingCoupon(null)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>
                Are you sure you want to delete coupon code{' '}
                <strong>&quot;{deletingCoupon.code}&quot;</strong>? Customers will no longer be able
                to redeem this discount.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingCoupon(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
