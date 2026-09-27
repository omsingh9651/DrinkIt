const API_BASE = '/api/admin/customers';

/**
 * Fetch customers list with search, status filters, spend aggregations and metrics
 */
export async function fetchAdminCustomers({ search = '', status = 'ALL', page = 1, limit = 20 } = {}) {
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
    throw new Error(data.error || 'Failed to fetch customers.');
  }

  return data;
}

/**
 * Fetch detailed customer profile and complete order history
 */
export async function fetchCustomerDetails(phone) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(phone)}`, {
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
  const res = await fetch(`${API_BASE}/${encodeURIComponent(phone)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ isActive }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to update customer status.');
  }

  return data.data;
}

