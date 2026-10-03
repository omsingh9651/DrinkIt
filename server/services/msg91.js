import '../config/env.js';

/**
 * Server-side MSG91 OTP Service
 *
 * Uses MSG91_AUTH_KEY strictly on the backend.
 * Never leaks credentials to the frontend.
 */

const MSG91_WIDGET_BASE_URL = 'https://control.msg91.com/api/v5/widget';
const MSG91_CONTROL_BASE_URL = 'https://control.msg91.com/api/v5/otp';

export const RATE_LIMIT_MESSAGE = 'Too many OTP attempts. Please try again after 15 minutes.';

/**
 * Custom error class for MSG91 operations with rate limit and authentication metadata
 */
export class Msg91Error extends Error {
  constructor(message, { statusCode = 500, isRateLimit = false, isAuthFailure = false, retryAfter = 900, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'Msg91Error';
    this.statusCode = statusCode;
    this.isRateLimit = isRateLimit;
    this.isAuthFailure = isAuthFailure;
    this.retryAfter = retryAfter;
  }
}

/**
 * Detects if a status code or error text indicates MSG91 rate limiting
 */
export function isRateLimitResponse(status, message = '') {
  if (status === 429) return true;
  const lower = String(message).toLowerCase();
  return (
    lower.includes('too many otp') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('wait 15 minutes') ||
    (lower.includes('wait') && lower.includes('minute')) ||
    (lower.includes('ip address') && lower.includes('wait'))
  );
}

/**
 * Detects if a status code or error text indicates MSG91 authentication failure
 */
export function isAuthFailureResponse(code, message = '') {
  if (String(code) === '201' || String(code) === '401') return true;
  const lower = String(message).toLowerCase();
  return (
    lower.includes('authenticationfailure') ||
    lower.includes('authentication failure') ||
    lower.includes('invalid authkey') ||
    lower.includes('authkey not found') ||
    lower.includes('unauthorized')
  );
}

/**
 * Formats Indian mobile number to standard international format (91XXXXXXXXXX)
 */
export function formatIndianMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  const tenDigit = digits.slice(-10);
  return tenDigit.length === 10 ? `91${tenDigit}` : digits;
}

/**
 * Helper to safely extract and sanitize MSG91 credentials from environment.
 * Handles alternative variable names, accidental whitespace, or enclosing quotes.
 */
export function getMsg91Credentials() {
  const rawAuthKey =
    process.env.MSG91_AUTH_KEY ||
    process.env.MSG91_AUTHKEY ||
    process.env.MSG91_KEY ||
    '';
  const rawWidgetId =
    process.env.MSG91_WIDGET_ID ||
    process.env.MSG91_WIDGETID ||
    '';
  const rawTokenAuth =
    process.env.MSG91_TOKEN_AUTH ||
    process.env.MSG91_TOKEN ||
    process.env.MSG91_AUTH_TOKEN ||
    '';
  const rawTemplateId =
    process.env.MSG91_TEMPLATE_ID ||
    process.env.MSG91_TEMPLATEID ||
    '';

  const clean = (val) =>
    String(val || '')
      .trim()
      .replace(/^[\\"'`]+|[\\"'`]+$/g, '')
      .trim();

  const authKey = clean(rawAuthKey);
  const widgetId = clean(rawWidgetId);
  let tokenAuth = clean(rawTokenAuth);
  const templateId = clean(rawTemplateId);

  // If authKey is formatted as a JWT (3 segments separated by dots), it is a widget tokenAuth
  if (!tokenAuth && authKey.split('.').length === 3) {
    tokenAuth = authKey;
  }

  return {
    authKey,
    widgetId,
    tokenAuth,
    templateId,
  };
}

/**
 * Validates whether MSG91 credentials are configured in server environment
 */
export function isMsg91Configured() {
  const { authKey, widgetId, templateId, tokenAuth } = getMsg91Credentials();
  const hasAuth =
    (Boolean(authKey) && authKey !== 'your_msg91_master_authkey') ||
    Boolean(tokenAuth);
  const hasTarget =
    (Boolean(widgetId) && widgetId !== 'your_msg91_widget_id') ||
    Boolean(templateId);

  return Boolean(hasAuth && hasTarget);
}

/**
 * Logs safe diagnostics without ever exposing secret values
 */
export function logMsg91Diagnostics() {
  const { authKey, widgetId, tokenAuth } = getMsg91Credentials();
  const isAuthConfigured = Boolean((authKey && authKey.length > 0) || (tokenAuth && tokenAuth.length > 0));
  const isWidgetConfigured = Boolean(widgetId && widgetId.length > 0);

  console.log(`MSG91_AUTH_KEY configured: ${isAuthConfigured}`);
  console.log(`MSG91_WIDGET_ID configured: ${isWidgetConfigured}`);
  console.log(`MSG91 endpoint host: control.msg91.com`);
}

/**
 * Helper to perform fetch to MSG91 with descriptive network error reporting
 */
async function msg91Fetch(url, options = {}, context = 'MSG91 API') {
  try {
    return await fetch(url, options);
  } catch (err) {
    const causeMsg = err.cause ? (err.cause.code || err.cause.message) : '';
    const detail = causeMsg ? `${err.message} (${causeMsg})` : err.message;
    console.error(`[${context}] Network failure:`, detail);
    throw new Error(`Unable to reach MSG91 servers: ${detail}`, { cause: err });
  }
}

/**
 * Safely parse JSON response from fetch, with detailed error reporting for empty or non-JSON payloads.
 */
async function safeParseResponse(response, contextLabel = 'MSG91') {
  const rawText = await response.text();

  if (response.status === 429 || isRateLimitResponse(response.status, rawText)) {
    throw new Msg91Error(RATE_LIMIT_MESSAGE, {
      statusCode: 429,
      isRateLimit: true,
      retryAfter: 900,
    });
  }

  if (!rawText || !rawText.trim()) {
    throw new Error(
      `${contextLabel} returned an empty response (HTTP ${response.status} ${response.statusText}).`
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const preview = rawText.slice(0, 150).replace(/<[^>]*>?/gm, '').trim();
    throw new Error(
      `${contextLabel} returned non-JSON response (HTTP ${response.status}): ${preview || 'Unexpected response format'}`
    );
  }
}

/**
 * Send real SMS OTP to user's mobile number
 *
 * @param {string} mobileNumber - 10 digit Indian number or full format (e.g. 9876543210 or 919876543210)
 * @returns {Promise<{ success: boolean, reqId?: string, message: string }>}
 */
export async function sendOtp(mobileNumber) {
  const { authKey, widgetId, templateId, tokenAuth } = getMsg91Credentials();

  if (!authKey && !tokenAuth) {
    throw new Error('MSG91_AUTH_KEY is not configured on the backend server.');
  }

  const formattedNumber = formatIndianMobile(mobileNumber);

  // Approach 1: MSG91 OTP Widget API (control.msg91.com/api/v5/widget/sendOtp)
  if (widgetId) {
    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authKey ? { authkey: authKey } : {}),
    };

    const requestBody = {
      widgetId,
      identifier: formattedNumber,
      ...(tokenAuth ? { tokenAuth } : {}),
    };

    const response = await msg91Fetch(
      `${MSG91_WIDGET_BASE_URL}/sendOtp`,
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      },
      'MSG91 Widget sendOtp'
    );

    const data = await safeParseResponse(response, 'MSG91 Widget sendOtp');

    const isSuccess =
      response.ok &&
      data &&
      (data.type === 'success' || data.status === 'success') &&
      data.type !== 'error' &&
      data.status !== 'error' &&
      !data.hasError &&
      String(data.code || '200') === '200';

    if (!isSuccess) {
      const errMsg =
        data.message || data.error || (typeof data === 'string' ? data : 'Failed to send OTP via MSG91.');

      if (isRateLimitResponse(response.status, errMsg)) {
        throw new Msg91Error(RATE_LIMIT_MESSAGE, {
          statusCode: 429,
          isRateLimit: true,
          retryAfter: 900,
        });
      }

      if (isAuthFailureResponse(data.code, errMsg)) {
        console.error('[MSG91 Error] Authentication failure (code 201). Safe diagnostics:');
        logMsg91Diagnostics();
        console.error('[MSG91 Error] Please verify:');
        console.error(' 1. MSG91_AUTH_KEY and MSG91_WIDGET_ID in Render match your MSG91 dashboard.');
        console.error(' 2. In MSG91 Dashboard -> Authkey Settings, verify IP whitelisting is not blocking Render outbound IPs.');
        throw new Msg91Error('MSG91 authentication failure. Please check server SMS configuration.', {
          statusCode: 502,
          isAuthFailure: true,
          cause: new Error(errMsg),
        });
      }

      throw new Error(errMsg);
    }

    // Extract requestId (in MSG91 Widget sendOtp, the hex request ID is in data.message)
    let reqId =
      data.reqId ||
      data.requestId ||
      (typeof data.message === 'string' && /^[a-z0-9]{10,}$/i.test(data.message.trim()) ? data.message.trim() : null) ||
      (typeof data.data === 'object' && data.data ? data.data.reqId || data.data.requestId : null) ||
      (typeof data.message === 'object' && data.message ? data.message.reqId : null);

    const userMessage =
      typeof data.message === 'string' && !reqId
        ? data.message
        : 'OTP sent successfully to your mobile.';

    return {
      success: true,
      reqId: reqId || null,
      message: userMessage,
    };
  }

  // Approach 2: Standard MSG91 OTP API (Only if templateId configured without widgetId)
  if (templateId) {
    const response = await msg91Fetch(
      `${MSG91_CONTROL_BASE_URL}`,
      {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          mobile: formattedNumber,
        }),
      },
      'MSG91 Control sendOtp'
    );

    const data = await safeParseResponse(response, 'MSG91 Control sendOtp');
    if (!response.ok || data.type === 'error') {
      const errMsg = data.message || 'Failed to send OTP via MSG91.';
      if (isRateLimitResponse(response.status, errMsg)) {
        throw new Msg91Error(RATE_LIMIT_MESSAGE, {
          statusCode: 429,
          isRateLimit: true,
          retryAfter: 900,
        });
      }
      throw new Error(errMsg);
    }

    return {
      success: true,
      reqId: data.request_id || null,
      message: data.message || 'OTP sent successfully.',
    };
  }

  throw new Error('Neither MSG91_WIDGET_ID nor MSG91_TEMPLATE_ID is configured.');
}

/**
 * Verify OTP entered by the user
 *
 * @param {Object} params
 * @param {string} params.reqId - Request ID from sendOtp
 * @param {string} params.otp - 4-6 digit OTP code
 * @param {string} params.mobileNumber - User's mobile number
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function verifyOtp({ reqId, otp, mobileNumber }) {
  const { authKey, widgetId, templateId, tokenAuth } = getMsg91Credentials();

  if (!authKey && !tokenAuth) {
    throw new Error('MSG91_AUTH_KEY is not configured on the backend server.');
  }

  const cleanOtp = String(otp || '').trim();
  const formattedNumber = formatIndianMobile(mobileNumber);

  // Approach 1: MSG91 OTP Widget API (control.msg91.com/api/v5/widget/verifyOtp)
  if (widgetId) {
    if (!reqId) {
      throw new Error('Request ID (reqId) is required to verify OTP with MSG91 Widget.');
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authKey ? { authkey: authKey } : {}),
    };

    const requestBody = {
      widgetId,
      reqId: String(reqId).trim(),
      otp: cleanOtp,
      ...(tokenAuth ? { tokenAuth } : {}),
    };

    const response = await msg91Fetch(
      `${MSG91_WIDGET_BASE_URL}/verifyOtp`,
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      },
      'MSG91 Widget verifyOtp'
    );

    const data = await safeParseResponse(response, 'MSG91 Widget verifyOtp');

    const isSuccess =
      response.ok &&
      data &&
      (data.type === 'success' || data.status === 'success') &&
      data.type !== 'error' &&
      data.status !== 'error' &&
      !data.hasError &&
      String(data.code || '200') === '200';

    if (!isSuccess) {
      const errMsg =
        data.message || data.error || 'Invalid or expired OTP. Please check the code and try again.';

      if (isAuthFailureResponse(data.code, errMsg)) {
        console.error('[MSG91 Error] Authentication failure on verifyOtp (code 201).');
        logMsg91Diagnostics();
        throw new Msg91Error('MSG91 authentication failure. Please check server SMS configuration.', {
          statusCode: 502,
          isAuthFailure: true,
          cause: new Error(errMsg),
        });
      }

      throw new Error(errMsg);
    }

    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  }

  // Approach 2: Standard MSG91 OTP API (Only if templateId configured without widgetId)
  if (templateId) {
    const url = new URL(`${MSG91_CONTROL_BASE_URL}/verify`);
    url.searchParams.set('otp', cleanOtp);
    url.searchParams.set('mobile', formattedNumber);

    const response = await msg91Fetch(
      url.toString(),
      {
        method: 'GET',
        headers: {
          authkey: authKey,
        },
      },
      'MSG91 Control verifyOtp'
    );

    const data = await safeParseResponse(response, 'MSG91 Control verifyOtp');

    if (!response.ok || data.type === 'error') {
      throw new Error(data.message || 'Invalid or expired OTP. Please try again.');
    }

    return {
      success: true,
      message: data.message || 'OTP verified successfully.',
    };
  }

  throw new Error('Neither MSG91_WIDGET_ID nor MSG91_TEMPLATE_ID is configured.');
}

/**
 * Resend / Retry OTP
 *
 * @param {Object} params
 * @param {string} params.reqId - Original request ID
 * @param {string} params.mobileNumber - User's mobile number
 * @param {string} [params.retryChannel='11'] - '11' for SMS
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function retryOtp({ reqId, mobileNumber, retryChannel = '11' }) {
  const { authKey, widgetId, templateId, tokenAuth } = getMsg91Credentials();

  if (!authKey && !tokenAuth) {
    throw new Error('MSG91_AUTH_KEY is not configured on the backend server.');
  }

  const formattedNumber = formatIndianMobile(mobileNumber);

  // Approach 1: MSG91 OTP Widget API (control.msg91.com/api/v5/widget/retryOtp)
  if (widgetId) {
    if (!reqId) {
      throw new Error('Request ID (reqId) is required to resend OTP with MSG91 Widget.');
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authKey ? { authkey: authKey } : {}),
    };

    const requestBody = {
      widgetId,
      reqId: String(reqId).trim(),
      retryChannel: String(retryChannel),
      ...(tokenAuth ? { tokenAuth } : {}),
    };

    const response = await msg91Fetch(
      `${MSG91_WIDGET_BASE_URL}/retryOtp`,
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      },
      'MSG91 Widget retryOtp'
    );

    const data = await safeParseResponse(response, 'MSG91 Widget retryOtp');

    const isSuccess =
      response.ok &&
      data &&
      (data.type === 'success' || data.status === 'success') &&
      data.type !== 'error' &&
      data.status !== 'error' &&
      !data.hasError &&
      String(data.code || '200') === '200';

    if (!isSuccess) {
      const errMsg = data.message || data.error || 'Failed to resend OTP. Please try again.';

      if (isRateLimitResponse(response.status, errMsg)) {
        throw new Msg91Error(RATE_LIMIT_MESSAGE, {
          statusCode: 429,
          isRateLimit: true,
          retryAfter: 900,
        });
      }

      if (isAuthFailureResponse(data.code, errMsg)) {
        console.error('[MSG91 Error] Authentication failure on retryOtp (code 201).');
        logMsg91Diagnostics();
        throw new Msg91Error('MSG91 authentication failure. Please check server SMS configuration.', {
          statusCode: 502,
          isAuthFailure: true,
          cause: new Error(errMsg),
        });
      }

      throw new Error(errMsg);
    }

    return {
      success: true,
      message: 'OTP resent successfully.',
    };
  }

  // Approach 2: Standard MSG91 OTP API (Only if templateId configured without widgetId)
  if (templateId) {
    const url = new URL(`${MSG91_CONTROL_BASE_URL}/retry`);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('mobile', formattedNumber);
    url.searchParams.set('retrytype', 'text');

    const response = await msg91Fetch(
      url.toString(),
      {
        method: 'GET',
      },
      'MSG91 Control retryOtp'
    );

    const data = await safeParseResponse(response, 'MSG91 Control retryOtp');

    if (!response.ok || data.type === 'error') {
      const errMsg = data.message || 'Failed to resend OTP.';
      if (isRateLimitResponse(response.status, errMsg)) {
        throw new Msg91Error(RATE_LIMIT_MESSAGE, {
          statusCode: 429,
          isRateLimit: true,
          retryAfter: 900,
        });
      }
      throw new Error(errMsg);
    }

    return {
      success: true,
      message: data.message || 'OTP resent successfully.',
    };
  }

  throw new Error('Neither MSG91_WIDGET_ID nor MSG91_TEMPLATE_ID is configured.');
}
