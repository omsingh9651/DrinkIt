import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Media } from '../models/Media.js';
import { isDbConnected } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../public/uploads');

const INITIAL_MEDIA = [
  {
    id: 'med-wine-reserve',
    filename: 'sula-dindori-reserve.jpg',
    originalName: 'sula-dindori-reserve.jpg',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 245000,
    source: 'external',
    createdAt: new Date('2026-01-10T10:00:00Z'),
  },
  {
    id: 'med-whisky-single-malt',
    filename: 'amrut-fusion-single-malt.jpg',
    originalName: 'amrut-fusion-single-malt.jpg',
    url: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 312000,
    source: 'external',
    createdAt: new Date('2026-01-12T14:30:00Z'),
  },
  {
    id: 'med-beer-lager',
    filename: 'craft-belgian-beer.jpg',
    originalName: 'craft-belgian-beer.jpg',
    url: 'https://images.unsplash.com/photo-1608270546103-9c86e00ea354?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 198000,
    source: 'external',
    createdAt: new Date('2026-01-15T09:15:00Z'),
  },
  {
    id: 'med-vodka-spirit',
    filename: 'magic-moments-vodka.jpg',
    originalName: 'magic-moments-vodka.jpg',
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 275000,
    source: 'external',
    createdAt: new Date('2026-01-18T16:45:00Z'),
  },
  {
    id: 'med-rum-dark',
    filename: 'old-monk-dark-rum.jpg',
    originalName: 'old-monk-dark-rum.jpg',
    url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 289000,
    source: 'external',
    createdAt: new Date('2026-01-20T11:20:00Z'),
  },
  {
    id: 'med-brandy-xo',
    filename: 'morpheus-xo-brandy.jpg',
    originalName: 'morpheus-xo-brandy.jpg',
    url: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 340000,
    source: 'external',
    createdAt: new Date('2026-01-22T12:00:00Z'),
  },
  {
    id: 'med-champagne-brut',
    filename: 'chandon-delice-sparkling.jpg',
    originalName: 'chandon-delice-sparkling.jpg',
    url: 'https://images.unsplash.com/photo-1549418018-8f8d68962638?w=800&auto=format&fit=crop&q=80',
    mimetype: 'image/jpeg',
    size: 320000,
    source: 'external',
    createdAt: new Date('2026-01-25T15:10:00Z'),
  },
];

class MediaRepository {
  constructor() {
    this.memoryMedia = JSON.parse(JSON.stringify(INITIAL_MEDIA));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Media.countDocuments();
      if (count === 0) {
        await Media.insertMany(INITIAL_MEDIA);
        console.log('[MediaRepository] Seeded initial media into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[MediaRepository] Failed to seed media into MongoDB:', err.message);
    }
  }

  async getAll({ search = '', source = 'all' } = {}) {
    await this.seedDatabaseIfEmpty();

    let list;
    if (isDbConnected()) {
      const query = {};
      if (source && source !== 'all') {
        query.source = source;
      }
      if (search && search.trim()) {
        const term = search.trim();
        query.$or = [
          { filename: new RegExp(term, 'i') },
          { originalName: new RegExp(term, 'i') },
          { url: new RegExp(term, 'i') },
        ];
      }
      const docs = await Media.find(query).sort({ createdAt: -1 }).lean();
      list = docs.map((d) => ({
        ...d,
        id: d.id || d._id?.toString(),
      }));
    } else {
      list = [...this.memoryMedia];
      if (source && source !== 'all') {
        list = list.filter((m) => m.source === source);
      }
      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        list = list.filter(
          (m) =>
            m.filename.toLowerCase().includes(term) ||
            (m.originalName && m.originalName.toLowerCase().includes(term)) ||
            m.url.toLowerCase().includes(term)
        );
      }
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return list;
  }

  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Media.findOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] }).lean();
      if (doc) return { ...doc, id: doc.id || doc._id.toString() };
    }
    return this.memoryMedia.find((m) => m.id === id) || null;
  }

  async create(data) {
    const newMedia = {
      id: data.id || `med-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      filename: data.filename,
      originalName: data.originalName || data.filename,
      url: data.url,
      mimetype: data.mimetype || 'image/jpeg',
      size: Number(data.size) || 0,
      source: data.source || 'upload',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isDbConnected()) {
      const doc = await Media.create(newMedia);
      const res = doc.toJSON();
      this.memoryMedia.unshift(res);
      return res;
    }

    this.memoryMedia.unshift(newMedia);
    return newMedia;
  }

  async delete(id) {
    const item = await this.getById(id);
    if (!item) {
      throw new Error(`Media item with ID "${id}" not found.`);
    }

    // If it's a local upload stored in uploadsDir, safely remove the disk file
    if (item.source === 'upload' && item.filename) {
      try {
        const filePath = path.join(uploadsDir, item.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn(`[MediaRepository] Failed to delete disk file ${item.filename}:`, err.message);
      }
    }

    if (isDbConnected()) {
      await Media.deleteOne({ $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] });
    }

    this.memoryMedia = this.memoryMedia.filter((m) => m.id !== id);
    return { success: true, id, message: `Media "${item.filename}" deleted successfully.` };
  }
}

export const mediaRepository = new MediaRepository();
export default mediaRepository;
