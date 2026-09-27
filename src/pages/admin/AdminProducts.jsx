import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  updateProductStock,
  updateProductStatus,
  deleteProduct,
  uploadProductImage,
} from '../../services/productApi';
import {
  isUnusableImageUrl,
  UNUSABLE_IMAGE_ERROR,
  validateImageUrl,
} from '../../utils/imageValidation';
import { formatINR } from '../../utils/formatters';
import styles from './AdminProducts.module.css';

const CATEGORIES = [
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

const COMMON_BOTTLE_SIZES = [180, 375, 500, 650, 750, 1000];

const INITIAL_FORM = {
  name: '',
  brand: '',
  category: 'Wine',
  subCategory: '',
  price: '',
  originalPrice: '',
  volume: '750 ml',
  bottleSizeInMl: 750,
  abv: '13.5%',
  origin: 'India',
  stockQuantity: 25,
  rating: 4.5,
  status: 'active',
  badge: '',
  image: '',
  description: '',
  tastingNotes: '',
};

export default function AdminProducts() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStockStatus, setSelectedStockStatus] = useState('All');
  const [selectedProductStatus, setSelectedProductStatus] = useState('All'); // 'All' | 'active' | 'inactive'

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(() => searchParams.get('action') === 'add');
  const [editingId, setEditingId] = useState(null); // null = Add, string = Edit ID
  const [deletingProduct, setDeletingProduct] = useState(null); // product object or null

  // Form State
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Image Upload / Mode State
  const [imageInputMode, setImageInputMode] = useState('upload'); // 'upload' | 'url'
  const [imageValidation, setImageValidation] = useState({
    status: 'idle', // 'idle' | 'validating' | 'valid' | 'invalid'
    message: '',
    dimensions: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3000);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setErrorMessage('');
    setImageInputMode('upload');
    setImageValidation({ status: 'idle', message: '', dimensions: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    fetchProducts({ includeInactive: true })
      .then((data) => {
        if (isMounted) {
          setProducts(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading admin products:', err);
        if (isMounted) {
          setLoading(false);
          showToast('Failed to load products');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== 'All' && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Stock status filter
      if (selectedStockStatus === 'in-stock' && (!p.inStock || p.stockQuantity <= 5)) return false;
      if (selectedStockStatus === 'low-stock' && (!p.inStock || p.stockQuantity > 5 || p.stockQuantity <= 0)) return false;
      if (selectedStockStatus === 'out-of-stock' && (p.inStock && p.stockQuantity > 0)) return false;

      // Active / Inactive status filter
      if (
        selectedProductStatus !== 'All' &&
        (p.status || 'active').toLowerCase() !== selectedProductStatus.toLowerCase()
      ) {
        return false;
      }

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [products, selectedCategory, selectedStockStatus, selectedProductStatus, searchQuery]);

  const handleOpenEdit = (product) => {
    setEditingId(product.id);
    const existingImage =
      product.image ||
      product.imageUrl ||
      product.thumbnail ||
      (Array.isArray(product.images) && product.images[0]) ||
      '';

    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      category: product.category || 'Wine',
      subCategory: product.subCategory || product.subcategory || '',
      price: product.price !== undefined ? product.price : product.sellingPrice !== undefined ? product.sellingPrice : '',
      originalPrice: product.mrp || product.originalPrice || '',
      volume: product.volume || (product.bottleSizeInMl ? `${product.bottleSizeInMl} ml` : '750 ml'),
      bottleSizeInMl: product.bottleSizeInMl || (product.volume ? parseInt(product.volume, 10) : 750) || 750,
      abv: product.abv || '13.5%',
      origin: product.origin || 'India',
      stockQuantity: product.stockQuantity !== undefined ? product.stockQuantity : product.stock !== undefined ? product.stock : 25,
      rating: product.rating !== undefined ? product.rating : 4.5,
      status: product.status || 'active',
      badge: product.badge || '',
      image: existingImage,
      description: product.description || product.shortDescription || '',
      tastingNotes: Array.isArray(product.tastingNotes)
        ? product.tastingNotes.join(', ')
        : product.tastingNotes || '',
    });
    setErrorMessage('');

    if (existingImage.startsWith('/uploads/')) {
      setImageInputMode('upload');
      setImageValidation({ status: 'valid', message: 'Local storage image', dimensions: 'Local Upload' });
    } else if (existingImage) {
      setImageInputMode('url');
      if (isUnusableImageUrl(existingImage)) {
        setImageValidation({ status: 'invalid', message: UNUSABLE_IMAGE_ERROR, dimensions: '' });
      } else {
        setImageValidation({ status: 'validating', message: 'Verifying image link...', dimensions: '' });
        validateImageUrl(existingImage).then((res) => {
          if (res.valid) {
            setImageValidation({ status: 'valid', message: 'Direct image link verified', dimensions: res.dimensions });
          } else {
            setImageValidation({ status: 'invalid', message: res.error || UNUSABLE_IMAGE_ERROR, dimensions: '' });
          }
        });
      }
    } else {
      setImageInputMode('upload');
      setImageValidation({ status: 'idle', message: '', dimensions: '' });
    }

    setIsModalOpen(true);
  };

  const handleToggleStatus = async (product) => {
    const nextStatus = (product.status || 'active') === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateProductStatus(product.id, nextStatus);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, ...updated, status: nextStatus } : p))
      );
      showToast(`Product "${product.name}" marked as ${nextStatus.toUpperCase()}.`);
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast(err.message || 'Failed to update product status.');
    }
  };

  const handleImageUrlChange = (url) => {
    setFormData((prev) => ({ ...prev, image: url }));
    setErrorMessage('');

    if (!url || !url.trim()) {
      setImageValidation({ status: 'idle', message: '', dimensions: '' });
      return;
    }

    if (isUnusableImageUrl(url)) {
      setImageValidation({
        status: 'invalid',
        message: UNUSABLE_IMAGE_ERROR,
        dimensions: '',
      });
      return;
    }

    setImageValidation({ status: 'validating', message: 'Verifying image link...', dimensions: '' });

    validateImageUrl(url).then((res) => {
      if (res.valid) {
        setImageValidation({
          status: 'valid',
          message: 'Direct image link verified',
          dimensions: res.dimensions || 'Verified',
        });
      } else {
        setImageValidation({
          status: 'invalid',
          message: res.error || UNUSABLE_IMAGE_ERROR,
          dimensions: '',
        });
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageValidation({
        status: 'invalid',
        message: 'Please select an image file (JPEG, PNG, WebP, AVIF).',
        dimensions: '',
      });
      return;
    }

    setUploadingImage(true);
    setImageValidation({ status: 'validating', message: 'Uploading image to DrinkIt media...', dimensions: '' });
    setErrorMessage('');

    try {
      const uploadedUrl = await uploadProductImage(file);
      setFormData((prev) => ({ ...prev, image: uploadedUrl }));
      setImageValidation({
        status: 'valid',
        message: 'Image uploaded successfully',
        dimensions: 'Local Storage',
      });
      showToast('Image uploaded successfully');
    } catch (err) {
      console.error('Image upload failed:', err);
      setImageValidation({
        status: 'invalid',
        message: err.message || 'Failed to upload image',
        dimensions: '',
      });
      setErrorMessage(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearImage = () => {
    setFormData((prev) => ({ ...prev, image: '' }));
    setImageValidation({ status: 'idle', message: '', dimensions: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = formData.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Product name must be at least 2 characters.');
      return;
    }

    const trimmedBrand = formData.brand.trim();
    if (!trimmedBrand) {
      setErrorMessage('Brand name is required.');
      return;
    }

    if (!formData.category) {
      setErrorMessage('Please select a valid category.');
      return;
    }

    const numPrice = Number(formData.price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMessage('Please enter a valid positive price in INR.');
      return;
    }

    const numMrp = formData.originalPrice
      ? Number(formData.originalPrice)
      : Math.round(numPrice * 1.15);
    if (numMrp < numPrice) {
      setErrorMessage('MRP / Regular price cannot be less than the selling price.');
      return;
    }

    const numStock = Number(formData.stockQuantity);
    if (isNaN(numStock) || numStock < 0 || !Number.isInteger(numStock)) {
      setErrorMessage('Stock quantity must be a non-negative whole number (0 or greater).');
      return;
    }

    const numRating = Number(formData.rating !== undefined ? formData.rating : 4.5);
    if (isNaN(numRating) || numRating < 0 || numRating > 5) {
      setErrorMessage('Rating must be between 0.0 and 5.0.');
      return;
    }

    const numBottleSize =
      Number(formData.bottleSizeInMl) ||
      (formData.volume ? parseInt(formData.volume, 10) : 750) ||
      750;
    if (isNaN(numBottleSize) || numBottleSize <= 0) {
      setErrorMessage('Bottle size in ml must be a positive number.');
      return;
    }

    // Check unusable image URL before saving
    if (formData.image && isUnusableImageUrl(formData.image)) {
      setErrorMessage(UNUSABLE_IMAGE_ERROR);
      return;
    }

    // Check if live validation flagged this image as invalid
    if (formData.image && imageValidation.status === 'invalid') {
      setErrorMessage(imageValidation.message || UNUSABLE_IMAGE_ERROR);
      return;
    }

    setFormSubmitting(true);

    try {
      const payload = {
        ...formData,
        name: trimmedName,
        brand: trimmedBrand,
        price: numPrice,
        sellingPrice: numPrice,
        discountPrice: numPrice,
        originalPrice: numMrp,
        mrp: numMrp,
        stockQuantity: numStock,
        stock: numStock,
        bottleSizeInMl: numBottleSize,
        volume: formData.volume || `${numBottleSize} ml`,
        abv: formData.abv || '40.0%',
        rating: numRating,
        status: formData.status === 'inactive' ? 'inactive' : 'active',
        tastingNotes: formData.tastingNotes
          ? formData.tastingNotes.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };

      let savedProduct;
      if (editingId) {
        savedProduct = await updateProduct(editingId, payload);
      } else {
        savedProduct = await createProduct(payload);
      }

      // Verification: ensure image field was actually saved
      if (payload.image && savedProduct.image !== payload.image) {
        throw new Error('Image failed to save on the server. Please try again.');
      }

      // Immediately refresh products catalog from server to ensure fresh state
      const freshProducts = await fetchProducts({ includeInactive: true });
      if (Array.isArray(freshProducts) && freshProducts.length > 0) {
        setProducts(freshProducts);
      } else {
        setProducts((prev) =>
          editingId
            ? prev.map((p) => (p.id === editingId ? { ...p, ...savedProduct } : p))
            : [savedProduct, ...prev]
        );
      }

      showToast(
        editingId
          ? `✔ "${savedProduct.name}" updated successfully.`
          : `✔ "${savedProduct.name}" created successfully.`
      );

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
      setErrorMessage(err.message || 'Failed to save product.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStockBlur = async (product, newQty) => {
    const qty = Number(newQty);
    if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      showToast('Stock quantity must be a non-negative whole number (0 or greater).');
      return;
    }
    if (qty === product.stockQuantity) return;

    try {
      const updated = await updateProductStock(product.id, qty);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, ...updated, stockQuantity: qty, stock: qty } : p))
      );
      showToast(`Stock updated for ${product.name} (${qty} units).`);
    } catch (err) {
      console.error('Failed to update stock:', err);
      showToast(err.message || 'Error updating stock.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;

    try {
      await deleteProduct(deletingProduct.id);
      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      showToast(`Product "${deletingProduct.name}" deleted.`);
      setDeletingProduct(null);
    } catch (err) {
      console.error('Delete error:', err);
      showToast(err.message || 'Failed to delete product.');
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          <span>🔔</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Product Catalog</h1>
          <p>Create, modify, restock, and manage all alcoholic beverages in the DrinkIt store.</p>
        </div>

        <button type="button" onClick={handleOpenAdd} className={styles.addBtn}>
          <span>+</span>
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by product name, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.selectGroup}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.select}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={selectedStockStatus}
            onChange={(e) => setSelectedStockStatus(e.target.value)}
            className={styles.select}
          >
            <option value="All">All Stock Levels</option>
            <option value="in-stock">In Stock (&gt; 5)</option>
            <option value="low-stock">Low Stock (1 - 5)</option>
            <option value="out-of-stock">Out of Stock (0)</option>
          </select>

          <select
            value={selectedProductStatus}
            onChange={(e) => setSelectedProductStatus(e.target.value)}
            className={styles.select}
          >
            <option value="All">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingSpinner}>Loading DrinkIt catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No products match your search/filter criteria.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Rating</th>
                  <th>Price (INR)</th>
                  <th>Stock Qty</th>
                  <th>Store Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className={styles.productCell}>
                        {p.image || p.imageUrl || p.thumbnail || (Array.isArray(p.images) && p.images[0]) ? (
                          <img
                            src={
                              p.image ||
                              p.imageUrl ||
                              p.thumbnail ||
                              (Array.isArray(p.images) && p.images[0])
                            }
                            alt={p.name}
                            className={styles.thumbImg}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className={styles.thumbEmoji}>{p.emoji || '🥃'}</span>
                        )}
                        <div className={styles.nameBlock}>
                          <span className={styles.nameText}>{p.name}</span>
                          <span className={styles.brandText}>
                            {p.brand} {p.volume ? `• ${p.volume}` : p.bottleSizeInMl ? `• ${p.bottleSizeInMl} ml` : ''} {p.abv ? `• ${p.abv}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td>
                      <span className={styles.ratingCell}>
                        ★ {Number(p.rating ?? 4.5).toFixed(1)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600 }}>{formatINR(p.price)}</span>
                        {p.originalPrice && Number(p.originalPrice) > Number(p.price) && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                            {formatINR(p.originalPrice)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        defaultValue={p.stockQuantity}
                        onBlur={(e) => handleStockBlur(p, e.target.value)}
                        className={styles.stockInput}
                        title="Click and change number to update stock immediately"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(p)}
                        className={p.status === 'inactive' ? styles.statusBtnInactive : styles.statusBtnActive}
                        title={`Click to switch to ${p.status === 'inactive' ? 'Active' : 'Inactive'}`}
                      >
                        {p.status === 'inactive' ? '○ Inactive' : '● Active'}
                      </button>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className={styles.editBtn}
                          title="Edit Product"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingProduct(p)}
                          className={styles.deleteBtn}
                          title="Delete Product"
                        >
                          🗑️ Delete
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

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className={styles.modalBody}>
                {errorMessage && (
                  <div style={{ color: '#ff858d', fontSize: '0.85rem' }}>
                    ⚠️ {errorMessage}
                  </div>
                )}

                <div className={styles.formGrid}>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Product Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sula Dindori Reserve Shiraz"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Sula Vineyards"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={styles.input}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Store Catalog Status *</label>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={styles.input}
                    >
                      <option value="active">Active (Visible in Store)</option>
                      <option value="inactive">Inactive (Hidden from Customers)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Selling Price (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="1350"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>MRP / Original Price (₹)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1550"
                      value={formData.originalPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, originalPrice: e.target.value })
                      }
                      className={styles.input}
                    />
                    {Number(formData.originalPrice) > Number(formData.price) && Number(formData.price) > 0 && (
                      <div className={styles.discountTag}>
                        Save ₹{Number(formData.originalPrice) - Number(formData.price)} ({Math.round(((Number(formData.originalPrice) - Number(formData.price)) / Number(formData.originalPrice)) * 100)}% OFF)
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.stockQuantity}
                      onChange={(e) =>
                        setFormData({ ...formData, stockQuantity: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Bottle Size (ml) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="750"
                      value={formData.bottleSizeInMl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          bottleSizeInMl: val,
                          volume: val ? `${val} ml` : ''
                        });
                      }}
                      className={styles.input}
                    />
                    <div className={styles.sizePresetRow}>
                      {COMMON_BOTTLE_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          className={`${styles.sizePresetBtn} ${Number(formData.bottleSizeInMl) === size ? styles.sizePresetBtnActive : ''}`}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              bottleSizeInMl: size,
                              volume: `${size} ml`
                            })
                          }
                        >
                          {size} ml
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>ABV (Alcohol %)</label>
                    <input
                      type="text"
                      placeholder="e.g. 13.5% or 42.8%"
                      value={formData.abv}
                      onChange={(e) => setFormData({ ...formData, abv: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Rating (0.0 – 5.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="4.5"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Badge / Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. Award Winner, Bestseller"
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  {/* Image Manager Section */}
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <div className={styles.imageSectionHeader}>
                      <label className={styles.label}>Product Image</label>
                      <div className={styles.imageModeToggle}>
                        <button
                          type="button"
                          className={`${styles.modeBtn} ${imageInputMode === 'upload' ? styles.modeBtnActive : ''}`}
                          onClick={() => setImageInputMode('upload')}
                        >
                          📁 Upload Image
                        </button>
                        <button
                          type="button"
                          className={`${styles.modeBtn} ${imageInputMode === 'url' ? styles.modeBtnActive : ''}`}
                          onClick={() => setImageInputMode('url')}
                        >
                          🔗 Paste Image URL
                        </button>
                      </div>
                    </div>

                    {imageInputMode === 'upload' ? (
                      <div className={styles.uploadDropzone}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          id="product-image-file-input"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                          onChange={handleFileUpload}
                          className={styles.hiddenFileInput}
                        />
                        <label htmlFor="product-image-file-input" className={styles.uploadLabel}>
                          {uploadingImage ? (
                            <div className={styles.uploadingState}>
                              <span className={styles.uploadSpinner}>⏳</span>
                              <span>Uploading image from your computer...</span>
                            </div>
                          ) : (
                            <div className={styles.uploadPrompt}>
                              <span className={styles.uploadIcon}>📸</span>
                              <div className={styles.uploadText}>
                                <span className={styles.uploadPrimaryText}>
                                  Click to browse &amp; upload image from computer
                                </span>
                                <span className={styles.uploadSecondaryText}>
                                  Supports JPG, PNG, WebP, AVIF up to 10MB
                                </span>
                              </div>
                            </div>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className={styles.urlInputContainer}>
                        <input
                          type="url"
                          placeholder="https://images.unsplash.com/photo-... (Direct image link)"
                          value={formData.image}
                          onChange={(e) => handleImageUrlChange(e.target.value)}
                          className={styles.input}
                        />
                        <span className={styles.urlHint}>
                          Direct image links only. Google search/preview links are not supported.
                        </span>
                      </div>
                    )}

                    {/* Live Preview Box */}
                    {formData.image && (
                      <div className={styles.previewContainer}>
                        <div className={styles.previewThumbWrapper}>
                          <img
                            src={formData.image}
                            alt="Product preview"
                            className={styles.previewImg}
                            onError={() => {
                              setImageValidation({
                                status: 'invalid',
                                message: UNUSABLE_IMAGE_ERROR,
                                dimensions: '',
                              });
                            }}
                          />
                        </div>

                        <div className={styles.previewDetails}>
                          <div className={styles.previewStatusRow}>
                            {imageValidation.status === 'validating' && (
                              <span className={styles.statusBadgeValidating}>
                                ⏳ Validating image link...
                              </span>
                            )}
                            {imageValidation.status === 'valid' && (
                              <span className={styles.statusBadgeValid}>
                                ✓ Image Ready {imageValidation.dimensions ? `(${imageValidation.dimensions})` : ''}
                              </span>
                            )}
                            {imageValidation.status === 'invalid' && (
                              <span className={styles.statusBadgeInvalid}>
                                ⚠️ Invalid Image
                              </span>
                            )}
                            {imageValidation.status === 'idle' && (
                              <span className={styles.statusBadgeIdle}>Image Attached</span>
                            )}

                            <button
                              type="button"
                              onClick={handleClearImage}
                              className={styles.clearImageBtn}
                              title="Remove Image"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div className={styles.previewPathText} title={formData.image}>
                            {formData.image}
                          </div>

                          {imageValidation.status === 'invalid' && (
                            <div className={styles.imageErrorBanner}>
                              ⚠️ {imageValidation.message || UNUSABLE_IMAGE_ERROR}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Tasting Notes (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="Blackberry, Vanilla Oak, Black Pepper"
                      value={formData.tastingNotes}
                      onChange={(e) =>
                        setFormData({ ...formData, tastingNotes: e.target.value })
                      }
                      className={styles.input}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label className={styles.label}>Description</label>
                    <textarea
                      placeholder="Product summary or description..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className={`${styles.input} ${styles.textarea}`}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className={styles.saveBtn}
                >
                  {formSubmitting ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className={styles.modalBackdrop} onClick={() => setDeletingProduct(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Confirm Delete</h2>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setDeletingProduct(null)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to permanently delete <strong>{deletingProduct.name}</strong> from the DrinkIt catalog?
              </p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '8px' }}>
                Category: <strong>{deletingProduct.category}</strong> • Price: <strong>₹{deletingProduct.price}</strong> • Stock: <strong>{deletingProduct.stockQuantity} units</strong> • Status: <strong>{deletingProduct.status || 'active'}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '6px' }}>
                ⚠️ This will permanently remove the product from MongoDB. This action cannot be undone.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className={styles.deleteDangerBtn}
              >
                Yes, Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
