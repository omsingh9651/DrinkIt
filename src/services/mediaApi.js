const API_BASE = '/api/admin/media';

/**
 * Fetch all media assets
 */
export async function fetchAdminMedia({ search = '', source = 'all' } = {}) {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  if (source && source !== 'all') params.append('source', source);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}${qs}`, {
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

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
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
  const res = await fetch(`${API_BASE}/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete media asset.');
  }
  return data;
}

