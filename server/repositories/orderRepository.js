import { Order } from '../models/Order.js';
import { isDbConnected } from '../config/db.js';

const INITIAL_ORDERS = [
  {
    id: 'ORD-88214',
    customerId: 'cust-9876543210',
    customerPhone: '9876543210',
    customerName: 'Aarav Sharma',
    deliveryAddress: {
      fullName: 'Aarav Sharma',
      mobileNumber: '9876543210',
      house: 'Flat 402, Tower 5',
      street: 'Sector 62',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pinCode: '201309',
    },
    latitude: 28.628,
    longitude: 77.3649,
    items: [
      {
        productId: 'sula-dindori-reserve-shiraz',
        name: 'Sula Dindori Reserve Shiraz',
        brand: 'Sula Vineyards',
        price: 1550,
        quantity: 2,
        subtotal: 3100,
      },
    ],
    subtotal: 3100,
    deliveryFee: 50,
    total: 3150,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    razorpayOrderId: 'order_test_98231',
    razorpayPaymentId: 'pay_test_RzP98231',
    paidAt: new Date('2026-01-14T18:22:00Z').toISOString(),
    orderStatus: 'DELIVERED',
    statusHistory: [
      { status: 'CONFIRMED', timestamp: new Date('2026-01-14T18:22:00Z'), note: 'Payment verified via Razorpay' },
      { status: 'DELIVERED', timestamp: new Date('2026-01-14T18:55:00Z'), note: 'Order delivered safely' },
    ],
    createdAt: new Date('2026-01-14T18:20:00Z').toISOString(),
  },
  {
    id: 'ORD-88215',
    customerId: 'cust-9812345678',
    customerPhone: '9812345678',
    customerName: 'Priya Nair',
    deliveryAddress: {
      fullName: 'Priya Nair',
      mobileNumber: '9812345678',
      house: 'Villa 12, Palm Grove',
      street: 'Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122002',
    },
    latitude: 28.4595,
    longitude: 77.0266,
    items: [
      {
        productId: 'amrut-fusion-single-malt',
        name: 'Amrut Fusion Single Malt',
        brand: 'Amrut Distilleries',
        price: 5300,
        quantity: 1,
        subtotal: 5300,
      },
    ],
    subtotal: 5300,
    deliveryFee: 50,
    total: 5350,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    razorpayOrderId: 'order_test_Amr10293',
    razorpayPaymentId: 'pay_test_Amr10293',
    paidAt: new Date('2026-01-18T19:32:00Z').toISOString(),
    orderStatus: 'OUT_FOR_DELIVERY',
    statusHistory: [
      { status: 'CONFIRMED', timestamp: new Date('2026-01-18T19:32:00Z'), note: 'Payment verified' },
      { status: 'OUT_FOR_DELIVERY', timestamp: new Date('2026-01-18T19:40:00Z'), note: 'Dispatched with delivery partner' },
    ],
    createdAt: new Date('2026-01-18T19:30:00Z').toISOString(),
  },
  {
    id: 'ORD-88216',
    customerId: 'cust-9988776655',
    customerPhone: '9988776655',
    customerName: 'Rohan Verma',
    deliveryAddress: {
      fullName: 'Rohan Verma',
      mobileNumber: '9988776655',
      house: 'C-18, Hauz Khas',
      street: 'Aurobindo Marg',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110016',
    },
    latitude: 28.5494,
    longitude: 77.2001,
    items: [
      {
        productId: 'kingfisher-ultra-max',
        name: 'Kingfisher Ultra Max Premium',
        brand: 'United Breweries',
        price: 210,
        quantity: 6,
        subtotal: 1260,
      },
    ],
    subtotal: 1260,
    deliveryFee: 60,
    total: 1320,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    orderStatus: 'CONFIRMED',
    statusHistory: [
      { status: 'CONFIRMED', timestamp: new Date('2026-01-20T20:16:00Z'), note: 'Cash on delivery confirmed' },
    ],
    createdAt: new Date('2026-01-20T20:15:00Z').toISOString(),
  },
  {
    id: 'ORD-88217',
    customerId: 'cust-9823456789',
    customerPhone: '9823456789',
    customerName: 'Meera Patel',
    deliveryAddress: {
      fullName: 'Meera Patel',
      mobileNumber: '9823456789',
      house: 'B-201, Indirapuram',
      street: 'Ahinsa Khand 2',
      city: 'Ghaziabad',
      state: 'Uttar Pradesh',
      pinCode: '201014',
    },
    latitude: 28.6369,
    longitude: 77.3712,
    items: [
      {
        productId: 'magic-moments-remix-vodka',
        name: 'Magic Moments Remix Vodka',
        brand: 'Radico Khaitan',
        price: 850,
        quantity: 2,
        subtotal: 1700,
      },
    ],
    subtotal: 1700,
    deliveryFee: 80,
    total: 1780,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    razorpayOrderId: 'order_test_Mgc88421',
    razorpayPaymentId: 'pay_test_Mgc88421',
    paidAt: new Date('2026-01-22T14:12:00Z').toISOString(),
    orderStatus: 'PROCESSING',
    statusHistory: [
      { status: 'CONFIRMED', timestamp: new Date('2026-01-22T14:12:00Z'), note: 'Payment verified' },
      { status: 'PROCESSING', timestamp: new Date('2026-01-22T14:20:00Z'), note: 'Warehouse picking items' },
    ],
    createdAt: new Date('2026-01-22T14:10:00Z').toISOString(),
  },
];

class OrderRepository {
  constructor() {
    this.memoryOrders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Order.countDocuments();
      if (count === 0) {
        await Order.insertMany(INITIAL_ORDERS);
        console.log('[OrderRepository] Seeded initial orders into MongoDB.');
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[OrderRepository] Failed to seed orders to MongoDB:', err.message);
    }
  }

  cleanPhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '').slice(-10);
  }

  /**
   * Create a new order
   */
  async create(orderData) {
    const orderDoc = {
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDbConnected()) {
      const created = await Order.create(orderDoc);
      return created.toJSON();
    }

    // In-memory fallback
    this.memoryOrders.unshift(orderDoc);
    return orderDoc;
  }

  /**
   * Find order by ID
   */
  async getById(orderId) {
    await this.seedDatabaseIfEmpty();
    if (!orderId) return null;

    if (isDbConnected()) {
      const doc = await Order.findOne({ id: String(orderId) }).exec();
      return doc ? doc.toJSON() : null;
    }

    return this.memoryOrders.find((o) => o.id === String(orderId)) || null;
  }

  /**
   * Find order by Razorpay Order ID
   */
  async getByRazorpayOrderId(razorpayOrderId) {
    await this.seedDatabaseIfEmpty();
    if (!razorpayOrderId) return null;

    if (isDbConnected()) {
      const doc = await Order.findOne({ razorpayOrderId: String(razorpayOrderId) }).exec();
      return doc ? doc.toJSON() : null;
    }

    return this.memoryOrders.find((o) => o.razorpayOrderId === String(razorpayOrderId)) || null;
  }

  /**
   * Fetch orders for customer by phone
   */
  async getByCustomer(customerPhone) {
    await this.seedDatabaseIfEmpty();
    const clean = this.cleanPhone(customerPhone);
    if (!clean) return [];

    if (isDbConnected()) {
      const docs = await Order.find({ customerPhone: clean }).sort({ createdAt: -1 }).exec();
      return docs.map((d) => d.toJSON());
    }

    return this.memoryOrders.filter((o) => o.customerPhone === clean);
  }

  /**
   * Fetch all orders for admin with search, status, paymentStatus, date range & pagination
   */
  async getAll({
    status,
    paymentStatus,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = {}) {
    await this.seedDatabaseIfEmpty();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    if (isDbConnected()) {
      const filter = {};

      if (status && status.toUpperCase() !== 'ALL') {
        filter.orderStatus = status.toUpperCase();
      }

      if (paymentStatus && paymentStatus.toUpperCase() !== 'ALL') {
        filter.paymentStatus = paymentStatus.toUpperCase();
      }

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate).toISOString();
        }
        if (endDate) {
          const end = new Date(endDate);
          if (String(endDate).length === 10) {
            end.setHours(23, 59, 59, 999);
          }
          filter.createdAt.$lte = end.toISOString();
        }
      }

      if (search && search.trim()) {
        const term = search.trim();
        filter.$or = [
          { id: new RegExp(term, 'i') },
          { customerPhone: new RegExp(term, 'i') },
          { customerName: new RegExp(term, 'i') },
          { 'deliveryAddress.city': new RegExp(term, 'i') },
        ];
      }

      const total = await Order.countDocuments(filter).exec();
      const docs = await Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .exec();

      // Compute overall store metrics across entire order collection
      const allDocs = await Order.find({}, 'orderStatus total').lean().exec();
      const metrics = {
        total: allDocs.length,
        pending: allDocs.filter((o) => o.orderStatus === 'PENDING').length,
        inTransit: allDocs.filter((o) =>
          ['CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
        ).length,
        delivered: allDocs.filter((o) => o.orderStatus === 'DELIVERED').length,
        totalRevenue: allDocs
          .filter((o) => o.orderStatus !== 'CANCELLED')
          .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
      };

      return {
        orders: docs.map((d) => d.toJSON()),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        metrics,
      };
    }

    // In-memory fallback
    let result = [...this.memoryOrders];

    if (status && status.toUpperCase() !== 'ALL') {
      const target = status.toUpperCase();
      result = result.filter((o) => o.orderStatus === target);
    }

    if (paymentStatus && paymentStatus.toUpperCase() !== 'ALL') {
      const targetPay = paymentStatus.toUpperCase();
      result = result.filter((o) => (o.paymentStatus || 'PENDING') === targetPay);
    }

    if (startDate) {
      const startIso = new Date(startDate).toISOString();
      result = result.filter((o) => (o.createdAt || '') >= startIso);
    }

    if (endDate) {
      const end = new Date(endDate);
      if (String(endDate).length === 10) {
        end.setHours(23, 59, 59, 999);
      }
      const endIso = end.toISOString();
      result = result.filter((o) => (o.createdAt || '') <= endIso);
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((o) => {
        return (
          (o.id && o.id.toLowerCase().includes(term)) ||
          (o.customerPhone && o.customerPhone.includes(term)) ||
          (o.customerName && o.customerName.toLowerCase().includes(term)) ||
          (o.deliveryAddress?.city && o.deliveryAddress.city.toLowerCase().includes(term))
        );
      });
    }

    // Sort by createdAt desc
    result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = result.length;
    const paginatedOrders = result.slice(skip, skip + limitNum);

    const metrics = {
      total: this.memoryOrders.length,
      pending: this.memoryOrders.filter((o) => o.orderStatus === 'PENDING').length,
      inTransit: this.memoryOrders.filter((o) =>
        ['CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.orderStatus)
      ).length,
      delivered: this.memoryOrders.filter((o) => o.orderStatus === 'DELIVERED').length,
      totalRevenue: this.memoryOrders
        .filter((o) => o.orderStatus !== 'CANCELLED')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    };

    return {
      orders: paginatedOrders,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      metrics,
    };
  }

  /**
   * Update order status & payment status with audit trail
   */
  async updateStatus(orderId, { orderStatus, paymentStatus, note, updatedBy = 'ADMIN', extraFields = {} }) {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found.`);
    }

    const updates = {
      ...extraFields,
      updatedAt: new Date().toISOString(),
    };

    if (orderStatus) updates.orderStatus = orderStatus.toUpperCase();
    if (paymentStatus) updates.paymentStatus = paymentStatus.toUpperCase();

    const historyEntry = {
      status: updates.orderStatus || order.orderStatus,
      timestamp: new Date().toISOString(),
      note: note || `Order updated to ${updates.orderStatus || order.orderStatus}`,
      updatedBy,
    };

    if (isDbConnected()) {
      const updated = await Order.findOneAndUpdate(
        { id: String(orderId) },
        {
          $set: updates,
          $push: { statusHistory: historyEntry },
        },
        { new: true }
      ).exec();

      return updated ? updated.toJSON() : null;
    }

    // In-memory fallback
    Object.assign(order, updates);
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push(historyEntry);
    return order;
  }

  /**
   * Update delivery tracking telemetry (coordinates, route, ETA)
   */
  async updateTracking(orderId, trackingData) {
    if (!orderId) return null;

    if (isDbConnected()) {
      const updated = await Order.findOneAndUpdate(
        { id: String(orderId) },
        {
          $set: {
            ...trackingData,
            lastLocationUpdateAt: new Date().toISOString(),
          },
        },
        { new: true }
      ).exec();

      // Also sync memory cache
      const inMem = this.memoryOrders.find((o) => o.id === String(orderId));
      if (inMem) {
        Object.assign(inMem, trackingData);
        inMem.lastLocationUpdateAt = new Date().toISOString();
      }

      return updated ? updated.toJSON() : null;
    }

    const order = await this.getById(orderId);
    if (order) {
      Object.assign(order, trackingData);
      order.lastLocationUpdateAt = new Date().toISOString();
    }
    return order;
  }

  /**
   * Fetch all orders without pagination for analytics and reports
   */
  async getAllOrdersRaw({ startDate, endDate } = {}) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const filter = {};
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate).toISOString();
        if (endDate) {
          const end = new Date(endDate);
          if (String(endDate).length === 10) end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end.toISOString();
        }
      }
      const docs = await Order.find(filter).sort({ createdAt: -1 }).lean().exec();
      return docs.map((d) => ({ ...d, id: d.id || d._id?.toString() }));
    }

    let result = [...this.memoryOrders];
    if (startDate) {
      const startIso = new Date(startDate).toISOString();
      result = result.filter((o) => (o.createdAt || '') >= startIso);
    }
    if (endDate) {
      const end = new Date(endDate);
      if (String(endDate).length === 10) end.setHours(23, 59, 59, 999);
      const endIso = end.toISOString();
      result = result.filter((o) => (o.createdAt || '') <= endIso);
    }
    return result;
  }
}

export const orderRepository = new OrderRepository();
export default orderRepository;

