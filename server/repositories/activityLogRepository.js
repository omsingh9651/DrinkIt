import { ActivityLog } from '../models/ActivityLog.js';
import { isDbConnected } from '../config/db.js';

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'otp',
  'jwt',
  'authorization',
  'cookie',
  'creditcard',
  'cvv',
];

function sanitizeMetadata(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMetadata);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      clean[key] = '***REDACTED***';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

const INITIAL_LOGS = [
  {
    id: 'act-init-001',
    adminEmail: 'admin@drinkit.com',
    adminRole: 'super_admin',
    action: 'LOGIN',
    module: 'AUTH',
    targetId: 'admin@drinkit.com',
    description: 'Admin signed in securely to Admin Control Center',
    metadata: { method: 'password_auth' },
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-14T09:00:00Z').toISOString(),
  },
  {
    id: 'act-init-002',
    adminEmail: 'admin@drinkit.com',
    adminRole: 'super_admin',
    action: 'DISPATCH_SIMULATION',
    module: 'ORDERS',
    targetId: 'ORD-88214',
    description: 'Dispatched order ORD-88214 for real-time delivery GPS tracking',
    metadata: { partner: 'Suraj Singh (Electric Bike)' },
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-14T18:25:00Z').toISOString(),
  },
  {
    id: 'act-init-003',
    adminEmail: 'inventory@drinkit.com',
    adminRole: 'inventory_manager',
    action: 'RESTOCK',
    module: 'INVENTORY',
    targetId: 'sula-dindori-reserve-shiraz',
    description: 'Received warehouse restock batch of 50 units for Sula Dindori Shiraz',
    metadata: { unitsAdded: 50, poNumber: 'PO-2026-001' },
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-15T10:30:00Z').toISOString(),
  },
  {
    id: 'act-init-004',
    adminEmail: 'admin@drinkit.com',
    adminRole: 'super_admin',
    action: 'CREATE',
    module: 'COUPONS',
    targetId: 'DRINKIT10',
    description: 'Created promotional discount campaign DRINKIT10 (10% off up to ₹500)',
    metadata: { minOrderValue: 999, discountValue: 10 },
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-16T12:00:00Z').toISOString(),
  },
  {
    id: 'act-init-005',
    adminEmail: 'merchandising@drinkit.com',
    adminRole: 'content_manager',
    action: 'CREATE',
    module: 'BANNERS',
    targetId: 'ban-summer-rose',
    description: 'Published promotional homepage banner "Summer Rosé & Sparkling Festival"',
    metadata: { targetPage: 'home', ctaLink: '/products?category=Wine' },
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-17T15:20:00Z').toISOString(),
  },
  {
    id: 'act-init-006',
    adminEmail: 'admin@drinkit.com',
    adminRole: 'super_admin',
    action: 'CREATE',
    module: 'ADMIN_USERS',
    targetId: 'dispatch@drinkit.com',
    description: 'Created new order management personnel account for Ananya Roy',
    metadata: { role: 'order_manager' },
    ipAddress: '127.0.0.1',
    createdAt: new Date('2026-01-18T11:10:00Z').toISOString(),
  },
];

class ActivityLogRepository {
  constructor() {
    this.memoryLogs = JSON.parse(JSON.stringify(INITIAL_LOGS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await ActivityLog.countDocuments();
      if (count === 0) {
        await ActivityLog.insertMany(INITIAL_LOGS);
        console.log('[ActivityLogRepository] Seeded initial activity logs into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[ActivityLogRepository] Failed to seed activity logs to MongoDB:', err.message);
    }
  }

  /**
   * Record an admin audit action with strict sanitization
   */
  async logAction({
    adminEmail = 'admin@drinkit.com',
    adminRole = 'admin',
    action,
    module,
    targetId = null,
    description,
    metadata = {},
    ipAddress = '',
  }) {
    const cleanLog = {
      id: `act-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`,
      adminEmail: String(adminEmail).trim().toLowerCase(),
      adminRole: String(adminRole).trim(),
      action: String(action).trim().toUpperCase(),
      module: String(module).trim().toUpperCase(),
      targetId: targetId ? String(targetId).trim() : null,
      description: String(description || '').trim(),
      metadata: sanitizeMetadata(metadata),
      ipAddress: String(ipAddress || '').trim(),
      createdAt: new Date().toISOString(),
    };

    if (isDbConnected()) {
      try {
        const created = await ActivityLog.create(cleanLog);
        const res = created.toJSON();
        this.memoryLogs.unshift(res);
        return res;
      } catch (err) {
        console.warn('[ActivityLogRepository] DB write failed, recording in-memory:', err.message);
      }
    }

    this.memoryLogs.unshift(cleanLog);
    if (this.memoryLogs.length > 3000) {
      this.memoryLogs.pop();
    }
    return cleanLog;
  }

  /**
   * Retrieve activity logs with filters and pagination
   */
  async getLogs({ module, search, startDate, endDate, page = 1, limit = 25 } = {}) {
    await this.seedDatabaseIfEmpty();

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 25), 100);
    const skip = (pageNum - 1) * limitNum;

    if (isDbConnected()) {
      try {
        const filter = {};
        if (module && module.toUpperCase() !== 'ALL') {
          filter.module = module.toUpperCase();
        }

        if (startDate || endDate) {
          filter.createdAt = {};
          if (startDate) filter.createdAt.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            if (String(endDate).length === 10) end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
          }
        }

        if (search && search.trim()) {
          const term = search.trim();
          filter.$or = [
            { adminEmail: new RegExp(term, 'i') },
            { action: new RegExp(term, 'i') },
            { description: new RegExp(term, 'i') },
            { targetId: new RegExp(term, 'i') },
          ];
        }

        const [docs, total] = await Promise.all([
          ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean().exec(),
          ActivityLog.countDocuments(filter).exec(),
        ]);

        return {
          logs: docs.map((d) => ({ ...d, id: d.id || d._id?.toString() })),
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        };
      } catch (err) {
        console.warn('[ActivityLogRepository] MongoDB query failed, using in-memory:', err.message);
      }
    }

    // In-memory fallback
    let filtered = [...this.memoryLogs];

    if (module && module.toUpperCase() !== 'ALL') {
      const target = module.toUpperCase();
      filtered = filtered.filter((l) => l.module === target);
    }

    if (startDate) {
      const startIso = new Date(startDate).toISOString();
      filtered = filtered.filter((l) => (l.createdAt || '') >= startIso);
    }

    if (endDate) {
      const end = new Date(endDate);
      if (String(endDate).length === 10) end.setHours(23, 59, 59, 999);
      const endIso = end.toISOString();
      filtered = filtered.filter((l) => (l.createdAt || '') <= endIso);
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.adminEmail.toLowerCase().includes(term) ||
          l.action.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term) ||
          (l.targetId && l.targetId.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      logs: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }
}

export const activityLogRepository = new ActivityLogRepository();
export default activityLogRepository;

