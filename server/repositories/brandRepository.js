import { Brand } from '../models/Brand.js';
import { isDbConnected } from '../config/db.js';
import { productRepository } from './productRepository.js';

const INITIAL_BRANDS = [
  {
    id: 'brand-sula-vineyards',
    name: 'Sula Vineyards',
    slug: 'sula-vineyards',
    description: "India's premier wine producer located in Nashik valley, Maharashtra.",
    logo: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80',
    origin: 'Nashik, Maharashtra',
    website: 'https://sulavineyards.com',
    isActive: true,
  },
  {
    id: 'brand-fratelli-vineyards',
    name: 'Fratelli Vineyards',
    slug: 'fratelli-vineyards',
    description: 'Indo-Italian partnership producing distinguished Super Tuscan blends in Akluj.',
    logo: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&auto=format&fit=crop&q=80',
    origin: 'Akluj, Maharashtra',
    website: 'https://fratelliwines.com',
    isActive: true,
  },
  {
    id: 'brand-grover-zampa',
    name: 'Grover Zampa',
    slug: 'grover-zampa',
    description: 'Pioneering fine wine maker cultivating lush vineyards in the Nandi Hills.',
    logo: 'https://images.unsplash.com/photo-1558001373-7b93ee48ffa0?w=800&auto=format&fit=crop&q=80',
    origin: 'Nandi Hills, Karnataka',
    website: 'https://groverzampa.in',
    isActive: true,
  },
  {
    id: 'brand-chandon-india',
    name: 'Chandon India',
    slug: 'chandon-india',
    description: 'Domaine Chandon crafting methode traditionnelle sparkling wine in Nashik.',
    logo: 'https://images.unsplash.com/photo-1549418018-8f8d68962638?w=800&auto=format&fit=crop&q=80',
    origin: 'Dindori, Maharashtra',
    website: 'https://chandon.com',
    isActive: true,
  },
  {
    id: 'brand-amrut-distilleries',
    name: 'Amrut Distilleries',
    slug: 'amrut-distilleries',
    description: 'Internationally acclaimed pioneer of Indian single malt whiskies from Bengaluru.',
    logo: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    origin: 'Bengaluru, Karnataka',
    website: 'https://amrutwhisky.com',
    isActive: true,
  },
  {
    id: 'brand-pernod-ricard-india',
    name: 'Pernod Ricard India',
    slug: 'pernod-ricard-india',
    description: 'Global spirits leader crafting iconic whiskies such as Blenders Pride & Royal Salute.',
    logo: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&auto=format&fit=crop&q=80',
    origin: 'Gurugram, Haryana',
    website: 'https://pernod-ricard.com',
    isActive: true,
  },
  {
    id: 'brand-diageo-india',
    name: 'Diageo India',
    slug: 'diageo-india',
    description: 'Leading beverage alcohol company producing Johnnie Walker, Smirnoff & McDowell’s.',
    logo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    origin: 'Bengaluru, Karnataka',
    website: 'https://diageo.com',
    isActive: true,
  },
  {
    id: 'brand-united-spirits',
    name: 'United Spirits (Diageo)',
    slug: 'united-spirits-diageo',
    description: "India's largest spirits company known for Signature, Antiquity and McDowell's No. 1.",
    logo: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    origin: 'Bengaluru, Karnataka',
    website: 'https://diageoindia.com',
    isActive: true,
  },
  {
    id: 'brand-piccadily-agro',
    name: 'Piccadily Agro Industries',
    slug: 'piccadily-agro-industries',
    description: 'Distillers of the world-famous Indri Single Malt & Camikara Cane Rum in Indri.',
    logo: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    origin: 'Indri, Haryana',
    website: 'https://piccadily.com',
    isActive: true,
  },
  {
    id: 'brand-paul-john',
    name: 'Paul John Distilleries',
    slug: 'paul-john-distilleries',
    description: 'Crafting award-winning coastal Goan single malt whiskies from six-row barley.',
    logo: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    origin: 'Goa, India',
    website: 'https://pauljohnwhisky.com',
    isActive: true,
  },
  {
    id: 'brand-in-a-can-spirits',
    name: 'In A Can Spirits',
    slug: 'in-a-can-spirits',
    description: 'Craft ready-to-drink premium canned cocktails crafted for the modern lifestyle.',
    logo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    origin: 'Goa, India',
    website: 'https://inacan.in',
    isActive: true,
  },
  {
    id: 'brand-jimmys-cocktails',
    name: "Jimmy's Cocktails",
    slug: 'jimmys-cocktails',
    description: 'Finest non-alcoholic cocktail mixers and crafted spirit accompaniments.',
    logo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    origin: 'Gurugram, Haryana',
    website: 'https://jimmyscocktails.com',
    isActive: true,
  },
  {
    id: 'brand-united-breweries',
    name: 'United Breweries',
    slug: 'united-breweries',
    description: "Makers of India's undisputed king of good times: Kingfisher Premium & Ultra.",
    logo: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=800&auto=format&fit=crop&q=80',
    origin: 'Bengaluru, Karnataka',
    website: 'https://unitedbreweries.com',
    isActive: true,
  },
  {
    id: 'brand-b9-beverages',
    name: 'B9 Beverages',
    slug: 'b9-beverages',
    description: 'Modern craft beer revolution with Bira 91 Belgian White and crisp lagers.',
    logo: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=800&auto=format&fit=crop&q=80',
    origin: 'New Delhi, India',
    website: 'https://bira91.com',
    isActive: true,
  },
  {
    id: 'brand-ab-inbev-india',
    name: 'AB InBev India',
    slug: 'ab-inbev-india',
    description: 'World-renowned brewing powerhouse bringing Budweiser Magnum & Corona to India.',
    logo: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=800&auto=format&fit=crop&q=80',
    origin: 'Bengaluru, Karnataka',
    website: 'https://ab-inbev.com',
    isActive: true,
  },
  {
    id: 'brand-heineken',
    name: 'United Breweries (Heineken)',
    slug: 'united-breweries-heineken',
    description: 'Pure malt Heineken lager brewed under world-class brewing standards in India.',
    logo: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=800&auto=format&fit=crop&q=80',
    origin: 'Bengaluru, Karnataka',
    website: 'https://heineken.com',
    isActive: true,
  },
  {
    id: 'brand-radico-khaitan',
    name: 'Radico Khaitan',
    slug: 'radico-khaitan',
    description: "One of India's oldest distillers, makers of Magic Moments Vodka & Rampur Single Malt.",
    logo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    origin: 'Rampur, Uttar Pradesh',
    website: 'https://radicokhaitan.com',
    isActive: true,
  },
  {
    id: 'brand-mohan-meakin',
    name: 'Mohan Meakin',
    slug: 'mohan-meakin',
    description: "Legendary distillers since 1855, makers of India's beloved Old Monk Dark Rum.",
    logo: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
    origin: 'Kasauli & Ghaziabad',
    website: 'https://mohanmeakin.com',
    isActive: true,
  },
  {
    id: 'brand-bacardi-india',
    name: 'Bacardi India',
    slug: 'bacardi-india',
    description: 'Iconic global rum brand with smooth Carta Blanca and premium fruit-infused spirits.',
    logo: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
    origin: 'Gurugram, Haryana',
    website: 'https://bacardi.com',
    isActive: true,
  },
  {
    id: 'brand-tilaknagar-industries',
    name: 'Tilaknagar Industries',
    slug: 'tilaknagar-industries',
    description: "India's largest brandy manufacturer, maker of Mansion House and Courrier Napoleon.",
    logo: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&auto=format&fit=crop&q=80',
    origin: 'Shrirampur, Maharashtra',
    website: 'https://tilind.com',
    isActive: true,
  },
];

class BrandRepository {
  constructor() {
    this.memoryBrands = JSON.parse(JSON.stringify(INITIAL_BRANDS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Brand.countDocuments();
      if (count === 0) {
        await Brand.insertMany(INITIAL_BRANDS);
        console.log('[BrandRepository] Seeded initial brands into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[BrandRepository] Failed to seed brands into MongoDB:', err.message);
    }
  }

  /**
   * Fetch all brands
   */
  async getAll({ includeInactive = false } = {}) {
    await this.seedDatabaseIfEmpty();

    let list;
    if (isDbConnected()) {
      const query = includeInactive ? {} : { isActive: true };
      const docs = await Brand.find(query).sort({ name: 1 }).lean();
      list = docs.map((doc) => ({
        ...doc,
        id: doc.id || doc._id?.toString(),
      }));
    } else {
      list = this.memoryBrands.filter((b) => (includeInactive ? true : b.isActive !== false));
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Attach product counts
    const withCounts = await Promise.all(
      list.map(async (brand) => {
        const count = await productRepository.countByBrand(brand.name);
        return {
          ...brand,
          productCount: count,
        };
      })
    );

    return withCounts;
  }

  /**
   * Get brand by ID
   */
  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Brand.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }).lean();
      if (doc) {
        const productCount = await productRepository.countByBrand(doc.name);
        return { ...doc, id: doc.id || doc._id.toString(), productCount };
      }
    }
    const found = this.memoryBrands.find((b) => b.id === id);
    if (!found) return null;
    const count = await productRepository.countByBrand(found.name);
    return { ...found, productCount: count };
  }

  /**
   * Get brand by Slug
   */
  async getBySlug(slug) {
    await this.seedDatabaseIfEmpty();
    const cleanSlug = slug.toLowerCase().trim();
    if (isDbConnected()) {
      const doc = await Brand.findOne({ slug: cleanSlug }).lean();
      if (doc) {
        const productCount = await productRepository.countByBrand(doc.name);
        return { ...doc, id: doc.id || doc._id.toString(), productCount };
      }
    }
    const found = this.memoryBrands.find((b) => b.slug === cleanSlug);
    if (!found) return null;
    const count = await productRepository.countByBrand(found.name);
    return { ...found, productCount: count };
  }

  /**
   * Create brand
   */
  async create(data) {
    const slug = (data.slug || data.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const newBrand = {
      id: data.id || `brand-${slug || Date.now()}`,
      name: data.name.trim(),
      slug,
      description: data.description || '',
      logo: data.logo || '',
      origin: data.origin || 'India',
      website: data.website || '',
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isDbConnected()) {
      const doc = await Brand.create(newBrand);
      const res = doc.toJSON();
      this.memoryBrands.push(res);
      return { ...res, productCount: 0 };
    }

    this.memoryBrands.push(newBrand);
    return { ...newBrand, productCount: 0 };
  }

  /**
   * Update brand
   */
  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Brand with ID "${id}" not found.`);
    }

    const updates = { ...data, updatedAt: new Date() };
    if (updates.name && !updates.slug) {
      updates.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    if (isDbConnected()) {
      const updated = await Brand.findOneAndUpdate(
        { $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      if (updated) {
        const memIdx = this.memoryBrands.findIndex((b) => b.id === id);
        if (memIdx !== -1) {
          this.memoryBrands[memIdx] = { ...this.memoryBrands[memIdx], ...updated };
        }
        const count = await productRepository.countByBrand(updated.name);
        return { ...updated, id: updated.id || updated._id.toString(), productCount: count };
      }
    }

    const memIdx = this.memoryBrands.findIndex((b) => b.id === id);
    if (memIdx !== -1) {
      this.memoryBrands[memIdx] = { ...this.memoryBrands[memIdx], ...updates };
      const count = await productRepository.countByBrand(this.memoryBrands[memIdx].name);
      return { ...this.memoryBrands[memIdx], productCount: count };
    }

    throw new Error(`Brand with ID "${id}" could not be updated.`);
  }

  /**
   * Delete brand safely
   */
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Brand with ID "${id}" not found.`);
    }

    // Safety guardrail: cannot delete if products are linked
    const productCount = await productRepository.countByBrand(existing.name);
    if (productCount > 0) {
      const err = new Error(
        `Cannot delete brand "${existing.name}" because ${productCount} product(s) are assigned to it. Please reassign or delete these products first.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (isDbConnected()) {
      await Brand.deleteOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    }

    this.memoryBrands = this.memoryBrands.filter((b) => b.id !== id);
    return { success: true, id, message: `Brand "${existing.name}" deleted successfully.` };
  }
}

export const brandRepository = new BrandRepository();
export default brandRepository;
