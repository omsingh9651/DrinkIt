import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../../services/bannerApi';
import styles from './AdminBanners.module.css';

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    badgeText: 'FEATURED SELECTION',
    image: '',
    ctaText: 'Shop Collection',
    ctaLink: '/products',
    displayOrder: 1,
    startDate: '',
    endDate: '',
    isActive: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete Confirmation Modal
  const [deletingBanner, setDeletingBanner] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminBanners({
        search: searchQuery,
        status: statusFilter,
      });
      setBanners(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load promotional banners.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const res = await fetchAdminBanners({
          search: searchQuery,
          status: statusFilter,
        });
        if (isMounted) {
          setBanners(res.data || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load banners.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, [searchQuery, statusFilter]);

  const openAddModal = () => {
    setEditingBanner(null);
    setFormData({
      title: '',
      subtitle: '',
      badgeText: 'LUXURY RESERVE',
      image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
      ctaText: 'Explore Collection',
      ctaLink: '/products?category=Wine',
      displayOrder: (banners.length + 1),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      badgeText: banner.badgeText || '',
      image: banner.image || '',
      ctaText: banner.ctaText || 'Explore Now',
      ctaLink: banner.ctaLink || '/products',
      displayOrder: banner.displayOrder || 1,
      startDate: banner.startDate ? banner.startDate.slice(0, 10) : '',
      endDate: banner.endDate ? banner.endDate.slice(0, 10) : '',
      isActive: banner.isActive !== false,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Banner title is required.');
      setFormSubmitting(false);
      return;
    }

    if (!formData.image.trim()) {
      setFormError('Banner background image URL is required.');
      setFormSubmitting(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        displayOrder: Number(formData.displayOrder) || 1,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };

      if (editingBanner) {
        await updateBanner(editingBanner.id, payload);
        showToast(`Banner "${formData.title}" updated successfully.`);
      } else {
        await createBanner(payload);
        showToast(`Banner "${formData.title}" created successfully.`);
      }

      setIsModalOpen(false);
      loadBanners();
    } catch (err) {
      setFormError(err.message || 'Failed to save banner.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      const newStatus = !banner.isActive;
      await updateBanner(banner.id, { isActive: newStatus });
      showToast(`Banner "${banner.title}" is now ${newStatus ? 'Active' : 'Inactive'}.`);
      loadBanners();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deletingBanner) return;
    setDeleteSubmitting(true);
    try {
      await deleteBanner(deletingBanner.id);
      showToast(`Banner "${deletingBanner.title}" deleted.`);
      setDeletingBanner(null);
      loadBanners();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const metrics = useMemo(() => {
    const total = banners.length;
    const active = banners.filter((b) => b.isActive !== false).length;
    const inactive = banners.filter((b) => b.isActive === false).length;
    return [
      { label: 'Total Banners', value: total, icon: '🖼️' },
      { label: 'Live on Storefront', value: active, icon: '🟢' },
      { label: 'Inactive / Drafts', value: inactive, icon: '⏸️' },
    ];
  }, [banners]);

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Promotional Banners</h1>
          <p className={styles.subtitle}>
            Publish and schedule high-resolution luxury marketing banners for the storefront homepage.
          </p>
        </div>
        <button type="button" onClick={openAddModal} className={styles.addBtn}>
          <span>+</span> Create Banner
        </button>
      </div>

      {/* Metrics */}
      <div className={styles.metricGrid}>
        {metrics.map((m, idx) => (
          <div key={idx} className={styles.metricCard}>
            <div className={styles.metricIcon}>{m.icon}</div>
            <div className={styles.metricInfo}>
              <span className={styles.metricLabel}>{m.label}</span>
              <span className={styles.metricValue}>{m.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search banners by title or subtitle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Banners</option>
            <option value="ACTIVE">Live Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={loadBanners} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Banner Cards Grid */}
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading promotional banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🖼️</span>
          <h3>No banners found</h3>
          <p>Click &quot;Create Banner&quot; above to launch your first marketing campaign.</p>
        </div>
      ) : (
        <div className={styles.bannerGrid}>
          {banners.map((b) => (
            <div key={b.id} className={styles.bannerCard}>
              {/* Visual Preview */}
              <div
                className={styles.cardPreview}
                style={{ backgroundImage: `url("${b.image}")` }}
              >
                <div className={styles.cardOverlay}>
                  {b.badgeText && <span className={styles.cardBadge}>{b.badgeText}</span>}
                  <h3 className={styles.cardTitle}>{b.title}</h3>
                  {b.subtitle && <p className={styles.cardSub}>{b.subtitle}</p>}
                  <div className={styles.cardCtaPreview}>
                    <span>{b.ctaText || 'Shop'} →</span>
                  </div>
                </div>
              </div>

              {/* Card Meta & Actions */}
              <div className={styles.cardDetails}>
                <div className={styles.metaRow}>
                  <div className={styles.orderPill}>Order: #{b.displayOrder || 1}</div>
                  <button
                    type="button"
                    className={`${styles.statusToggle} ${
                      b.isActive !== false ? styles.statusLive : styles.statusOff
                    }`}
                    onClick={() => handleToggleActive(b)}
                    title="Click to toggle live status"
                  >
                    {b.isActive !== false ? '● Live' : '○ Inactive'}
                  </button>
                </div>

                <div className={styles.dateRow}>
                  <span>
                    📅{' '}
                    {b.startDate
                      ? new Date(b.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                      : 'Always'}{' '}
                    -{' '}
                    {b.endDate
                      ? new Date(b.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                      : 'Ongoing'}
                  </span>
                  <span className={styles.targetLink}>🔗 {b.ctaLink}</span>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => openEditModal(b)}
                  >
                    Edit Banner
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => setDeletingBanner(b)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingBanner ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
              </h2>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className={styles.modalForm}>
              {formError && <div className={styles.formErrorBox}>⚠️ {formError}</div>}

              {/* Title & Badge */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Campaign Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Rosé & Champagne Festival"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Badge Pill Text</label>
                  <input
                    type="text"
                    placeholder="e.g. LIMITED RESERVE"
                    value={formData.badgeText}
                    onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                    className={styles.input}
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Subtitle / Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Enjoy 20% off imported sparkling wines & champagnes"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  className={styles.input}
                />
              </div>

              {/* Image URL & Live Preview */}
              <div className={styles.formGroup}>
                <label className={styles.label}>High-Resolution Image URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/photo-..."
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className={styles.input}
                />
              </div>

              {formData.image && (
                <div className={styles.imagePreviewWrapper}>
                  <span className={styles.previewLabel}>Image Preview:</span>
                  <div
                    className={styles.liveBannerPreview}
                    style={{ backgroundImage: `url("${formData.image}")` }}
                  >
                    <div className={styles.liveBannerOverlay}>
                      {formData.badgeText && <span className={styles.cardBadge}>{formData.badgeText}</span>}
                      <h4>{formData.title || 'Your Campaign Title'}</h4>
                      <p>{formData.subtitle || 'Your promotional subtitle text goes here'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA Details */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Button Text</label>
                  <input
                    type="text"
                    placeholder="e.g. Explore Reserve"
                    value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Target Link / Route</label>
                  <input
                    type="text"
                    placeholder="e.g. /products?category=Wine"
                    value={formData.ctaLink}
                    onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                    className={styles.input}
                  />
                </div>
              </div>

              {/* Ordering and Dates */}
              <div className={styles.formRowThree}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Display Order</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className={styles.input}
                  />
                </div>
              </div>

              {/* Status Switch */}
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className={styles.checkbox}
                  />
                  <span>Publish and activate banner immediately on homepage</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className={styles.formButtons}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={formSubmitting}
                >
                  {formSubmitting
                    ? 'Saving...'
                    : editingBanner
                    ? 'Update Banner'
                    : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBanner && (
        <div className={styles.modalOverlay} onClick={() => setDeletingBanner(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete Promotional Banner?</h3>
            <p className={styles.confirmText}>
              Are you sure you want to permanently delete banner &quot;
              <strong>{deletingBanner.title}</strong>&quot;? This cannot be undone.
            </p>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingBanner(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={handleDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

