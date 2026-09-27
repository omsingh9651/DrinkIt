/**
 * DrinkIt Customer User Service & API Abstraction
 *
 * In Phase 1, stores and synchronizes customer profiles, addresses, wishlist,
 * and notifications locally with support for backend sync.
 * Designed to seamlessly plug into MongoDB / REST API in Phase 2 without
 * requiring refactoring in UI components.
 */

import { getApiUrl } from './apiConfig';

const STORAGE_PREFIX = 'drinkit_customer_';

/**
 * Helper to get user-specific storage key
 */
function getUserKey(phoneNumber, key) {
  const clean = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
  return `${STORAGE_PREFIX}${clean || 'guest'}_${key}`;
}

/**
 * Initial empty profile template
 */
export function createDefaultProfile(phoneNumber) {
  const clean = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
  return {
    id: `user_${clean || Date.now()}`,
    phoneNumber: clean ? `+91 ${clean}` : '',
    phoneVerified: Boolean(clean),
    fullName: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    profileImage: '',
    ageVerificationStatus: 'pending', // 'pending' | 'verified' | 'failed'
    profileCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fetch profile for a customer
 */
export async function getCustomerProfile(phoneNumber) {
  if (!phoneNumber) return null;

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('drinkit_customer_token') : null;
  if (token) {
    try {
      const res = await fetch(getApiUrl('/api/users/me'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const key = getUserKey(phoneNumber, 'profile');
          localStorage.setItem(key, JSON.stringify(data.user));
          return data.user;
        }
      }
    } catch {
      // Fallback to localStorage on network disconnect
    }
  }

  const key = getUserKey(phoneNumber, 'profile');
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse customer profile from storage:', err);
    return null;
  }
}

/**
 * Save / Update customer profile
 */
export async function saveCustomerProfile(phoneNumber, profileData) {
  if (!phoneNumber) throw new Error('Phone number is required to save profile.');
  const key = getUserKey(phoneNumber, 'profile');
  const existing = (await getCustomerProfile(phoneNumber)) || createDefaultProfile(phoneNumber);

  const updated = {
    ...existing,
    ...profileData,
    phoneNumber: existing.phoneNumber || profileData.phoneNumber,
    phoneVerified: true,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(key, JSON.stringify(updated));

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('drinkit_customer_token') : null;
  if (token) {
    try {
      await fetch(getApiUrl('/api/users/me'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.warn('Backend profile update deferred:', e.message);
    }
  }

  return updated;
}

/**
 * Fetch saved addresses for a customer
 */
export async function getCustomerAddresses(phoneNumber) {
  if (!phoneNumber) return [];
  const key = getUserKey(phoneNumber, 'addresses');
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save full address list
 */
export async function saveCustomerAddresses(phoneNumber, addresses) {
  if (!phoneNumber) return [];
  const key = getUserKey(phoneNumber, 'addresses');
  localStorage.setItem(key, JSON.stringify(addresses));
  return addresses;
}

/**
 * Fetch customer wishlist (array of product IDs)
 */
export async function getCustomerWishlist(phoneNumber) {
  if (!phoneNumber) return [];
  const key = getUserKey(phoneNumber, 'wishlist');
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save customer wishlist
 */
export async function saveCustomerWishlist(phoneNumber, wishlist) {
  if (!phoneNumber) return [];
  const key = getUserKey(phoneNumber, 'wishlist');
  localStorage.setItem(key, JSON.stringify(wishlist));
  return wishlist;
}

/**
 * Fetch customer notifications
 */
export async function getCustomerNotifications(phoneNumber) {
  if (!phoneNumber) return [];
  const key = getUserKey(phoneNumber, 'notifications');
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);

    // Initial starter notifications for new customers
    const initialNotes = [
      {
        id: 'notif_welcome',
        title: 'Welcome to DrinkIt Reserve 🥃',
        message: 'Your account is ready. Explore our hand-crafted selection of premium wines, single malts, and craft spirits.',
        date: new Date().toISOString(),
        read: false,
        type: 'account',
      },
      {
        id: 'notif_promo',
        title: 'Special Offer: 10% Off Your First Order',
        message: 'Use promo code DRINKIT10 at checkout to enjoy 10% discount on orders above ₹1,000.',
        date: new Date(Date.now() - 3600000).toISOString(),
        read: false,
        type: 'offer',
      },
    ];
    localStorage.setItem(key, JSON.stringify(initialNotes));
    return initialNotes;
  } catch {
    return [];
  }
}

/**
 * Save customer notifications
 */
export async function saveCustomerNotifications(phoneNumber, notifications) {
  if (!phoneNumber) return [];
  const key = getUserKey(phoneNumber, 'notifications');
  localStorage.setItem(key, JSON.stringify(notifications));
  return notifications;
}
