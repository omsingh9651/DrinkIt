/**
 * DrinkIt Frontend API & WebSocket Configuration
 *
 * Configured for production deployment on Vercel and backend on Render:
 * - Production Backend: https://drinkit-6oms.onrender.com
 * - Development: Falls back to empty string ('') to leverage Vite's proxy in vite.config.js
 * - Normalizes URLs to prevent '/api/api/...' or omitting '/api'
 */

const PROD_DEFAULT_BACKEND = 'https://drinkit-6oms.onrender.com';

// Check if running in Vite local development mode
const isDev = Boolean(
  import.meta.env.DEV ||
  (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
);

const rawApiBase = import.meta.env.VITE_API_BASE_URL;

// Normalize API base:
// In dev: if not set, default to '' (routes via Vite proxy to localhost:5001).
// In prod: if not set, default to Render backend URL.
// Strip trailing slashes and any trailing '/api' to prevent duplicate /api/api
function resolveBaseUrl() {
  const base = rawApiBase && rawApiBase.trim()
    ? rawApiBase.trim()
    : (isDev ? '' : PROD_DEFAULT_BACKEND);

  return base.replace(/\/+$/, '').replace(/\/api$/, '');
}

export const API_BASE_URL = resolveBaseUrl();

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL;
export const SOCKET_URL = rawSocketUrl && rawSocketUrl.trim()
  ? rawSocketUrl.trim().replace(/\/+$/, '')
  : (API_BASE_URL || (isDev ? '/' : PROD_DEFAULT_BACKEND));

/**
 * Build a full API endpoint URL
 * Guarantees proper /api prefix and eliminates duplicate /api/api/...
 *
 * @param {string} endpoint - e.g. '/api/products' or 'api/auth/status' or '/auth/status'
 * @returns {string} - Complete API URL
 */
export function getApiUrl(endpoint = '') {
  if (!endpoint) return API_BASE_URL;

  // Clean leading slash
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Ensure path starts with /api
  if (!path.startsWith('/api/') && path !== '/api') {
    path = `/api${path}`;
  }

  // Prevent duplicate /api/api
  path = path.replace(/^\/api\/api(\/|$)/, '/api$1');

  // If in dev proxy mode (empty base), return the relative path
  if (!API_BASE_URL) {
    return path;
  }

  // Base without trailing slash + path starting with /api
  const cleanBase = API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${cleanBase}${path}`;
}

/**
 * Format asset / upload URLs so backend-hosted media resolves correctly in production
 *
 * @param {string} url - Image or asset path
 * @returns {string} - Full asset URL
 */
export function getAssetUrl(url = '') {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('/uploads/')) {
    const base = API_BASE_URL || (isDev ? '' : PROD_DEFAULT_BACKEND);
    return base ? `${base.replace(/\/+$/, '')}${url}` : url;
  }
  return url;
}
