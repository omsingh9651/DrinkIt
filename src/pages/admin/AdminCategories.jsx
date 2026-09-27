import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/categoryApi';
import styles from './AdminCategories.module.css';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    emoji: '🍾',
    description: '',
    image: '',
    displayOrder: 1,
    isActive: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete modal
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminCategories();
      setCategories(data);
    } catch (err) {
      setError(err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchAdminCategories();
        if (isMounted) {
          setCategories(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load categories.');
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
    const total = categories.length;
    const active = categories.filter((c) => c.isActive !== false).length;
    const inactive = total - active;
    const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
    return { total, active, inactive, totalProducts };
  }, [categories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && c.isActive !== false) ||
        (statusFilter === 'Inactive' && c.isActive === false);

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  // Handlers for Add/Edit
  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      emoji: '🍾',
      description: '',
      image: '',
      displayOrder: categories.length + 1,
      isActive: true,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      slug: category.slug || '',
      emoji: category.emoji || '🍾',
      description: category.description || '',
      image: category.image || '',
      displayOrder: category.displayOrder !== undefined ? category.displayOrder : 1,
      isActive: category.isActive !== false,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    if (!editingCategory) {
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
      setFormError('Category name is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
        showToast(`Category "${formData.name}" updated successfully!`);
      } else {
        await createCategory(formData);
        showToast(`Category "${formData.name}" created successfully!`);
      }
      setIsEditModalOpen(false);
      await loadCategories();
    } catch (err) {
      setFormError(err.message || 'Failed to save category.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    try {
      const nextStatus = !cat.isActive;
      await updateCategory(cat.id, { isActive: nextStatus });
      showToast(`Category "${cat.name}" marked as ${nextStatus ? 'Active' : 'Inactive'}.`);
      await loadCategories();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDeleteClick = (cat) => {
    setDeletingCategory(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setDeleteSubmitting(true);
    try {
      await deleteCategory(deletingCategory.id);
      showToast(`Category "${deletingCategory.name}" removed successfully.`);
      setDeletingCategory(null);
      await loadCategories();
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
            <span>📁</span> Category Management
          </h1>
          <p>Organize product taxonomy, browse hierarchies, and display attributes</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadCategories} disabled={loading}>
            🔄 Refresh
          </button>
          <button className={styles.primaryBtn} onClick={handleOpenAdd}>
            ➕ Add Category
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📂</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.total}</span>
            <span className={styles.statLabel}>Total Categories</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.active}</span>
            <span className={styles.statLabel}>Active Categories</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏸️</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.inactive}</span>
            <span className={styles.statLabel}>Inactive Categories</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🍾</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.totalProducts}</span>
            <span className={styles.statLabel}>Linked Products</span>
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
            placeholder="Search categories by name, slug, description..."
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
          <p>Loading categories catalog...</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Failed to Load Categories</h3>
          <p>{error}</p>
          <button className={styles.refreshBtn} onClick={loadCategories}>
            Try Again
          </button>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h3>No Categories Found</h3>
          <p>Try clearing your search query or add a new category.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.categoryTable}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Order</th>
                <th>Products</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => (
                <tr key={cat.id} className={styles.categoryRow}>
                  <td>
                    <div className={styles.catInfoCell}>
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className={styles.catThumbnail}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={styles.catThumbnailFallback}
                        style={{ display: cat.image ? 'none' : 'flex' }}
                      >
                        {cat.emoji || '🍾'}
                      </div>
                      <div className={styles.catDetails}>
                        <span className={styles.catName}>
                          {cat.emoji} {cat.name}
                        </span>
                        <span className={styles.catSlug}>/{cat.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.catDesc} title={cat.description}>
                      {cat.description || '—'}
                    </span>
                  </td>
                  <td>
                    <strong>#{cat.displayOrder || 0}</strong>
                  </td>
                  <td>
                    <span
                      className={`${styles.productBadge} ${
                        (cat.productCount || 0) > 0 ? styles.hasProducts : ''
                      }`}
                    >
                      🏷️ {cat.productCount || 0} products
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        cat.isActive !== false ? styles.statusActive : styles.statusInactive
                      }`}
                    >
                      {cat.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleOpenEdit(cat)}
                        title="Edit Category"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleStatus(cat)}
                        title={cat.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {cat.isActive ? '⏸️' : '▶️'}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDeleteClick(cat)}
                        title="Delete Category"
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

      {/* Add / Edit Category Modal */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCategory ? `Edit "${editingCategory.name}"` : 'Create New Category'}</h2>
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
                    <label>Category Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Tequila & Mezcal"
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
                      placeholder="e.g. tequila-mezcal"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Emoji Icon</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. 🍷, 🥃, 🍾"
                      value={formData.emoji}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Display Order</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={formData.displayOrder}
                      onChange={(e) =>
                        setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    placeholder="Short description displayed on storefront cards..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Image URL</label>
                  <input
                    type="url"
                    className={styles.formInput}
                    placeholder="https://images.unsplash.com/..."
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                  {formData.image && (
                    <div className={styles.imgPreviewBox}>
                      <img
                        src={formData.image}
                        alt="Preview"
                        className={styles.previewImg}
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Live Image Preview</span>
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
                    Category is Active and visible to customers
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
                  {formSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Guardrail Modal */}
      {deletingCategory && (
        <div className={styles.modalOverlay} onClick={() => setDeletingCategory(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete Category</h2>
              <button className={styles.closeBtn} onClick={() => setDeletingCategory(null)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {(deletingCategory.productCount || 0) > 0 ? (
                <div className={styles.deleteWarningBox}>
                  <strong>🚫 Deletion Blocked:</strong>
                  <p style={{ margin: '8px 0 0 0' }}>
                    Cannot delete <strong>{deletingCategory.name}</strong> because{' '}
                    <strong>{deletingCategory.productCount} product(s)</strong> are currently assigned to it.
                    Please reassign or delete these products before removing this category.
                  </p>
                </div>
              ) : (
                <p>
                  Are you sure you want to permanently delete category{' '}
                  <strong>&quot;{deletingCategory.name}&quot;</strong>? This action cannot be undone.
                </p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingCategory(null)}
              >
                Close
              </button>
              {(deletingCategory.productCount || 0) === 0 && (
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
