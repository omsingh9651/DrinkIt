import '../config/env.js';
import { connectDB, disconnectDB, isDbConnected } from '../config/db.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import { app } from '../index.js';
import { Product } from '../models/Product.js';

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
  console.log('   DRINKIT ADMIN PRODUCTS ADD & DELETE VERIFICATION SUITE');
  console.log('================================================================\n');

  // Connect to MongoDB Atlas
  const connected = await connectDB();
  assert(connected === true && isDbConnected() === true, 'MongoDB Atlas connection established');

  // Start temporary test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running on ${baseUrl}`);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@drinkit.com';
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  const customerSecret = process.env.CUSTOMER_JWT_SECRET || 'test_dummy_customer_secret';

  let adminJwtToken = null;
  let tempProductId = null;
  let tempProductMongoId = null;
  const tempProductSku = `TEST-VERIF-${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // 1. Admin Login -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Admin Login ---');
    // Sign token directly or login via endpoint
    adminJwtToken = jwt.sign(
      { email: adminEmail, role: 'super_admin', name: 'Super Administrator' },
      adminSecret,
      { expiresIn: '1h' }
    );

    // Verify login endpoint structure
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'wrong_password_test' }),
    });
    assert(loginRes.status === 401, 'Admin Login rejects incorrect credentials with 401');

    assert(Boolean(adminJwtToken), 'Admin JWT generated with ADMIN_JWT_SECRET');

    // -------------------------------------------------------------------------
    // 2. Admin Dashboard / Me -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Admin Dashboard Access (GET /api/admin/auth/me) ---');
    const meRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
      headers: {
        Authorization: `Bearer ${adminJwtToken}`,
      },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.success && meData.admin?.email === adminEmail, `Admin authenticated: role=${meData.admin?.role}`);

    // -------------------------------------------------------------------------
    // 3. Admin Products Catalog -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Admin Products Page (GET /api/products?includeInactive=true) ---');
    const catalogRes = await fetch(`${baseUrl}/api/products?includeInactive=true`, {
      headers: {
        Authorization: `Bearer ${adminJwtToken}`,
      },
    });
    const catalogData = await catalogRes.json();
    assert(catalogRes.status === 200 && catalogData.success && Array.isArray(catalogData.products), `Products catalog loaded (count=${catalogData.products.length})`);

    // -------------------------------------------------------------------------
    // 4. Add product with valid admin session -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Add Product with Valid Admin Session (POST /api/products) ---');
    const newProductPayload = {
      name: `DrinkIt Test Reserve-${Date.now()}`,
      brand: 'DrinkIt Testing',
      category: 'Wine',
      price: 1850,
      originalPrice: 2200,
      stockQuantity: 15,
      bottleSizeInMl: 750,
      abv: '14.0%',
      rating: 4.8,
      status: 'active',
      sku: tempProductSku,
      tastingNotes: ['Oak', 'Vanilla', 'Plum'],
      description: 'Temporary verification test wine for DrinkIt admin verification suite.',
    };

    const addRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwtToken}`,
      },
      body: JSON.stringify(newProductPayload),
    });

    const addData = await addRes.json();
    assert(addRes.status === 201 && addData.success && addData.product, `Product created successfully: id=${addData.product?.id}`);
    tempProductId = addData.product?.id;
    tempProductMongoId = addData.product?._id || addData.product?.id;

    // -------------------------------------------------------------------------
    // 5. Product appears in MongoDB Atlas -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Verify Product in MongoDB Atlas Database ---');
    const atlasDoc = await Product.findOne({ sku: tempProductSku }).exec();
    assert(atlasDoc !== null, `Found document in MongoDB Atlas (sku: ${tempProductSku})`);
    assert(atlasDoc?.price === 1850, `Atlas price matches: ₹${atlasDoc?.price}`);
    assert(atlasDoc?.stockQuantity === 15, `Atlas stock matches: ${atlasDoc?.stockQuantity} units`);
    const verifiedMongoId = atlasDoc?._id.toString();

    // -------------------------------------------------------------------------
    // 5b. Update Product with Valid Admin Session (PUT /api/products/:id) -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 5b. Update/Edit Product with Valid Admin Session (PUT /api/products/:id) ---');
    const updateRes = await fetch(`${baseUrl}/api/products/${verifiedMongoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwtToken}`,
      },
      body: JSON.stringify({
        price: 2150,
        stockQuantity: 18,
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.success, `Product updated via PUT: status=${updateRes.status}`);

    const atlasUpdatedDoc = await Product.findById(verifiedMongoId).exec();
    assert(atlasUpdatedDoc?.price === 2150, `Atlas updated price verified: ₹${atlasUpdatedDoc?.price}`);
    assert(atlasUpdatedDoc?.stockQuantity === 18, `Atlas updated stock verified: ${atlasUpdatedDoc?.stockQuantity} units`);

    // -------------------------------------------------------------------------
    // 6. Delete product with valid admin session -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Delete Product with Valid Admin Session by MongoDB ID (DELETE /api/products/:id) ---');
    const deleteRes = await fetch(`${baseUrl}/api/products/${verifiedMongoId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminJwtToken}`,
      },
    });

    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200 && deleteData.success, `Product deleted successfully: response status=${deleteRes.status}`);

    // -------------------------------------------------------------------------
    // 7. Product disappears from MongoDB Atlas -> PASS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Verify Product Permanently Disappears from MongoDB Atlas ---');
    const postDeleteDoc = await Product.findOne({
      $or: [{ _id: verifiedMongoId }, { sku: tempProductSku }, { id: tempProductId }],
    }).exec();
    assert(postDeleteDoc === null, 'Document is completely gone from MongoDB Atlas');

    // -------------------------------------------------------------------------
    // 8. Add product without admin token -> 401/403
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Add Product Without Admin Token -> 401/403 ---');
    const unauthAddRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauth Wine',
        category: 'Wine',
        price: 500,
        stockQuantity: 5,
      }),
    });
    const unauthAddData = await unauthAddRes.json();
    assert(
      unauthAddRes.status === 401 || unauthAddRes.status === 403,
      `Rejected with HTTP ${unauthAddRes.status}: "${unauthAddData.error}"`
    );

    // -------------------------------------------------------------------------
    // 9. Delete product without admin token -> 401/403
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Delete Product Without Admin Token -> 401/403 ---');
    const unauthDeleteRes = await fetch(`${baseUrl}/api/products/sample-id-123`, {
      method: 'DELETE',
    });
    const unauthDeleteData = await unauthDeleteRes.json();
    assert(
      unauthDeleteRes.status === 401 || unauthDeleteRes.status === 403,
      `Rejected with HTTP ${unauthDeleteRes.status}: "${unauthDeleteData.error}"`
    );

    // -------------------------------------------------------------------------
    // 10. Customer JWT cannot create products -> 403
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Customer JWT Cannot Create Products -> 403 ---');
    const customerToken = jwt.sign(
      { id: 'user_9876543210', phone: '9876543210', role: 'customer' },
      customerSecret,
      { expiresIn: '1h' }
    );

    const customerAddRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        name: 'Customer Created Wine',
        category: 'Wine',
        price: 999,
        stockQuantity: 10,
      }),
    });
    const customerAddData = await customerAddRes.json();
    assert(
      customerAddRes.status === 403,
      `Rejected with HTTP ${customerAddRes.status} Forbidden: "${customerAddData.error}"`
    );

    // -------------------------------------------------------------------------
    // 11. Customer JWT cannot delete products -> 403
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Customer JWT Cannot Delete Products -> 403 ---');
    const customerDeleteRes = await fetch(`${baseUrl}/api/products/sample-id-123`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });
    const customerDeleteData = await customerDeleteRes.json();
    assert(
      customerDeleteRes.status === 403,
      `Rejected with HTTP ${customerDeleteRes.status} Forbidden: "${customerDeleteData.error}"`
    );

    // -------------------------------------------------------------------------
    // 12. Invalid / Tampered admin JWT rejected -> 401/403
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Invalid/Tampered Admin JWT Rejection -> 401/403 ---');
    const tamperedToken = `${adminJwtToken.slice(0, -6)}tamper`;
    const tamperedRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tamperedToken}`,
      },
      body: JSON.stringify({
        name: 'Tampered Token Product',
        category: 'Wine',
        price: 500,
        stockQuantity: 5,
      }),
    });
    const tamperedData = await tamperedRes.json();
    assert(
      tamperedRes.status === 401 || tamperedRes.status === 403,
      `Rejected with HTTP ${tamperedRes.status}: "${tamperedData.error}"`
    );
  } finally {
    // Safety cleanup in case of test failure midway
    if (tempProductId || tempProductSku) {
      await Product.deleteMany({
        $or: [
          { sku: tempProductSku },
          ...(tempProductMongoId && mongoose.Types.ObjectId.isValid(tempProductMongoId)
            ? [{ _id: tempProductMongoId }]
            : []),
          ...(tempProductId ? [{ id: tempProductId }] : []),
        ],
      }).catch(() => {});
    }

    server.close();
    await disconnectDB();
  }

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
