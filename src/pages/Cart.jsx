import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { formatINR } from '../utils/formatters';
import styles from './Cart.module.css';

export default function Cart() {
  const navigate = useNavigate();
  const {
    items,
    totalItems,
    subtotal,
    shipping,
    estimatedTax,
    totalPrice,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const { selectedLocation, openLocationPicker, serviceability } = useLocation();

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoError, setPromoError] = useState('');

  const handleProceedToCheckout = () => {
    if (!selectedLocation) {
      openLocationPicker();
      return;
    }
    navigate('/checkout');
  };

  // Free shipping threshold at ₹999
  const freeShippingThreshold = 999;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const progressPercent = Math.min(
    100,
    Math.round((subtotal / freeShippingThreshold) * 100)
  );

  const handleApplyPromo = (e) => {
    e.preventDefault();
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    if (code === 'DRINKIT10') {
      setAppliedPromo('DRINKIT10');
      setPromoCode('');
    } else if (code === 'WELCOME50') {
      setAppliedPromo('WELCOME50');
      setPromoCode('');
    } else {
      setPromoError('Invalid coupon. Try "DRINKIT10" (10% off) or "WELCOME50" (₹50 off).');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo('');
    setPromoError('');
  };

  // Calculate discount based on applied promo
  const discountAmount = useMemo(() => {
    if (appliedPromo === 'DRINKIT10') {
      return Math.round(subtotal * 0.1);
    }
    if (appliedPromo === 'WELCOME50') {
      return Math.min(subtotal, 50);
    }
    return 0;
  }, [appliedPromo, subtotal]);

  const finalTotal = Math.max(0, totalPrice - discountAmount);

  // Empty state
  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>🛒</div>
        <h1 className={styles.emptyTitle}>Your Tasting Cart is Empty</h1>
        <p className={styles.emptySubtitle}>
          Looks like you haven&apos;t added any fine spirits, craft brews, or vintage bottles yet.
        </p>
        <Link to="/products" className={styles.shopNowBtn}>
          Explore The Cellar →
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Tasting Cart</h1>
        <p className={styles.subtitle}>
          Review your handpicked bottles and proceed to secure checkout.
        </p>
      </header>

      {/* Free Shipping Progress Meter */}
      <div className={styles.shippingMeter}>
        <div className={styles.meterText}>
          {remainingForFreeShipping > 0 ? (
            <span>
              Add <strong>{formatINR(remainingForFreeShipping)}</strong> more to unlock <strong>FREE Express Delivery</strong> 🚚
            </span>
          ) : (
            <span className={styles.freeUnlocked}>
              🎉 You have unlocked <strong>FREE Express Delivery</strong> across India!
            </span>
          )}
        </div>
        <div className={styles.progressBarBg}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className={styles.cartLayout}>
        {/* Left Column: Items list */}
        <div className={styles.itemsColumn}>
          <div className={styles.itemsHeader}>
            <span>Item Details</span>
            <span>Quantity</span>
            <span>Line Total</span>
          </div>

          <div className={styles.itemsList}>
            {items.map(({ product, quantity }) => {
              const maxStock =
                product.stockQuantity !== undefined ? Number(product.stockQuantity) : 99;
              const isAtMaxStock = quantity >= maxStock;

              return (
                <div key={product.id} className={styles.cartItem}>
                  {/* Thumbnail with image & fallback */}
                  <Link
                    to={`/products/${product.id}`}
                    className={styles.itemThumb}
                    aria-label={product.name}
                  >
                    {product.image || product.imageUrl || product.thumbnail || (product.images && product.images[0]) ? (
                      <img
                        src={
                          product.image ||
                          product.imageUrl ||
                          product.thumbnail ||
                          (product.images && product.images[0])
                        }
                        alt={product.name}
                        className={styles.thumbImg}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <span
                      className={styles.itemEmoji}
                      style={{
                        display:
                          product.image ||
                          product.imageUrl ||
                          product.thumbnail ||
                          (product.images && product.images[0])
                            ? 'none'
                            : 'flex',
                      }}
                    >
                      {product.emoji || '🥃'}
                    </span>
                  </Link>

                  {/* Details */}
                  <div className={styles.itemInfo}>
                    <div className={styles.brandRow}>
                      <span className={styles.itemBrand}>{product.brand || 'DrinkIt'}</span>
                      <span className={styles.itemCategory}>• {product.category}</span>
                    </div>
                    <Link to={`/products/${product.id}`} className={styles.itemName}>
                      {product.name}
                    </Link>
                    <span className={styles.itemUnit}>
                      {formatINR(product.price)} each {product.volume && `· ${product.volume}`}
                    </span>
                    <button
                      type="button"
                      className={styles.removeBtnMobile}
                      onClick={() => removeFromCart(product.id)}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Quantity Controls with Stock Guard */}
                  <div className={styles.itemQty}>
                    <div className={styles.qtyControl}>
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        onClick={() => decreaseQuantity(product.id)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className={styles.qtyNumber}>{quantity}</span>
                      <button
                        type="button"
                        className={`${styles.qtyBtn} ${isAtMaxStock ? styles.qtyBtnDisabled : ''}`}
                        onClick={() => !isAtMaxStock && increaseQuantity(product.id)}
                        disabled={isAtMaxStock}
                        aria-label="Increase quantity"
                        title={
                          isAtMaxStock
                            ? `Maximum available stock (${maxStock}) reached`
                            : 'Increase quantity'
                        }
                      >
                        +
                      </button>
                    </div>
                    {isAtMaxStock && (
                      <span className={styles.maxStockNotice}>Max stock ({maxStock})</span>
                    )}
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeFromCart(product.id)}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Line Total in INR */}
                  <div className={styles.itemTotal}>
                    <span>{formatINR(product.price * quantity)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className={styles.cartActions}>
            <Link to="/products" className={styles.continueBtn}>
              ← Continue Shopping
            </Link>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearCart}
            >
              Clear Entire Cart
            </button>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className={styles.summaryColumn}>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>

            <div className={styles.summaryRow}>
              <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
              <span>{formatINR(subtotal)}</span>
            </div>

            <div className={styles.summaryRow}>
              <span>Estimated Shipping</span>
              <span>
                {shipping === 0 ? (
                  <strong className={styles.freeShipping}>FREE</strong>
                ) : (
                  formatINR(shipping)
                )}
              </span>
            </div>

            <div className={styles.summaryRow}>
              <span>Estimated GST &amp; Excise (5%)</span>
              <span>{formatINR(estimatedTax)}</span>
            </div>

            {appliedPromo && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>Discount ({appliedPromo})</span>
                <span>-{formatINR(discountAmount)}</span>
              </div>
            )}

            <div className={styles.divider} />

            <div className={styles.totalRow}>
              <span>Grand Total</span>
              <span className={styles.totalAmount}>{formatINR(finalTotal)}</span>
            </div>

            {/* Promo Code Box */}
            {appliedPromo ? (
              <div className={styles.appliedPromoBox}>
                <div className={styles.appliedPromoLeft}>
                  <span>🎟️</span>
                  <span>
                    Coupon <strong>{appliedPromo}</strong> applied (-{formatINR(discountAmount)})
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.removePromoBtn}
                  onClick={handleRemovePromo}
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyPromo} className={styles.promoForm}>
                <input
                  type="text"
                  placeholder="Promo code (DRINKIT10 or WELCOME50)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className={styles.promoInput}
                />
                <button type="submit" className={styles.promoBtn}>
                  Apply
                </button>
              </form>
            )}
            {promoError && <p className={styles.promoError}>⚠️ {promoError}</p>}

            {/* Delivery Location Section */}
            <div className={styles.cartLocationBox}>
              <div className={styles.cartLocationHeader}>
                <span className={styles.cartLocationIcon}>📍</span>
                <div className={styles.cartLocationInfo}>
                  <span className={styles.cartLocationTitle}>
                    {selectedLocation
                      ? `Delivering to ${selectedLocation.locality || selectedLocation.city}`
                      : 'Delivery location needed'}
                  </span>
                  <span className={styles.cartLocationSub}>
                    {selectedLocation
                      ? `${serviceability.badgeText} · ${serviceability.estimatedTimeText}`
                      : 'Please choose your delivery location'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.cartLocationChangeBtn}
                  onClick={openLocationPicker}
                >
                  {selectedLocation ? 'Change' : 'Select'}
                </button>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              className={styles.checkoutBtn}
              onClick={handleProceedToCheckout}
            >
              Proceed to Checkout →
            </button>

            <div className={styles.summaryGuarantees}>
              <span>🔒 256-bit Encrypted Checkout</span>
              <span>🔞 21+ Age verification mandatory upon delivery</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
