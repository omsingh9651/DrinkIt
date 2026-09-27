import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchAdminMedia,
  uploadMediaFile,
  addExternalMediaUrl,
  deleteMedia,
} from '../../services/mediaApi';
import { getAssetUrl } from '../../services/apiConfig';
import styles from './AdminMedia.module.css';

export default function AdminMedia() {
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Add External URL Modal
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [urlSubmitting, setUrlSubmitting] = useState(false);

  // Preview Lightbox Modal
  const [previewItem, setPreviewItem] = useState(null);

  // Delete Modal
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminMedia();
      setMediaList(data);
    } catch (err) {
      setError(err.message || 'Failed to load media assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const executeFetch = async () => {
      try {
        const data = await fetchAdminMedia();
        if (isMounted) {
          setMediaList(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load media assets.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    executeFetch();
    return () => {
      isMounted = false;
    };
  }, []);

  // Derived KPI metrics
  const kpis = useMemo(() => {
    const total = mediaList.length;
    const uploads = mediaList.filter((m) => m.source === 'upload').length;
    const external = mediaList.filter((m) => m.source === 'external').length;
    const totalBytes = mediaList.reduce((sum, m) => sum + (m.size || 0), 0);
    const storageFormatted =
      totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(totalBytes / 1024).toFixed(0)} KB`;
    return { total, uploads, external, storageFormatted };
  }, [mediaList]);

  // Filtered media
  const filteredMedia = useMemo(() => {
    return mediaList.filter((m) => {
      const matchesSearch =
        !searchQuery.trim() ||
        m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.originalName && m.originalName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.url.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSource = sourceFilter === 'all' || m.source === sourceFilter;

      return matchesSearch && matchesSource;
    });
  }, [mediaList, searchQuery, sourceFilter]);

  // Copy URL to clipboard
  const handleCopyUrl = async (url) => {
    try {
      // If it starts with /uploads, form full URL for convenience
      const assetUrl = getAssetUrl(url);
      const finalUrl = assetUrl || (url.startsWith('/') ? `${window.location.origin}${url}` : url);
      await navigator.clipboard.writeText(finalUrl);
      showToast('Image URL copied to clipboard!');
    } catch {
      showToast('Copied URL: ' + url);
    }
  };

  // Upload handler
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMediaFile(file);
      showToast(`Uploaded "${uploaded.filename}" successfully!`);
      await loadMedia();
    } catch (err) {
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Handle External URL Submit
  const handleAddUrl = async (e) => {
    e.preventDefault();
    if (!externalUrl.trim()) return;
    setUrlSubmitting(true);
    try {
      await addExternalMediaUrl({
        url: externalUrl.trim(),
        title: externalTitle.trim(),
      });
      showToast('External image added to Media Library!');
      setIsUrlModalOpen(false);
      setExternalUrl('');
      setExternalTitle('');
      await loadMedia();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setUrlSubmitting(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeleteSubmitting(true);
    try {
      await deleteMedia(deletingItem.id);
      showToast(`Deleted "${deletingItem.filename}".`);
      setDeletingItem(null);
      if (previewItem?.id === deletingItem.id) {
        setPreviewItem(null);
      }
      await loadMedia();
    } catch (err) {
      showToast(`Failed to delete: ${err.message}`);
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
            <span>🖼️</span> Media Library
          </h1>
          <p>Upload drink assets, preview catalog photography, and manage verified URLs</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadMedia} disabled={loading}>
            🔄 Refresh
          </button>
          <button
            className={styles.secondaryBtn}
            onClick={() => setIsUrlModalOpen(true)}
          >
            🔗 Add Image URL
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload File'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
        </div>
      </div>

      {/* KPI Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🖼️</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.total}</span>
            <span className={styles.statLabel}>Total Assets</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💾</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.uploads}</span>
            <span className={styles.statLabel}>Local Uploads</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🌐</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.external}</span>
            <span className={styles.statLabel}>External URLs</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{kpis.storageFormatted}</span>
            <span className={styles.statLabel}>Stored Volume</span>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        className={`${styles.dropzone} ${dragActive ? styles.active : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.dropzoneIcon}>☁️</div>
        <div className={styles.dropzoneText}>
          <h3>Drop an image here or click to browse</h3>
          <p>Supports JPG, PNG, WebP, AVIF, SVG up to 15MB</p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search media by filename, url, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All Sources</option>
            <option value="upload">Uploads Only</option>
            <option value="external">External URLs Only</option>
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Loading media assets...</p>
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h3>Failed to Load Media</h3>
          <p>{error}</p>
          <button className={styles.refreshBtn} onClick={loadMedia}>
            Try Again
          </button>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📷</div>
          <h3>No Media Assets Found</h3>
          <p>Upload a file or add an external image URL to get started.</p>
        </div>
      ) : (
        <div className={styles.mediaGrid}>
          {filteredMedia.map((item) => (
            <div key={item.id} className={styles.mediaCard}>
              <div className={styles.imgWrapper} onClick={() => setPreviewItem(item)}>
                <img
                  src={item.url}
                  alt={item.originalName || item.filename}
                  className={styles.cardImg}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src =
                      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80';
                  }}
                />
                <span className={styles.sourceBadge}>{item.source}</span>
              </div>
              <div className={styles.mediaCardBody}>
                <span className={styles.mediaTitle} title={item.originalName || item.filename}>
                  {item.originalName || item.filename}
                </span>
                <div className={styles.mediaMeta}>
                  <span>
                    {item.size > 0 ? `${(item.size / 1024).toFixed(0)} KB` : 'CDN Hosted'}
                  </span>
                  <span>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
                <div className={styles.mediaCardActions}>
                  <button
                    className={styles.copyUrlBtn}
                    onClick={() => handleCopyUrl(item.url)}
                    title="Copy Image URL"
                  >
                    📋 Copy URL
                  </button>
                  <button
                    className={styles.deleteIconBtn}
                    onClick={() => setDeletingItem(item)}
                    title="Delete Media"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add External URL Modal */}
      {isUrlModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsUrlModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add External Image URL</h2>
              <button className={styles.closeBtn} onClick={() => setIsUrlModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddUrl}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Image URL *</label>
                  <input
                    type="url"
                    className={styles.formInput}
                    placeholder="https://images.unsplash.com/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Label / Title (Optional)</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Vintage Reserve Merlot 2020"
                    value={externalTitle}
                    onChange={(e) => setExternalTitle(e.target.value)}
                  />
                </div>
                {externalUrl && (
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <img
                      src={externalUrl}
                      alt="Preview"
                      style={{
                        maxHeight: 140,
                        maxWidth: '100%',
                        borderRadius: 8,
                        objectFit: 'contain',
                        background: '#0b0d14',
                      }}
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsUrlModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={urlSubmitting}>
                  {urlSubmitting ? 'Saving...' : 'Add to Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewItem && (
        <div className={styles.modalOverlay} onClick={() => setPreviewItem(null)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxHeader}>
              <h2>{previewItem.originalName || previewItem.filename}</h2>
              <button className={styles.closeBtn} onClick={() => setPreviewItem(null)}>
                ✕
              </button>
            </div>
            <div className={styles.lightboxBody}>
              <div className={styles.lightboxImgContainer}>
                <img
                  src={previewItem.url}
                  alt={previewItem.filename}
                  className={styles.lightboxImg}
                />
              </div>

              <div className={styles.urlCopyBox}>
                <span className={styles.urlText}>{previewItem.url}</span>
                <button
                  className={styles.copyUrlBtn}
                  style={{ maxWidth: 120 }}
                  onClick={() => handleCopyUrl(previewItem.url)}
                >
                  📋 Copy
                </button>
              </div>

              <div className={styles.lightboxInfo}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Filename</span>
                  <span className={styles.infoValue}>{previewItem.filename}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Source</span>
                  <span className={styles.infoValue}>{previewItem.source.toUpperCase()}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>File Size</span>
                  <span className={styles.infoValue}>
                    {previewItem.size > 0
                      ? `${(previewItem.size / 1024).toFixed(1)} KB`
                      : 'CDN External'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Created</span>
                  <span className={styles.infoValue}>
                    {previewItem.createdAt
                      ? new Date(previewItem.createdAt).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className={styles.modalOverlay} onClick={() => setDeletingItem(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete Media Asset</h2>
              <button className={styles.closeBtn} onClick={() => setDeletingItem(null)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>
                Are you sure you want to delete <strong>{deletingItem.filename}</strong>?
                {deletingItem.source === 'upload' &&
                  ' This will also permanently remove the physical file from the server.'}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeletingItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
