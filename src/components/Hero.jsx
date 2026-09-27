import { Link } from 'react-router-dom';
import styles from './Hero.module.css';

function Hero() {
  return (
    <section className={styles.hero}>
      {/* Decorative gradient blobs in background */}
      <div className={styles.blobLeft} aria-hidden="true" />
      <div className={styles.blobRight} aria-hidden="true" />

      <div className={styles.content}>
        {/* Badge */}
        <span className={styles.badge}>✨ Premium Spirits & Beverages</span>

        {/* Main heading */}
        <h1 className={styles.title}>
          Welcome to <span className={styles.brand}>DrinkIt</span>
        </h1>

        {/* Tagline */}
        <p className={styles.tagline}>
          Discover the world&apos;s finest wines, whiskies, craft beers, and
          handcrafted cocktails — delivered straight to your door.
        </p>

        {/* Call-to-action buttons */}
        <div className={styles.actions}>
          <Link to="/products" className={styles.ctaPrimary}>
            Explore Products
          </Link>
          <a href="#categories" className={styles.ctaSecondary}>
            Browse Categories
          </a>
        </div>

        {/* Stats row */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <strong>500+</strong>
            <span>Products</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.stat}>
            <strong>50+</strong>
            <span>Brands</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.stat}>
            <strong>10k+</strong>
            <span>Happy Customers</span>
          </div>
        </div>
      </div>

      {/* Hero visual — decorative glass graphic */}
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.glassCard}>
          <div className={styles.glassTop}>🥃</div>
          <div className={styles.glassLabel}>Premium Selection</div>
          <div className={styles.glassRating}>★★★★★</div>
        </div>
        <div className={styles.floatingTag}>🍷 Wine of the Month</div>
        <div className={styles.floatingTag2}>🍺 Craft Beer Drop</div>
      </div>
    </section>
  );
}

export default Hero;

