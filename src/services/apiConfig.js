/**
 * DrinkIt Frontend API & WebSocket Configuration
 *
 * Configured for production deployment on Vercel and backend on Render:
 * - In Production: VITE_API_BASE_URL points to the Render backend service (e.g. https://<backend>.onrender.com)
 * - In Development: If VITE_API_BASE_URL is not set, defaults to empty string ('') which
 *   seamlessly routes via Vite's proxy in vite.config.js to http://127.0.0.1:5001.
 * - If VITE_API_BASE_URL is explicitly set (e.g. http://127.0.0.1:5001), it uses that directly.
 */

const rawApiBase = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL = rawApiBase ? rawApiBase.trim().replace(/\/+$/, '') : '';

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL;
export const SOCKET_URL = rawSocketUrl
  ? rawSocketUrl.trim().replace(/\/+$/, '')
  : (API_BASE_URL || (import.meta.env.DEV ? '/' : 'http://127.0.0.1:5001'));

/**
 * Build a full API endpoint URL
 * @param {string} endpoint - e.g. '/api/products' or 'api/auth/login'
 * @returns {string} - Complete API URL
 */
export function getApiUrl(endpoint = '') {
  if (!endpoint) return API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

/**
 * Format asset / upload URLs so backend-hosted media resolves correctly in production
 * @param {string} url - Image or asset path
 * @returns {string} - Full asset URL
 */
export function getAssetUrl(url = '') {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('/uploads/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}
