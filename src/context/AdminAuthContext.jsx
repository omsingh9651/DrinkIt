import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loginAdmin,
  logoutAdmin,
  getAdminMe,
  getAdminToken,
  setAdminToken,
  removeAdminToken,
  ADMIN_USER_KEY,
} from '../services/adminAuthApi';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  // Pre-seed admin state from local storage if available to avoid unnecessary redirect flash
  const [admin, setAdmin] = useState(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    const token = getAdminToken();
    if (!token) return null;
    try {
      const stored = localStorage.getItem(ADMIN_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Verify active admin session on mount via Bearer token / HTTP-only cookie
  useEffect(() => {
    let isMounted = true;
    getAdminMe()
      .then((data) => {
        if (isMounted && data?.success && data?.admin) {
          setAdmin(data.admin);
          if (data.token) {
            setAdminToken(data.token);
          }
        } else if (isMounted) {
          setAdmin(null);
          removeAdminToken();
        }
      })
      .catch((err) => {
        if (isMounted) {
          // If explicitly unauthorized, clear stored session
          if (err.status === 401 || err.status === 403) {
            setAdmin(null);
            removeAdminToken();
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshAdmin = useCallback(async () => {
    try {
      const data = await getAdminMe();
      if (data?.success && data?.admin) {
        setAdmin(data.admin);
        if (data.token) setAdminToken(data.token);
      } else {
        setAdmin(null);
        removeAdminToken();
      }
    } catch {
      setAdmin(null);
      removeAdminToken();
    }
  }, []);

  /**
   * Log in administrator
   */
  const login = async (email, password) => {
    const data = await loginAdmin({ email, password });
    if (data && data.success && data.admin) {
      if (data.token) {
        setAdminToken(data.token);
      }
      setAdmin(data.admin);
    }
    return data;
  };

  /**
   * Log out administrator
   */
  const logout = async () => {
    try {
      await logoutAdmin();
    } catch (err) {
      console.warn('Admin logout API warning:', err);
    } finally {
      removeAdminToken();
      setAdmin(null);
    }
  };

  const value = {
    admin,
    isAuthenticated: Boolean(admin),
    role: admin?.role || null,
    loading,
    login,
    logout,
    refreshAdmin,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
