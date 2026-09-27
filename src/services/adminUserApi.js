import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl('/api/admin/admin-users');

/**
 * Fetch all admin users
 */
export async function fetchAdminUsers() {
  const res = await fetch(API_BASE, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch admin users.');
  }

  return data.data || [];
}

/**
 * Create new admin user
 */
export async function createAdminUser(payload) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create admin user.');
  }

  return data.data;
}

/**
 * Update admin user role, status or password
 */
export async function updateAdminUser(id, payload) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update admin user.');
  }

  return data.data;
}

/**
 * Delete admin user
 */
export async function deleteAdminUser(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete admin user.');
  }

  return data.data;
}

