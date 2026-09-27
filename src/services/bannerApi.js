import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl('/api/admin/banners');
const PUBLIC_API = getApiUrl('/api/banners');

/**
 * Fetch active promotional banners for storefront homepage
 */
export async function fetchActiveBanners() {
  const res = await fetch(PUBLIC_API);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch active banners.');
  }
  return data.data || [];
}

/**
 * Fetch all banners for Admin with optional search and status filter
 */
export async function fetchAdminBanners({ search = '', status = 'ALL', page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status && status !== 'ALL') params.append('status', status);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const res = await fetch(`${API_BASE}?${params.toString()}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch banners.');
  }

  return data;
}

/**
 * Create a new banner
 */
export async function createBanner(payload) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create banner.');
  }

  return data.data;
}

/**
 * Update an existing banner
 */
export async function updateBanner(id, payload) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update banner.');
  }

  return data.data;
}

/**
 * Delete a banner
 */
export async function deleteBanner(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete banner.');
  }

  return data.data;
}

