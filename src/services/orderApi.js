import { getApiUrl } from './apiConfig';

function getHeaders(customerPhone) {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('drinkit_customer_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (customerPhone) {
    const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
    headers['x-drinkit-customer-phone'] = cleanPhone;
  }
  return headers;
}

/**
 * Helper to safely extract JSON with descriptive errors
 */
async function parseResponse(res, context = 'Order API') {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${context}: Unexpected server response format (HTTP ${res.status}).`);
  }

  if (!res.ok || data.success === false) {
    if (res.status === 401 && typeof window !== 'undefined') {
      try {
        localStorage.removeItem('drinkit_customer_token');
        localStorage.removeItem('drinkit_user_session');
        window.dispatchEvent(new Event('drinkit:auth-expired'));
      } catch {
        // Ignore storage errors
      }
    }
    throw new Error(data.error || data.message || `${context} request failed (HTTP ${res.status}).`);
  }

  return data;
}

/**
 * Customer: Place a new order
 */
export async function createOrder(orderPayload, customerPhone) {
  const res = await fetch(getApiUrl('/api/orders'), {
    method: 'POST',
    headers: getHeaders(customerPhone),
    credentials: 'include',
    body: JSON.stringify(orderPayload),
  });

  return parseResponse(res, 'Place Order');
}

/**
 * Customer: Fetch order history for the logged-in customer
 */
export async function getMyOrders(customerPhone) {
  const res = await fetch(getApiUrl('/api/orders/my-orders'), {
    method: 'GET',
    headers: getHeaders(customerPhone),
    credentials: 'include',
  });

  const data = await parseResponse(res, 'Fetch My Orders');
  return data.orders || [];
}

/**
 * Customer / Admin: Fetch single order by ID
 */
export async function getOrderById(orderId, customerPhone) {
  const res = await fetch(getApiUrl(`/api/orders/${orderId}`), {
    method: 'GET',
    headers: getHeaders(customerPhone),
    credentials: 'include',
  });

  const data = await parseResponse(res, 'Fetch Order');
  return data.order || null;
}

/**
 * Customer: Cancel pending/confirmed order
 */
export async function cancelCustomerOrder(orderId, customerPhone, reason = '') {
  const res = await fetch(getApiUrl(`/api/orders/${orderId}/cancel`), {
    method: 'PATCH',
    headers: getHeaders(customerPhone),
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  const data = await parseResponse(res, 'Cancel Order');
  return data.order;
}

/**
 * Admin: Fetch all store orders with filtering and pagination
 */
export async function fetchAdminOrders({
  status = 'ALL',
  paymentStatus = 'ALL',
  search = '',
  startDate = '',
  endDate = '',
  page = 1,
  limit = 10,
} = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.set('status', status);
  if (paymentStatus && paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus);
  if (search && search.trim()) params.set('search', search.trim());
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const res = await fetch(getApiUrl(`/api/admin/orders?${params.toString()}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const data = await parseResponse(res, 'Admin Fetch Orders');
  return {
    orders: data.orders || [],
    total: data.total !== undefined ? data.total : (data.orders || []).length,
    page: data.page || 1,
    limit: data.limit || 10,
    totalPages: data.totalPages || 1,
    metrics: data.metrics || null,
  };
}

/**
 * Admin: Fetch full order details
 */
export async function fetchAdminOrderById(orderId) {
  const res = await fetch(getApiUrl(`/api/admin/orders/${orderId}`), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const data = await parseResponse(res, 'Admin Fetch Order Detail');
  return data.order || null;
}

/**
 * Admin: Update order status & payment status
 */
export async function updateAdminOrderStatus(orderId, { orderStatus, paymentStatus, note }) {
  const res = await fetch(getApiUrl(`/api/admin/orders/${orderId}/status`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ orderStatus, paymentStatus, note }),
  });

  return parseResponse(res, 'Admin Update Order Status');
}

/**
 * Fetch list of DrinkIt pickup store hubs
 */
export async function fetchDeliveryStores() {
  const res = await fetch(getApiUrl('/api/delivery/stores'), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await parseResponse(res, 'Fetch Delivery Stores');
  return data.stores || [];
}

/**
 * Fetch list of delivery partners
 */
export async function fetchDeliveryPartners() {
  const res = await fetch(getApiUrl('/api/delivery/partners'), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const data = await parseResponse(res, 'Fetch Delivery Partners');
  return data.partners || [];
}

/**
 * Assign delivery partner and/or store hub to order
 */
export async function assignDeliveryPartnerAndStore(orderId, { partnerId, storeId }) {
  const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/assign`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ partnerId, storeId }),
  });
  const data = await parseResponse(res, 'Assign Delivery Order');
  return data.order;
}

/**
 * Reset tracking coordinates back to store pickup
 */
export async function resetDeliveryLocation(orderId) {
  const res = await fetch(getApiUrl(`/api/delivery/orders/${orderId}/reset`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const data = await parseResponse(res, 'Reset Delivery Location');
  return data.order;
}

