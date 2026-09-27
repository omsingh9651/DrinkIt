import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchProducts, fetchCategories } from '../services/productApi';
import styles from './Products.module.css';

// Category emoji mappings for DrinkIt's curated Indian catalog
const CATEGORY_EMOJIS = {
  All: '✨',
  Wine: '🍷',
  Champagne: '🥂',
  Whisky: '🥃',
  'Premium Spirits': '🥃',
  Cocktails: '🍸',
  Beer: '🍺',
  Vodka: '🍸',
  Rum: '🥃',
  Brandy: '🍷',
};

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');

  // In-stock only filter
  const [inStockOnly, setInStockOnly] = useState(false);

  // Category filter derived from URL query param ?category=...
  const categoryParam = searchParams.get('category') || 'All';

  // Sorting state (featured, popular, price-low, price-high, rating, newest)
  const [sortBy, setSortBy] = useState('featured');

  // Load available categories dynamically from catalog
  useEffect(() => {
    let isMounted = true;
    fetchCategories()
      .then((cats) => {
        if (isMounted && Array.isArray(cats)) {
          // Filter to categories that actually exist (count > 0)
          const activeNames = cats.filter((c) => c.count > 0).map((c) => c.name);
          setCatalogCategories(['All', ...activeNames]);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Using local categories fallback:', err);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch products with backend filtering and sorting
  useEffect(() => {
    let isMounted = true;

    fetchProducts({
      category: categoryParam,
      q: searchQuery,
      sortBy,
    })
      .then((data) => {
        if (isMounted) {
          setErrorNotice(null);
          setProducts(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load products:', err);
          setErrorNotice('Unable to connect to live catalog service. Showing offline cellar.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [categoryParam, searchQuery, sortBy, retryCount]);

  // Dynamically available categories: fallback to distinct categories in loaded products if categories API was empty
  const displayCategories = useMemo(() => {
    if (catalogCategories.length > 0) return catalogCategories;
    const distinct = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    );
    return ['All', ...distinct];
  }, [catalogCategories, products]);

  // Handle category tab selection
  const handleCategoryChange = (cat) => {
    const nextParams = new URLSearchParams(searchParams);
    if (cat === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', cat);
    }
    setSearchParams(nextParams);
  };

  // Client-side in-stock filter
  const displayProducts = useMemo(() => {
    if (!inStockOnly) return products;
    return products.filter(
      (p) =>
        p.inStock !== false &&
        p.stockQuantity > 0 &&
        p.status !== 'out_of_stock'
    );
  }, [products, inStockOnly]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setInStockOnly(false);
    handleCategoryChange('All');
    setSortBy('featured');
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.header}>
        <span className={styles.label}>Authentic Indian Spirits & Cellars</span>
        <h1 className={styles.title}>The DrinkIt Cellar</h1>
        <p className={styles.subtitle}>
          Explore authentic Indian single malts, reserve wines, craft ales, triple-distilled vodkas, aged rums, and premium cocktails.
        </p>
      </header>

      {/* Non-breaking fallback alert if backend was unavailable */}
      {errorNotice && (
        <div className={styles.noticeBanner}>
          <span>ℹ️ {errorNotice}</span>
          <button
            type="button"
            className={styles.noticeRetryBtn}
            onClick={() => {
              setLoading(true);
              setRetryCount((c) => c + 1);
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Filter and Search Controls Bar */}
      <section className={styles.controlsBar}>
        {/* Search Input */}
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by product name, brand, or category (e.g. Sula, Amrut, Bira)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search product catalog"
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search input"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Selector with all required criteria */}
        <div className={styles.sortWrapper}>
          <label htmlFor="sort-select" className={styles.sortLabel}>
            Sort By:
          </label>
          <select
            id="sort-select"
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="popular">Popular</option>
            <option value="price-low">Price: Low to High (₹)</option>
            <option value="price-high">Price: High to Low (₹)</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </section>

      {/* Category Filter Pills (Only categories that actually exist in catalog) */}
      <nav className={styles.categoryTabs} aria-label="Filter products by category">
        {displayCategories.map((cat) => {
          const isActive =
            categoryParam.toLowerCase() === cat.toLowerCase() ||
            (categoryParam === '' && cat === 'All');
          const emoji = CATEGORY_EMOJIS[cat] || '🍾';

          return (
            <button
              key={cat}
              type="button"
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              <span className={styles.tabEmoji}>{emoji}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </nav>

      {/* Results summary & In-Stock toggle */}
      <div className={styles.resultsMeta}>
        <div className={styles.metaLeft}>
          <span className={styles.countText}>
            Showing <strong>{displayProducts.length}</strong>{' '}
            {displayProducts.length === 1 ? 'bottle' : 'bottles'}
            {categoryParam !== 'All' && ` in ${categoryParam}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>

          <label className={styles.inStockToggle}>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span>In Stock Only</span>
          </label>
        </div>

        {(searchQuery || (categoryParam && categoryParam !== 'All') || inStockOnly) && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleClearFilters}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Products Catalog Grid */}
      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}>🥃</div>
          <p>Browsing the curated DrinkIt cellar...</p>
        </div>
      ) : displayProducts.length > 0 ? (
        <div className={styles.grid}>
          {displayProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className={styles.noResults}>
          <span className={styles.noResultsEmoji}>🍸</span>
          <h3>No products found</h3>
          <p>
            We couldn&apos;t find any bottles matching your search or category filter. Try clearing your filters or searching with a different keyword.
          </p>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClearFilters}
          >
            Clear Filters & View All
          </button>
        </div>
      )}

      {/* Statutory 21+ Age Verification & Excise Compliance Banner */}
      <footer className={styles.complianceFooter}>
        <div className={styles.complianceContent}>
          <span className={styles.complianceIcon}>🔞</span>
          <div>
            <strong>Statutory Age Verification Mandatory</strong>
            <p>
              Under applicable state excise regulations, purchasers and recipients must be of statutory legal drinking age (21+). Physical government-issued photo ID verification is strictly mandated upon order delivery.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
