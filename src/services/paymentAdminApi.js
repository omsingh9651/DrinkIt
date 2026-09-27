import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl('/api/admin/payments');

/**
 * Fetch all payments with filtering and financial metrics
 */
export async function fetchAdminPayments({
  status = 'ALL',
  method = 'ALL',
  search = '',
  startDate = '',
  endDate = '',
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.append('status', status);
  if (method && method !== 'ALL') params.append('method', method);
  if (search && search.trim()) params.append('search', search.trim());
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}${qs}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch payment records.');
  }

  return {
    payments: data.payments || [],
    total: data.total || 0,
    page: data.page || 1,
    limit: data.limit || 20,
    totalPages: data.totalPages || 1,
    metrics: data.metrics || {
      totalVolume: 0,
      successfulCount: 0,
      pendingCount: 0,
      refundedCount: 0,
      failedCount: 0,
      averageOrderValue: 0,
      totalTransactions: 0,
    },
  };
}

/**
 * Refund an order payment
 */
export async function refundOrderPayment(orderId, reason = '') {
  const res = await fetch(`${API_BASE}/${orderId}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to process refund.');
  }

  return data;
}

