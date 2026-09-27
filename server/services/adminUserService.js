import bcrypt from 'bcryptjs';
import { adminUserRepository } from '../repositories/adminUserRepository.js';
import { activityLogRepository } from '../repositories/activityLogRepository.js';
import { ADMIN_ROLES } from '../middleware/adminAuth.js';

const VALID_ROLES = Object.values(ADMIN_ROLES);

class AdminUserService {
  /**
   * Validate admin user payload
   */
  validatePayload(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate || data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
        errors.push('Full name must be at least 2 characters long.');
      }
    }

    if (!isUpdate || data.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!data.email || !emailRegex.test(String(data.email).trim())) {
        errors.push('A valid email address is required.');
      }
    }

    if (!isUpdate && (!data.password || String(data.password).length < 8)) {
      errors.push('Password must be at least 8 characters long.');
    } else if (isUpdate && data.password && String(data.password).length < 8) {
      errors.push('New password must be at least 8 characters long.');
    }

    if (data.role && !VALID_ROLES.includes(data.role)) {
      errors.push(`Invalid role "${data.role}". Valid roles: ${VALID_ROLES.join(', ')}`);
    }

    return errors;
  }

  /**
   * List all admin users
   */
  async getAllAdmins() {
    return adminUserRepository.getAll();
  }

  /**
   * Get single admin user
   */
  async getAdminById(id) {
    return adminUserRepository.getById(id);
  }

  /**
   * Create new admin user
   */
  async createAdmin(data, performingAdmin = {}) {
    const errors = this.validatePayload(data, false);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const cleanEmail = String(data.email).trim().toLowerCase();
    const existing = await adminUserRepository.getByEmail(cleanEmail);
    if (existing) {
      throw new Error(`An administrator account with email "${cleanEmail}" already exists.`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(data.password), salt);

    const created = await adminUserRepository.create({
      name: data.name.trim(),
      email: cleanEmail,
      passwordHash,
      role: data.role || ADMIN_ROLES.ADMIN,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });

    await activityLogRepository.logAction({
      adminEmail: performingAdmin.email || 'admin@drinkit.com',
      adminRole: performingAdmin.role || 'super_admin',
      action: 'CREATE',
      module: 'ADMIN_USERS',
      targetId: created.email,
      description: `Created new admin account for ${created.name} (${created.role})`,
      metadata: { adminId: created.id, email: created.email, role: created.role },
    });

    return created;
  }

  /**
   * Update admin user details or password
   */
  async updateAdmin(id, data, performingAdmin = {}) {
    const errors = this.validatePayload(data, true);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const updateData = { ...data };

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(String(data.password), salt);
      delete updateData.password;
    }

    const updated = await adminUserRepository.update(id, updateData);

    await activityLogRepository.logAction({
      adminEmail: performingAdmin.email || 'admin@drinkit.com',
      adminRole: performingAdmin.role || 'super_admin',
      action: 'UPDATE',
      module: 'ADMIN_USERS',
      targetId: updated.email,
      description: `Updated admin profile for ${updated.name} (${updated.email})`,
      metadata: { adminId: id, email: updated.email, role: updated.role, isActive: updated.isActive },
    });

    return updated;
  }

  /**
   * Delete admin user
   */
  async deleteAdmin(id, performingAdmin = {}) {
    const target = await adminUserRepository.getById(id);
    if (!target) {
      throw new Error(`Admin user not found.`);
    }

    const result = await adminUserRepository.delete(id);

    await activityLogRepository.logAction({
      adminEmail: performingAdmin.email || 'admin@drinkit.com',
      adminRole: performingAdmin.role || 'super_admin',
      action: 'DELETE',
      module: 'ADMIN_USERS',
      targetId: target.email,
      description: `Deleted admin user ${target.name} (${target.email})`,
      metadata: { adminId: id, email: target.email, role: target.role },
    });

    return result;
  }
}

export const adminUserService = new AdminUserService();
export default adminUserService;

