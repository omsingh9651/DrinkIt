import crypto from 'crypto';
import { getRazorpayConfig } from '../config/razorpay.js';

class RazorpayService {
  /**
   * Create an order with Razorpay Test Mode
   * @param {Object} params
   * @param {number} params.amount - Amount in paise (e.g. 99900 = ₹999.00)
   * @param {string} [params.currency='INR'] - 3-letter currency code
   * @param {string} params.receipt - Internal order identifier (e.g. DKT-...)
   * @param {Object} [params.notes={}] - Key-value metadata
   */
  async createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const { keyId, keySecret, isTestMode } = getRazorpayConfig();

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Valid order amount in paise is required.');
    }

    const payload = {
      amount: Math.round(Number(amount)),
      currency: currency.toUpperCase(),
      receipt: String(receipt || `rcpt_${Date.now()}`),
      notes: {
        platform: 'DrinkIt Reserve',
        mode: isTestMode ? 'test' : 'live',
        ...notes,
      },
    };

    // Attempt real Razorpay API call
    try {
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [Razorpay API] Real Test Mode order created: ${data.id} (₹${(data.amount / 100).toFixed(2)})`);
        return {
          id: data.id,
          entity: 'order',
          amount: data.amount,
          amount_paid: 0,
          amount_due: data.amount,
          currency: data.currency,
          receipt: data.receipt,
          status: data.status,
          attempts: 0,
          notes: data.notes,
          created_at: data.created_at,
          isSimulated: false,
        };
      }

      // Razorpay API returned non-200 (e.g. 401 Unauthorized for demo keys or invalid credentials)
      let errDescription = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errDescription = errJson?.error?.description || errJson?.error?.code || `HTTP ${res.status}`;
      } catch {
        // non-JSON body
      }

      console.warn(
        `⚠️ [Razorpay API] Order creation returned HTTP ${res.status} (${errDescription}).`
      );
      console.warn(
        '   Notice: To use the live Razorpay checkout popup, configure valid test keys from https://dashboard.razorpay.com in server/.env. Using DrinkIt Test Sandbox Simulator with cryptographic backend verification.'
      );

      const randomHex = crypto.randomBytes(4).toString('hex');
      const simulatedOrderId = `order_test_${Date.now().toString(36)}_${randomHex}`;

      return {
        id: simulatedOrderId,
        entity: 'order',
        amount: payload.amount,
        amount_paid: 0,
        amount_due: payload.amount,
        currency: payload.currency,
        receipt: payload.receipt,
        status: 'created',
        attempts: 0,
        notes: payload.notes,
        created_at: Math.floor(Date.now() / 1000),
        isSimulated: true,
        simulationReason: `Razorpay API ${res.status}: ${errDescription}`,
      };
    } catch (netErr) {
      console.warn(`⚠️ [Razorpay API] Network connection issue: ${netErr.message}.`);
      console.warn(
        '   Using DrinkIt Test Sandbox Simulator with cryptographic backend verification.'
      );

      const randomHex = crypto.randomBytes(4).toString('hex');
      const simulatedOrderId = `order_test_${Date.now().toString(36)}_${randomHex}`;

      return {
        id: simulatedOrderId,
        entity: 'order',
        amount: payload.amount,
        amount_paid: 0,
        amount_due: payload.amount,
        currency: payload.currency,
        receipt: payload.receipt,
        status: 'created',
        attempts: 0,
        notes: payload.notes,
        created_at: Math.floor(Date.now() / 1000),
        isSimulated: true,
        simulationReason: `Network offline: ${netErr.message}`,
      };
    }
  }

  /**
   * Cryptographically verify Razorpay payment HMAC signature
   * signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }

    const { keySecret } = getRazorpayConfig();
    const data = `${razorpayOrderId}|${razorpayPaymentId}`;

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(data)
      .digest('hex');

    try {
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const providedBuf = Buffer.from(razorpaySignature, 'utf8');

      if (expectedBuf.length !== providedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, providedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Helper to generate authentic test signature for sandbox simulations
   */
  generateTestSignature(razorpayOrderId, razorpayPaymentId) {
    const { keySecret } = getRazorpayConfig();
    return crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
  }
}

export const razorpayService = new RazorpayService();
export default razorpayService;

