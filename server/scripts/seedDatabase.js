import '../config/env.js';
import { connectDB, disconnectDB, isDbConnected } from '../config/db.js';
import { Product } from '../models/Product.js';
import { Store } from '../models/Store.js';
import { DeliveryPartner } from '../models/DeliveryPartner.js';
import { INITIAL_PRODUCTS } from '../data/initialProducts.js';

const SEED_STORES = [
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
    status: 'active',
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
    status: 'active',
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
    status: 'active',
  },
];

const SEED_PARTNERS = [
  {
    id: 'DP-2081',
    name: 'Suraj Singh',
    phone: '+91 98765 43210',
    cleanPhone: '9876543210',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    rating: 4.9,
    totalDeliveries: 1420,
    vehicleType: 'Electric Cargo Scooter',
    vehicleNumber: 'UP-78-EV-2081',
    status: 'AVAILABLE',
    availabilityStatus: 'AVAILABLE',
    onlineStatus: true,
    currentLatitude: 26.4715,
    currentLongitude: 80.3440,
    assignedOrder: null,
    currentOrderId: null,
    isDemo: true,
  },
  {
    id: 'DP-3042',
    name: 'Amit Verma',
    phone: '+91 98765 43211',
    cleanPhone: '9876543211',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    rating: 4.8,
    totalDeliveries: 980,
    vehicleType: 'Motorcycle 150cc',
    vehicleNumber: 'UP-78-BK-3042',
    status: 'AVAILABLE',
    availabilityStatus: 'AVAILABLE',
    onlineStatus: true,
    currentLatitude: 26.4820,
    currentLongitude: 80.3210,
    assignedOrder: null,
    currentOrderId: null,
    isDemo: true,
  },
  {
    id: 'DP-4199',
    name: 'Rahul Gupta',
    phone: '+91 98765 43212',
    cleanPhone: '9876543212',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    rating: 4.95,
    totalDeliveries: 2150,
    vehicleType: 'Express EV Rider',
    vehicleNumber: 'UP-78-SC-4199',
    status: 'AVAILABLE',
    availabilityStatus: 'AVAILABLE',
    onlineStatus: true,
    currentLatitude: 26.5085,
    currentLongitude: 80.2435,
    assignedOrder: null,
    currentOrderId: null,
    isDemo: true,
  },
];

async function seedDatabase() {
  console.log('\n🌱 ========================================================');
  console.log('   DRINKIT MONGODB IDEMPOTENT DATABASE SEED & MIGRATION');
  console.log('========================================================\n');

  const connected = await connectDB();
  if (!connected || !isDbConnected()) {
    console.error('❌ Could not connect to MongoDB.');
    console.log('   Please make sure your MongoDB instance is running and check MONGODB_URI in server/.env.');
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------
    // 1. Seed Products Idempotently (No Duplicates via SKU / ID)
    // -------------------------------------------------------------
    console.log(`📦 Seeding ${INITIAL_PRODUCTS.length} authentic DrinkIt products...`);
    let productUpsertCount = 0;

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
      productUpsertCount++;
    }

    const totalProducts = await Product.countDocuments();
    console.log(`  ✅ Successfully verified/upserted ${productUpsertCount} products (Total in DB: ${totalProducts}, 0 duplicates created).`);

    // -------------------------------------------------------------
    // 2. Seed Store Hubs Idempotently
    // -------------------------------------------------------------
    console.log(`\n🏪 Seeding ${SEED_STORES.length} DrinkIt Cellar Store Hubs...`);
    for (const store of SEED_STORES) {
      await Store.findOneAndUpdate(
        { id: store.id },
        { $set: store },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    const totalStores = await Store.countDocuments();
    console.log(`  ✅ Successfully verified/upserted ${SEED_STORES.length} store hubs (Total in DB: ${totalStores}).`);

    // -------------------------------------------------------------
    // 3. Seed Demo Delivery Partners Idempotently
    // -------------------------------------------------------------
    console.log(`\n🛵 Seeding ${SEED_PARTNERS.length} Delivery Partners...`);
    for (const partner of SEED_PARTNERS) {
      await DeliveryPartner.findOneAndUpdate(
        { id: partner.id },
        { $set: partner },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    const totalPartners = await DeliveryPartner.countDocuments();
    console.log(`  ✅ Successfully verified/upserted ${SEED_PARTNERS.length} delivery partners (Total in DB: ${totalPartners}).`);

    console.log('\n🎉 ========================================================');
    console.log('   DATABASE SEED COMPLETED SUCCESSFULLY! ZERO DUPLICATES.');
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Error during seed:', err);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seedDatabase();

