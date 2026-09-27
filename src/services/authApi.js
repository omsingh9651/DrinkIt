/**
 * DrinkIt Frontend Authentication Service
 *
 * Communicates ONLY with DrinkIt's local backend API (/api/auth/*).
 * Zero credentials, authkeys, or OTP secrets are handled in the browser.
 */

/**
 * Safely parse JSON from fetch response with friendly error messages
 */
async function safeFetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (netErr) {
    throw new Error(
      `Cannot connect to DrinkIt backend server. Please verify the server is running on port 5001 (${netErr.message}).`,
      { cause: netErr }
    );
  }

  const rawText = await res.text();

  if (!rawText || !rawText.trim()) {
    if (res.status === 502) {
      throw new Error(
        'Cannot reach DrinkIt backend server (502 Bad Gateway). Please make sure "npm run server" is running on port 5001.'
      );
    }
    if (res.status === 504) {
      throw new Error('Backend gateway timeout (504). Please try again in a moment.');
    }
    throw new Error(`Server returned an empty response (HTTP ${res.status}).`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    // If not JSON (e.g. proxy HTML error page)
    const cleanSnippet = rawText.slice(0, 120).replace(/<[^>]*>?/gm, '').trim();
    if (res.status === 502 || res.status === 504) {
      throw new Error(
        'Backend connection failed (502). Please verify the DrinkIt server is running on port 5001.'
      );
    }
    throw new Error(cleanSnippet || `Unexpected server response format (HTTP ${res.status}).`);
  }

  if (!res.ok || data.success === false) {
    const errorMsg = data.error || data.message || 'Request failed. Please try again.';
    const error = new Error(errorMsg);
    error.status = res.status;
    error.statusCode = res.status;
    error.retryAfter = data.retryAfter;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Check whether backend has MSG91 properly configured
 */
export async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    if (!res.ok) return { isConfigured: false };
    const rawText = await res.text();
    const data = JSON.parse(rawText);
    return { isConfigured: Boolean(data.isConfigured) };
  } catch (err) {
    console.warn('Could not connect to DrinkIt backend auth status:', err.message);
    return { isConfigured: false, error: err.message };
  }
}

/**
 * Request real SMS OTP via backend
 *
 * @param {string} mobileNumber - 10-digit Indian mobile number
 * @returns {Promise<{ success: boolean, reqId?: string, message: string }>}
 */
export async function sendOtp(mobileNumber) {
  const cleanMobile = String(mobileNumber).replace(/\D/g, '').slice(-10);

  return safeFetchJson('/api/auth/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mobile: cleanMobile }),
  });
}

/**
 * Verify OTP entered by user via backend
 *
 * @param {Object} params
 * @param {string} params.mobileNumber - 10-digit Indian mobile number
 * @param {string} params.otp - 4-digit OTP code
 * @param {string} [params.reqId] - Request ID from sendOtp response
 * @returns {Promise<{ success: boolean, user: Object, message: string }>}
 */
export async function verifyOtp({ mobileNumber, otp, reqId }) {
  const cleanMobile = String(mobileNumber).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp).trim();

  return safeFetchJson('/api/auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile: cleanMobile,
      otp: cleanOtp,
      reqId: reqId || null,
    }),
  });
}

/**
 * Resend OTP via backend
 *
 * @param {Object} params
 * @param {string} params.mobileNumber - 10-digit Indian mobile number
 * @param {string} [params.reqId] - Request ID from initial sendOtp response
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function retryOtp({ mobileNumber, reqId }) {
  const cleanMobile = String(mobileNumber).replace(/\D/g, '').slice(-10);

  return safeFetchJson('/api/auth/retry-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mobile: cleanMobile,
      reqId: reqId || null,
    }),
  });
}

/**
 * Validate current customer session with backend using signed JWT
 */
export async function getMe() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('drinkit_customer_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return safeFetchJson('/api/auth/me', {
    method: 'GET',
    headers,
    credentials: 'include',
  });
}

/**
 * Terminate customer session
 */
export async function logoutCustomer() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('drinkit_customer_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return safeFetchJson('/api/auth/logout', {
    method: 'POST',
    headers,
    credentials: 'include',
  });
}
