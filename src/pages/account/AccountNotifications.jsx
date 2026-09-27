import { useUser } from '../../context/UserContext';
import styles from './AccountNotifications.module.css';

export default function AccountNotifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useUser();

  const getIcon = (type) => {
    switch (type) {
      case 'offer':
        return '🎟️';
      case 'order':
        return '📦';
      default:
        return '🔔';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1>Notifications & Alerts</h1>
          <p>Order tracking milestones, dispatch alerts, and tasting events.</p>
        </div>

        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className={styles.markReadBtn}
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No notifications at the moment.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}
              onClick={() => markNotificationRead(n.id)}
            >
              <div className={styles.iconWrapper}>{getIcon(n.type)}</div>
              <div className={styles.meta}>
                <div className={styles.titleRow}>
                  <span className={styles.title}>{n.title}</span>
                  <span className={styles.date}>
                    {new Date(n.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <p className={styles.message}>{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
