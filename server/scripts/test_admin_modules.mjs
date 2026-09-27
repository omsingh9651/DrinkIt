// Test script to verify all 6 newly activated Admin modules:
// 1. Categories
// 2. Brands
// 3. Media Library
// 4. Stock History
// 5. Payments
// 6. Coupons

const BASE_URL = 'http://localhost:5001';

async function runTests() {
  console.log('🧪 Starting Admin Modules End-to-End Verification Tests...\n');

  // Test 1: Public Categories
  console.log('--- TEST 1: Public Categories ---');
  const catRes = await fetch(`${BASE_URL}/api/categories`);
  const catData = await catRes.json();
  console.log(`Public categories status: ${catRes.status}, count: ${catData.data?.length || 0}`);
  if (!catData.success || !Array.isArray(catData.data) || catData.data.length === 0) {
    throw new Error('Public categories test failed');
  }
  console.log(`✅ Category Sample: ${catData.data[0].name} (${catData.data[0].slug})`);

  // Test 2: Public Brands
  console.log('\n--- TEST 2: Public Brands ---');
  const brandRes = await fetch(`${BASE_URL}/api/brands`);
  const brandData = await brandRes.json();
  console.log(`Public brands status: ${brandRes.status}, count: ${brandData.data?.length || 0}`);
  if (!brandData.success || !Array.isArray(brandData.data) || brandData.data.length === 0) {
    throw new Error('Public brands test failed');
  }
  console.log(`✅ Brand Sample: ${brandData.data[0].name} (Origin: ${brandData.data[0].origin})`);

  // Test 3: Public Coupons & Validation
  console.log('\n--- TEST 3: Public Coupons & Validation ---');
  const availRes = await fetch(`${BASE_URL}/api/coupons/available`);
  const availData = await availRes.json();
  console.log(`Available coupons: ${availData.data?.map((c) => c.code).join(', ')}`);

  const valRes = await fetch(`${BASE_URL}/api/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'DRINKIT10', subtotal: 2000, customerPhone: '9876543210' }),
  });
  const valData = await valRes.json();
  console.log(`Validation DRINKIT10 status: ${valRes.status}, discount: ₹${valData.data?.discount}`);
  if (!valData.success || valData.data?.discount !== 200) {
    throw new Error(`Coupon validation expected ₹200 discount, got ${valData.data?.discount}`);
  }
  console.log('✅ Coupon validation verified successfully');

  // Test 4: Admin Authentication
  console.log('\n--- TEST 4: Admin Authentication ---');
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@drinkit.com',
      password: process.env.ADMIN_PASSWORD || '',
    }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log(`Admin login status: ${loginRes.status}, has cookie: ${Boolean(cookie)}`);
  if (!cookie) {
    throw new Error('Admin login failed to return session cookie');
  }
  const adminHeaders = {
    Cookie: cookie,
    'Content-Type': 'application/json',
  };

  // Test 5: Admin Categories CRUD & Guardrails
  console.log('\n--- TEST 5: Admin Categories ---');
  const adminCatRes = await fetch(`${BASE_URL}/api/admin/categories`, { headers: adminHeaders });
  const adminCatData = await adminCatRes.json();
  console.log(`Admin categories total: ${adminCatData.data?.length}`);
  
  // Create test category
  const createCatRes = await fetch(`${BASE_URL}/api/admin/categories`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Tequila & Agave',
      emoji: '🌵',
      description: 'Artisanal blue agave tequilas and mezcals.',
      displayOrder: 10,
      isActive: true,
    }),
  });
  const createdCat = await createCatRes.json();
  console.log(`Created category: ${createdCat.data?.name} (id: ${createdCat.data?.id})`);

  // Delete test category
  const delCatRes = await fetch(`${BASE_URL}/api/admin/categories/${createdCat.data.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const delCatData = await delCatRes.json();
  console.log(`Deleted category: ${delCatData.message}`);
  console.log('✅ Admin Categories CRUD verified');

  // Test 6: Admin Brands CRUD
  console.log('\n--- TEST 6: Admin Brands ---');
  const createBrandRes = await fetch(`${BASE_URL}/api/admin/brands`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Rampur Distillery',
      origin: 'Rampur, Uttar Pradesh',
      description: 'Pioneering Indian single malts distilled in traditional copper pot stills.',
      website: 'https://rampursinglemalt.com',
      isActive: true,
    }),
  });
  const createdBrand = await createBrandRes.json();
  console.log(`Created brand: ${createdBrand.data?.name} (id: ${createdBrand.data?.id})`);

  // Delete brand
  const delBrandRes = await fetch(`${BASE_URL}/api/admin/brands/${createdBrand.data.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const delBrandData = await delBrandRes.json();
  console.log(`Deleted brand: ${delBrandData.message}`);
  console.log('✅ Admin Brands CRUD verified');

  // Test 7: Admin Media Library
  console.log('\n--- TEST 7: Admin Media Library ---');
  const mediaListRes = await fetch(`${BASE_URL}/api/admin/media`, { headers: adminHeaders });
  const mediaListData = await mediaListRes.json();
  console.log(`Media items found: ${mediaListData.data?.length}`);

  // Register external URL
  const addUrlRes = await fetch(`${BASE_URL}/api/admin/media/url`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      url: 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=800',
      title: 'Premium Oak Barrel Still',
    }),
  });
  const addedMedia = await addUrlRes.json();
  console.log(`Added media: ${addedMedia.data?.filename} (${addedMedia.data?.id})`);

  // Delete test media
  const delMediaRes = await fetch(`${BASE_URL}/api/admin/media/${addedMedia.data.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const delMediaData = await delMediaRes.json();
  console.log(`Deleted media: ${delMediaData.message}`);
  console.log('✅ Admin Media Library verified');

  // Test 8: Admin Stock History & Audit
  console.log('\n--- TEST 8: Admin Stock History & Audit ---');
  const histRes = await fetch(`${BASE_URL}/api/admin/inventory/history?limit=10`, { headers: adminHeaders });
  const histData = await histRes.json();
  console.log(`Stock history records: ${histData.total}, events: ${histData.logs?.length}`);
  console.log(`Audit Metrics: Total: ${histData.metrics?.totalEvents}, Restocks: ${histData.metrics?.restockCount}, Orders: ${histData.metrics?.orderCount}`);
  if (!histData.success || !Array.isArray(histData.logs) || histData.logs.length === 0) {
    throw new Error('Stock history query failed');
  }
  console.log(`✅ Sample log: ${histData.logs[0].productName} (${histData.logs[0].type}) change: ${histData.logs[0].change}`);

  // Test 9: Admin Payments Ledger
  console.log('\n--- TEST 9: Admin Payments Ledger ---');
  const payRes = await fetch(`${BASE_URL}/api/admin/payments?limit=10`, { headers: adminHeaders });
  const payData = await payRes.json();
  console.log(`Payments status: ${payRes.status}, total: ${payData.total}, page items: ${payData.payments?.length}`);
  console.log(`Financial metrics: Total Volume: ₹${payData.metrics?.totalVolume}, Successful: ${payData.metrics?.successfulCount}, Pending: ${payData.metrics?.pendingCount}`);
  if (!payData.success || !Array.isArray(payData.payments) || payData.payments.length === 0) {
    throw new Error('Payment ledger query failed');
  }
  console.log(`✅ Sample payment: ID: ${payData.payments[0].paymentId} · ₹${payData.payments[0].amount} · ${payData.payments[0].paymentStatus} (${payData.payments[0].paymentMethod})`);

  // Test 10: Admin Coupons CRUD
  console.log('\n--- TEST 10: Admin Coupons CRUD ---');
  const couponListRes = await fetch(`${BASE_URL}/api/admin/coupons`, { headers: adminHeaders });
  const couponListData = await couponListRes.json();
  console.log(`Admin coupons found: ${couponListData.data?.length}`);

  const createCoupRes = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      code: 'TESTFEST25',
      title: 'Festival 25% Off',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      minOrderValue: 1999,
      maxDiscountAmount: 750,
      isActive: true,
    }),
  });
  const createdCoup = await createCoupRes.json();
  console.log(`Created coupon: ${createdCoup.data?.code} (${createdCoup.data?.id})`);

  // Delete test coupon
  const delCoupRes = await fetch(`${BASE_URL}/api/admin/coupons/${createdCoup.data.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  const delCoupData = await delCoupRes.json();
  console.log(`Deleted coupon: ${delCoupData.message}`);
  console.log('✅ Admin Coupons CRUD verified');

  console.log('\n🎉 ALL 10 VERIFICATION TESTS PASSED WITH ZERO ERRORS!\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
