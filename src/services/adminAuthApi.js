/**
 * DrinkIt Admin Authentication Service
 *
 * Dedicated client for administrator authentication.
 * Sends HTTP-only credentials with all requests.
 */

import { getApiUrl } from './apiConfig';

const ADMIN_AUTH_BASE = getApiUrl('/api/admin/auth');

export const ADMIN_TOKEN_KEY = 'admin_token';
export const ADMIN_USER_KEY = 'drinkit_admin_user';

/**
 * Retrieve stored admin JWT token
 */
export function getAdminToken() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!raw) return null;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Persist admin JWT token to storage
 */
export function setAdminToken(token) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

/**
 * Remove admin JWT token and admin user payload from storage
 */
export function removeAdminToken() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

/**
 * Helper to build headers including Authorization: Bearer <valid-admin-jwt>
 * @param {Object} customHeaders
 * @returns {Object}
 */
export function getAdminAuthHeaders(customHeaders = {}) {
  const token = getAdminToken();
  const headers = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Handle API responses and uniform error parsing
 */
async function handleResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned unexpected response (${res.status}).`);
  }

  if (!res.ok || data.success === false) {
    const errorMsg = data.error || data.message || 'Admin authentication request failed.';
    const err = new Error(errorMsg);
    err.status = res.status;
    if (res.status === 401 || res.status === 403) {
      removeAdminToken();
    }
    throw err;
  }

  return data;
}

/**
 * Sign in as administrator
 *
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ success: boolean, token?: string, admin: { email: string, role: string } }>}
 */
export async function loginAdmin({ email, password }) {
  const res = await fetch(`${ADMIN_AUTH_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await handleResponse(res);
  if (data?.token) {
    setAdminToken(data.token);
  }
  if (data?.admin) {
    try {
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.admin));
    } catch {
      // Ignore storage errors
    }
  }
  return data;
}

/**
 * Sign out administrator (clears HTTP-only cookie and stored token)
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function logoutAdmin() {
  const headers = getAdminAuthHeaders();
  try {
    const res = await fetch(`${ADMIN_AUTH_BASE}/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    return await handleResponse(res);
  } finally {
    removeAdminToken();
  }
}

/**
 * Fetch current authenticated administrator profile
 *
 * @returns {Promise<{ success: boolean, admin: { email: string, role: string } }>}
 */
export async function getAdminMe() {
  const headers = getAdminAuthHeaders();
  const res = await fetch(`${ADMIN_AUTH_BASE}/me`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse(res);
}
