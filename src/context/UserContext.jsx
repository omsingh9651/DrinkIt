import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  getCustomerProfile,
  saveCustomerProfile,
  createDefaultProfile,
  getCustomerAddresses,
  saveCustomerAddresses,
  getCustomerWishlist,
  saveCustomerWishlist,
  getCustomerNotifications,
  saveCustomerNotifications,
} from '../services/userApi';
import { getMyOrders } from '../services/orderApi';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const phoneNumber = user?.phoneNumber || null;

  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load customer data whenever authenticated phone number changes
  useEffect(() => {
    let isMounted = true;

    if (!isAuthenticated || !phoneNumber) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setProfile(null);
          setAddresses([]);
          setWishlist([]);
          setNotifications([]);
          setOrders([]);
          setLoading(false);
        }
      });
      return;
    }

    Promise.all([
      getCustomerProfile(phoneNumber),
      getCustomerAddresses(phoneNumber),
      getCustomerWishlist(phoneNumber),
      getCustomerNotifications(phoneNumber),
      getMyOrders(phoneNumber).catch(() => []),
    ])
      .then(([prof, addrs, wish, notifs, ords]) => {
        if (!isMounted) return;
        const activeProfile = prof || createDefaultProfile(phoneNumber);
        setProfile(activeProfile);
        setAddresses(addrs || []);
        setWishlist(wish || []);
        setNotifications(notifs || []);
        setOrders(ords || []);
      })
      .catch((err) => {
        console.error('Error loading customer user state:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, phoneNumber]);

  /**
   * Re-fetch orders for the current customer
   */
  const refreshOrders = useCallback(async () => {
    if (!phoneNumber) return [];
    try {
      const fetched = await getMyOrders(phoneNumber);
      setOrders(fetched || []);
      return fetched;
    } catch (err) {
      console.error('Failed to refresh orders:', err);
      return [];
    }
  }, [phoneNumber]);

  /**
   * Update Profile
   */
  const updateProfile = useCallback(
    async (updates) => {
      if (!phoneNumber) return null;
      const saved = await saveCustomerProfile(phoneNumber, updates);
      setProfile(saved);
      return saved;
    },
    [phoneNumber]
  );

  /**
   * Add a new Address
   */
  const addAddress = useCallback(
    async (addressData) => {
      if (!phoneNumber) return;
      const newAddress = {
        ...addressData,
        id: `addr_${Date.now()}`,
        isDefault: addresses.length === 0 ? true : Boolean(addressData.isDefault),
        createdAt: new Date().toISOString(),
      };

      let nextList = [...addresses];
      if (newAddress.isDefault) {
        nextList = nextList.map((a) => ({ ...a, isDefault: false }));
      }
      nextList.push(newAddress);

      await saveCustomerAddresses(phoneNumber, nextList);
      setAddresses(nextList);
      return newAddress;
    },
    [phoneNumber, addresses]
  );

  /**
   * Edit an existing Address
   */
  const editAddress = useCallback(
    async (id, addressData) => {
      if (!phoneNumber) return;
      let nextList = addresses.map((a) => {
        if (a.id === id) {
          return { ...a, ...addressData, id };
        }
        if (addressData.isDefault) {
          return { ...a, isDefault: false };
        }
        return a;
      });

      await saveCustomerAddresses(phoneNumber, nextList);
      setAddresses(nextList);
    },
    [phoneNumber, addresses]
  );

  /**
   * Delete an Address
   */
  const deleteAddress = useCallback(
    async (id) => {
      if (!phoneNumber) return;
      let nextList = addresses.filter((a) => a.id !== id);

      // If we deleted the default and there are remaining addresses, make first default
      if (nextList.length > 0 && !nextList.some((a) => a.isDefault)) {
        nextList[0].isDefault = true;
      }

      await saveCustomerAddresses(phoneNumber, nextList);
      setAddresses(nextList);
    },
    [phoneNumber, addresses]
  );

  /**
   * Set an Address as Default
   */
  const setDefaultAddress = useCallback(
    async (id) => {
      if (!phoneNumber) return;
      const nextList = addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }));

      await saveCustomerAddresses(phoneNumber, nextList);
      setAddresses(nextList);
    },
    [phoneNumber, addresses]
  );

  /**
   * Wishlist handlers
   */
  const isInWishlist = useCallback(
    (productId) => {
      return wishlist.includes(productId);
    },
    [wishlist]
  );

  const addToWishlist = useCallback(
    async (productId) => {
      if (!phoneNumber || wishlist.includes(productId)) return;
      const nextList = [...wishlist, productId];
      await saveCustomerWishlist(phoneNumber, nextList);
      setWishlist(nextList);
    },
    [phoneNumber, wishlist]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      if (!phoneNumber) return;
      const nextList = wishlist.filter((id) => id !== productId);
      await saveCustomerWishlist(phoneNumber, nextList);
      setWishlist(nextList);
    },
    [phoneNumber, wishlist]
  );

  const toggleWishlist = useCallback(
    async (productId) => {
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(productId);
      }
    },
    [isInWishlist, removeFromWishlist, addToWishlist]
  );

  /**
   * Notifications handlers
   */
  const markNotificationRead = useCallback(
    async (id) => {
      if (!phoneNumber) return;
      const nextList = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      await saveCustomerNotifications(phoneNumber, nextList);
      setNotifications(nextList);
    },
    [phoneNumber, notifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!phoneNumber) return;
    const nextList = notifications.map((n) => ({ ...n, read: true }));
    await saveCustomerNotifications(phoneNumber, nextList);
    setNotifications(nextList);
  }, [phoneNumber, notifications]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const isProfileComplete = Boolean(
    profile && profile.profileCompleted && profile.fullName && profile.email && profile.dateOfBirth
  );

  const value = {
    profile,
    isProfileComplete,
    addresses,
    wishlist,
    orders,
    refreshOrders,
    notifications,
    unreadNotificationsCount,
    loading,
    updateProfile,
    addAddress,
    editAddress,
    deleteAddress,
    setDefaultAddress,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
