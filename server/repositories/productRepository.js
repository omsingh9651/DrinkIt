import { Product } from '../models/Product.js';
import { INITIAL_PRODUCTS } from '../data/initialProducts.js';
import { isDbConnected } from '../config/db.js';
import { inventoryLogRepository } from './inventoryLogRepository.js';

class ProductRepository {
  constructor() {
    // In-memory fallback cache
    this.memoryProducts = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)).map((p) => {
      const s = p.stockQuantity !== undefined ? Number(p.stockQuantity) : p.stock !== undefined ? Number(p.stock) : 25;
      return {
        ...p,
        stock: s,
        stockQuantity: s,
        sellingPrice: p.price,
        mrp: p.originalPrice || p.mrp || p.price,
        inStock: s > 0,
      };
    });
    this.hasSeededDb = false;
  }

  async seedDatabaseIfEmpty() {
    if (!isDbConnected() || this.hasSeededDb) return;
    try {
      const count = await Product.countDocuments();
      if (count === 0) {
        for (const p of INITIAL_PRODUCTS) {
          const price = Number(p.price);
          const mrp = Number(p.originalPrice || p.mrp || Math.round(price * 1.15));
          const stock = Number(p.stockQuantity !== undefined ? p.stockQuantity : p.stock !== undefined ? p.stock : 25);
          const sku = (p.sku || `DKT-${p.id.toUpperCase()}`).trim().toUpperCase();

          const productDoc = {
            id: p.id,
            name: p.name,
            brand: p.brand || 'DrinkIt Reserve',
            category: p.category,
            subcategory: p.subcategory || p.subCategory || `${p.category} Special`,
            subCategory: p.subCategory || p.subcategory || `${p.category} Special`,
            description: p.description || '',
            shortDescription: p.shortDescription || p.description || '',
            longDescription: p.longDescription || p.description || '',
            images: Array.isArray(p.images) ? p.images : [p.image || p.thumbnail].filter(Boolean),
            image: p.image || p.thumbnail || '',
            imageUrl: p.imageUrl || p.image || p.thumbnail || '',
            thumbnail: p.thumbnail || p.image || '',
            volume: p.volume || '750 ml',
            unit: p.unit || 'bottle',
            abv: p.abv || '40.0%',
            sku,
            barcode: p.barcode || '',
            mrp,
            originalPrice: mrp,
            sellingPrice: price,
            price,
            discount: p.discount || Math.max(0, Math.round(((mrp - price) / mrp) * 100)),
            stock,
            stockQuantity: stock,
            lowStockThreshold: p.lowStockThreshold || 5,
            inStock: stock > 0,
            rating: p.rating || 4.5,
            reviewCount: p.reviewCount || p.reviewsCount || 0,
            reviewsCount: p.reviewCount || p.reviewsCount || 0,
            status: p.status || 'active',
            featured: p.featured || false,
            popular: p.popular || false,
            badge: p.badge || null,
            origin: p.origin || 'India',
            tastingNotes: p.tastingNotes || [],
            foodPairing: p.foodPairing || '',
            currency: '₹',
          };

          await Product.findOneAndUpdate(
            { sku },
            { $set: productDoc },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
        console.log(`[ProductRepository] Seeded ${INITIAL_PRODUCTS.length} initial products into MongoDB.`);
      }
      this.hasSeededDb = true;
    } catch (err) {
      console.warn('[ProductRepository] Failed to seed products to MongoDB:', err.message);
    }
  }

  /**
   * Fetch all products matching criteria
   */
  async getAll({ category, q, sortBy = 'featured', inStock, minPrice, maxPrice, status, includeInactive } = {}) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const filter = {};

      // Status filtering: if includeInactive is true, do not filter out inactive
      // If status is specifically requested (e.g. 'active', 'inactive', 'archived'), filter by that status
      // Otherwise (public customer browsing), show only active products
      if (status && status.toLowerCase() !== 'all') {
        filter.status = status.toLowerCase();
      } else if (includeInactive !== true && includeInactive !== 'true') {
        filter.status = { $ne: 'inactive' };
      }

      if (category && category.toLowerCase() !== 'all') {
        filter.category = new RegExp(`^${category}$`, 'i');
      }

      if (q && q.trim()) {
        const term = q.trim();
        filter.$or = [
          { name: new RegExp(term, 'i') },
          { brand: new RegExp(term, 'i') },
          { category: new RegExp(term, 'i') },
          { subcategory: new RegExp(term, 'i') },
          { subCategory: new RegExp(term, 'i') },
          { description: new RegExp(term, 'i') },
        ];
      }

      if (inStock !== undefined && inStock !== null && inStock !== '') {
        const stockBool = inStock === 'true' || inStock === true;
        filter.inStock = stockBool;
      }

      if (minPrice !== undefined && minPrice !== '') {
        const min = Number(minPrice);
        if (!isNaN(min)) filter.sellingPrice = { ...(filter.sellingPrice || {}), $gte: min };
      }
      if (maxPrice !== undefined && maxPrice !== '') {
        const max = Number(maxPrice);
        if (!isNaN(max)) filter.sellingPrice = { ...(filter.sellingPrice || {}), $lte: max };
      }

      let query = Product.find(filter);

      switch (sortBy) {
        case 'price-low':
          query = query.sort({ sellingPrice: 1 });
          break;
        case 'price-high':
          query = query.sort({ sellingPrice: -1 });
          break;
        case 'rating':
          query = query.sort({ rating: -1 });
          break;
        case 'popular':
          query = query.sort({ popular: -1, reviewCount: -1 });
          break;
        case 'newest':
          query = query.sort({ createdAt: -1 });
          break;
        case 'featured':
        default:
          query = query.sort({ featured: -1, rating: -1 });
          break;
      }

      const docs = await query.exec();
      return docs.map((d) => d.toJSON());
    }

    // In-memory fallback
    let result = [...this.memoryProducts];

    // Status filtering in fallback
    if (status && status.toLowerCase() !== 'all') {
      const targetStatus = status.toLowerCase();
      result = result.filter((p) => (p.status || 'active').toLowerCase() === targetStatus);
    } else if (includeInactive !== true && includeInactive !== 'true') {
      result = result.filter((p) => (p.status || 'active') !== 'inactive');
    }

    if (category && category.toLowerCase() !== 'all') {
      const target = category.toLowerCase();
      result = result.filter((p) => p.category && p.category.toLowerCase() === target);
    }

    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.brand && p.brand.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term)) ||
          (p.subcategory && p.subcategory.toLowerCase().includes(term)) ||
          (p.subCategory && p.subCategory.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }

    if (inStock !== undefined && inStock !== null && inStock !== '') {
      const stockBool = inStock === 'true' || inStock === true;
      result = result.filter((p) => p.inStock === stockBool);
    }

    if (minPrice !== undefined && minPrice !== '') {
      const min = Number(minPrice);
      if (!isNaN(min)) result = result.filter((p) => (p.sellingPrice || p.price) >= min);
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const max = Number(maxPrice);
      if (!isNaN(max)) result = result.filter((p) => (p.sellingPrice || p.price) <= max);
    }

    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => (a.sellingPrice || a.price) - (b.sellingPrice || b.price));
        break;
      case 'price-high':
        result.sort((a, b) => (b.sellingPrice || b.price) - (a.sellingPrice || a.price));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'popular':
        result.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'featured':
      default:
        result.sort((a, b) => (b.featured === a.featured ? 0 : b.featured ? 1 : -1));
        break;
    }

    return result;
  }

  /**
   * Find product by ID or slug
   */
  async getById(id) {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const doc = await Product.findOne({
        $or: [{ id: String(id) }, { sku: String(id).toUpperCase() }],
      }).exec();
      return doc ? doc.toJSON() : null;
    }

    return this.memoryProducts.find((p) => String(p.id) === String(id) || String(p.sku) === String(id)) || null;
  }

  /**
   * Find product by unique SKU
   */
  async getBySku(sku) {
    await this.seedDatabaseIfEmpty();
    if (!sku) return null;
    const cleanSku = String(sku).trim().toUpperCase();

    if (isDbConnected()) {
      const doc = await Product.findOne({ sku: cleanSku }).exec();
      return doc ? doc.toJSON() : null;
    }

    return this.memoryProducts.find((p) => String(p.sku).toUpperCase() === cleanSku) || null;
  }

  /**
   * Create a new product
   */
  async create(data) {
    const baseSlug = (data.name || 'product')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = data.id || baseSlug;

    const price = Number(data.price || data.sellingPrice || data.discountPrice);
    if (isNaN(price) || price <= 0) {
      throw new Error('Price must be a positive number in INR.');
    }

    const mrp = data.mrp
      ? Number(data.mrp)
      : data.originalPrice
        ? Number(data.originalPrice)
        : Math.round(price * 1.15);
    if (mrp < price) {
      throw new Error('MRP / Regular price cannot be less than the discounted selling price.');
    }

    const stockQty =
      data.stockQuantity !== undefined
        ? Number(data.stockQuantity)
        : data.stock !== undefined
          ? Number(data.stock)
          : 25;
    if (isNaN(stockQty) || stockQty < 0) {
      throw new Error('Stock quantity cannot be negative.');
    }

    const bottleSizeInMl =
      Number(data.bottleSizeInMl) ||
      (data.volume ? parseInt(data.volume, 10) : 750) ||
      750;
    const volume = data.volume || `${bottleSizeInMl} ml`;
    const abv = data.abv || '40.0%';
    const status = data.status === 'inactive' ? 'inactive' : 'active';
    const rating = data.rating !== undefined ? Math.min(5, Math.max(0, Number(data.rating))) : 4.5;
    const sku = (
      data.sku || `DKT-${baseSlug.toUpperCase().slice(0, 10)}-${Date.now().toString().slice(-4)}`
    )
      .trim()
      .toUpperCase();

    const productPayload = {
      ...data,
      id: slug,
      sku,
      name: (data.name || '').trim(),
      brand: (data.brand || 'DrinkIt Reserve').trim(),
      category: (data.category || 'Wine').trim(),
      price,
      sellingPrice: price,
      discountPrice: price,
      mrp,
      originalPrice: mrp,
      stock: stockQty,
      stockQuantity: stockQty,
      bottleSizeInMl,
      volume,
      abv,
      status,
      inStock: stockQty > 0,
      rating,
      reviewCount: Number(data.reviewCount || data.reviewsCount) || 0,
      image: (data.image || data.imageUrl || data.thumbnail || '').trim(),
      imageUrl: (data.image || data.imageUrl || data.thumbnail || '').trim(),
      thumbnail: (data.image || data.imageUrl || data.thumbnail || '').trim(),
    };

    if (isDbConnected()) {
      // Ensure unique slug
      let counter = 1;
      while (await Product.findOne({ id: slug }).exec()) {
        slug = `${baseSlug}-${counter++}`;
      }
      productPayload.id = slug;

      const created = await Product.create(productPayload);
      return created.toJSON();
    }

    // In-memory fallback
    this.memoryProducts.unshift(productPayload);
    return productPayload;
  }

  /**
   * Update product by ID
   */
  async update(id, updates) {
    const cleanUpdates = { ...updates };

    if (cleanUpdates.price !== undefined) {
      const p = Number(cleanUpdates.price);
      if (isNaN(p) || p <= 0) throw new Error('Price must be a positive number in INR.');
      cleanUpdates.price = p;
      cleanUpdates.sellingPrice = p;
      cleanUpdates.discountPrice = p;
    }
    if (cleanUpdates.sellingPrice !== undefined && cleanUpdates.price === undefined) {
      const p = Number(cleanUpdates.sellingPrice);
      if (isNaN(p) || p <= 0) throw new Error('Price must be a positive number in INR.');
      cleanUpdates.price = p;
      cleanUpdates.sellingPrice = p;
      cleanUpdates.discountPrice = p;
    }
    if (cleanUpdates.discountPrice !== undefined && cleanUpdates.price === undefined) {
      const p = Number(cleanUpdates.discountPrice);
      if (isNaN(p) || p <= 0) throw new Error('Price must be a positive number in INR.');
      cleanUpdates.price = p;
      cleanUpdates.sellingPrice = p;
      cleanUpdates.discountPrice = p;
    }
    if (cleanUpdates.mrp !== undefined) {
      cleanUpdates.originalPrice = Number(cleanUpdates.mrp);
      cleanUpdates.mrp = cleanUpdates.originalPrice;
    }
    if (cleanUpdates.originalPrice !== undefined) {
      cleanUpdates.mrp = Number(cleanUpdates.originalPrice);
    }
    if (cleanUpdates.price && cleanUpdates.mrp && cleanUpdates.mrp < cleanUpdates.price) {
      throw new Error('MRP / Regular price cannot be less than the discounted selling price.');
    }
    if (cleanUpdates.stockQuantity !== undefined) {
      const s = Number(cleanUpdates.stockQuantity);
      if (isNaN(s) || s < 0) throw new Error('Stock quantity cannot be negative.');
      cleanUpdates.stockQuantity = s;
      cleanUpdates.stock = s;
      cleanUpdates.inStock = s > 0;
    }
    if (cleanUpdates.stock !== undefined && cleanUpdates.stockQuantity === undefined) {
      const s = Number(cleanUpdates.stock);
      if (isNaN(s) || s < 0) throw new Error('Stock quantity cannot be negative.');
      cleanUpdates.stock = s;
      cleanUpdates.stockQuantity = s;
      cleanUpdates.inStock = s > 0;
    }
    if (cleanUpdates.rating !== undefined) {
      const r = Number(cleanUpdates.rating);
      if (!isNaN(r) && r >= 0 && r <= 5) {
        cleanUpdates.rating = r;
      }
    }
    if (cleanUpdates.status !== undefined) {
      cleanUpdates.status = cleanUpdates.status === 'inactive' ? 'inactive' : 'active';
    }
    if (cleanUpdates.bottleSizeInMl !== undefined) {
      const ml = Number(cleanUpdates.bottleSizeInMl);
      if (!isNaN(ml) && ml > 0) {
        cleanUpdates.bottleSizeInMl = ml;
        if (!cleanUpdates.volume) cleanUpdates.volume = `${ml} ml`;
      }
    }
    if (cleanUpdates.image) {
      const img = cleanUpdates.image.trim();
      cleanUpdates.image = img;
      cleanUpdates.imageUrl = img;
      cleanUpdates.thumbnail = img;
    }

    if (isDbConnected()) {
      const updated = await Product.findOneAndUpdate(
        { id: String(id) },
        { $set: cleanUpdates },
        { new: true }
      ).exec();

      return updated ? updated.toJSON() : null;
    }

    const index = this.memoryProducts.findIndex((p) => String(p.id) === String(id));
    if (index === -1) return null;

    const current = this.memoryProducts[index];
    const updated = {
      ...current,
      ...cleanUpdates,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };

    if (updated.stockQuantity !== undefined) updated.stock = updated.stockQuantity;
    if (updated.stock !== undefined) updated.stockQuantity = updated.stock;
    updated.inStock = (updated.stockQuantity || 0) > 0;

    this.memoryProducts[index] = updated;
    return updated;
  }

  /**
   * Fast stock updater
   */
  async updateStock(id, stockQuantity, { reason = 'Stock quantity update', performedBy = 'ADMIN', referenceId = null } = {}) {
    const qty = Number(stockQuantity);
    if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new Error('Stock quantity must be a non-negative whole number');
    }
    const product = await this.getById(id);
    const prevStock = product ? Number(product.stockQuantity ?? product.stock ?? 0) : 0;
    const updated = await this.update(id, { stockQuantity: qty, stock: qty, inStock: qty > 0 });

    if (product && qty !== prevStock) {
      const delta = qty - prevStock;
      inventoryLogRepository.createLog({
        productId: product.id,
        productName: product.name,
        category: product.category,
        previousStock: prevStock,
        newStock: qty,
        change: delta,
        type: delta > 0 && String(reason).toLowerCase().includes('restock') ? 'RESTOCK' : 'ADJUSTMENT',
        reason,
        referenceId,
        performedBy,
      }).catch((err) => console.warn('Failed to log updateStock:', err.message));
    }

    return updated;
  }

  /**
   * Safe stock adjustment (increase, decrease, set) with audit logging
   */
  async adjustStock(id, { quantity, adjustmentType = 'delta', reason = 'Manual stock adjustment', performedBy = 'ADMIN', referenceId = null }) {
    const product = await this.getById(id);
    if (!product) {
      throw new Error(`Product #${id} not found.`);
    }

    const currentStock = Number(product.stockQuantity ?? product.stock ?? 0);
    const numQty = Number(quantity);

    if (isNaN(numQty) || !Number.isInteger(numQty)) {
      throw new Error('Adjustment quantity must be an integer.');
    }

    let newStock;
    if (adjustmentType === 'set') {
      newStock = numQty;
    } else {
      newStock = currentStock + numQty;
    }

    if (newStock < 0) {
      throw new Error(`Negative stock prohibited. Current stock is ${currentStock}, adjustment results in ${newStock}.`);
    }

    const delta = newStock - currentStock;
    if (delta === 0) {
      return { product, log: null };
    }

    const logType = delta > 0 && String(reason).toLowerCase().includes('restock') ? 'RESTOCK' : 'ADJUSTMENT';

    // Update product stock
    const updated = await this.update(id, {
      stockQuantity: newStock,
      stock: newStock,
      inStock: newStock > 0,
    });

    // Record immutable audit history
    const log = await inventoryLogRepository.createLog({
      productId: product.id,
      productName: product.name,
      category: product.category,
      previousStock: currentStock,
      newStock,
      change: delta,
      type: logType,
      reason,
      referenceId,
      performedBy,
    });

    return { product: updated, log };
  }

  /**
   * Fast status updater (active / inactive)
   */
  async updateStatus(id, status) {
    const validStatus = status === 'inactive' ? 'inactive' : 'active';
    return this.update(id, { status: validStatus });
  }

  /**
   * Safe Atomic Stock Decrement
   * Guarantees stock does not drop below zero and logs history
   */
  async atomicDecreaseStock(id, quantity, { referenceId = null, performedBy = 'SYSTEM (Order Placement)', reason = 'Order placed' } = {}) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Invalid quantity to decrease.');
    }

    const product = await this.getById(id);
    if (!product) throw new Error(`Product ${id} not found.`);
    const currentStock = Number(product.stockQuantity ?? product.stock ?? 0);

    if (currentStock < qty) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${currentStock}, Requested: ${qty}.`);
    }

    let updatedProduct;

    if (isDbConnected()) {
      const updated = await Product.findOneAndUpdate(
        {
          id: String(id),
          $or: [{ stockQuantity: { $gte: qty } }, { stock: { $gte: qty } }],
        },
        {
          $inc: { stockQuantity: -qty, stock: -qty },
        },
        { new: true }
      ).exec();

      if (!updated) {
        throw new Error(`Insufficient stock available for product ID: ${id}`);
      }

      // Check if stock reached 0
      if (updated.stockQuantity <= 0) {
        await Product.updateOne({ id: String(id) }, { $set: { inStock: false } });
      }

      updatedProduct = updated.toJSON();
    } else {
      // In-memory fallback
      const newStock = currentStock - qty;
      updatedProduct = await this.update(id, { stockQuantity: newStock, stock: newStock, inStock: newStock > 0 });
    }

    // Log deduction
    const finalStock = Number(updatedProduct.stockQuantity ?? updatedProduct.stock ?? 0);
    inventoryLogRepository.createLog({
      productId: product.id,
      productName: product.name,
      category: product.category,
      previousStock: currentStock,
      newStock: finalStock,
      change: -qty,
      type: 'ORDER_PLACED',
      reason: reason || (referenceId ? `Order #${referenceId}` : 'Customer order placed'),
      referenceId,
      performedBy,
    }).catch((err) => console.warn('Failed to log atomicDecreaseStock:', err.message));

    return updatedProduct;
  }

  /**
   * Safe Atomic Stock Restoration (e.g. Order Cancelled)
   * Logs history
   */
  async atomicRestoreStock(id, quantity, { referenceId = null, performedBy = 'SYSTEM (Order Cancelled)', reason = 'Order cancellation return' } = {}) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return null;

    const product = await this.getById(id);
    if (!product) return null;
    const currentStock = Number(product.stockQuantity ?? product.stock ?? 0);

    let updatedProduct;

    if (isDbConnected()) {
      const updated = await Product.findOneAndUpdate(
        { id: String(id) },
        {
          $inc: { stockQuantity: qty, stock: qty },
          $set: { inStock: true },
        },
        { new: true }
      ).exec();

      updatedProduct = updated ? updated.toJSON() : null;
    } else {
      // In-memory fallback
      const newStock = currentStock + qty;
      updatedProduct = await this.update(id, { stockQuantity: newStock, stock: newStock, inStock: newStock > 0 });
    }

    if (updatedProduct) {
      const finalStock = Number(updatedProduct.stockQuantity ?? updatedProduct.stock ?? 0);
      inventoryLogRepository.createLog({
        productId: product.id,
        productName: product.name,
        category: product.category,
        previousStock: currentStock,
        newStock: finalStock,
        change: qty,
        type: 'ORDER_CANCELLED',
        reason: reason || (referenceId ? `Order #${referenceId} cancelled` : 'Order cancellation return'),
        referenceId,
        performedBy,
      }).catch((err) => console.warn('Failed to log atomicRestoreStock:', err.message));
    }

    return updatedProduct;
  }

  /**
   * Get complete inventory summary metrics
   */
  async getInventorySummary({ threshold = 5 } = {}) {
    const numThreshold = Math.max(0, parseInt(threshold, 10) || 5);
    const products = await this.getAll({ includeInactive: true });

    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let healthyStockCount = 0;
    let totalValuation = 0;

    for (const p of products) {
      const stock = Number(p.stockQuantity ?? p.stock ?? 0);
      const price = Number(p.price ?? p.sellingPrice ?? 0);
      const prodThreshold = p.lowStockThreshold !== undefined ? Number(p.lowStockThreshold) : numThreshold;

      totalStock += stock;
      totalValuation += stock * price;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= prodThreshold) {
        lowStockCount++;
      } else {
        healthyStockCount++;
      }
    }

    return {
      totalProducts: products.length,
      totalStock,
      lowStockCount,
      outOfStockCount,
      healthyStockCount,
      threshold: numThreshold,
      totalValuation,
    };
  }

  /**
   * Delete product by ID
   */
  async delete(id) {
    if (isDbConnected()) {
      const deleted = await Product.findOneAndDelete({ id: String(id) }).exec();
      return deleted ? deleted.toJSON() : null;
    }

    const index = this.memoryProducts.findIndex((p) => String(p.id) === String(id));
    if (index === -1) return null;
    const [deleted] = this.memoryProducts.splice(index, 1);
    return deleted;
  }

  /**
   * Get category summary with count of products
   */
  async getCategories() {
    await this.seedDatabaseIfEmpty();
    if (isDbConnected()) {
      const agg = await Product.aggregate([
        { $match: { status: { $ne: 'archived' } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      return agg.map((a) => ({ name: a._id, count: a.count }));
    }

    const categoryMap = new Map();
    this.memoryProducts.forEach((p) => {
      if (p.category) {
        const count = categoryMap.get(p.category) || 0;
        categoryMap.set(p.category, count + 1);
      }
    });
    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }

  /**
   * Count products belonging to a specific category
   */
  async countByCategory(categoryName) {
    await this.seedDatabaseIfEmpty();
    if (!categoryName) return 0;
    const regex = new RegExp(`^${categoryName.trim()}$`, 'i');
    if (isDbConnected()) {
      return Product.countDocuments({ category: regex }).exec();
    }
    return this.memoryProducts.filter((p) => p.category && regex.test(p.category)).length;
  }

  /**
   * Count products belonging to a specific brand
   */
  async countByBrand(brandName) {
    await this.seedDatabaseIfEmpty();
    if (!brandName) return 0;
    const regex = new RegExp(`^${brandName.trim()}$`, 'i');
    if (isDbConnected()) {
      return Product.countDocuments({ brand: regex }).exec();
    }
    return this.memoryProducts.filter((p) => p.brand && regex.test(p.brand)).length;
  }

  /**
   * Upsert many products idempotently (for migration/seed)
   */
  async upsertMany(products) {
    if (!Array.isArray(products) || products.length === 0) return [];

    if (isDbConnected()) {
      const operations = products.map((p) => {
        const sku = (p.sku || p.id).toUpperCase();
        return {
          updateOne: {
            filter: { sku },
            update: { $set: p },
            upsert: true,
          },
        };
      });

      await Product.bulkWrite(operations);
      return this.getAll();
    }

    // In-memory fallback: replace or append
    products.forEach((p) => {
      const idx = this.memoryProducts.findIndex((mp) => mp.sku === p.sku || mp.id === p.id);
      if (idx !== -1) {
        this.memoryProducts[idx] = { ...this.memoryProducts[idx], ...p };
      } else {
        this.memoryProducts.push(p);
      }
    });
    return this.memoryProducts;
  }
}

export const productRepository = new ProductRepository();
export default productRepository;

