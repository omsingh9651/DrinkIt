import { useCart } from '../context/CartContext';
import styles from './Toast.module.css';

export default function Toast() {
  const { toastMessage } = useCart();

  if (!toastMessage) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.icon}>🛒</span>
      <span className={styles.text}>{toastMessage}</span>
    </div>
  );
}

