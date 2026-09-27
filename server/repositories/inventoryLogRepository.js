import { InventoryLog } from '../models/InventoryLog.js';
import { isDbConnected } from '../config/db.js';

const INITIAL_LOGS = [
  {
    id: 'LOG-INIT-001',
    productId: 'sula-dindori-reserve-shiraz',
    productName: 'Sula Dindori Reserve Shiraz',
    category: 'Wine',
    previousStock: 0,
    newStock: 50,
    change: 50,
    type: 'RESTOCK',
    reason: 'Initial warehouse intake shipment',
    referenceId: 'PO-2026-001',
    performedBy: 'ADMIN (admin@drinkit.com)',
    createdAt: new Date('2026-01-05T09:00:00Z'),
  },
  {
    id: 'LOG-INIT-002',
    productId: 'amrut-fusion-single-malt',
    productName: 'Amrut Fusion Single Malt',
    category: 'Whisky',
    previousStock: 0,
    newStock: 30,
    change: 30,
    type: 'RESTOCK',
    reason: 'Direct distillery consignment intake',
    referenceId: 'PO-2026-002',
    performedBy: 'ADMIN (admin@drinkit.com)',
    createdAt: new Date('2026-01-06T11:15:00Z'),
  },
  {
    id: 'LOG-INIT-003',
    productId: 'kingfisher-ultra-max',
    productName: 'Kingfisher Ultra Max Premium',
    category: 'Beer',
    previousStock: 0,
    newStock: 120,
    change: 120,
    type: 'RESTOCK',
    reason: 'Brewery fresh batch consignment',
    referenceId: 'PO-2026-003',
    performedBy: 'ADMIN (admin@drinkit.com)',
    createdAt: new Date('2026-01-08T14:20:00Z'),
  },
  {
    id: 'LOG-INIT-004',
    productId: 'sula-dindori-reserve-shiraz',
    productName: 'Sula Dindori Reserve Shiraz',
    category: 'Wine',
    previousStock: 50,
    newStock: 48,
    change: -2,
    type: 'ORDER_PLACED',
    reason: 'Customer purchase fulfillment',
    referenceId: 'ORD-98214',
    performedBy: 'SYSTEM (Order Checkout)',
    createdAt: new Date('2026-01-10T19:45:00Z'),
  },
  {
    id: 'LOG-INIT-005',
    productId: 'magic-moments-remix-vodka',
    productName: 'Magic Moments Remix Vodka',
    category: 'Vodka',
    previousStock: 0,
    newStock: 60,
    change: 60,
    type: 'RESTOCK',
    reason: 'Weekly stock replenishment',
    referenceId: 'PO-2026-004',
    performedBy: 'ADMIN (admin@drinkit.com)',
    createdAt: new Date('2026-01-12T10:00:00Z'),
  },
  {
    id: 'LOG-INIT-006',
    productId: 'old-monk-supreme-vatted-rum',
    productName: 'Old Monk The Legend Very Old Vatted Rum',
    category: 'Rum',
    previousStock: 0,
    newStock: 40,
    change: 40,
    type: 'RESTOCK',
    reason: 'Replenishment for weekend rush',
    referenceId: 'PO-2026-005',
    performedBy: 'ADMIN (admin@drinkit.com)',
    createdAt: new Date('2026-01-15T16:30:00Z'),
  },
  {
    id: 'LOG-INIT-007',
    productId: 'magic-moments-remix-vodka',
    productName: 'Magic Moments Remix Vodka',
    category: 'Vodka',
    previousStock: 60,
    newStock: 59,
    change: -1,
    type: 'ORDER_PLACED',
    reason: 'Customer purchase fulfillment',
    referenceId: 'ORD-98432',
    performedBy: 'SYSTEM (Order Checkout)',
    createdAt: new Date('2026-01-18T21:10:00Z'),
  },
  {
    id: 'LOG-INIT-008',
    productId: 'magic-moments-remix-vodka',
    productName: 'Magic Moments Remix Vodka',
    category: 'Vodka',
    previousStock: 59,
    newStock: 60,
    change: 1,
    type: 'ORDER_CANCELLED',
    reason: 'Restored inventory upon order cancellation',
    referenceId: 'ORD-98432',
    performedBy: 'SYSTEM (Order Cancellation)',
    createdAt: new Date('2026-01-18T21:30:00Z'),
  },
  {
    id: 'LOG-INIT-009',
    productId: 'amrut-fusion-single-malt',
    productName: 'Amrut Fusion Single Malt',
    category: 'Whisky',
    previousStock: 30,
    newStock: 29,
    change: -1,
    type: 'ADJUSTMENT',
    reason: 'Damaged seal bottle decommissioned',
    referenceId: 'ADJ-2026-001',
    performedBy: 'ADMIN (admin@drinkit.com)',
    createdAt: new Date('2026-01-22T13:00:00Z'),
  },
];

class InventoryLogRepository {
  constructor() {
    this.memoryLogs = JSON.parse(JSON.stringify(INITIAL_LOGS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await InventoryLog.countDocuments();
      if (count === 0) {
        await InventoryLog.insertMany(INITIAL_LOGS);
        console.log('[InventoryLogRepository] Seeded initial logs into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[InventoryLogRepository] Failed to seed logs to MongoDB:', err.message);
    }
  }

  generateId() {
    const timestampPart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `LOG-${timestampPart}-${randomPart}`;
  }

  /**
   * Create an immutable inventory log record
   */
  async createLog(data) {
    const logDoc = {
      id: data.id || this.generateId(),
      productId: String(data.productId),
      productName: data.productName || 'Product',
      category: data.category || 'Spirits',
      previousStock: Number(data.previousStock),
      newStock: Number(data.newStock),
      change: Number(data.change),
      type: data.type || 'ADJUSTMENT',
      reason: data.reason || 'Manual stock update',
      referenceId: data.referenceId ? String(data.referenceId) : null,
      performedBy: data.performedBy || 'SYSTEM',
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    };

    if (isDbConnected()) {
      try {
        const created = await InventoryLog.create(logDoc);
        const res = created.toJSON();
        this.memoryLogs.unshift(res);
        return res;
      } catch (err) {
        console.warn('MongoDB InventoryLog write failed, recording in-memory:', err.message);
      }
    }

    // In-memory fallback
    this.memoryLogs.unshift(logDoc);
    if (this.memoryLogs.length > 2000) {
      this.memoryLogs.pop();
    }
    return logDoc;
  }

  /**
   * Retrieve inventory history logs with search, filtering, and summary statistics
   */
  async getLogs({ productId, type, category, search, limit = 50, skip = 0 } = {}) {
    await this.seedDatabaseIfEmpty();

    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);
    const safeSkip = Math.max(0, parseInt(skip, 10) || 0);

    if (isDbConnected()) {
      try {
        const filter = {};
        if (productId) filter.productId = String(productId);
        if (type && type !== 'ALL') filter.type = String(type);
        if (category && category !== 'All') filter.category = new RegExp(`^${category}$`, 'i');

        if (search && search.trim()) {
          const term = search.trim();
          filter.$or = [
            { productName: new RegExp(term, 'i') },
            { reason: new RegExp(term, 'i') },
            { referenceId: new RegExp(term, 'i') },
            { performedBy: new RegExp(term, 'i') },
          ];
        }

        const [docs, total] = await Promise.all([
          InventoryLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(safeSkip)
            .limit(safeLimit)
            .lean()
            .exec(),
          InventoryLog.countDocuments(filter).exec(),
        ]);

        // Compute summary metrics for filter
        const allMatching = await InventoryLog.find(filter).lean();
        const metrics = this.computeMetrics(allMatching);

        return {
          total,
          limit: safeLimit,
          skip: safeSkip,
          metrics,
          logs: docs.map((d) => ({ ...d, id: d.id || d._id?.toString() })),
        };
      } catch (err) {
        console.warn('MongoDB InventoryLog query failed, using in-memory:', err.message);
      }
    }

    // In-memory fallback
    let filtered = [...this.memoryLogs];
    if (productId) {
      filtered = filtered.filter((l) => l.productId === String(productId));
    }
    if (type && type !== 'ALL') {
      filtered = filtered.filter((l) => l.type === String(type));
    }
    if (category && category !== 'All') {
      filtered = filtered.filter((l) => l.category && l.category.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.productName.toLowerCase().includes(term) ||
          (l.reason && l.reason.toLowerCase().includes(term)) ||
          (l.referenceId && l.referenceId.toLowerCase().includes(term)) ||
          (l.performedBy && l.performedBy.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const paginated = filtered.slice(safeSkip, safeSkip + safeLimit);
    const metrics = this.computeMetrics(filtered);

    return {
      total,
      limit: safeLimit,
      skip: safeSkip,
      metrics,
      logs: paginated,
    };
  }

  computeMetrics(logs) {
    let restockCount = 0;
    let orderCount = 0;
    let cancelCount = 0;
    let netDelta = 0;

    for (const log of logs) {
      if (log.type === 'RESTOCK') restockCount++;
      if (log.type === 'ORDER_PLACED') orderCount++;
      if (log.type === 'ORDER_CANCELLED') cancelCount++;
      netDelta += log.change || 0;
    }

    return {
      totalEvents: logs.length,
      restockCount,
      orderCount,
      cancelCount,
      netDelta,
    };
  }
}

export const inventoryLogRepository = new InventoryLogRepository();
export default inventoryLogRepository;
