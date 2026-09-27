import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginAdmin, logoutAdmin, getAdminMe } from '../services/adminAuthApi';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verify active admin session on mount via HTTP-only cookie
  useEffect(() => {
    let isMounted = true;
    getAdminMe()
      .then((data) => {
        if (isMounted && data?.success && data?.admin) {
          setAdmin(data.admin);
        } else if (isMounted) {
          setAdmin(null);
        }
      })
      .catch(() => {
        if (isMounted) setAdmin(null);
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
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    }
  }, []);

  /**
   * Log in administrator
   */
  const login = async (email, password) => {
    const data = await loginAdmin({ email, password });
    if (data && data.success && data.admin) {
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
