import { Navigate } from 'react-router-dom';

/**
 * Admin Delivery Simulator View Alias
 * Automatically forwards to the unified two-panel Admin Delivery Center (/admin/delivery)
 */
export default function AdminDeliverySimulator() {
  return <Navigate to="/admin/delivery" replace />;
}
