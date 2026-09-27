import { User } from '../models/User.js';
import { isDbConnected } from '../config/db.js';
import { orderRepository } from './orderRepository.js';

const INITIAL_CUSTOMERS = [
  {
    phone: '9876543210',
    phoneNumber: '+91 9876543210',
    fullName: 'Aarav Sharma',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    dateOfBirth: '1992-05-14',
    gender: 'Male',
    profileImage: '🍷',
    phoneVerified: true,
    ageVerified: true,
    isActive: true,
    savedAddresses: [
      {
        id: 'addr_aarav_1',
        fullName: 'Aarav Sharma',
        mobileNumber: '9876543210',
        house: 'Flat 402, Tower 5',
        street: 'Sector 62',
        city: 'Noida',
        district: 'Gautam Buddha Nagar',
        state: 'Uttar Pradesh',
        pinCode: '201309',
        type: 'Home',
        isDefault: true,
        latitude: 28.628,
        longitude: 77.3649,
      },
    ],
    createdAt: new Date('2026-01-02T10:00:00Z').toISOString(),
  },
  {
    phone: '9812345678',
    phoneNumber: '+91 9812345678',
    fullName: 'Priya Nair',
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    dateOfBirth: '1995-11-20',
    gender: 'Female',
    profileImage: '🍸',
    phoneVerified: true,
    ageVerified: true,
    isActive: true,
    savedAddresses: [
      {
        id: 'addr_priya_1',
        fullName: 'Priya Nair',
        mobileNumber: '9812345678',
        house: 'Villa 12, Palm Grove',
        street: 'Golf Course Road',
        city: 'Gurugram',
        district: 'Gurugram',
        state: 'Haryana',
        pinCode: '122002',
        type: 'Home',
        isDefault: true,
        latitude: 28.4595,
        longitude: 77.0266,
      },
    ],
    createdAt: new Date('2026-01-05T14:30:00Z').toISOString(),
  },
  {
    phone: '9988776655',
    phoneNumber: '+91 9988776655',
    fullName: 'Rohan Verma',
    name: 'Rohan Verma',
    email: 'rohan.verma@example.com',
    dateOfBirth: '1989-08-03',
    gender: 'Male',
    profileImage: '🍺',
    phoneVerified: true,
    ageVerified: true,
    isActive: true,
    savedAddresses: [
      {
        id: 'addr_rohan_1',
        fullName: 'Rohan Verma',
        mobileNumber: '9988776655',
        house: 'C-18, Hauz Khas',
        street: 'Aurobindo Marg',
        city: 'New Delhi',
        district: 'South Delhi',
        state: 'Delhi',
        pinCode: '110016',
        type: 'Home',
        isDefault: true,
        latitude: 28.5494,
        longitude: 77.2001,
      },
    ],
    createdAt: new Date('2026-01-08T18:15:00Z').toISOString(),
  },
  {
    phone: '9823456789',
    phoneNumber: '+91 9823456789',
    fullName: 'Meera Patel',
    name: 'Meera Patel',
    email: 'meera.patel@example.com',
    dateOfBirth: '1996-03-27',
    gender: 'Female',
    profileImage: '🍾',
    phoneVerified: true,
    ageVerified: true,
    isActive: true,
    savedAddresses: [
      {
        id: 'addr_meera_1',
        fullName: 'Meera Patel',
        mobileNumber: '9823456789',
        house: 'B-201, Indirapuram',
        street: 'Ahinsa Khand 2',
        city: 'Ghaziabad',
        district: 'Ghaziabad',
        state: 'Uttar Pradesh',
        pinCode: '201014',
        type: 'Home',
        isDefault: true,
        latitude: 28.6369,
        longitude: 77.3712,
      },
    ],
    createdAt: new Date('2026-01-10T11:45:00Z').toISOString(),
  },
];

class UserRepository {
  constructor() {
    this.memoryUsers = new Map();
    for (const c of INITIAL_CUSTOMERS) {
      this.memoryUsers.set(c.phone, { ...c, addresses: c.savedAddresses });
    }
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await User.countDocuments();
      if (count === 0) {
        await User.insertMany(INITIAL_CUSTOMERS);
        console.log('[UserRepository] Seeded initial customer profiles into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[UserRepository] Failed to seed customer profiles into MongoDB:', err.message);
    }
  }

  cleanPhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '').slice(-10);
  }

  /**
   * Get user profile by clean 10-digit phone
   */
  async getByPhone(phone) {
    await this.seedDatabaseIfEmpty();
    const clean = this.cleanPhone(phone);
    if (!clean) return null;

    if (isDbConnected()) {
      const user = await User.findOne({ phone: clean }).exec();
      if (user) return user.toJSON();
    } else {
      if (this.memoryUsers.has(clean)) {
        return this.memoryUsers.get(clean);
      }
    }

    // Default initialized profile
    return {
      id: `user_${clean}`,
      phone: clean,
      phoneNumber: `+91 ${clean}`,
      phoneVerified: true,
      fullName: '',
      name: '',
      email: '',
      dateOfBirth: '',
      gender: '',
      profileImage: '🥃',
      ageVerificationStatus: 'pending',
      ageVerified: false,
      isActive: true,
      savedAddresses: [],
      addresses: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Update or create profile
   */
  async upsertProfile(phone, data) {
    await this.seedDatabaseIfEmpty();
    const clean = this.cleanPhone(phone);
    if (!clean) throw new Error('Phone number is required.');

    const updatePayload = {
      ...data,
      phone: clean,
      phoneNumber: `+91 ${clean}`,
      phoneVerified: true,
    };

    if (updatePayload.name && !updatePayload.fullName) updatePayload.fullName = updatePayload.name;
    if (updatePayload.fullName && !updatePayload.name) updatePayload.name = updatePayload.fullName;

    if (isDbConnected()) {
      const user = await User.findOneAndUpdate(
        { phone: clean },
        { $set: updatePayload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();

      const userJson = user.toJSON();
      userJson.addresses = userJson.savedAddresses;
      return userJson;
    }

    // In-memory fallback
    const existing = (await this.getByPhone(clean)) || {};
    const merged = {
      ...existing,
      ...updatePayload,
      updatedAt: new Date().toISOString(),
    };
    merged.addresses = merged.savedAddresses || merged.addresses || [];
    this.memoryUsers.set(clean, merged);
    return merged;
  }

  /**
   * Fetch all registered customers for Admin with order history aggregation
   */
  async getAllCustomers({ search = '', status = 'ALL', page = 1, limit = 20 } = {}) {
    await this.seedDatabaseIfEmpty();

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);

    let rawUsers;
    if (isDbConnected()) {
      const docs = await User.find({}).sort({ createdAt: -1 }).lean().exec();
      rawUsers = docs.map((d) => ({
        ...d,
        id: d.id || `user_${d.phone}`,
        addresses: d.savedAddresses || [],
      }));
    } else {
      rawUsers = Array.from(this.memoryUsers.values());
      rawUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // Correlate with orders to compute orderCount, totalSpend, and lastOrderDate
    const enriched = await Promise.all(
      rawUsers.map(async (u) => {
        const orders = await orderRepository.getByCustomer(u.phone);
        const nonCancelled = orders.filter((o) => o.orderStatus !== 'CANCELLED');
        const totalSpend = nonCancelled.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const lastOrder = orders.length > 0 ? orders[0] : null;

        return {
          id: u.id || `user_${u.phone}`,
          phone: u.phone,
          phoneNumber: u.phoneNumber || `+91 ${u.phone}`,
          fullName: u.fullName || u.name || 'DrinkIt Customer',
          email: u.email || '',
          city: u.savedAddresses?.[0]?.city || u.addresses?.[0]?.city || 'Delhi NCR',
          isActive: u.isActive !== false,
          phoneVerified: u.phoneVerified !== false,
          ageVerified: Boolean(u.ageVerified),
          orderCount: orders.length,
          totalSpend,
          lastOrderDate: lastOrder ? lastOrder.createdAt : null,
          createdAt: u.createdAt,
        };
      })
    );

    // Apply filtering
    let filtered = enriched;
    if (status === 'ACTIVE') {
      filtered = filtered.filter((u) => u.isActive !== false);
    } else if (status === 'INACTIVE') {
      filtered = filtered.filter((u) => u.isActive === false);
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (u) =>
          u.phone.includes(term) ||
          u.fullName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.city.toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const skip = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(skip, skip + limitNum);

    const metrics = {
      totalCustomers: enriched.length,
      activeCustomers: enriched.filter((u) => u.isActive !== false).length,
      inactiveCustomers: enriched.filter((u) => u.isActive === false).length,
      totalRevenue: enriched.reduce((sum, u) => sum + u.totalSpend, 0),
    };

    return {
      customers: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      metrics,
    };
  }

  /**
   * Get customer details and complete order history
   */
  async getCustomerDetails(phone) {
    const clean = this.cleanPhone(phone);
    const profile = await this.getByPhone(clean);
    if (!profile) return null;

    const orders = await orderRepository.getByCustomer(clean);
    const nonCancelled = orders.filter((o) => o.orderStatus !== 'CANCELLED');
    const totalSpend = nonCancelled.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return {
      profile,
      orders,
      stats: {
        orderCount: orders.length,
        totalSpend,
        lastOrderDate: orders.length > 0 ? orders[0].createdAt : null,
      },
    };
  }

  /**
   * Activate or deactivate customer account securely
   */
  async updateCustomerStatus(phone, { isActive }) {
    const clean = this.cleanPhone(phone);
    const activeBool = Boolean(isActive);

    if (isDbConnected()) {
      await User.updateOne({ phone: clean }, { $set: { isActive: activeBool } }).exec();
    }

    if (this.memoryUsers.has(clean)) {
      const user = this.memoryUsers.get(clean);
      user.isActive = activeBool;
      this.memoryUsers.set(clean, user);
    }

    return { success: true, phone: clean, isActive: activeBool };
  }

  /**
   * Get saved addresses
   */
  async getAddresses(phone) {
    const user = await this.getByPhone(phone);
    return user ? user.savedAddresses || user.addresses || [] : [];
  }

  /**
   * Add a new saved address
   */
  async addAddress(phone, addressData) {
    const clean = this.cleanPhone(phone);
    if (!clean) throw new Error('Phone number is required.');

    const addressId = addressData.id || `addr_${Date.now()}`;
    const newAddress = {
      ...addressData,
      id: addressId,
      fullName: addressData.fullName || 'Customer',
      mobileNumber: addressData.mobileNumber || clean,
      house: addressData.house || '',
      street: addressData.street || '',
      city: addressData.city || 'Kanpur',
      state: addressData.state || 'Uttar Pradesh',
      pinCode: addressData.pinCode || '208001',
      type: addressData.type || 'Home',
      latitude: Number(addressData.latitude) || 26.5037,
      longitude: Number(addressData.longitude) || 80.2525,
      createdAt: new Date().toISOString(),
    };

    if (isDbConnected()) {
      await User.findOneAndUpdate(
        { phone: clean },
        {
          $push: { savedAddresses: newAddress },
          $setOnInsert: {
            phone: clean,
            phoneNumber: `+91 ${clean}`,
            phoneVerified: true,
          },
        },
        { upsert: true, new: true }
      ).exec();

      return newAddress;
    }

    // In-memory fallback
    const user = await this.getByPhone(clean);
    user.savedAddresses = [...(user.savedAddresses || user.addresses || []), newAddress];
    user.addresses = user.savedAddresses;
    this.memoryUsers.set(clean, user);
    return newAddress;
  }

  /**
   * Delete saved address
   */
  async deleteAddress(phone, addressId) {
    const clean = this.cleanPhone(phone);
    if (!clean) return false;

    if (isDbConnected()) {
      await User.updateOne(
        { phone: clean },
        { $pull: { savedAddresses: { id: addressId } } }
      ).exec();
      return true;
    }

    // In-memory fallback
    const user = await this.getByPhone(clean);
    if (!user) return false;
    user.savedAddresses = (user.savedAddresses || user.addresses || []).filter((a) => a.id !== addressId);
    user.addresses = user.savedAddresses;
    this.memoryUsers.set(clean, user);
    return true;
  }
}

export const userRepository = new UserRepository();
export default userRepository;
