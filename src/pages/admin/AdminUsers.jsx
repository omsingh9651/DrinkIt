import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from '../../services/adminUserApi';
import styles from './AdminUsers.module.css';

const ROLES = [
  { id: 'super_admin', label: 'Super Administrator', badgeClass: 'roleSuper' },
  { id: 'admin', label: 'Store Administrator', badgeClass: 'roleAdmin' },
  { id: 'inventory_manager', label: 'Inventory Manager', badgeClass: 'roleInventory' },
  { id: 'order_manager', label: 'Order & Logistics Manager', badgeClass: 'roleOrder' },
  { id: 'content_manager', label: 'Content & Merchandising', badgeClass: 'roleContent' },
];

export default function AdminUsers() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'admin',
    password: '',
    isActive: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete Confirmation Modal
  const [deletingAdmin, setDeletingAdmin] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setAdmins(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load administrator accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchAdminUsers();
        if (isMounted) {
          setAdmins(data || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load admin users.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, []);

  const openAddModal = () => {
    setEditingAdmin(null);
    setFormData({
      name: '',
      email: '',
      role: 'admin',
      password: '',
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (adm) => {
    setEditingAdmin(adm);
    setFormData({
      name: adm.name || '',
      email: adm.email || '',
      role: adm.role || 'admin',
      password: '', // Blank unless changing
      isActive: adm.isActive !== false,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Administrator full name is required.');
      setFormSubmitting(false);
      return;
    }

    if (!formData.email.trim()) {
      setFormError('Email address is required.');
      setFormSubmitting(false);
      return;
    }

    if (!editingAdmin && (!formData.password || formData.password.length < 8)) {
      setFormError('Password must be at least 8 characters.');
      setFormSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        isActive: formData.isActive,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingAdmin) {
        await updateAdminUser(editingAdmin.id, payload);
        showToast(`Administrator "${formData.name}" updated successfully.`);
      } else {
        await createAdminUser(payload);
        showToast(`Administrator "${formData.name}" created successfully.`);
      }

      setIsModalOpen(false);
      loadAdmins();
    } catch (err) {
      setFormError(err.message || 'Failed to save admin user.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;
    setDeleteSubmitting(true);
    try {
      await deleteAdminUser(deletingAdmin.id);
      showToast(`Administrator account "${deletingAdmin.email}" deleted.`);
      setDeletingAdmin(null);
      loadAdmins();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredAdmins = useMemo(() => {
    let list = [...admins];
    if (roleFilter !== 'ALL') {
      list = list.filter((a) => a.role === roleFilter);
    }
    if (searchQuery && searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.email.toLowerCase().includes(term) ||
          a.role.toLowerCase().includes(term)
      );
    }
    return list;
  }, [admins, roleFilter, searchQuery]);

  const metrics = useMemo(() => {
    const total = admins.length;
    const superCount = admins.filter((a) => a.role === 'super_admin').length;
    const activeCount = admins.filter((a) => a.isActive !== false).length;
    return [
      { label: 'Total Personnel', value: total, icon: '🛡️' },
      { label: 'Super Administrators', value: superCount, icon: '👑' },
      { label: 'Active Access', value: activeCount, icon: '🟢' },
    ];
  }, [admins]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return <span className={`${styles.roleBadge} ${styles.roleSuper}`}>Super Admin</span>;
      case 'admin':
        return <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Store Admin</span>;
      case 'inventory_manager':
        return <span className={`${styles.roleBadge} ${styles.roleInventory}`}>Inventory Ops</span>;
      case 'order_manager':
        return <span className={`${styles.roleBadge} ${styles.roleOrder}`}>Logistics Dispatch</span>;
      case 'content_manager':
        return <span className={`${styles.roleBadge} ${styles.roleContent}`}>Merchandising</span>;
      default:
        return <span className={styles.roleBadge}>{role}</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Access & RBAC</h1>
          <p className={styles.subtitle}>
            Manage internal staff accounts, roles, access permissions, and authentication credentials.
          </p>
        </div>
        <button type="button" onClick={openAddModal} className={styles.addBtn}>
          <span>+</span> Add Admin User
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

      {/* Search & Filters */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search admins by name, email or role..."
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
          <label className={styles.filterLabel}>Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button type="button" onClick={loadAdmins} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading administrator personnel records...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🛡️</span>
            <h3>No administrators found</h3>
            <p>Try refining your search terms or filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Last Sign-In</th>
                  <th>Account Created</th>
                  <th className={styles.thActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((adm) => (
                  <tr key={adm.id}>
                    <td>
                      <div className={styles.adminCell}>
                        <div className={styles.avatar}>
                          {adm.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className={styles.adminName}>{adm.name}</span>
                          <span className={styles.adminEmail}>{adm.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{getRoleBadge(adm.role)}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          adm.isActive !== false ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        {adm.isActive !== false ? '● Active' : '○ Suspended'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.timeText}>
                        {adm.lastLogin
                          ? new Date(adm.lastLogin).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never signed in'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.timeText}>
                        {adm.createdAt
                          ? new Date(adm.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </td>
                    <td className={styles.tdActions}>
                      <div className={styles.actionButtons}>
                        <button
                          type="button"
                          className={styles.editBtn}
                          onClick={() => openEditModal(adm)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => setDeletingAdmin(adm)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Admin Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingAdmin ? 'Edit Administrator Profile' : 'Add New Administrator'}
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

              {/* Name & Email */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Mehta"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikram@drinkit.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={styles.input}
                    disabled={Boolean(editingAdmin)}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Role & Access Scope *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className={styles.select}
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className={styles.helperText}>
                  Super Admin has unrestricted authority. Manager roles have scoped domain privileges.
                </span>
              </div>

              {/* Password */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {editingAdmin ? 'Reset Password (leave blank to keep current)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingAdmin}
                  placeholder={editingAdmin ? '••••••••' : 'Minimum 8 characters'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={styles.input}
                />
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
                  <span>Account Active (Allowed to sign in to DrinkIt Admin)</span>
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
                    : editingAdmin
                    ? 'Save Changes'
                    : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAdmin && (
        <div className={styles.modalOverlay} onClick={() => setDeletingAdmin(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete Administrator Account?</h3>
            <p className={styles.confirmText}>
              Are you sure you want to permanently revoke credentials and delete administrator &quot;
              <strong>{deletingAdmin.name}</strong>&quot; ({deletingAdmin.email})?
            </p>
            {deletingAdmin.role === 'super_admin' && (
              <div className={styles.superAdminWarning}>
                ⚠️ Note: DrinkIt security prevents deleting the last active Super Administrator.
              </div>
            )}
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingAdmin(null)}
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
                {deleteSubmitting ? 'Deleting...' : 'Confirm Revoke & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
