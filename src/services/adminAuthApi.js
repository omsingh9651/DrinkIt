/**
 * DrinkIt Admin Authentication Service
 *
 * Dedicated client for administrator authentication.
 * Sends HTTP-only credentials with all requests.
 */

import { getApiUrl } from './apiConfig';

const ADMIN_AUTH_BASE = getApiUrl('/api/admin/auth');

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
 * @returns {Promise<{ success: boolean, admin: { email: string, role: string } }>}
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

  return handleResponse(res);
}

/**
 * Sign out administrator (clears HTTP-only cookie)
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function logoutAdmin() {
  const res = await fetch(`${ADMIN_AUTH_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  return handleResponse(res);
}

/**
 * Fetch current authenticated administrator profile
 *
 * @returns {Promise<{ success: boolean, admin: { email: string, role: string } }>}
 */
export async function getAdminMe() {
  const res = await fetch(`${ADMIN_AUTH_BASE}/me`, {
    method: 'GET',
    credentials: 'include',
  });

  return handleResponse(res);
}
