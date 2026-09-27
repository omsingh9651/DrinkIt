import { productRepository } from '../repositories/productRepository.js';

/**
 * Product Service
 * Business logic layer delegating database operations to productRepository.
 * Compatible with both MongoDB and resilient in-memory fallback.
 */
class ProductService {
  /**
   * Fetch all products matching criteria
   */
  async getAll(params = {}) {
    return productRepository.getAll(params);
  }

  /**
   * Find product by ID
   */
  async getById(id) {
    return productRepository.getById(id);
  }

  /**
   * Find product by SKU
   */
  async getBySku(sku) {
    return productRepository.getBySku(sku);
  }

  /**
   * Create a new product
   */
  async create(data) {
    return productRepository.create(data);
  }

  /**
   * Update product by ID
   */
  async update(id, updates) {
    return productRepository.update(id, updates);
  }

  /**
   * Fast stock updater
   */
  async updateStock(id, stockQuantity) {
    return productRepository.updateStock(id, stockQuantity);
  }

  /**
   * Fast status updater (active / inactive)
   */
  async updateStatus(id, status) {
    return productRepository.updateStatus(id, status);
  }

  /**
   * Safe Atomic Stock Decrement
   */
  async atomicDecreaseStock(id, quantity) {
    return productRepository.atomicDecreaseStock(id, quantity);
  }

  /**
   * Safe Atomic Stock Restoration
   */
  async atomicRestoreStock(id, quantity) {
    return productRepository.atomicRestoreStock(id, quantity);
  }

  /**
   * Delete product by ID
   */
  async delete(id) {
    return productRepository.delete(id);
  }

  /**
   * Get category summary with count of products
   */
  async getCategories() {
    return productRepository.getCategories();
  }

  /**
   * Reset store to initial seed data
   */
  async resetToDefaults() {
    return productRepository.getAll();
  }
}

export const productService = new ProductService();
export default productService;
