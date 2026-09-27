const API_BASE = '/api/admin/activity-logs';

/**
 * Fetch centralized activity logs with search, module filter and pagination
 */
export async function fetchActivityLogs({ module = 'ALL', search = '', startDate = '', endDate = '', page = 1, limit = 25 } = {}) {
  const params = new URLSearchParams();
  if (module && module !== 'ALL') params.append('module', module);
  if (search) params.append('search', search);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const res = await fetch(`${API_BASE}?${params.toString()}`, {
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to fetch activity logs.');
  }

  return data;
}

