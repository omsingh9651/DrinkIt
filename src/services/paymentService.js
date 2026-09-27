/**
 * DrinkIt Payment Service
 *
 * Provides a secure, clean interface for payment methods:
 * 1. Cash on Delivery (COD) - Standard doorstep payment with 21+ age check
 * 2. Razorpay Test Mode - Secure checkout with server-side HMAC-SHA256 signature verification
 */

export const PAYMENT_METHODS = {
  COD: 'COD',
  RAZORPAY: 'RAZORPAY',
};

export const PAYMENT_METHOD_DETAILS = [
  {
    id: PAYMENT_METHODS.COD,
    name: 'Cash on Delivery (Doorstep Verification)',
    badge: 'Standard Option',
    isTest: false,
    description:
      'Pay in cash or UPI QR scan upon courier delivery. Valid 21+ government photo ID check is mandatory at doorstep.',
    icon: '💵',
  },
  {
    id: PAYMENT_METHODS.RAZORPAY,
    name: 'Razorpay Online (UPI, Cards, NetBanking)',
    badge: 'Test Mode (Sandbox)',
    isTest: true,
    description:
      'Secure Razorpay payment gateway in Test Mode. Instant confirmation with cryptographic signature verification. Zero real money deducted.',
    icon: '💳',
  },
];

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

async function parseResponse(res, context = 'Payment API') {
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
    throw new Error(data.error || data.message || `${context} failed (HTTP ${res.status}).`);
  }

  return data;
}

/**
 * Dynamically load Razorpay standard checkout script
 * Returns boolean indicating whether script is ready
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }

    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Unable to load external Razorpay checkout script (offline or sandboxed environment).');
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

/**
 * Fetch public payment configuration
 */
export async function fetchPaymentConfig() {
  const res = await fetch('/api/payment/config');
  return parseResponse(res, 'Fetch Payment Config');
}

/**
 * Create Razorpay Order on server
 */
export async function createRazorpayOrder(orderPayload, customerPhone) {
  const res = await fetch('/api/payment/razorpay/create-order', {
    method: 'POST',
    headers: getHeaders(customerPhone),
    credentials: 'include',
    body: JSON.stringify(orderPayload),
  });

  return parseResponse(res, 'Create Razorpay Order');
}

/**
 * Verify Razorpay payment signature on backend
 */
export async function verifyRazorpayPayment(verificationPayload, customerPhone) {
  const res = await fetch('/api/payment/razorpay/verify', {
    method: 'POST',
    headers: getHeaders(customerPhone),
    credentials: 'include',
    body: JSON.stringify(verificationPayload),
  });

  return parseResponse(res, 'Verify Razorpay Payment');
}

/**
 * Report Razorpay payment failure / cancellation to server
 */
export async function recordPaymentFailure(failurePayload, customerPhone) {
  const res = await fetch('/api/payment/razorpay/failed', {
    method: 'POST',
    headers: getHeaders(customerPhone),
    credentials: 'include',
    body: JSON.stringify(failurePayload),
  });

  return parseResponse(res, 'Record Payment Failure');
}

/**
 * Offline / sandbox simulation helper
 */
export async function simulateTestPayment(orderId, razorpayOrderId, customerPhone) {
  const res = await fetch('/api/payment/razorpay/simulate-success', {
    method: 'POST',
    headers: getHeaders(customerPhone),
    credentials: 'include',
    body: JSON.stringify({ orderId, razorpayOrderId }),
  });

  return parseResponse(res, 'Simulate Test Payment');
}
