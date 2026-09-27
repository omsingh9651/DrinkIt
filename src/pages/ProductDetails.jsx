import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchProductById, fetchProducts } from '../services/productApi';
import { useCart } from '../context/CartContext';
import ProductCard, { StarRating } from '../components/ProductCard';
import { formatINR } from '../utils/formatters';
import styles from './ProductDetails.module.css';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, getItemQuantity, increaseQuantity, decreaseQuantity } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Gallery active image state
  const [activeImage, setActiveImage] = useState('');
  const [imgError, setImgError] = useState(false);

  // Quantity selector state for items not yet in cart
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let isMounted = true;
    window.scrollTo(0, 0);

    async function loadData() {
      try {
        const prod = await fetchProductById(id);
        if (!isMounted) return;
        setProduct(prod);
        setImgError(false);
        setQuantity(1);

        if (prod) {
          const initialImg =
            prod.image ||
            prod.imageUrl ||
            prod.thumbnail ||
            (Array.isArray(prod.images) && prod.images[0]) ||
            '';
          setActiveImage(initialImg);

          const related = await fetchProducts({ category: prod.category });
          if (isMounted) {
            setRelatedProducts(
              (related || []).filter((p) => p.id !== prod.id).slice(0, 4)
            );
          }
        }
      } catch (err) {
        if (isMounted) console.error('Failed to load product details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Gallery image list resolution (prioritize product.image)
  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (product.image) {
      if (Array.isArray(product.images) && product.images.length > 0) {
        return [product.image, ...product.images.filter((img) => img !== product.image)];
      }
      return [product.image];
    }
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    const single = product.imageUrl || product.thumbnail;
    return single ? [single] : [];
  }, [product]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>🥃</div>
        <p>Fetching vintage details from the cellar...</p>
      </div>
    );
  }

  // If product not found
  if (!product) {
    return (
      <div className={styles.notFoundContainer}>
        <span className={styles.notFoundEmoji}>🔍</span>
        <h2>Bottle Not Found</h2>
        <p>The spirit or beverage you are searching for is unavailable or has been archived from the DrinkIt cellar.</p>
        <Link to="/products" className={styles.backBtn}>
          ← Back to All Products
        </Link>
      </div>
    );
  }

  // Pricing calculations
  const mrp = product.mrp || product.originalPrice || product.price;
  const price = product.price;
  const discount =
    product.discount !== undefined
      ? Number(product.discount)
      : mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;
  const savings = mrp > price ? mrp - price : 0;

  // Inventory & Stock state
  const isOutOfStock =
    product.inStock === false ||
    product.stockQuantity === 0 ||
    product.status === 'out_of_stock';
  const availableStock =
    product.stockQuantity !== undefined ? Number(product.stockQuantity) : 99;
  const maxPurchaseQty = isOutOfStock ? 0 : Math.min(availableStock, 99);

  // Cart quantities
  const inCartQty = getItemQuantity ? getItemQuantity(product.id) : 0;
  const isMaxInCart = !isOutOfStock && (inCartQty >= availableStock || (inCartQty === 0 && quantity >= availableStock));

  const handleDecreaseQty = () => {
    if (inCartQty > 0) {
      decreaseQuantity(product.id);
    } else {
      setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
    }
  };

  const handleIncreaseQty = () => {
    if (inCartQty > 0) {
      if (inCartQty >= availableStock) return;
      increaseQuantity(product.id);
    } else {
      setQuantity((prev) => (prev < maxPurchaseQty ? prev + 1 : prev));
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock || isMaxInCart) return;
    addToCart(product, quantity);
  };

  return (
    <div className={styles.container}>
      {/* Breadcrumbs Navigation */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb navigation">
        <Link to="/" className={styles.breadcrumbLink}>
          Home
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link to="/products" className={styles.breadcrumbLink}>
          Products
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link
          to={`/products?category=${encodeURIComponent(product.category)}`}
          className={styles.breadcrumbLink}
        >
          {product.category}
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbActive}>{product.name}</span>
      </nav>

      {/* Main Details Showcase */}
      <div className={styles.showcase}>
        {/* Left Column: Image Gallery */}
        <div className={styles.imageColumn}>
          {/* Main Large Image Container */}
          <div className={styles.imageCard}>
            {discount > 0 && (
              <span className={styles.discountBadgeTop}>{discount}% OFF</span>
            )}
            {product.badge && <span className={styles.badge}>{product.badge}</span>}

            {!imgError && activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className={styles.detailImage}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className={styles.emojiDisplay}>{product.emoji || '🥃'}</div>
            )}

            {product.origin && (
              <div className={styles.originTag}>📍 {product.origin}</div>
            )}
          </div>

          {/* Thumbnail Strip Gallery (if multiple images exist) */}
          {galleryImages.length > 1 && (
            <div
              className={styles.thumbnailGallery}
              role="tablist"
              aria-label="Product image thumbnails"
            >
              {galleryImages.map((imgUrl, index) => {
                const isActive = activeImage === imgUrl;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`${styles.thumbnailBtn} ${
                      isActive ? styles.thumbnailBtnActive : ''
                    }`}
                    onClick={() => {
                      setActiveImage(imgUrl);
                      setImgError(false);
                    }}
                    aria-label={`View image ${index + 1} of ${product.name}`}
                    aria-selected={isActive}
                  >
                    <img
                      src={imgUrl}
                      alt={`${product.name} preview ${index + 1}`}
                      className={styles.thumbImg}
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Value Guarantees */}
          <div className={styles.trustRow}>
            <div className={styles.trustItem}>
              <span>🛡️ 100% Authentic Indian Bottling</span>
            </div>
            <div className={styles.trustItem}>
              <span>❄️ Temperature Controlled Cellar</span>
            </div>
            <div className={styles.trustItem}>
              <span>📦 Discreet Secure Delivery</span>
            </div>
          </div>
        </div>

        {/* Right Column: Meta & Actions */}
        <div className={styles.metaColumn}>
          {/* Badges & Stock Status Row */}
          <div className={styles.categoryBadgeRow}>
            <span className={styles.brandPill}>{product.brand}</span>
            <span className={styles.categoryPill}>{product.category}</span>
            {(product.subcategory || product.subCategory) && (
              <span className={styles.subCategoryPill}>
                {product.subcategory || product.subCategory}
              </span>
            )}
            <span
              className={
                isOutOfStock
                  ? styles.stockStatusOut
                  : availableStock <= 5
                    ? styles.stockStatusLow
                    : styles.stockStatusIn
              }
            >
              {isOutOfStock
                ? '○ Out of Stock'
                : availableStock <= 5
                  ? `⚠️ Low Stock: Only ${availableStock} left`
                  : `● In Stock (${availableStock} available)`}
            </span>
          </div>

          <h1 className={styles.productTitle}>{product.name}</h1>

          {/* Rating & Connoisseur Reviews */}
          <div className={styles.ratingRow}>
            <StarRating
              rating={product.rating}
              reviewCount={product.reviewCount || product.reviewsCount}
            />
            <span className={styles.reviewCount}>
              {product.reviewCount || product.reviewsCount || 0} verified reviews
            </span>
          </div>

          {/* Price Section (Strictly in INR ₹) */}
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatINR(price)}</span>
            {discount > 0 && savings > 0 && (
              <div className={styles.discountGroup}>
                <span className={styles.originalPrice}>{formatINR(mrp)}</span>
                <span className={styles.saveTag}>
                  Save {formatINR(savings)} ({discount}% OFF)
                </span>
              </div>
            )}
            <span className={styles.taxNotice}>Inclusive of all excise duties & taxes</span>
          </div>

          {/* Short Description */}
          {product.shortDescription && (
            <p className={styles.shortDescriptionText}>
              {product.shortDescription}
            </p>
          )}

          {/* Quantity Selector & Add to Cart Controls */}
          <div className={styles.purchaseControls}>
            <div className={styles.qtyContainer}>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={handleDecreaseQty}
                disabled={isOutOfStock || (inCartQty === 0 && quantity <= 1)}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className={styles.qtyInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {isOutOfStock ? 0 : inCartQty > 0 ? inCartQty : quantity}
              </span>
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={handleIncreaseQty}
                disabled={isOutOfStock || isMaxInCart || (inCartQty === 0 && quantity >= maxPurchaseQty)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {inCartQty > 0 ? (
              <div className={styles.inCartStatusGroup}>
                <span className={styles.inCartPillBadge}>
                  ✓ Added to Cart ({inCartQty})
                </span>
                <button
                  type="button"
                  className={styles.viewCartBtn}
                  onClick={() => navigate('/cart')}
                >
                  View Cart →
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${styles.addToCartBtn} ${isOutOfStock || isMaxInCart ? styles.disabledCartBtn : ''}`}
                onClick={handleAddToCart}
                disabled={isOutOfStock || isMaxInCart}
                aria-label={
                  isOutOfStock
                    ? 'Product is out of stock'
                    : isMaxInCart
                      ? 'Maximum stock reached in cart'
                      : 'Add product to cart'
                }
              >
                {isOutOfStock ? (
                  'Currently Sold Out'
                ) : isMaxInCart ? (
                  'Maximum Stock Reached'
                ) : (
                  `🛒 Add to Cart • ${formatINR(price * quantity)}`
                )}
              </button>
            )}
          </div>

          {/* In-cart status callout if item already in cart */}
          {inCartQty > 0 && (
            <div className={styles.inCartPill}>
              <span>✓ You currently have <strong>{inCartQty}</strong> in your cart.</span>
            </div>
          )}

          {/* Specifications Grid */}
          <div className={styles.specsSection}>
            <h3 className={styles.sectionHeading}>Product Specifications</h3>
            <div className={styles.specsGrid}>
              <div className={styles.specBox}>
                <span className={styles.specLabel}>Volume</span>
                <span className={styles.specValue}>
                  {product.volume || (product.bottleSizeInMl ? `${product.bottleSizeInMl} ml` : '750 ml')}
                </span>
              </div>

              {/* ABV is displayed strictly ONLY where available */}
              {product.abv && product.abv.trim() ? (
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Alcohol by Volume</span>
                  <span className={styles.specValue}>
                    {product.abv.toUpperCase().includes('ABV')
                      ? product.abv
                      : `${product.abv} ABV`}
                  </span>
                </div>
              ) : null}

              {product.unit && (
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Packaging Unit</span>
                  <span className={styles.specValue}>{product.unit}</span>
                </div>
              )}

              {product.sku && (
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>SKU</span>
                  <span className={styles.specValue}>{product.sku}</span>
                </div>
              )}

              {product.barcode && (
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>EAN Barcode</span>
                  <span className={styles.specValue}>{product.barcode}</span>
                </div>
              )}

              {product.origin && (
                <div className={styles.specBox}>
                  <span className={styles.specLabel}>Region of Origin</span>
                  <span className={styles.specValue}>{product.origin}</span>
                </div>
              )}
            </div>
          </div>

          {/* Full Description */}
          {(product.description || product.longDescription) && (
            <div className={styles.descriptionSection}>
              <h3 className={styles.sectionHeading}>About this Bottle</h3>
              <p className={styles.longDescription}>
                {product.longDescription || product.description}
              </p>
            </div>
          )}

          {/* Tasting Notes */}
          {Array.isArray(product.tastingNotes) && product.tastingNotes.length > 0 && (
            <div className={styles.tastingSection}>
              <h3 className={styles.sectionHeading}>Tasting Notes</h3>
              <div className={styles.tastingNotesList}>
                {product.tastingNotes.map((note) => (
                  <span key={note} className={styles.tastingNote}>
                    ✦ {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Culinary Pairing */}
          {product.foodPairing && (
            <div className={styles.pairingSection}>
              <span className={styles.pairingIcon}>🍽️</span>
              <p>
                <strong>Culinary Pairing:</strong> {product.foodPairing}
              </p>
            </div>
          )}

          {/* Statutory Age Verification Notice */}
          <div className={styles.legalNoticeCard}>
            <span className={styles.legalIcon}>🔞</span>
            <div className={styles.legalText}>
              <strong>Statutory Age Verification Required</strong>
              <p>
                You must be of statutory legal drinking age (21+) in your jurisdiction to order and receive this item. Valid government-issued photo ID is strictly verified upon delivery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Showcase */}
      {relatedProducts.length > 0 && (
        <section className={styles.relatedSection}>
          <div className={styles.relatedHeader}>
            <span className={styles.relatedLabel}>Explore More in {product.category}</span>
            <h2 className={styles.relatedTitle}>You May Also Appreciate</h2>
          </div>
          <div className={styles.relatedGrid}>
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
