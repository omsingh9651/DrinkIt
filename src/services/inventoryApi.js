const API_BASE = '/api/admin/inventory';

/**
 * Fetch inventory summary KPI metrics
 * @param {number} threshold
 */
export async function fetchInventorySummary(threshold = 5) {
  const res = await fetch(`${API_BASE}/summary?threshold=${encodeURIComponent(threshold)}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch inventory summary.');
  }

  return data.summary;
}

/**
 * Fetch inventory items with status, search, and category filtering
 */
export async function fetchInventoryItems({ threshold = 5, status = 'All', category = 'All', q = '', sortBy = '' } = {}) {
  const params = new URLSearchParams();
  if (threshold !== undefined) params.append('threshold', threshold);
  if (status && status !== 'All') params.append('status', status);
  if (category && category !== 'All') params.append('category', category);
  if (q && q.trim()) params.append('q', q.trim());
  if (sortBy) params.append('sortBy', sortBy);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/items${qs}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch inventory items.');
  }

  return data.items || [];
}

/**
 * Adjust stock for a product safely
 * @param {Object} payload
 * @param {string} payload.productId
 * @param {number} payload.quantity
 * @param {'delta' | 'set'} payload.adjustmentType
 * @param {string} payload.reason
 */
export async function adjustProductStock({ productId, quantity, adjustmentType = 'delta', reason }) {
  const res = await fetch(`${API_BASE}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      productId,
      quantity,
      adjustmentType,
      reason,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to adjust product stock.');
  }

  return { product: data.product, log: data.log };
}

/**
 * Fetch stock audit history logs
 * @param {Object} params
 * @param {string} [params.productId]
 * @param {string} [params.type]
 * @param {number} [params.limit]
 * @param {number} [params.skip]
 */
export async function fetchStockHistory({ productId = '', type = '', category = '', search = '', limit = 50, skip = 0 } = {}) {
  const params = new URLSearchParams();
  if (productId) params.append('productId', productId);
  if (type && type !== 'ALL') params.append('type', type);
  if (category && category !== 'All') params.append('category', category);
  if (search && search.trim()) params.append('search', search.trim());
  if (limit) params.append('limit', limit);
  if (skip) params.append('skip', skip);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/history${qs}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch stock history.');
  }

  return {
    total: data.total || 0,
    metrics: data.metrics || {
      totalEvents: 0,
      restockCount: 0,
      orderCount: 0,
      cancelCount: 0,
      netDelta: 0,
    },
    logs: data.logs || [],
  };
}

