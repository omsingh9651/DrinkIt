import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/formatters';
import styles from './ProductCard.module.css';

/**
 * StarRating component showing stars, rating value, and review count
 */
export function StarRating({ rating = 4.5, reviewCount }) {
  const numRating = Number(rating) || 4.5;
  const rounded = Math.round(numRating);

  return (
    <div className={styles.stars} aria-label={`Rating: ${numRating} out of 5`}>
      <span className={styles.starIcons}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rounded ? styles.starFilled : styles.starEmpty}
          >
            ★
          </span>
        ))}
      </span>
      <span className={styles.ratingNum}>{numRating.toFixed(1)}</span>
      {reviewCount !== undefined && reviewCount !== null && (
        <span className={styles.reviewCount}>({reviewCount})</span>
      )}
    </div>
  );
}

/**
 * Customer ProductCard component
 * Adheres strictly to DrinkIt's dark & amber aesthetic and improved product data structure:
 * - Real product image/thumbnail with graceful fallback
 * - Brand, Category & Subcategory tags
 * - Product name linked to /products/:id
 * - Volume (e.g. 750 ml)
 * - ABV (displayed only where available)
 * - MRP, Selling price (₹), and Discount percentage
 * - Rating & Review count
 * - Stock status ("In Stock", "Only X left", or "Out of Stock")
 * - Add to Cart button (disabled when out of stock or max cart quantity reached)
 * - View Details link
 */
function ProductCard({ product }) {
  const { addToCart, getItemQuantity, increaseQuantity, decreaseQuantity } = useCart();
  const [imgError, setImgError] = useState(false);

  // Price & Discount resolution
  const mrp = product.mrp || product.originalPrice || product.price;
  const price = product.price;
  const discount =
    product.discount !== undefined
      ? Number(product.discount)
      : mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;

  // Stock & Inventory resolution
  const isOutOfStock =
    product.inStock === false ||
    product.stockQuantity === 0 ||
    product.status === 'out_of_stock';
  const isLowStock =
    !isOutOfStock &&
    product.stockQuantity !== undefined &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= (product.lowStockThreshold || 5);

  const inCartQty = getItemQuantity ? getItemQuantity(product.id) : 0;
  const isMaxInCart =
    !isOutOfStock &&
    product.stockQuantity !== undefined &&
    inCartQty >= product.stockQuantity;

  // Primary image (prioritize product.image)
  const primaryImage =
    product.image ||
    product.imageUrl ||
    product.thumbnail ||
    (Array.isArray(product.images) && product.images[0]);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || isMaxInCart) return;
    addToCart(product, 1);
  };

  return (
    <div
      className={`${styles.card} ${isOutOfStock ? styles.cardOutOfStock : ''}`}
      data-testid={`product-card-${product.id}`}
    >
      {/* Top Floating Badges */}
      <div className={styles.badgeContainer}>
        {discount > 0 ? (
          <span className={styles.discountBadge}>{discount}% OFF</span>
        ) : (
          <span />
        )}
        {product.badge && <span className={styles.badge}>{product.badge}</span>}
      </div>

      {/* Product Image Showcase */}
      <Link
        to={`/products/${product.id}`}
        className={styles.imageWrapper}
        aria-label={`View details for ${product.name}`}
      >
        {!imgError && primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className={styles.productImg}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.fallbackGraphic}>
            <span className={styles.productEmoji}>{product.emoji || '🥃'}</span>
          </div>
        )}

        {isOutOfStock && (
          <div className={styles.outOfStockOverlay}>
            <span>Out of Stock</span>
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className={styles.cardBody}>
        {/* Brand & Volume Row */}
        <div className={styles.brandRow}>
          <span className={styles.brand}>{product.brand || 'DrinkIt Reserve'}</span>
          {(product.volume || product.bottleSizeInMl) && (
            <span className={styles.volume}>{product.volume || `${product.bottleSizeInMl} ml`}</span>
          )}
        </div>

        {/* Product Title */}
        <h3 className={styles.name}>
          <Link to={`/products/${product.id}`} className={styles.nameLink}>
            {product.name}
          </Link>
        </h3>

        {/* Short description / category tags */}
        <p className={styles.description}>
          {product.shortDescription || product.description}
        </p>

        {/* Rating & Stock Status Row */}
        <div className={styles.metaRow}>
          <StarRating
            rating={product.rating}
            reviewCount={product.reviewCount || product.reviewsCount}
          />
          {isOutOfStock ? (
            <span className={styles.stockBadgeOut}>Out of Stock</span>
          ) : isLowStock ? (
            <span className={styles.stockBadgeLow}>
              Only {product.stockQuantity} left
            </span>
          ) : (
            <span className={styles.stockBadgeIn}>In Stock</span>
          )}
        </div>

        {/* Price & ABV Row */}
        <div className={styles.priceRow}>
          <div className={styles.priceGroup}>
            <span className={styles.price}>{formatINR(price)}</span>
            {discount > 0 && mrp > price && (
              <span className={styles.mrpPrice}>{formatINR(mrp)}</span>
            )}
          </div>

          {/* ABV is strictly displayed ONLY if available */}
          {product.abv && product.abv.trim() && (
            <span className={styles.abvBadge} title="Alcohol by Volume">
              {product.abv.toUpperCase().includes('ABV')
                ? product.abv
                : `${product.abv} ABV`}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className={styles.actionsRow}>
          <Link
            to={`/products/${product.id}`}
            className={styles.viewBtn}
            aria-label={`View details for ${product.name}`}
          >
            Details
          </Link>

          {isOutOfStock ? (
            <button
              type="button"
              className={`${styles.addBtn} ${styles.disabledBtn}`}
              disabled
              aria-label={`${product.name} is out of stock`}
            >
              Out of Stock
            </button>
          ) : inCartQty > 0 ? (
            <div className={styles.inCartControlBox}>
              <div className={styles.qtyControls}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    decreaseQuantity(product.id);
                  }}
                  aria-label={`Decrease quantity of ${product.name}`}
                >
                  −
                </button>
                <span className={styles.qtyCount} aria-label={`Current cart quantity ${inCartQty}`}>
                  {inCartQty}
                </span>
                <button
                  type="button"
                  className={`${styles.qtyBtn} ${isMaxInCart ? styles.qtyBtnDisabled : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isMaxInCart) return;
                    increaseQuantity(product.id);
                  }}
                  disabled={isMaxInCart}
                  aria-label={`Increase quantity of ${product.name}`}
                  title={isMaxInCart ? 'Maximum available quantity reached' : 'Add one more'}
                >
                  +
                </button>
              </div>
              <div className={styles.addedNotice}>
                <span className={styles.addedCheck}>✓</span> Added to Cart
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddToCart}
              aria-label={`Add ${product.name} to cart`}
            >
              + Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
