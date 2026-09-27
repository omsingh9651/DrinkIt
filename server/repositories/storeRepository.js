import { Store } from '../models/Store.js';
import { isDbConnected } from '../config/db.js';

const DEFAULT_STORES = [
  {
    id: 'store-1',
    name: 'DrinkIt Flagship Reserve Cellar — Civil Lines',
    code: 'CVL-01',
    address: 'The Mall Road, Civil Lines, Kanpur, Uttar Pradesh 208001',
    phone: '+91 512 230 4920',
    latitude: 26.4715,
    longitude: 80.3440,
    isOpen: true,
    operatingHours: '10:00 AM - 11:00 PM',
    tag: 'Flagship Cellar',
  },
  {
    id: 'store-2',
    name: 'DrinkIt Boutique Hub — Swaroop Nagar',
    code: 'SWN-02',
    address: 'Khalasi Line, Swaroop Nagar, Kanpur, Uttar Pradesh 208002',
    phone: '+91 512 255 1088',
    latitude: 26.4820,
    longitude: 80.3210,
    isOpen: true,
    operatingHours: '10:00 AM - 11:00 PM',
    tag: 'Premium Hub',
  },
  {
    id: 'store-3',
    name: 'DrinkIt Express Warehouse — Kalyanpur',
    code: 'KLP-03',
    address: 'GT Road, Near IIT Kanpur, Kalyanpur, Kanpur, Uttar Pradesh 208016',
    phone: '+91 512 259 7112',
    latitude: 26.5085,
    longitude: 80.2435,
    isOpen: true,
    operatingHours: '09:00 AM - Midnight',
    tag: 'Express Fulfillment Hub',
  },
];

class StoreRepository {
  constructor() {
    this.memoryStores = DEFAULT_STORES.map((s) => ({ ...s }));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Store.countDocuments();
      if (count === 0) {
        for (const store of DEFAULT_STORES) {
          await Store.findOneAndUpdate(
            { id: store.id },
            { $set: store },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
        console.log('[StoreRepository] Seeded initial stores into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[StoreRepository] Failed to seed stores to MongoDB:', err.message);
    }
  }

  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async getAll() {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const stores = await Store.find({ status: { $ne: 'inactive' } }).exec();
      if (stores && stores.length > 0) {
        return stores.map((s) => s.toJSON());
      }
    }
    return this.memoryStores;
  }

  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Store.findOne({
        $or: [{ id: String(id) }, { code: String(id) }],
      }).exec();
      if (doc) return doc.toJSON();
    }
    return this.memoryStores.find((s) => s.id === id || s.code === id) || this.memoryStores[0];
  }

  async findNearest(lat, lng) {
    const stores = await this.getAll();
    if (!lat || !lng) return stores[0];

    const numLat = Number(lat);
    const numLng = Number(lng);
    if (isNaN(numLat) || isNaN(numLng)) return stores[0];

    let nearest = stores[0];
    let minDistance = Infinity;

    for (const store of stores) {
      const d = this.calculateDistanceKm(numLat, numLng, store.latitude, store.longitude);
      if (d < minDistance) {
        minDistance = d;
        nearest = store;
      }
    }

    return nearest;
  }

  async upsertMany(storesList) {
    if (!Array.isArray(storesList) || storesList.length === 0) return [];

    if (isDbConnected()) {
      const ops = storesList.map((s) => ({
        updateOne: {
          filter: { id: s.id },
          update: { $set: s },
          upsert: true,
        },
      }));
      await Store.bulkWrite(ops);
      return this.getAll();
    }

    storesList.forEach((s) => {
      const idx = this.memoryStores.findIndex((ms) => ms.id === s.id);
      if (idx !== -1) {
        this.memoryStores[idx] = { ...this.memoryStores[idx], ...s };
      } else {
        this.memoryStores.push(s);
      }
    });
    return this.memoryStores;
  }
}

export const storeRepository = new StoreRepository();
export default storeRepository;

