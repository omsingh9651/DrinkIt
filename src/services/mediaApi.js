import { getApiUrl } from './apiConfig';
import { getAdminAuthHeaders } from './adminAuthApi';

const API_BASE = getApiUrl('/api/admin/media');

/**
 * Fetch all media assets
 */
export async function fetchAdminMedia({ search = '', source = 'all' } = {}) {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  if (source && source !== 'all') params.append('source', source);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}${qs}`, {
    headers,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch media assets.');
  }
  return data.data || [];
}

/**
 * Upload image file via FormData
 */
export async function uploadMediaFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to upload image file.');
  }
  return data.data;
}

/**
 * Add external image URL
 */
export async function addExternalMediaUrl(mediaData) {
  const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/url`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(mediaData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to register image URL.');
  }
  return data.data;
}

/**
 * Delete media asset
 */
export async function deleteMedia(id) {
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete media asset.');
  }
  return data;
}

