import { Category } from '../models/Category.js';
import { isDbConnected } from '../config/db.js';
import { productRepository } from './productRepository.js';

const INITIAL_CATEGORIES = [
  {
    id: 'cat-wine',
    name: 'Wine',
    slug: 'wine',
    emoji: '🍷',
    description: 'Nashik estate Shiraz, Super Tuscans & Nandi Hills reserves.',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'cat-whisky',
    name: 'Whisky',
    slug: 'whisky',
    emoji: '🥃',
    description: 'Indian single malts, Solera reserves & premium blended Scotch.',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'cat-beer',
    name: 'Beer',
    slug: 'beer',
    emoji: '🍺',
    description: 'Belgian wheat ales, crisp lagers & beechwood aged strong brews.',
    image: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=800&auto=format&fit=crop&q=80',
    displayOrder: 3,
    isActive: true,
  },
  {
    id: 'cat-vodka',
    name: 'Vodka',
    slug: 'vodka',
    emoji: '🍸',
    description: 'Triple-distilled pure grain vodkas & birch charcoal filtered spirits.',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    displayOrder: 4,
    isActive: true,
  },
  {
    id: 'cat-rum',
    name: 'Rum',
    slug: 'rum',
    emoji: '🥃',
    description: 'Aged dark vatted rums, white rums & charred barrel selections.',
    image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
    displayOrder: 5,
    isActive: true,
  },
  {
    id: 'cat-brandy',
    name: 'Brandy',
    slug: 'brandy',
    emoji: '🍷',
    description: 'French oak aged grape brandies & luxurious XO expressions.',
    image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&auto=format&fit=crop&q=80',
    displayOrder: 6,
    isActive: true,
  },
  {
    id: 'cat-champagne',
    name: 'Champagne',
    slug: 'champagne',
    emoji: '🍾',
    description: 'Sparkling cuvées, Brut reserves & celebrations.',
    image: 'https://images.unsplash.com/photo-1549418018-8f8d68962638?w=800&auto=format&fit=crop&q=80',
    displayOrder: 7,
    isActive: true,
  },
  {
    id: 'cat-premium-spirits',
    name: 'Premium Spirits',
    slug: 'premium-spirits',
    emoji: '✨',
    description: 'Artisanal, rare and imported ultra-premium spirits.',
    image: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    displayOrder: 8,
    isActive: true,
  },
  {
    id: 'cat-cocktails',
    name: 'Cocktails',
    slug: 'cocktails',
    emoji: '🍹',
    description: 'Ready-to-drink craft cocktails and premium bar mixers.',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    displayOrder: 9,
    isActive: true,
  },
];

class CategoryRepository {
  constructor() {
    this.memoryCategories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Category.countDocuments();
      if (count === 0) {
        await Category.insertMany(INITIAL_CATEGORIES);
        console.log('[CategoryRepository] Seeded initial categories into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[CategoryRepository] Failed to seed categories to MongoDB:', err.message);
    }
  }

  /**
   * Fetch all categories
   */
  async getAll({ includeInactive = false } = {}) {
    await this.seedDatabaseIfEmpty();

    let list;
    if (isDbConnected()) {
      const query = includeInactive ? {} : { isActive: true };
      const docs = await Category.find(query).sort({ displayOrder: 1, name: 1 }).lean();
      list = docs.map((doc) => ({
        ...doc,
        id: doc.id || doc._id?.toString(),
      }));
    } else {
      list = this.memoryCategories.filter((c) => (includeInactive ? true : c.isActive !== false));
      list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }

    // Attach current live product counts
    const withCounts = await Promise.all(
      list.map(async (cat) => {
        const count = await productRepository.countByCategory(cat.name);
        return {
          ...cat,
          productCount: count,
        };
      })
    );

    return withCounts;
  }

  /**
   * Get single category by ID
   */
  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Category.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }).lean();
      if (doc) {
        const productCount = await productRepository.countByCategory(doc.name);
        return { ...doc, id: doc.id || doc._id.toString(), productCount };
      }
    }
    const found = this.memoryCategories.find((c) => c.id === id);
    if (!found) return null;
    const count = await productRepository.countByCategory(found.name);
    return { ...found, productCount: count };
  }

  /**
   * Get single category by Slug
   */
  async getBySlug(slug) {
    await this.seedDatabaseIfEmpty();
    const cleanSlug = slug.toLowerCase().trim();
    if (isDbConnected()) {
      const doc = await Category.findOne({ slug: cleanSlug }).lean();
      if (doc) {
        const productCount = await productRepository.countByCategory(doc.name);
        return { ...doc, id: doc.id || doc._id.toString(), productCount };
      }
    }
    const found = this.memoryCategories.find((c) => c.slug === cleanSlug);
    if (!found) return null;
    const count = await productRepository.countByCategory(found.name);
    return { ...found, productCount: count };
  }

  /**
   * Create category
   */
  async create(data) {
    const slug = (data.slug || data.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const newCat = {
      id: data.id || `cat-${slug || Date.now()}`,
      name: data.name.trim(),
      slug,
      emoji: data.emoji || '🍾',
      description: data.description || '',
      image: data.image || '',
      displayOrder: Number(data.displayOrder) || this.memoryCategories.length + 1,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isDbConnected()) {
      const doc = await Category.create(newCat);
      const res = doc.toJSON();
      this.memoryCategories.push(res);
      return { ...res, productCount: 0 };
    }

    this.memoryCategories.push(newCat);
    return { ...newCat, productCount: 0 };
  }

  /**
   * Update category
   */
  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Category with ID "${id}" not found.`);
    }

    const updates = { ...data, updatedAt: new Date() };
    if (updates.name && !updates.slug) {
      updates.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    if (isDbConnected()) {
      const updated = await Category.findOneAndUpdate(
        { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      if (updated) {
        const memIdx = this.memoryCategories.findIndex((c) => c.id === id);
        if (memIdx !== -1) {
          this.memoryCategories[memIdx] = { ...this.memoryCategories[memIdx], ...updated };
        }
        const count = await productRepository.countByCategory(updated.name);
        return { ...updated, id: updated.id || updated._id.toString(), productCount: count };
      }
    }

    const memIdx = this.memoryCategories.findIndex((c) => c.id === id);
    if (memIdx !== -1) {
      this.memoryCategories[memIdx] = { ...this.memoryCategories[memIdx], ...updates };
      const count = await productRepository.countByCategory(this.memoryCategories[memIdx].name);
      return { ...this.memoryCategories[memIdx], productCount: count };
    }

    throw new Error(`Category with ID "${id}" could not be updated.`);
  }

  /**
   * Delete category safely
   */
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Category with ID "${id}" not found.`);
    }

    // Safety guardrail: cannot delete if products are linked
    const productCount = await productRepository.countByCategory(existing.name);
    if (productCount > 0) {
      const err = new Error(
        `Cannot delete category "${existing.name}" because ${productCount} product(s) are assigned to it. Please reassign or delete these products first.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (isDbConnected()) {
      await Category.deleteOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    }

    this.memoryCategories = this.memoryCategories.filter((c) => c.id !== id);
    return { success: true, id, message: `Category "${existing.name}" deleted successfully.` };
  }
}

export const categoryRepository = new CategoryRepository();
export default categoryRepository;
