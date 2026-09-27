import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { fetchProducts } from '../services/productApi';
import { PRODUCTS } from '../data/products';
import styles from './PopularProducts.module.css';

function PopularProducts() {
  const [popularItems, setPopularItems] = useState(() => PRODUCTS.slice(0, 8));

  useEffect(() => {
    let mounted = true;
    fetchProducts({ sortBy: 'rating' })
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setPopularItems(data.slice(0, 8));
        }
      })
      .catch((err) => console.warn('Could not fetch popular products:', err));

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className={styles.section} id="products">
      <div className={styles.header}>
        <p className={styles.label}>Handpicked Indian & Global Cellar</p>
        <h2 className={styles.title}>Popular Reserve Bottles</h2>
        <p className={styles.subtitle}>
          Our top-rated wines, single malts, craft brews, and spirits loved across India.
        </p>
      </div>

      <div className={styles.grid}>
        {popularItems.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className={styles.viewAll}>
        <Link to="/products" className={styles.viewAllBtn}>
          View All Products →
        </Link>
      </div>
    </section>
  );
}

export default PopularProducts;
