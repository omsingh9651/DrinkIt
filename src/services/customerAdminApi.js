import { getApiUrl } from './apiConfig';
import { getAdminAuthHeaders } from './adminAuthApi';

const API_BASE = getApiUrl('/api/admin/customers');

/**
 * Fetch customers list with search, status filters, spend aggregations and metrics
 */
export async function fetchAdminCustomers({ search = '', status = 'ALL', page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status && status !== 'ALL') params.append('status', status);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}?${params.toString()}`, {
    headers,
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch customers.');
  }

  return data;
}

export async function fetchCustomerDetails(phone) {
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}/${encodeURIComponent(phone)}`, {
    headers,
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch customer profile.');
  }

  return data.data;
}

/**
 * Activate or deactivate customer account
 */
export async function updateCustomerStatus(phone, isActive) {
  const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/${encodeURIComponent(phone)}/status`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify({ isActive }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update customer status.');
  }

  return data.data;
}

