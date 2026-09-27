import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../../services/brandApi';
import styles from './AdminBrands.module.css';

export default function AdminBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    logo: '',
    origin: 'India',
    website: '',
    isActive: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete modal
  const [deletingBrand, setDeletingBrand] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminBrands();
      setBrands(data);
    } catch (err) {
      setError(err.message || 'Failed to load brands.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchAdminBrands();
        if (isMounted) {
          setBrands(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load brands.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, []);

  // Derived KPI counts
  const kpis = useMemo(() => {
    const total = brands.length;
    const active = brands.filter((b) => b.isActive !== false).length;
    const inactive = total - active;
    const totalProducts = brands.reduce((sum, b) => sum + (b.productCount || 0), 0);
    return { total, active, inactive, totalProducts };
  }, [brands]);

  // Filtered brands
  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      const matchesSearch =
        !searchQuery.trim() ||
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.origin && b.origin.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && b.isActive !== false) ||
        (statusFilter === 'Inactive' && b.isActive === false);

      return matchesSearch && matchesStatus;
    });
  }, [brands, searchQuery, statusFilter]);

  // Handlers for Add/Edit
  const handleOpenAdd = () => {
    setEditingBrand(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      logo: '',
      origin: 'India',
      website: '',
      isActive: true,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || '',
      slug: brand.slug || '',
      description: brand.description || '',
      logo: brand.logo || '',
      origin: brand.origin || 'India',
      website: brand.website || '',
      isActive: brand.isActive !== false,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    if (!editingBrand) {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, name, slug }));
    } else {
      setFormData((prev) => ({ ...prev, name }));
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Brand name is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, formData);
        showToast(`Brand "${formData.name}" updated successfully!`);
      } else {
        await createBrand(formData);
        showToast(`Brand "${formData.name}" created successfully!`);
      }
      setIsEditModalOpen(false);
      await loadBrands();
    } catch (err) {
      setFormError(err.message || 'Failed to save brand.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (brand) => {
    try {
      const nextStatus = !brand.isActive;
      await updateBrand(brand.id, { isActive: nextStatus });
      showToast(`Brand "${brand.name}" marked as ${nextStatus ? 'Active' : 'Inactive'}.`);
      await loadBrands();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDeleteClick = (brand) => {
    setDeletingBrand(brand);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBrand) return;
    setDeleteSubmitting(true);
    try {
      await deleteBrand(deletingBrand.id);
      showToast(`Brand "${deletingBrand.name}" removed successfully.`);
      setDeletingBrand(null);
      await loadBrands();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {toast && <div className={styles.toast}>✨ {toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <span>🏷️</span> Brand Management
          </h1>
          <p>Manage authentic distilleries, vineyards, breweries, and partner labels</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadBrands} disabled={loading}>
            🔄 Refresh
          </button>
          <button className={styles.primaryBtn} onClick={handleOpenAdd}>
            ➕ Add Brand
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🏢</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.total}</span>
            <span className={styles.statLabel}>Total Brands</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.active}</span>
            <span className={styles.statLabel}>Active Brands</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏸️</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.inactive}</span>
            <span className={styles.statLabel}>Inactive Brands</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🍾</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.totalProducts}</span>
            <span className={styles.statLabel}>Total Products</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search brands by name, region, description..."
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
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Loading brand catalog...</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Failed to Load Brands</h3>
          <p>{error}</p>
          <button className={styles.refreshBtn} onClick={loadBrands}>
            Try Again
          </button>
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h3>No Brands Found</h3>
          <p>Try clearing your search query or create a new brand profile.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.brandTable}>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Origin / Region</th>
                <th>Description</th>
                <th>Products</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBrands.map((b) => (
                <tr key={b.id} className={styles.brandRow}>
                  <td>
                    <div className={styles.brandInfoCell}>
                      {b.logo ? (
                        <img
                          src={b.logo}
                          alt={b.name}
                          className={styles.brandLogo}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={styles.brandLogoFallback}
                        style={{ display: b.logo ? 'none' : 'flex' }}
                      >
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.brandDetails}>
                        <span className={styles.brandName}>{b.name}</span>
                        <span className={styles.brandSlug}>/{b.slug}</span>
                        {b.website && (
                          <a
                            href={b.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.websiteLink}
                          >
                            🌐 {b.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.originBadge}>📍 {b.origin || 'India'}</span>
                  </td>
                  <td>
                    <span className={styles.brandDesc} title={b.description}>
                      {b.description || '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.productBadge} ${
                        (b.productCount || 0) > 0 ? styles.hasProducts : ''
                      }`}
                    >
                      🏷️ {b.productCount || 0} products
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        b.isActive !== false ? styles.statusActive : styles.statusInactive
                      }`}
                    >
                      {b.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleOpenEdit(b)}
                        title="Edit Brand"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleStatus(b)}
                        title={b.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {b.isActive ? '⏸️' : '▶️'}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDeleteClick(b)}
                        title="Delete Brand"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Brand Modal */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingBrand ? `Edit "${editingBrand.name}"` : 'Add New Brand Profile'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsEditModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className={styles.modalBody}>
                {formError && (
                  <div className={styles.deleteWarningBox}>
                    ⚠️ {formError}
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Brand Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Rampur Distillery"
                      value={formData.name}
                      onChange={handleNameChange}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Slug (URL Friendly)</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. rampur-distillery"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Origin / Region</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Rampur, Uttar Pradesh"
                      value={formData.origin}
                      onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Official Website</label>
                    <input
                      type="url"
                      className={styles.formInput}
                      placeholder="https://example.com"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    placeholder="Brief background about distillery or vineyard heritage..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Brand Logo URL</label>
                  <input
                    type="url"
                    className={styles.formInput}
                    placeholder="https://images.unsplash.com/..."
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  />
                  {formData.logo && (
                    <div className={styles.imgPreviewBox}>
                      <img
                        src={formData.logo}
                        alt="Logo Preview"
                        className={styles.previewImg}
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Live Logo Preview</span>
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Brand is Active and selectable in products
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : editingBrand ? 'Update Brand' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Guardrail Modal */}
      {deletingBrand && (
        <div className={styles.modalOverlay} onClick={() => setDeletingBrand(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete Brand Profile</h2>
              <button className={styles.closeBtn} onClick={() => setDeletingBrand(null)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {(deletingBrand.productCount || 0) > 0 ? (
                <div className={styles.deleteWarningBox}>
                  <strong>🚫 Deletion Blocked:</strong>
                  <p style={{ margin: '8px 0 0 0' }}>
                    Cannot delete <strong>{deletingBrand.name}</strong> because{' '}
                    <strong>{deletingBrand.productCount} product(s)</strong> are currently assigned to this brand.
                    Please reassign or delete these products before removing this brand.
                  </p>
                </div>
              ) : (
                <p>
                  Are you sure you want to permanently delete brand{' '}
                  <strong>&quot;{deletingBrand.name}&quot;</strong>? This action cannot be undone.
                </p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingBrand(null)}
              >
                Close
              </button>
              {(deletingBrand.productCount || 0) === 0 && (
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                >
                  {deleteSubmitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
