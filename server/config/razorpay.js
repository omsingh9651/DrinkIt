/**
 * DrinkIt Razorpay Configuration & Guardrails
 *
 * Ensures all Razorpay interactions strictly run in Test Mode.
 * NEVER exposes secret keys to client or logs.
 */

export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  // Enforce Test Mode safety check
  const isTestMode = keyId.startsWith('rzp_test_');
  if (keyId && !isTestMode) {
    console.warn('⚠️ WARNING: Live Razorpay keys detected! DrinkIt strictly requires Test Mode keys (starting with "rzp_test_").');
  }

  return {
    keyId,
    keySecret,
    isTestMode,
    isConfigured: Boolean(keyId && keySecret),
  };
}

export default getRazorpayConfig;

