import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, getMe, logoutCustomer } from '../services/authApi';

const AuthContext = createContext();

const STORAGE_KEY = 'drinkit_user_session';
const TOKEN_KEY = 'drinkit_customer_token';

export function AuthProvider({ children }) {
  // Initialize user session from localStorage
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Failed to parse stored user session:', e);
      return null;
    }
  });

  const [isServerConfigured, setIsServerConfigured] = useState(true);
  const [loading, setLoading] = useState(() => {
    try {
      return Boolean(localStorage.getItem(TOKEN_KEY) || localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  });

  /**
   * Sign out the user and clear local session & server cookie
   */
  const logout = useCallback(async () => {
    try {
      await logoutCustomer().catch(() => {});
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('drinkit:auth-logout'));
    }
  }, []);

  // Check backend auth status & verify customer session on mount
  useEffect(() => {
    let isMounted = true;

    // Check MSG91 backend configuration
    checkAuthStatus().then((status) => {
      if (isMounted) {
        setIsServerConfigured(status.isConfigured);
      }
    });

    // Validate active session token against server
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(STORAGE_KEY);

    if (!token && !storedUser) {
      return;
    }

    getMe()
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.user) {
          setUser((prev) => ({
            ...(prev || {}),
            ...data.user,
            token: token || prev?.token,
          }));
        } else {
          logout();
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // If server rejected with 401 Unauthorized (expired, tampered, invalid token)
        if (err.status === 401 || err.statusCode === 401) {
          console.warn('Customer session token invalid or expired. Terminating session.');
          logout();
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [logout]);

  // Listen for global auth-expired events dispatched by API services
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };
    window.addEventListener('drinkit:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('drinkit:auth-expired', handleAuthExpired);
  }, [logout]);

  // Sync changes to localStorage
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to update localStorage user session:', e);
    }
  }, [user]);

  /**
   * Log in user with authenticated details
   * @param {Object} userData - e.g. { phoneNumber: '+91 9876543210', token: string, verifiedAt: string }
   */
  const loginUser = useCallback((userData) => {
    const token = userData?.token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    const sessionData = {
      ...userData,
      token,
      provider: 'msg91-backend',
      authenticatedAt: userData.verifiedAt || new Date().toISOString(),
    };
    setUser(sessionData);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        phoneNumber: user?.phoneNumber || null,
        loginUser,
        logout,
        isServerConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
