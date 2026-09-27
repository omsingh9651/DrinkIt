import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl('/api/admin/categories');
const PUBLIC_API = getApiUrl('/api/categories');

/**
 * Fetch all categories for public customer store
 */
export async function fetchPublicCategories() {
  const res = await fetch(PUBLIC_API);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch categories.');
  }
  return data.data || [];
}

/**
 * Fetch all categories for Admin (includes inactive & product counts)
 */
export async function fetchAdminCategories() {
  const res = await fetch(API_BASE, {
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch admin categories.');
  }
  return data.data || [];
}

/**
 * Create a new category
 */
export async function createCategory(categoryData) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(categoryData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to create category.');
  }
  return data.data;
}

/**
 * Update an existing category
 */
export async function updateCategory(id, categoryData) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(categoryData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to update category.');
  }
  return data.data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete category.');
  }
  return data;
}

