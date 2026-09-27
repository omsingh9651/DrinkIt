import { Banner } from '../models/Banner.js';
import { isDbConnected } from '../config/db.js';

const INITIAL_BANNERS = [
  {
    id: 'ban-summer-rose',
    title: 'Summer Rosé & Sparkling Festival',
    subtitle: 'Up to 20% off fine champagnes, Super Tuscans & Nashik estate reserves',
    badgeText: 'SUMMER CELEBRATION',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'Explore Wine Reserves',
    ctaLink: '/products?category=Wine',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'ban-single-malt',
    title: 'Rare Single Malt Curations',
    subtitle: 'Indri Trini, Amrut Fusion, Paul John & Glenfiddich delivered chilled in 60 mins',
    badgeText: 'CONNOISSEUR RESERVE',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'Shop Fine Whiskies',
    ctaLink: '/products?category=Whisky',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'ban-craft-beer',
    title: 'Weekend Craft Beer Ice Buckets',
    subtitle: 'Crisp Belgian Witbiers, draught lagers & craft beer packs ready for celebrations',
    badgeText: 'WEEKEND SPECIAL',
    image: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=1200&auto=format&fit=crop&q=80',
    ctaText: 'Order Chilled Beers',
    ctaLink: '/products?category=Beer',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    displayOrder: 3,
    isActive: true,
  },
];

class BannerRepository {
  constructor() {
    this.memoryBanners = JSON.parse(JSON.stringify(INITIAL_BANNERS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Banner.countDocuments();
      if (count === 0) {
        await Banner.insertMany(INITIAL_BANNERS);
        console.log('[BannerRepository] Seeded initial promotional banners into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[BannerRepository] Failed to seed banners into MongoDB:', err.message);
    }
  }

  /**
   * Fetch active banners for storefront home carousel
   */
  async getActiveBanners() {
    await this.seedDatabaseIfEmpty();
    const now = new Date();

    if (isDbConnected()) {
      const docs = await Banner.find({
        isActive: true,
        $and: [
          { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
          { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
        ],
      })
        .sort({ displayOrder: 1 })
        .lean()
        .exec();

      return docs.map((d) => ({ ...d, id: d.id || d._id?.toString() }));
    }

    return this.memoryBanners
      .filter((b) => {
        if (b.isActive === false) return false;
        if (b.startDate && new Date(b.startDate) > now) return false;
        if (b.endDate && new Date(b.endDate) < now) return false;
        return true;
      })
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  /**
   * Fetch all banners for Admin with search & status filters
   */
  async getAll({ search = '', status = 'ALL' } = {}) {
    await this.seedDatabaseIfEmpty();

    let list;
    if (isDbConnected()) {
      const query = {};
      if (status === 'ACTIVE') query.isActive = true;
      if (status === 'INACTIVE') query.isActive = false;

      if (search && search.trim()) {
        const term = search.trim();
        query.$or = [
          { title: new RegExp(term, 'i') },
          { subtitle: new RegExp(term, 'i') },
          { badgeText: new RegExp(term, 'i') },
        ];
      }

      const docs = await Banner.find(query).sort({ displayOrder: 1 }).lean().exec();
      list = docs.map((d) => ({ ...d, id: d.id || d._id?.toString() }));
    } else {
      list = [...this.memoryBanners];
      if (status === 'ACTIVE') list = list.filter((b) => b.isActive !== false);
      if (status === 'INACTIVE') list = list.filter((b) => b.isActive === false);

      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (b) =>
            b.title.toLowerCase().includes(term) ||
            (b.subtitle && b.subtitle.toLowerCase().includes(term)) ||
            (b.badgeText && b.badgeText.toLowerCase().includes(term))
        );
      }
      list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }

    return list;
  }

  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Banner.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] })
        .lean()
        .exec();
      if (doc) return { ...doc, id: doc.id || doc._id.toString() };
    }
    return this.memoryBanners.find((b) => b.id === id) || null;
  }

  async create(data) {
    const newBanner = {
      id: data.id || `ban-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`,
      title: data.title.trim(),
      subtitle: data.subtitle || '',
      badgeText: data.badgeText || 'SPECIAL OFFER',
      image: data.image.trim(),
      ctaText: data.ctaText || 'Shop Collection',
      ctaLink: data.ctaLink || '/products',
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      displayOrder: Number(data.displayOrder) || this.memoryBanners.length + 1,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDbConnected()) {
      const doc = await Banner.create(newBanner);
      const res = doc.toJSON();
      this.memoryBanners.push(res);
      return res;
    }

    this.memoryBanners.push(newBanner);
    return newBanner;
  }

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Banner with ID "${id}" not found.`);
    }

    const updates = { ...data, updatedAt: new Date().toISOString() };

    if (isDbConnected()) {
      const updated = await Banner.findOneAndUpdate(
        { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        { $set: updates },
        { new: true, runValidators: true }
      )
        .lean()
        .exec();

      if (updated) {
        const memIdx = this.memoryBanners.findIndex((b) => b.id === id);
        if (memIdx !== -1) {
          this.memoryBanners[memIdx] = { ...this.memoryBanners[memIdx], ...updated };
        }
        return { ...updated, id: updated.id || updated._id.toString() };
      }
    }

    const memIdx = this.memoryBanners.findIndex((b) => b.id === id);
    if (memIdx !== -1) {
      this.memoryBanners[memIdx] = { ...this.memoryBanners[memIdx], ...updates };
      return this.memoryBanners[memIdx];
    }

    throw new Error(`Banner "${id}" could not be updated.`);
  }

  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Banner with ID "${id}" not found.`);
    }

    if (isDbConnected()) {
      await Banner.deleteOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }).exec();
    }

    this.memoryBanners = this.memoryBanners.filter((b) => b.id !== id);
    return { success: true, id, message: `Banner "${existing.title}" deleted successfully.` };
  }
}

export const bannerRepository = new BannerRepository();
export default bannerRepository;

