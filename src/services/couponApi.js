import { getApiUrl } from './apiConfig';
import { getAdminAuthHeaders } from './adminAuthApi';

const API_BASE = getApiUrl('/api/admin/coupons');
const PUBLIC_API = getApiUrl('/api/coupons');

/**
 * Validate coupon code (Customer storefront checkout)
 */
export async function validateCouponCode(code, subtotal, customerPhone = '') {
  const res = await fetch(`${PUBLIC_API}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal, customerPhone }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Invalid coupon code.');
  }

  return data.data;
}

/**
 * Fetch available coupons for storefront promotion banner
 */
export async function fetchAvailableCoupons() {
  const res = await fetch(`${PUBLIC_API}/available`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch available coupons.');
  }
  return data.data || [];
}

/**
 * Fetch all coupons for Admin
 */
export async function fetchAdminCoupons(search = '') {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}${qs}`, {
    headers,
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch coupons.');
  }

  return data.data || [];
}

/**
 * Create new coupon
 */
export async function createCoupon(couponData) {
  const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(couponData),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to create coupon.');
  }

  return data.data;
}

/**
 * Update existing coupon
 */
export async function updateCoupon(id, couponData) {
  const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(couponData),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to update coupon.');
  }

  return data.data;
}

/**
 * Delete a coupon
 */
export async function deleteCoupon(id) {
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete coupon.');
  }

  return data;
}

