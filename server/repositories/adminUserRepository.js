import { AdminUser } from '../models/AdminUser.js';
import { isDbConnected } from '../config/db.js';
import { ADMIN_ROLES } from '../middleware/adminAuth.js';

const defaultHash = process.env.ADMIN_PASSWORD_HASH || '';

const INITIAL_ADMINS = [
  {
    id: 'adm-super-root',
    name: 'Super Administrator',
    email: 'admin@drinkit.com',
    passwordHash: defaultHash,
    role: ADMIN_ROLES.SUPER_ADMIN,
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'adm-inv-mgr',
    name: 'Vikram Mehta (Inventory Ops)',
    email: 'inventory@drinkit.com',
    passwordHash: defaultHash,
    role: ADMIN_ROLES.INVENTORY_MANAGER,
    isActive: true,
    lastLogin: new Date('2026-01-15T09:30:00Z').toISOString(),
    createdAt: new Date('2026-01-05T00:00:00Z').toISOString(),
  },
  {
    id: 'adm-ord-mgr',
    name: 'Ananya Roy (Logistics Dispatch)',
    email: 'dispatch@drinkit.com',
    passwordHash: defaultHash,
    role: ADMIN_ROLES.ORDER_MANAGER,
    isActive: true,
    lastLogin: new Date('2026-01-18T14:15:00Z').toISOString(),
    createdAt: new Date('2026-01-08T00:00:00Z').toISOString(),
  },
  {
    id: 'adm-content-mgr',
    name: 'Kavita Sen (Brand Merchandising)',
    email: 'merchandising@drinkit.com',
    passwordHash: defaultHash,
    role: ADMIN_ROLES.CONTENT_MANAGER,
    isActive: true,
    lastLogin: new Date('2026-01-20T11:00:00Z').toISOString(),
    createdAt: new Date('2026-01-10T00:00:00Z').toISOString(),
  },
];

class AdminUserRepository {
  constructor() {
    this.memoryAdmins = JSON.parse(JSON.stringify(INITIAL_ADMINS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await AdminUser.countDocuments();
      if (count === 0) {
        await AdminUser.insertMany(INITIAL_ADMINS);
        console.log('[AdminUserRepository] Seeded initial admin users into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[AdminUserRepository] Failed to seed admin users to MongoDB:', err.message);
    }
  }

  /**
   * Fetch all admin users (without password hashes)
   */
  async getAll() {
    await this.seedDatabaseIfEmpty();

    if (isDbConnected()) {
      const docs = await AdminUser.find({}, '-passwordHash').sort({ createdAt: 1 }).lean().exec();
      return docs.map((d) => ({
        ...d,
        id: d.id || d._id?.toString(),
      }));
    }

    return this.memoryAdmins.map((a) => {
      const copy = { ...a };
      delete copy.passwordHash;
      return copy;
    });
  }

  /**
   * Find admin user by email (includes passwordHash for authentication)
   */
  async getByEmail(email) {
    await this.seedDatabaseIfEmpty();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (isDbConnected()) {
      const doc = await AdminUser.findOne({ email: cleanEmail }).exec();
      if (doc) {
        const obj = doc.toObject();
        return { ...obj, id: obj.id || obj._id.toString() };
      }
    }

    const found = this.memoryAdmins.find((a) => a.email.toLowerCase() === cleanEmail);
    return found ? { ...found } : null;
  }

  /**
   * Find admin user by ID
   */
  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await AdminUser.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }, '-passwordHash')
        .lean()
        .exec();
      if (doc) return { ...doc, id: doc.id || doc._id.toString() };
    }

    const found = this.memoryAdmins.find((a) => a.id === id);
    if (found) {
      const copy = { ...found };
      delete copy.passwordHash;
      return copy;
    }
    return null;
  }

  /**
   * Count active super_admins
   */
  async countActiveSuperAdmins() {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      return AdminUser.countDocuments({ role: ADMIN_ROLES.SUPER_ADMIN, isActive: true }).exec();
    }
    return this.memoryAdmins.filter((a) => a.role === ADMIN_ROLES.SUPER_ADMIN && a.isActive !== false).length;
  }

  /**
   * Create new admin user
   */
  async create(data) {
    const cleanEmail = String(data.email).trim().toLowerCase();
    const newAdmin = {
      id: data.id || `adm-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`,
      name: data.name.trim(),
      email: cleanEmail,
      passwordHash: data.passwordHash,
      role: data.role || ADMIN_ROLES.ADMIN,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      lastLogin: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDbConnected()) {
      const doc = await AdminUser.create(newAdmin);
      const res = doc.toJSON();
      this.memoryAdmins.push({ ...newAdmin });
      return res;
    }

    this.memoryAdmins.push({ ...newAdmin });
    const copy = { ...newAdmin };
    delete copy.passwordHash;
    return copy;
  }

  /**
   * Update admin user
   */
  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Admin user with ID "${id}" not found.`);
    }

    // Guardrail: prevent deactivating the last active super_admin
    if (existing.role === ADMIN_ROLES.SUPER_ADMIN && (data.isActive === false || (data.role && data.role !== ADMIN_ROLES.SUPER_ADMIN))) {
      const superCount = await this.countActiveSuperAdmins();
      if (superCount <= 1) {
        throw new Error('Operation blocked: Cannot de-escalate or deactivate the only remaining active Super Administrator.');
      }
    }

    const updates = { ...data, updatedAt: new Date().toISOString() };
    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();

    if (isDbConnected()) {
      const updated = await AdminUser.findOneAndUpdate(
        { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        { $set: updates },
        { new: true, runValidators: true }
      )
        .select('-passwordHash')
        .lean()
        .exec();

      if (updated) {
        const memIdx = this.memoryAdmins.findIndex((a) => a.id === id);
        if (memIdx !== -1) {
          this.memoryAdmins[memIdx] = { ...this.memoryAdmins[memIdx], ...updates };
        }
        return { ...updated, id: updated.id || updated._id.toString() };
      }
    }

    const memIdx = this.memoryAdmins.findIndex((a) => a.id === id);
    if (memIdx !== -1) {
      this.memoryAdmins[memIdx] = { ...this.memoryAdmins[memIdx], ...updates };
      const copy = { ...this.memoryAdmins[memIdx] };
      delete copy.passwordHash;
      return copy;
    }

    throw new Error(`Admin user "${id}" could not be updated.`);
  }

  /**
   * Delete admin user
   */
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Admin user with ID "${id}" not found.`);
    }

    // Guardrail: prevent deleting the last active super_admin
    if (existing.role === ADMIN_ROLES.SUPER_ADMIN) {
      const superCount = await this.countActiveSuperAdmins();
      if (superCount <= 1) {
        throw new Error('Operation blocked: Cannot delete the only remaining active Super Administrator.');
      }
    }

    if (isDbConnected()) {
      await AdminUser.deleteOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }).exec();
    }

    this.memoryAdmins = this.memoryAdmins.filter((a) => a.id !== id);
    return { success: true, id, message: `Admin user "${existing.email}" deleted successfully.` };
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const now = new Date();

    if (isDbConnected()) {
      await AdminUser.updateOne({ email: cleanEmail }, { $set: { lastLogin: now } }).exec();
    }

    const found = this.memoryAdmins.find((a) => a.email.toLowerCase() === cleanEmail);
    if (found) {
      found.lastLogin = now.toISOString();
    }
  }
}

export const adminUserRepository = new AdminUserRepository();
export default adminUserRepository;

