import { PRODUCTS, getProductById as getLocalProductById } from '../data/products';
import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl('/api/products');

/**
 * Fetch all products from API with fallback to local catalog
 */
export async function fetchProducts({ category, q, sortBy, inStock, minPrice, maxPrice, status, includeInactive } = {}) {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (q && q.trim()) params.append('q', q.trim());
    if (sortBy) params.append('sortBy', sortBy);
    if (inStock !== undefined && inStock !== '') params.append('inStock', inStock);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);
    if (status && status !== 'All') params.append('status', status);
    if (includeInactive) params.append('includeInactive', 'true');

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}${queryString}`);

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        return data.products;
      }
    }
  } catch (err) {
    console.warn('[productApi] Backend unavailable, using local catalog fallback:', err.message);
  }

  // Graceful Fallback: filter local catalog in memory
  let result = [...PRODUCTS];
  if (category && category !== 'All') {
    result = result.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.brand && p.brand.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term)) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(term)) ||
        (p.subCategory && p.subCategory.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(term))
    );
  }
  if (inStock !== undefined && inStock !== '') {
    const stockBool = inStock === 'true' || inStock === true;
    result = result.filter((p) => p.inStock === stockBool);
  }

  // Local sorting
  if (sortBy === 'price-low') {
    result.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price-high') {
    result.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'rating') {
    result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortBy === 'popular') {
    result.sort(
      (a, b) =>
        (b.popular === a.popular
          ? (b.reviewCount || b.reviewsCount || 0) - (a.reviewCount || a.reviewsCount || 0)
          : (b.popular ? 1 : 0) - (a.popular ? 1 : 0))
    );
  } else if (sortBy === 'newest') {
    result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (sortBy === 'featured') {
    result.sort((a, b) => (b.featured === a.featured ? 0 : b.featured ? 1 : -1));
  }

  return result;
}

/**
 * Fetch a single product by ID from API with fallback to local catalog
 */
export async function fetchProductById(id) {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.product) {
        return data.product;
      }
    }
  } catch (err) {
    console.warn('[productApi] Backend unavailable, using local product lookup:', err.message);
  }

  return getLocalProductById(id) || null;
}

/**
 * Fetch categories with product counts
 */
export async function fetchCategories() {
  try {
    const res = await fetch(getApiUrl('/api/categories'));
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        return data.categories;
      }
    }
  } catch (err) {
    console.warn('[productApi] Backend categories unavailable, using local fallback:', err.message);
  }

  // Local fallback: dynamic aggregation from local PRODUCTS
  const catMap = new Map();
  PRODUCTS.forEach((p) => {
    if (p.category) {
      const count = catMap.get(p.category) || 0;
      catMap.set(p.category, count + 1);
    }
  });
  return Array.from(catMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));
}

/**
 * Create a new product (Admin - Protected)
 */
export async function createProduct(productData) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(productData),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create product');
  }
  return data.product;
}

/**
 * Update existing product (Admin - Protected)
 */
export async function updateProduct(id, updates) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update product');
  }
  return data.product;
}

/**
 * Fast stock updater (Admin - Protected)
 */
export async function updateProductStock(id, stockQuantity) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ stockQuantity: Number(stockQuantity) }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update stock');
  }
  return data.product;
}

/**
 * Fast status updater (Admin - Protected)
 * @param {string} id
 * @param {'active' | 'inactive'} status
 */
export async function updateProductStatus(id, status) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update product status');
  }
  return data.product;
}

/**
 * Delete product (Admin - Protected)
 */
export async function deleteProduct(id) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete product');
  }
  return data.product;
}

/**
 * Upload product image from computer (Admin - Protected)
 * @param {File} file
 * @returns {Promise<string>} Uploaded image URL (e.g. /uploads/product-xxx.jpg)
 */
export async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${API_BASE}/upload-image`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload image');
  }
  return data.url || data.image;
}


