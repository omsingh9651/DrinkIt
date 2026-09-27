const API_BASE = '/api/admin/coupons';
const PUBLIC_API = '/api/coupons';

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
  const res = await fetch(`${API_BASE}${qs}`, {
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
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete coupon.');
  }

  return data;
}

