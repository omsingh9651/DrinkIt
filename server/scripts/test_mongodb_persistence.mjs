import '../config/env.js';
import { connectDB, disconnectDB, isDbConnected, getSafeHost } from '../config/db.js';
import mongoose from 'mongoose';
import { userRepository } from '../repositories/userRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { deliveryPartnerRepository } from '../repositories/deliveryPartnerRepository.js';
import { deliveryTrackingRepository } from '../repositories/deliveryTrackingRepository.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { DeliveryPartner } from '../models/DeliveryPartner.js';
import { Store } from '../models/Store.js';
import { DeliveryTracking } from '../models/DeliveryTracking.js';
import { orderService } from '../services/orderService.js';
import { app } from '../index.js';
import http from 'http';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('   DRINKIT MONGODB ATLAS PERSISTENCE VERIFICATION');
  console.log('======================================================\n');

  // Test 1: Safe Host Logging & Credentials Masking
  console.log('--- TEST 1: Safe Host & Secrets Protection ---');
  const rawUri = process.env.MONGODB_URI;
  const safeHost = getSafeHost(rawUri);
  assert(safeHost.includes('mongodb.net'), `Safe host extracted: ${safeHost}`);
  const userMatch = rawUri?.match(/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/);
  if (userMatch) {
    const rawUser = userMatch[2];
    const rawPass = userMatch[3];
    assert(!safeHost.includes(rawPass), 'Safe host does NOT contain DB password');
    assert(!safeHost.includes(rawUser), 'Safe host does NOT contain DB username');
  }

  // Test 2: Connection & Canary Test
  console.log('\n--- TEST 2: Atlas Connection & Startup Canary ---');
  const connected = await connectDB();
  assert(connected === true && isDbConnected() === true, 'MongoDB connection established');
  assert(mongoose.connection.readyState === 1, 'Mongoose readyState is 1 (Connected)');
  assert(mongoose.connection.name === 'drinkit', `Connected database name is 'drinkit' (actual: ${mongoose.connection.name})`);

  // Test 3: Safe GET /api/health/database endpoint
  console.log('\n--- TEST 3: Safe GET /api/health/database Endpoint ---');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  
  try {
    const res = await fetch(`http://localhost:${port}/api/health/database`);
    const data = await res.json();
    assert(res.status === 200, 'GET /api/health/database returns HTTP 200');
    assert(data.success === true, 'Response success is true');
    assert(data.status === 'connected', 'Response status is "connected"');
    assert(data.database === 'drinkit', 'Response database is "drinkit"');
    assert(!JSON.stringify(data).includes('mongodb+srv'), 'Response does NOT leak connection URI');
    assert(!JSON.stringify(data).includes('password'), 'Response does NOT leak passwords');
  } finally {
    server.close();
  }

  // Test 4: Customer User Document Persistence (OTP Login / Upsert Profile)
  console.log('\n--- TEST 4: Customer Profile Persistence in Atlas ---');
  const testPhone = '9999912345';
  const testUserData = {
    name: 'Test Customer Atlas',
    email: 'testatlas@example.com',
  };
  const upsertedUser = await userRepository.upsertProfile(testPhone, testUserData);
  assert(upsertedUser.phone === testPhone, 'User profile upserted via repository');

  // Verify directly from MongoDB Atlas collection
  const atlasUserDoc = await User.findOne({ phone: testPhone }).exec();
  assert(atlasUserDoc !== null, 'User document found directly in MongoDB Atlas collection');
  assert(atlasUserDoc.name === 'Test Customer Atlas', `User document name in Atlas matches (${atlasUserDoc?.name})`);

  // Test 5: Product CRUD Persistence in Atlas
  console.log('\n--- TEST 5: Admin Product CRUD Persistence in Atlas ---');
  const testSku = `TEST-SKU-${Date.now()}`;
  const testProductData = {
    id: `test-prod-${Date.now()}`,
    name: 'Atlas Verification Single Malt',
    brand: 'Atlas Reserve',
    category: 'Whisky',
    price: 4500,
    mrp: 5000,
    sku: testSku,
    stockQuantity: 50,
  };
  const createdProd = await productRepository.create(testProductData);
  assert(createdProd.sku === testSku, 'Product created via repository');

  // Verify directly from MongoDB Atlas collection
  const atlasProdDoc = await Product.findOne({ sku: testSku }).exec();
  assert(atlasProdDoc !== null, 'Product found directly in MongoDB Atlas collection');
  assert(atlasProdDoc.name === 'Atlas Verification Single Malt', 'Product name persisted in Atlas');

  // Update product in Atlas
  const updatedProd = await productRepository.update(createdProd.id, { price: 4200 });
  assert(updatedProd.sellingPrice === 4200, 'Product updated via repository');
  const atlasUpdatedDoc = await Product.findOne({ sku: testSku }).exec();
  assert(atlasUpdatedDoc.sellingPrice === 4200, 'Updated price persisted in MongoDB Atlas');

  // Delete product test doc from Atlas
  await productRepository.delete(createdProd.id);
  const atlasDeletedDoc = await Product.findOne({ sku: testSku }).exec();
  assert(atlasDeletedDoc === null, 'Product successfully deleted from MongoDB Atlas');

  // Test 6: Stores and Delivery Partners Persistence
  console.log('\n--- TEST 6: Store and Delivery Partner Repositories in Atlas ---');
  const stores = await storeRepository.getAll();
  assert(stores.length >= 3, `Stores retrieved from Atlas (count: ${stores.length})`);
  const atlasStoreCount = await Store.countDocuments();
  assert(atlasStoreCount >= 3, `Stores verified directly in Atlas collection (count: ${atlasStoreCount})`);

  const partners = await deliveryPartnerRepository.getAll();
  assert(partners.length >= 3, `Partners retrieved from Atlas (count: ${partners.length})`);
  const atlasPartnerCount = await DeliveryPartner.countDocuments();
  assert(atlasPartnerCount >= 3, `Partners verified directly in Atlas collection (count: ${atlasPartnerCount})`);

  // Test 7: Order Creation & Checkout Persistence in Atlas
  console.log('\n--- TEST 7: Checkout Order Persistence in Atlas ---');
  const testOrderId = `ORD-ATLAS-${Date.now()}`;
  const testOrderDoc = {
    id: testOrderId,
    customerId: testPhone,
    customerPhone: testPhone,
    customerName: 'Test Customer Atlas',
    latitude: 26.4715,
    longitude: 80.3440,
    deliveryAddress: {
      fullName: 'Test Customer Atlas',
      mobileNumber: testPhone,
      house: '101 Suite',
      street: 'Mall Road',
      city: 'Kanpur',
      state: 'Uttar Pradesh',
      pinCode: '208001',
    },
    items: [
      {
        productId: 'sula-dindori-reserve-shiraz',
        name: 'Sula Dindori Reserve Shiraz',
        brand: 'Sula Vineyards',
        price: 1350,
        quantity: 1,
        subtotal: 1350,
      },
    ],
    subtotal: 1350,
    deliveryFee: 50,
    total: 1400,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    orderStatus: 'CONFIRMED',
    statusHistory: [
      { status: 'CONFIRMED', timestamp: new Date().toISOString(), note: 'Payment verified' },
    ],
  };

  const createdOrder = await orderRepository.create(testOrderDoc);
  assert(createdOrder.id === testOrderId, 'Order created via repository');

  // Verify directly from MongoDB Atlas collection
  const atlasOrderDoc = await Order.findOne({ id: testOrderId }).exec();
  assert(atlasOrderDoc !== null, 'Order found directly in MongoDB Atlas collection');
  assert(atlasOrderDoc.total === 1400, 'Order total verified in MongoDB Atlas');

  // Test 8: Delivery Simulation & DeliveryTracking Persistence in Atlas
  console.log('\n--- TEST 8: Delivery Tracking Persistence in Atlas ---');
  const trackingUpdate = {
    latitude: 26.4750,
    longitude: 80.3420,
    heading: 45,
    speed: 25,
    distanceRemainingKm: 2.1,
    estimatedMinutes: 8,
    deliveryStatus: 'ON_THE_WAY',
    orderStatus: 'OUT_FOR_DELIVERY',
  };

  await orderService.updateDeliveryTracking(testOrderId, trackingUpdate);

  // Verify in Order document in Atlas
  const updatedAtlasOrder = await Order.findOne({ id: testOrderId }).exec();
  assert(updatedAtlasOrder.orderStatus === 'OUT_FOR_DELIVERY', 'Order status updated in Atlas via orderService');
  assert(updatedAtlasOrder.currentDeliveryLocation?.latitude === 26.4750, 'Order delivery coordinates updated in Atlas');

  // Verify in DeliveryTracking document in Atlas
  const atlasTrackingDoc = await DeliveryTracking.findOne({ orderId: testOrderId }).exec();
  assert(atlasTrackingDoc !== null, 'DeliveryTracking document found directly in MongoDB Atlas');
  assert(atlasTrackingDoc.currentLatitude === 26.4750, 'DeliveryTracking latitude verified in Atlas');
  assert(atlasTrackingDoc.currentLongitude === 80.3420, 'DeliveryTracking longitude verified in Atlas');
  assert(atlasTrackingDoc.trackingStatus === 'ON_THE_WAY', 'DeliveryTracking status verified in Atlas');

  // Clean up test data
  console.log('\n--- CLEANUP: Removing verification documents ---');
  await User.deleteOne({ phone: testPhone });
  await Order.deleteOne({ id: testOrderId });
  await DeliveryTracking.deleteOne({ orderId: testOrderId });
  console.log('  Cleaned up test documents.');

  // Summary
  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  await disconnectDB();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
