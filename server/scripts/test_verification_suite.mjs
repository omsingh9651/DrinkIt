/**
 * DrinkIt Comprehensive Verification & Regression Test Suite
 *
 * Covers:
 * 1. Admin Authentication & Bearer Token Issuance
 * 2. Admin Products Add & Delete CRUD & MongoDB Atlas Persistence
 * 3. Delivery Dashboard: Orders, Stores, Partners APIs & Assignment Controls
 * 4. Security: Rejection of Missing/Invalid Tokens and Role Separation (Customer vs Admin)
 * 5. Commerce Regression: Customer JWT, Cart/Checkout, Sandbox Payments & Tracking
 */

import '../config/env.js';
import { connectDB, disconnectDB, isDbConnected } from '../config/db.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import { app } from '../index.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';

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
  console.log('\n================================================================');
  console.log('       DRINKIT COMPREHENSIVE VERIFICATION & TEST SUITE');
  console.log('================================================================\n');

  // Connect to MongoDB Atlas
  const connected = await connectDB();
  assert(connected === true && isDbConnected() === true, 'MongoDB Atlas connection established');

  // Start temporary test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Local test server running on ${baseUrl}`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@drinkit.com';
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  const customerSecret = process.env.CUSTOMER_JWT_SECRET || 'test_dummy_customer_secret';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'DrinkIt@2026';

  let adminJwtToken = null;
  let customerJwtTokenA = null;
  let customerJwtTokenB = null;

  const canaryPhoneA = '9876500001';
  const canaryPhoneB = '9876500002';

  // Temporary test IDs to clean up
  const createdProductIds = [];
  const createdOrderIds = [];

  try {
    // =========================================================================
    // SECTION 1: Admin Authentication & Token Handling
    // =========================================================================
    console.log('\n--- SECTION 1: Admin Authentication & Token Handling ---');

    // 1.1 POST /api/admin/auth/login returns token in JSON
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success === true, 'Admin login endpoint returns HTTP 200 and success: true');
    assert(Boolean(loginData.token), 'Admin login response body includes signed JWT token');
    adminJwtToken = loginData.token;

    // 1.2 GET /api/admin/auth/me with Bearer token
    const meRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
      headers: { Authorization: `Bearer ${adminJwtToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.success === true, 'GET /api/admin/auth/me accepts Bearer token');
    assert(meData.admin?.email === adminEmail, `Authenticated admin email matches (${meData.admin?.email})`);
    assert(meData.admin?.role === 'super_admin' || meData.admin?.role === 'admin', `Admin role confirmed: ${meData.admin?.role}`);

    // 1.3 Missing token rejected
    const unauthMeRes = await fetch(`${baseUrl}/api/admin/auth/me`);
    assert(unauthMeRes.status === 401, 'GET /api/admin/auth/me without token is rejected with HTTP 401');

    // 1.4 Invalid token rejected
    const invalidMeRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
      headers: { Authorization: 'Bearer totally.invalid.token' },
    });
    assert(invalidMeRes.status === 401, 'GET /api/admin/auth/me with invalid token is rejected with HTTP 401');

    // 1.5 Expired token rejected
    const expiredToken = jwt.sign({ email: adminEmail, role: 'admin' }, adminSecret, { expiresIn: '-1s' });
    const expiredMeRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredMeRes.status === 401, 'GET /api/admin/auth/me with expired token is rejected with HTTP 401');

    // =========================================================================
    // SECTION 2: Admin Products CRUD & MongoDB Atlas Persistence
    // =========================================================================
    console.log('\n--- SECTION 2: Admin Products CRUD & MongoDB Atlas Persistence ---');

    // Generate Customer tokens for authorization tests
    customerJwtTokenA = jwt.sign({ phone: canaryPhoneA, role: 'customer' }, customerSecret, { expiresIn: '1h' });
    customerJwtTokenB = jwt.sign({ phone: canaryPhoneB, role: 'customer' }, customerSecret, { expiresIn: '1h' });

    // 2.1 Add Product with Valid Admin Token
    const canarySku = `CANARY-TEST-${Date.now()}`;
    const productPayload = {
      name: `Canary Test Beverage ${Date.now()}`,
      brand: 'DrinkIt Reserve',
      category: 'Whisky',
      price: 2450,
      originalPrice: 2800,
      stockQuantity: 20,
      bottleSizeInMl: 750,
      abv: '42.8%',
      rating: 4.7,
      status: 'active',
      sku: canarySku,
      description: 'Temporary verification test product for automated verification.',
    };

    const addProdRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwtToken}`,
      },
      body: JSON.stringify(productPayload),
    });
    const addProdData = await addProdRes.json();
    assert(addProdRes.status === 201 && addProdData.success === true, 'POST /api/products with Admin token returns HTTP 201 Created');
    assert(Boolean(addProdData.product?.id), `Product created with slug ID: ${addProdData.product?.id}`);

    const createdMongoId = addProdData.product?._id;
    const createdSlugId = addProdData.product?.id;
    if (createdMongoId) createdProductIds.push(createdMongoId);

    // 2.2 Verify product persisted directly in MongoDB Atlas
    const atlasProductDoc = await Product.findOne({ sku: canarySku }).exec();
    assert(Boolean(atlasProductDoc), 'Product found directly in MongoDB Atlas collection');
    assert(atlasProductDoc?.price === 2450, `Price persisted correctly in Atlas: ₹${atlasProductDoc?.price}`);
    assert(atlasProductDoc?.stockQuantity === 20, `Stock persisted correctly in Atlas: ${atlasProductDoc?.stockQuantity} units`);

    // 2.3 Edit / Update Product via PUT /api/products/:id
    const updateProdRes = await fetch(`${baseUrl}/api/products/${createdMongoId || createdSlugId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwtToken}`,
      },
      body: JSON.stringify({ price: 2600, stockQuantity: 25 }),
    });
    const updateProdData = await updateProdRes.json();
    assert(updateProdRes.status === 200 && updateProdData.success === true, 'PUT /api/products/:id returns HTTP 200');

    const updatedAtlasDoc = await Product.findOne({ sku: canarySku }).exec();
    assert(updatedAtlasDoc?.price === 2600, `Updated price in Atlas verified: ₹${updatedAtlasDoc?.price}`);
    assert(updatedAtlasDoc?.stockQuantity === 25, `Updated stock in Atlas verified: ${updatedAtlasDoc?.stockQuantity} units`);

    // 2.4 Delete Product by MongoDB ID with Admin Token
    const deleteProdRes = await fetch(`${baseUrl}/api/products/${createdMongoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminJwtToken}` },
    });
    const deleteProdData = await deleteProdRes.json();
    assert(deleteProdRes.status === 200 && deleteProdData.success === true, 'DELETE /api/products/:id with Admin token returns HTTP 200');

    // 2.5 Confirm Product permanently removed from MongoDB Atlas
    const postDeleteAtlasDoc = await Product.findOne({ sku: canarySku }).exec();
    assert(postDeleteAtlasDoc === null, 'Deleted product is permanently removed from MongoDB Atlas collection');

    // 2.6 Security: Unauthenticated POST /api/products rejected
    const unauthAddRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productPayload),
    });
    assert(unauthAddRes.status === 401, 'POST /api/products without admin token rejected with HTTP 401');

    // 2.7 Security: Customer JWT POST /api/products rejected (403 Forbidden)
    const customerAddRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerJwtTokenA}`,
      },
      body: JSON.stringify(productPayload),
    });
    assert(customerAddRes.status === 403, 'POST /api/products with Customer token rejected with HTTP 403 Forbidden');

    // 2.8 Security: Unauthenticated DELETE /api/products/:id rejected
    const unauthDeleteRes = await fetch(`${baseUrl}/api/products/sample-id-123`, {
      method: 'DELETE',
    });
    assert(unauthDeleteRes.status === 401, 'DELETE /api/products/:id without admin token rejected with HTTP 401');

    // 2.9 Security: Customer JWT DELETE /api/products/:id rejected (403 Forbidden)
    const customerDeleteRes = await fetch(`${baseUrl}/api/products/sample-id-123`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerJwtTokenA}` },
    });
    assert(customerDeleteRes.status === 403, 'DELETE /api/products/:id with Customer token rejected with HTTP 403 Forbidden');

    // =========================================================================
    // SECTION 3: Delivery Dashboard & Fulfillment Center APIs
    // =========================================================================
    console.log('\n--- SECTION 3: Delivery Dashboard & Fulfillment Center APIs ---');

    // 3.1 GET /api/delivery/stores (Public store hubs directory)
    const storesRes = await fetch(`${baseUrl}/api/delivery/stores`);
    const storesData = await storesRes.json();
    assert(storesRes.status === 200 && storesData.success === true, 'GET /api/delivery/stores returns HTTP 200');
    assert(Array.isArray(storesData.stores) && storesData.stores.length >= 3, `Stores retrieved with valid coordinates (count: ${storesData.stores?.length})`);
    assert(storesData.stores[0].latitude && storesData.stores[0].longitude, 'Store has valid latitude/longitude coordinates for map pin');

    // 3.2 GET /api/delivery/partners with Admin Token
    const partnersRes = await fetch(`${baseUrl}/api/delivery/partners`, {
      headers: { Authorization: `Bearer ${adminJwtToken}` },
    });
    const partnersData = await partnersRes.json();
    assert(partnersRes.status === 200 && partnersData.success === true, 'GET /api/delivery/partners with Admin token returns HTTP 200');
    assert(Array.isArray(partnersData.partners) && partnersData.partners.length >= 3, `Delivery partners retrieved (count: ${partnersData.partners?.length})`);
    assert(Boolean(partnersData.partners[0].vehicleType), `Delivery partner includes vehicle: ${partnersData.partners[0].vehicleType}`);

    // 3.3 Security: GET /api/delivery/partners without token rejected (401)
    const unauthPartnersRes = await fetch(`${baseUrl}/api/delivery/partners`);
    assert(unauthPartnersRes.status === 401, 'GET /api/delivery/partners without token rejected with HTTP 401');

    // 3.4 Security: GET /api/delivery/partners with Customer token rejected (403)
    const customerPartnersRes = await fetch(`${baseUrl}/api/delivery/partners`, {
      headers: { Authorization: `Bearer ${customerJwtTokenA}` },
    });
    assert(customerPartnersRes.status === 403, 'GET /api/delivery/partners with Customer token rejected with HTTP 403');

    // 3.5 GET /api/admin/orders with Admin Token
    const adminOrdersRes = await fetch(`${baseUrl}/api/admin/orders?limit=10`, {
      headers: { Authorization: `Bearer ${adminJwtToken}` },
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert(adminOrdersRes.status === 200 && adminOrdersData.success === true, 'GET /api/admin/orders with Admin token returns HTTP 200');
    assert(Array.isArray(adminOrdersData.orders), `Admin orders array returned (count: ${adminOrdersData.orders?.length})`);

    // 3.6 Security: GET /api/admin/orders without token rejected (401)
    const unauthOrdersRes = await fetch(`${baseUrl}/api/admin/orders`);
    assert(unauthOrdersRes.status === 401, 'GET /api/admin/orders without token rejected with HTTP 401');

    // =========================================================================
    // SECTION 4: Customer Auth, Cart, Checkout, Sandbox Payments & Tracking
    // =========================================================================
    console.log('\n--- SECTION 4: Customer Auth, Cart, Checkout, Sandbox Payments & Tracking ---');

    // 4.1 OTP request validation: Reject invalid mobile formats
    const invalidPhoneRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '12345' }),
    });
    assert(invalidPhoneRes.status === 400, 'POST /api/auth/send-otp with invalid phone rejected with HTTP 400');

    // 4.2 Customer A Order Placement (Checkout)
    const existingActiveProd = await Product.findOne({ status: 'active', inStock: true }).exec();
    const activeProdId = existingActiveProd?.id || 'fratelli-sette-reserve';

    const orderPayloadA = {
      items: [
        {
          id: activeProdId,
          quantity: 1,
        },
      ],
      deliveryAddress: {
        fullName: 'Test Customer A',
        mobileNumber: canaryPhoneA,
        house: 'Flat 402, Royal Palms',
        street: 'Mall Road, Civil Lines',
        city: 'Kanpur',
        pinCode: '208001',
      },
      paymentMethod: 'ONLINE',
      latitude: 26.4715,
      longitude: 80.3440,
    };

    const createOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerJwtTokenA}`,
      },
      body: JSON.stringify(orderPayloadA),
    });
    const createOrderData = await createOrderRes.json();
    assert((createOrderRes.status === 200 || createOrderRes.status === 201) && createOrderData.success === true, 'Customer order created successfully via checkout (HTTP 201)');
    const orderIdA = createOrderData.order?.id;
    assert(Boolean(orderIdA), `Created Order ID: #${orderIdA}`);
    if (orderIdA) createdOrderIds.push(orderIdA);

    // 4.3 Customer A can fetch their own order
    const getOwnOrderRes = await fetch(`${baseUrl}/api/orders/${orderIdA}`, {
      headers: { Authorization: `Bearer ${customerJwtTokenA}` },
    });
    const getOwnOrderData = await getOwnOrderRes.json();
    assert(getOwnOrderRes.status === 200 && getOwnOrderData.success === true, 'Customer A can view their own order');

    // 4.4 IDOR Guard: Customer B is FORBIDDEN from accessing Customer A's order
    const crossAccountRes = await fetch(`${baseUrl}/api/orders/${orderIdA}`, {
      headers: { Authorization: `Bearer ${customerJwtTokenB}` },
    });
    assert(crossAccountRes.status === 403, 'Customer B is blocked with HTTP 403 Forbidden from accessing Customer A order');

    // 4.5 Razorpay Sandbox Order Creation
    const razorpayOrderRes = await fetch(`${baseUrl}/api/payment/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerJwtTokenA}`,
      },
      body: JSON.stringify({ orderId: orderIdA }),
    });
    const razorpayOrderData = await razorpayOrderRes.json();
    assert(razorpayOrderRes.status === 200 && razorpayOrderData.success === true, 'Razorpay test checkout order initialized');
    const rzpOrderId = razorpayOrderData.razorpayOrder?.id || razorpayOrderData.order?.razorpayOrderId;
    assert(Boolean(rzpOrderId), `Razorpay receipt/order ID: ${rzpOrderId}`);

    // 4.6 Razorpay Sandbox Simulated Test Payment Confirmation
    const simulatedPayRes = await fetch(`${baseUrl}/api/payment/razorpay/simulate-success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerJwtTokenA}`,
      },
      body: JSON.stringify({
        orderId: orderIdA,
        razorpayOrderId: rzpOrderId,
      }),
    });
    const simulatedPayData = await simulatedPayRes.json();
    assert(simulatedPayRes.status === 200 && simulatedPayData.success === true, 'Razorpay sandbox payment simulation succeeds');
    assert(simulatedPayData.order?.paymentStatus === 'PAID', 'Order paymentStatus updated to PAID in MongoDB Atlas');

    // 4.7 Admin Dispatch: Assign Delivery Partner & Store Hub to Order
    const firstStoreId = storesData.stores[0].id;
    const firstPartnerId = partnersData.partners[0].id;
    const assignRes = await fetch(`${baseUrl}/api/delivery/orders/${orderIdA}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwtToken}`,
      },
      body: JSON.stringify({
        partnerId: firstPartnerId,
        storeId: firstStoreId,
      }),
    });
    const assignData = await assignRes.json();
    assert(assignRes.status === 200 && assignData.success === true, 'Admin can assign store hub & delivery partner to order');

    // 4.8 Admin Dispatch: Reset Rider Location to Store Pickup
    const resetRes = await fetch(`${baseUrl}/api/delivery/orders/${orderIdA}/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwtToken}`,
      },
    });
    const resetData = await resetRes.json();
    assert(resetRes.status === 200 && resetData.success === true, 'Admin can reset delivery rider tracking to pickup store');

    // 4.9 Live Delivery Tracking for Verified Order Owner
    const trackingRes = await fetch(`${baseUrl}/api/orders/${orderIdA}/track`, {
      headers: { Authorization: `Bearer ${customerJwtTokenA}` },
    });
    const trackingData = await trackingRes.json();
    assert(trackingRes.status === 200 && trackingData.success === true, 'Customer A can view live tracking for their order');
    assert(Boolean(trackingData.tracking?.currentCoords || trackingData.tracking?.currentLocation), 'Tracking payload includes valid coordinates');
    assert(Boolean(trackingData.tracking?.deliveryPartner), 'Tracking payload includes assigned delivery partner');

  } catch (err) {
    console.error('Fatal suite error:', err);
    failed++;
  } finally {
    // Clean up temporary test records from MongoDB Atlas
    console.log('\n--- CLEANUP: Removing temporary test records ---');
    try {
      if (createdProductIds.length > 0) {
        await Product.deleteMany({ _id: { $in: createdProductIds } });
        console.log(`  Cleaned up ${createdProductIds.length} test product(s).`);
      }
      if (createdOrderIds.length > 0) {
        await Order.deleteMany({ id: { $in: createdOrderIds } });
        console.log(`  Cleaned up ${createdOrderIds.length} test order(s).`);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();
    await disconnectDB();
    console.log('Test server closed & MongoDB disconnected.\n');

    console.log('================================================================');
    console.log(`VERIFICATION SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
