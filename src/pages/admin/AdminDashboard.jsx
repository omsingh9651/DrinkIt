import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../../services/productApi';
import { formatINR } from '../../utils/formatters';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
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
      .catch((err) => {
        console.error('Failed to load products in admin dashboard:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.inStock && Number(p.stockQuantity) > 0).length;
    const lowStock = products.filter(
      (p) => Number(p.stockQuantity) > 0 && Number(p.stockQuantity) <= 5
    ).length;
    const outOfStock = products.filter(
      (p) => !p.inStock || Number(p.stockQuantity) <= 0
    ).length;
    const totalValuation = products.reduce(
      (sum, p) => sum + Number(p.price || 0) * Number(p.stockQuantity || 0),
      0
    );

    return { total, inStock, lowStock, outOfStock, totalValuation };
  }, [products]);

  // Recent 5 products
  const recentProducts = useMemo(() => {
    return [...products].slice(0, 5);
  }, [products]);

  // Low stock products (stock <= 5 or out of stock)
  const attentionProducts = useMemo(() => {
    return products
      .filter((p) => !p.inStock || Number(p.stockQuantity) <= 5)
      .slice(0, 5);
  }, [products]);

  if (loading) {
    return (
      <div className={styles.loadingSpinner}>
        <span>Loading DrinkIt store metrics...</span>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Header & Quick Actions */}
      <div className={styles.welcomeHeader}>
        <div className={styles.titleGroup}>
          <h1>Admin Overview Dashboard</h1>
          <p>Real-time catalog metrics and store performance overview.</p>
        </div>

        <div className={styles.quickActionBtns}>
          <Link to="/admin/products?action=add" className={styles.primaryBtn}>
            <span>+</span>
            <span>Add Product</span>
          </Link>
          <Link to="/admin/products" className={styles.secondaryBtn}>
            <span>📦</span>
            <span>Manage Products</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiGold}`}>
          <div className={styles.kpiTop}>
            <span>Total Catalog</span>
            <span className={styles.kpiIcon}>🍾</span>
          </div>
          <div className={styles.kpiValue}>{metrics.total}</div>
          <div className={styles.kpiSub}>Active store SKUs</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiSuccess}`}>
          <div className={styles.kpiTop}>
            <span>In Stock</span>
            <span className={styles.kpiIcon}>✔</span>
          </div>
          <div className={styles.kpiValue}>{metrics.inStock}</div>
          <div className={styles.kpiSub}>Ready for dispatch</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiWarning}`}>
          <div className={styles.kpiTop}>
            <span>Low Stock</span>
            <span className={styles.kpiIcon}>⚠️</span>
          </div>
          <div className={styles.kpiValue}>{metrics.lowStock}</div>
          <div className={styles.kpiSub}>5 or fewer bottles remaining</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiDanger}`}>
          <div className={styles.kpiTop}>
            <span>Out of Stock</span>
            <span className={styles.kpiIcon}>⛔</span>
          </div>
          <div className={styles.kpiValue}>{metrics.outOfStock}</div>
          <div className={styles.kpiSub}>Immediate restock needed</div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiGold}`}>
          <div className={styles.kpiTop}>
            <span>Inventory Value</span>
            <span className={styles.kpiIcon}>₹</span>
          </div>
          <div className={styles.kpiValue}>{formatINR(metrics.totalValuation)}</div>
          <div className={styles.kpiSub}>Total catalog value in stock</div>
        </div>
      </div>

      {/* Dual Table Section */}
      <div className={styles.tablesGrid}>
        {/* Recent Products */}
        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span>✨</span>
              <span>Recent Products</span>
            </h2>
            <Link to="/admin/products" className={styles.viewAllLink}>
              View All ({metrics.total}) →
            </Link>
          </div>

          <div className={styles.tableWrapper}>
            {recentProducts.length === 0 ? (
              <div className={styles.emptyState}>No products in catalog yet.</div>
            ) : (
              <table className={styles.miniTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.productCell}>
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className={styles.miniImg}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className={styles.miniEmoji}>{p.emoji || '🥃'}</span>
                          )}
                          <div>
                            <span className={styles.productName}>{p.name}</span>
                            <span className={styles.productCategory}>
                              {p.brand} • {p.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{formatINR(p.price)}</td>
                      <td>{p.stockQuantity}</td>
                      <td>
                        {p.stockQuantity > 5 ? (
                          <span className={styles.badgeSuccess}>In Stock</span>
                        ) : p.stockQuantity > 0 ? (
                          <span className={styles.badgeWarning}>Low ({p.stockQuantity})</span>
                        ) : (
                          <span className={styles.badgeDanger}>Out of Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Low Stock Attention */}
        <div className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span>⚠️</span>
              <span>Inventory Attention</span>
            </h2>
            <Link to="/admin/products" className={styles.viewAllLink}>
              Manage Inventory →
            </Link>
          </div>

          <div className={styles.tableWrapper}>
            {attentionProducts.length === 0 ? (
              <div className={styles.emptyState}>
                <span>🎉 All items are healthy and adequately stocked!</span>
              </div>
            ) : (
              <table className={styles.miniTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock Remaining</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.productCell}>
                          <span className={styles.miniEmoji}>{p.emoji || '🥃'}</span>
                          <div>
                            <span className={styles.productName}>{p.name}</span>
                            <span className={styles.productCategory}>{p.brand}</span>
                          </div>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        {p.stockQuantity <= 0 ? (
                          <span className={styles.badgeDanger}>0 units</span>
                        ) : (
                          <span className={styles.badgeWarning}>
                            {p.stockQuantity} {p.stockQuantity === 1 ? 'unit' : 'units'}
                          </span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/admin/products?search=${encodeURIComponent(p.name)}`}
                          className={styles.viewAllLink}
                        >
                          Restock ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
