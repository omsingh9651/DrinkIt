import { getApiUrl } from './apiConfig';

const API_BASE = getApiUrl('/api/admin/reports');

/**
 * Fetch calculated sales analytics for given date range
 */
export async function fetchAnalytics({ range = '30d', startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (range) params.append('range', range);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_BASE}/analytics?${params.toString()}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch sales analytics.');
  }

  return data.data;
}

/**
 * Download CSV export of orders for given range
 */
export async function downloadOrdersCsv({ range = '30d', startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (range) params.append('range', range);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_BASE}/export?${params.toString()}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to export sales report CSV.');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drinkit_orders_${range}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

