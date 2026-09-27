/**
 * Utility functions for currency and numerical formatting in DrinkIt.
 * Strictly uses Indian Rupee (INR / ₹) notation.
 */

/**
 * Format a number to Indian Rupee currency string
 * e.g. 899 -> "₹899", 1299 -> "₹1,299", 24999 -> "₹24,999"
 *
 * @param {number|string} amount
 * @returns {string}
 */
export function formatINR(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Calculate percentage discount between original price and current price
 *
 * @param {number} originalPrice
 * @param {number} currentPrice
 * @returns {number} percentage off (e.g. 15 for 15%)
 */
export function calculateDiscount(originalPrice, currentPrice) {
  const orig = Number(originalPrice);
  const curr = Number(currentPrice);

  if (!orig || !curr || orig <= curr) return 0;
  return Math.round(((orig - curr) / orig) * 100);
}

