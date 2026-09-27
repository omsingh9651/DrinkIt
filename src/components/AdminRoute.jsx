import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

/**
 * AdminRoute guard component.
 * Verifies that administrator session is authenticated with valid HTTP-only cookie.
 * Redirects unauthenticated visitors directly to /admin/login.
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0d11',
          color: '#e2d9cc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(229, 168, 75, 0.2)',
            borderTopColor: '#e5a84b',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#a09ba6', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
          VERIFYING ADMIN ACCESS...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
