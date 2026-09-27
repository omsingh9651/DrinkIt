import { productRepository } from '../repositories/productRepository.js';
import { inventoryLogRepository } from '../repositories/inventoryLogRepository.js';

class InventoryService {
  /**
   * Fetch aggregate inventory metrics
   */
  async getSummary(threshold = 5) {
    return productRepository.getInventorySummary({ threshold });
  }

  /**
   * Fetch inventory items with computed health flags
   */
  async getInventoryItems({ threshold = 5, status, category, q, sortBy } = {}) {
    const numThreshold = Math.max(0, parseInt(threshold, 10) || 5);
    const products = await productRepository.getAll({
      category,
      q,
      sortBy,
      includeInactive: true,
    });

    const items = products.map((p) => {
      const stock = Number(p.stockQuantity ?? p.stock ?? 0);
      const prodThreshold = p.lowStockThreshold !== undefined ? Number(p.lowStockThreshold) : numThreshold;

      let inventoryHealth = 'healthy';
      if (stock <= 0) {
        inventoryHealth = 'out_of_stock';
      } else if (stock <= prodThreshold) {
        inventoryHealth = 'low_stock';
      }

      return {
        ...p,
        stockQuantity: stock,
        stock,
        lowStockThreshold: prodThreshold,
        inventoryHealth,
        isOutOfStock: stock <= 0,
        isLowStock: stock > 0 && stock <= prodThreshold,
        totalItemValue: stock * Number(p.price ?? p.sellingPrice ?? 0),
      };
    });

    // Optional status filter on inventoryHealth ('out_of_stock', 'low_stock', 'healthy', or store status 'active', 'inactive')
    if (status && status !== 'All') {
      const s = status.toLowerCase();
      if (s === 'out_of_stock' || s === 'out-of-stock') {
        return items.filter((item) => item.inventoryHealth === 'out_of_stock');
      }
      if (s === 'low_stock' || s === 'low-stock') {
        return items.filter((item) => item.inventoryHealth === 'low_stock');
      }
      if (s === 'healthy' || s === 'in_stock' || s === 'in-stock') {
        return items.filter((item) => item.inventoryHealth === 'healthy');
      }
      if (s === 'active' || s === 'inactive') {
        return items.filter((item) => item.status === s);
      }
    }

    return items;
  }

  /**
   * Adjust product stock safely
   */
  async adjustStock({ productId, quantity, adjustmentType = 'delta', reason, performedBy, referenceId }) {
    if (!productId) {
      throw new Error('Product ID is required for stock adjustment.');
    }

    return productRepository.adjustStock(productId, {
      quantity,
      adjustmentType,
      reason,
      performedBy,
      referenceId,
    });
  }

  /**
   * Fetch stock history audit trail
   */
  async getHistory({ productId, type, category, search, limit = 50, skip = 0 } = {}) {
    return inventoryLogRepository.getLogs({ productId, type, category, search, limit, skip });
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;

