import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { useCart } from '../../context/CartContext';
import { fetchProducts } from '../../services/productApi';
import { formatINR } from '../../utils/formatters';
import styles from './AccountWishlist.module.css';

export default function AccountWishlist() {
  const { wishlist, removeFromWishlist } = useUser();
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchProducts()
      .then((data) => {
        if (isMounted) {
          setProducts(data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products that are in the user's wishlist
  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));

  const handleMoveToCart = (product) => {
    addToCart(product, 1);
    removeFromWishlist(product.id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Cellar Wishlist</h1>
        <p>Your saved favorites and vintage reserves to try next.</p>
      </div>

      {loading ? (
        <div style={{ color: '#e5a84b', padding: '2rem 0' }}>Loading your saved bottles...</div>
      ) : wishlistProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🍷</div>
          <h2 className={styles.emptyTitle}>Your wishlist is empty</h2>
          <p className={styles.emptySubtitle}>
            Save wines, whiskies, and craft beers you are looking forward to tasting.
          </p>
          <Link to="/products" className={styles.browseBtn}>
            Browse DrinkIt Catalog
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {wishlistProducts.map((product) => (
            <div key={product.id} className={styles.card}>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeFromWishlist(product.id)}
                title="Remove from Wishlist"
              >
                ✕
              </button>

              <Link to={`/products/${product.id}`} className={styles.imgWrapper}>
                {product.image || product.imageUrl || product.thumbnail || (product.images && product.images[0]) ? (
                  <img
                    src={
                      product.image ||
                      product.imageUrl ||
                      product.thumbnail ||
                      (product.images && product.images[0])
                    }
                    alt={product.name}
                    className={styles.productImg}
                  />
                ) : (
                  <span className={styles.emojiImg}>{product.emoji || '🥃'}</span>
                )}
              </Link>

              <div className={styles.info}>
                <span className={styles.brand}>{product.brand}</span>
                <Link to={`/products/${product.id}`} className={styles.title}>
                  {product.name}
                </Link>

                <div className={styles.priceRow}>
                  <span className={styles.price}>{formatINR(product.price)}</span>
                  {product.originalPrice && (
                    <span className={styles.originalPrice}>
                      {formatINR(product.originalPrice)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={styles.moveToCartBtn}
                onClick={() => handleMoveToCart(product)}
              >
                <span>🛒</span>
                <span>Move to Cart</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
