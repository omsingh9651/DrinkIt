import { orderRepository } from '../repositories/orderRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { userRepository } from '../repositories/userRepository.js';

/**
 * Report and Analytics Service
 * Computes live, accurate sales metrics and exports from MongoDB data.
 */
class ReportService {
  /**
   * Determine date range based on filter period
   */
  resolveDateRange({ range = '30d', startDate, endDate } = {}) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === '7d') {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === '30d') {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'custom') {
      if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(now.getDate() - 29);
      }
      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }
    } else {
      // Default: last 30 days
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      startDateObj: start,
      endDateObj: end,
    };
  }

  /**
   * Get analytics dashboard payload
   */
  async getAnalytics({ range = '30d', startDate, endDate } = {}) {
    const dateRange = this.resolveDateRange({ range, startDate, endDate });
    const orders = await orderRepository.getAllOrdersRaw({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

    const products = await productRepository.getAll({ includeInactive: true });
    const customerData = await userRepository.getAllCustomers({ limit: 1000 });

    const totalCustomers = customerData?.metrics?.totalCustomers || customerData?.total || 0;

    // Filter valid non-cancelled orders for financial metrics
    const nonCancelledOrders = orders.filter((o) => o.orderStatus !== 'CANCELLED');
    const cancelledOrders = orders.filter((o) => o.orderStatus === 'CANCELLED');

    const totalRevenue = nonCancelledOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const totalOrders = nonCancelledOrders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    let totalBottlesSold = 0;
    const productSalesMap = new Map();
    const categorySalesMap = new Map();

    for (const order of nonCancelledOrders) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const qty = Number(item.quantity) || 1;
          const subtotal = Number(item.subtotal) || (Number(item.price) || 0) * qty;
          totalBottlesSold += qty;

          // Product aggregation
          const pId = item.productId || item.id || item.name;
          const pName = item.name || 'Unknown Product';
          const pBrand = item.brand || 'DrinkIt Reserve';
          const existingProd = productSalesMap.get(pId) || {
            id: pId,
            name: pName,
            brand: pBrand,
            quantitySold: 0,
            revenue: 0,
          };
          existingProd.quantitySold += qty;
          existingProd.revenue += subtotal;
          productSalesMap.set(pId, existingProd);

          // Find product category if available
          const foundProd = products.find((p) => p.id === pId || p.name === pName);
          const cat = foundProd?.category || item.category || 'Spirits & Wine';
          const existingCat = categorySalesMap.get(cat) || {
            category: cat,
            revenue: 0,
            bottles: 0,
          };
          existingCat.revenue += subtotal;
          existingCat.bottles += qty;
          categorySalesMap.set(cat, existingCat);
        }
      }
    }

    // Sort Top Products by revenue
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Category distribution
    const categoryDistribution = Array.from(categorySalesMap.values()).map((c) => ({
      ...c,
      percentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
    }));

    // Status breakdown
    const statusCounts = {};
    for (const o of orders) {
      const st = o.orderStatus || 'PENDING';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    }

    const orderStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: orders.length > 0 ? Math.round((count / orders.length) * 100) : 0,
    }));

    // Build timeline daily series between start and end
    const timeline = [];
    const curr = new Date(dateRange.startDateObj);
    while (curr <= dateRange.endDateObj) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOrders = nonCancelledOrders.filter((o) => {
        const oDate = o.createdAt ? o.createdAt.split('T')[0] : '';
        return oDate === dateStr;
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const dayBottles = dayOrders.reduce((sum, o) => {
        const orderBottles = (o.items || []).reduce((bSum, i) => bSum + (Number(i.quantity) || 1), 0);
        return sum + orderBottles;
      }, 0);

      timeline.push({
        date: dateStr,
        label: new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        orders: dayOrders.length,
        bottles: dayBottles,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return {
      summary: {
        totalRevenue,
        totalOrders,
        totalCustomers,
        totalBottlesSold,
        averageOrderValue,
        cancelledOrdersCount: cancelledOrders.length,
        allOrdersCount: orders.length,
      },
      dateRange: {
        range,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      timeline,
      topProducts,
      categoryDistribution,
      orderStatusBreakdown,
    };
  }

  /**
   * Export orders report as CSV
   */
  async generateOrdersCsv({ range = '30d', startDate, endDate } = {}) {
    const dateRange = this.resolveDateRange({ range, startDate, endDate });
    const orders = await orderRepository.getAllOrdersRaw({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

    const headers = [
      'Order ID',
      'Date',
      'Customer Phone',
      'Customer Name',
      'City',
      'Order Status',
      'Payment Method',
      'Payment Status',
      'Item Count',
      'Subtotal (INR)',
      'Delivery Fee (INR)',
      'Total Amount (INR)',
    ];

    const rows = orders.map((o) => {
      const itemsCount = (o.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
      const date = o.createdAt ? new Date(o.createdAt).toISOString().replace('T', ' ').substring(0, 19) : '';
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

      return [
        escape(o.id),
        escape(date),
        escape(o.customerPhone),
        escape(o.customerName || o.deliveryAddress?.fullName || 'Customer'),
        escape(o.deliveryAddress?.city || 'Delhi NCR'),
        escape(o.orderStatus),
        escape(o.paymentMethod || 'RAZORPAY'),
        escape(o.paymentStatus || 'PAID'),
        itemsCount,
        Number(o.subtotal) || 0,
        Number(o.deliveryFee) || 0,
        Number(o.total) || 0,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const reportService = new ReportService();
export default reportService;

