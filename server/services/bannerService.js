import { bannerRepository } from '../repositories/bannerRepository.js';
import { activityLogRepository } from '../repositories/activityLogRepository.js';

class BannerService {
  /**
   * Validate banner fields
   */
  validateBannerPayload(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate || data.title !== undefined) {
      if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
        errors.push('Banner title is required.');
      }
    }

    if (!isUpdate || data.image !== undefined) {
      if (!data.image || typeof data.image !== 'string' || !data.image.trim()) {
        errors.push('Banner image URL is required.');
      } else {
        const urlStr = data.image.trim();
        if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://') && !urlStr.startsWith('/')) {
          errors.push('Image URL must start with http://, https://, or /');
        }
      }
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start > end) {
        errors.push('Start date cannot be after end date.');
      }
    }

    return errors;
  }

  /**
   * Public: get active banners for home screen
   */
  async getActiveBanners() {
    return bannerRepository.getActiveBanners();
  }

  /**
   * Admin: get all banners with search & filters
   */
  async getAllBanners(params) {
    return bannerRepository.getAll(params);
  }

  /**
   * Admin: get single banner
   */
  async getBannerById(id) {
    return bannerRepository.getById(id);
  }

  /**
   * Admin: create new promotional banner
   */
  async createBanner(data, adminUser = {}) {
    const errors = this.validateBannerPayload(data, false);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const created = await bannerRepository.create({
      title: data.title.trim(),
      subtitle: data.subtitle ? data.subtitle.trim() : '',
      badgeText: data.badgeText ? data.badgeText.trim() : 'PROMOTION',
      image: data.image.trim(),
      ctaText: data.ctaText ? data.ctaText.trim() : 'Explore Now',
      ctaLink: data.ctaLink ? data.ctaLink.trim() : '/products',
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      displayOrder: Number(data.displayOrder) || 1,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });

    await activityLogRepository.logAction({
      adminEmail: adminUser.email || 'admin@drinkit.com',
      adminRole: adminUser.role || 'admin',
      action: 'CREATE',
      module: 'BANNERS',
      targetId: created.id,
      description: `Created promotional banner "${created.title}"`,
      metadata: { bannerId: created.id, title: created.title, ctaLink: created.ctaLink },
    });

    return created;
  }

  /**
   * Admin: update banner
   */
  async updateBanner(id, data, adminUser = {}) {
    const errors = this.validateBannerPayload(data, true);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const updated = await bannerRepository.update(id, data);

    await activityLogRepository.logAction({
      adminEmail: adminUser.email || 'admin@drinkit.com',
      adminRole: adminUser.role || 'admin',
      action: 'UPDATE',
      module: 'BANNERS',
      targetId: id,
      description: `Updated banner "${updated.title}"`,
      metadata: { bannerId: id, updates: data },
    });

    return updated;
  }

  /**
   * Admin: delete banner
   */
  async deleteBanner(id, adminUser = {}) {
    const result = await bannerRepository.delete(id);

    await activityLogRepository.logAction({
      adminEmail: adminUser.email || 'admin@drinkit.com',
      adminRole: adminUser.role || 'admin',
      action: 'DELETE',
      module: 'BANNERS',
      targetId: id,
      description: `Deleted banner ID ${id}`,
      metadata: { bannerId: id },
    });

    return result;
  }
}

export const bannerService = new BannerService();
export default bannerService;

