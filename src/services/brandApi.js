import { getApiUrl } from './apiConfig';
import { getAdminAuthHeaders } from './adminAuthApi';

const API_BASE = getApiUrl('/api/admin/brands');
const PUBLIC_API = getApiUrl('/api/brands');

/**
 * Fetch all brands for public store
 */
export async function fetchPublicBrands() {
  const res = await fetch(PUBLIC_API);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch brands.');
  }
  return data.data || [];
}

/**
 * Fetch all brands for Admin (includes inactive & product counts)
 */
export async function fetchAdminBrands() {
  const headers = getAdminAuthHeaders();
  const res = await fetch(API_BASE, {
    headers,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch admin brands.');
  }
  return data.data || [];
}

/**
 * Create a new brand
 */
export async function createBrand(brandData) {
  const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(brandData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to create brand.');
  }
  return data.data;
}

/**
 * Update an existing brand
 */
export async function updateBrand(id, brandData) {
  const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(brandData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to update brand.');
  }
  return data.data;
}

/**
 * Delete a brand
 */
export async function deleteBrand(id) {
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete brand.');
  }
  return data;
}

