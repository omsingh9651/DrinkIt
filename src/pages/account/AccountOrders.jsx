import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { formatINR } from '../../utils/formatters';
import styles from './AccountOrders.module.css';

const TABS = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'ACTIVE', label: 'Active Dispatches' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function AccountOrders() {
  const { orders, refreshOrders, loading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!refreshOrders) return;
    setIsRefreshing(true);
    try {
      await refreshOrders();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (activeTab === 'ALL') return orders;
    if (activeTab === 'ACTIVE') {
      return orders.filter((o) => {
        const s = (o.orderStatus || o.status || 'PENDING').toUpperCase();
        return ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY'].includes(s);
      });
    }
    if (activeTab === 'DELIVERED') {
      return orders.filter((o) => (o.orderStatus || o.status || '').toUpperCase() === 'DELIVERED');
    }
    if (activeTab === 'CANCELLED') {
      return orders.filter((o) => (o.orderStatus || o.status || '').toUpperCase() === 'CANCELLED');
    }
    return orders;
  }, [orders, activeTab]);

  const getStatusClass = (status) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return styles.statusDelivered;
      case 'CANCELLED':
        return styles.statusCancelled;
      case 'CONFIRMED':
        return styles.statusConfirmed || styles.statusPending;
      case 'PROCESSING':
      case 'READY':
        return styles.statusProcessing || styles.statusPending;
      case 'OUT_FOR_DELIVERY':
        return styles.statusOutForDelivery || styles.statusPending;
      default:
        return styles.statusPending;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitleArea}>
          <h1>My Order History</h1>
          <p>Track active dispatches and view historical cellar orders.</p>
        </div>

        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={isRefreshing || userLoading}
        >
          <span>{isRefreshing ? '⏳' : '🔄'}</span>
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {orders.length > 0 && (
        <div className={styles.filterTabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.filterTab} ${activeTab === tab.key ? styles.filterTabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'ALL' && ` (${orders.length})`}
            </button>
          ))}
        </div>
      )}

      {orders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🍾</div>
          <h2 className={styles.emptyTitle}>No orders placed yet</h2>
          <p className={styles.emptySubtitle}>
            Your cellar is currently empty. Explore our selection of rare single malts, reserve wines, and craft beers.
          </p>
          <Link to="/products" className={styles.shopBtn}>
            <span>🛍️</span>
            <span>Explore DrinkIt Catalog</span>
          </Link>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.emptyState} style={{ padding: '2.5rem 1rem' }}>
          <div className={styles.emptyIcon}>🔍</div>
          <h2 className={styles.emptyTitle}>No {activeTab.toLowerCase()} orders</h2>
          <p className={styles.emptySubtitle}>
            You don't have any orders matching the selected filter tab.
          </p>
          <button
            type="button"
            className={styles.filterTabActive}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', marginTop: '0.5rem' }}
            onClick={() => setActiveTab('ALL')}
          >
            Show All Orders
          </button>
        </div>
      ) : (
        <div className={styles.ordersList}>
          {filteredOrders.map((order) => {
            const currentStatus = order.orderStatus || order.status || 'PENDING';
            const payStatus = order.paymentStatus || 'PENDING';
            const orderTotal = order.total || order.totalAmount || 0;

            return (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderIdGroup}>
                    <span className={styles.orderId}>#{order.id}</span>
                    <span className={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`${styles.statusBadge} ${getStatusClass(currentStatus)}`}>
                      {currentStatus.replace(/_/g, ' ')}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: payStatus === 'PAID' ? 'rgba(46,213,115,0.15)' : 'rgba(255,255,255,0.08)',
                        color: payStatus === 'PAID' ? '#2ed573' : '#cfcad6',
                      }}
                    >
                      {payStatus}
                    </span>
                  </div>
                </div>

                <div className={styles.orderItems}>
                  {order.items?.map((item, idx) => (
                    <div key={idx} className={styles.itemRow}>
                      <div className={styles.itemLeft}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} className={styles.itemImg} />
                        ) : (
                          <span className={styles.itemEmoji}>🥃</span>
                        )}
                        <div>
                          <span>
                            {item.name} × <strong>{item.quantity}</strong>
                          </span>
                          {item.volume && (
                            <span style={{ color: '#8c8594', fontSize: '0.76rem', marginLeft: '0.4rem' }}>
                              ({item.volume})
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, color: '#fff' }}>
                        {formatINR(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.orderFooter}>
                  <div>
                    <span style={{ fontSize: '0.82rem', color: '#8c8594' }}>Total Amount: </span>
                    <span className={styles.totalAmount}>{formatINR(orderTotal)}</span>
                  </div>
                  <div className={styles.footerActions}>
                    {(order.orderStatus === 'OUT_FOR_DELIVERY' ||
                      order.orderStatus === 'READY' ||
                      order.orderStatus === 'DELIVERED') && (
                      <Link to={`/account/orders/${order.id}/track`} className={styles.trackOrderBtn}>
                        {order.orderStatus === 'DELIVERED' ? '🗺️ Delivery Route' : '🛵 Track Delivery'}
                      </Link>
                    )}
                    <Link to={`/account/orders/${order.id}`} className={styles.viewDetailsLink}>
                      View Details →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
