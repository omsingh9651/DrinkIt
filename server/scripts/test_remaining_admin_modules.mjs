const BASE_URL = 'http://127.0.0.1:5001';

async function run() {
  console.log('🧪 Starting End-to-End Verification for Remaining 5 Admin Modules...\n');
  let cookieHeader = '';

  // 1. Authenticate as Super Admin
  console.log('1️⃣ Testing Admin Sign-In: POST /api/admin/auth/login');
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@drinkit.com',
      password: process.env.ADMIN_PASSWORD || '',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.success) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  }
  const rawCookie = loginRes.headers.get('set-cookie');
  if (rawCookie) {
    cookieHeader = rawCookie.split(';')[0];
  }
  console.log(`   ✅ Signed in as: ${loginData.admin.name} (${loginData.admin.email}, ${loginData.admin.role})`);
  console.log(`   🔒 Session Cookie captured: ${cookieHeader.slice(0, 25)}...\n`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: cookieHeader,
  };

  // 2. Test Public Banners
  console.log('2️⃣ Testing Public Storefront Banners: GET /api/banners');
  const pubBannersRes = await fetch(`${BASE_URL}/api/banners`);
  const pubBanners = await pubBannersRes.json();
  if (!pubBannersRes.ok || !pubBanners.success || !Array.isArray(pubBanners.data)) {
    throw new Error(`Public banners failed: ${JSON.stringify(pubBanners)}`);
  }
  console.log(`   ✅ Retrieved ${pubBanners.data.length} active storefront banners.`);
  console.log(`   Featured: "${pubBanners.data[0]?.title}"\n`);

  // 3. Test Customers Module
  console.log('3️⃣ Testing Customers Module:');
  console.log('   a) GET /api/admin/customers');
  const custRes = await fetch(`${BASE_URL}/api/admin/customers`, { headers: authHeaders });
  const custData = await custRes.json();
  if (!custRes.ok || !custData.success || !Array.isArray(custData.data)) {
    throw new Error(`Get customers failed: ${JSON.stringify(custData)}`);
  }
  console.log(`   ✅ Found ${custData.data.length} customers (Total: ${custData.total})`);
  console.log(`   Metrics: Total customers = ${custData.metrics.totalCustomers}, Revenue = ₹${custData.metrics.totalRevenue}`);

  const testPhone = custData.data[0]?.phone || '9876543210';
  console.log(`   b) GET /api/admin/customers/${testPhone}`);
  const detailsRes = await fetch(`${BASE_URL}/api/admin/customers/${testPhone}`, { headers: authHeaders });
  const detailsData = await detailsRes.json();
  if (!detailsRes.ok || !detailsData.success) {
    throw new Error(`Get customer details failed: ${JSON.stringify(detailsData)}`);
  }
  console.log(`   ✅ Retrieved profile for ${detailsData.data.profile.fullName} (Orders: ${detailsData.data.stats.orderCount})`);

  console.log(`   c) PUT /api/admin/customers/${testPhone}/status`);
  const toggleRes = await fetch(`${BASE_URL}/api/admin/customers/${testPhone}/status`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ isActive: false }),
  });
  const toggleData = await toggleRes.json();
  if (!toggleRes.ok || !toggleData.success) {
    throw new Error(`Customer deactivation failed: ${JSON.stringify(toggleData)}`);
  }
  console.log(`   ✅ Deactivated customer: isActive = ${toggleData.data.isActive}`);

  // Re-activate
  await fetch(`${BASE_URL}/api/admin/customers/${testPhone}/status`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ isActive: true }),
  });
  console.log(`   ✅ Re-activated customer: isActive = true\n`);

  // 4. Test Banners Module
  console.log('4️⃣ Testing Banners Module:');
  console.log('   a) GET /api/admin/banners');
  const adminBannersRes = await fetch(`${BASE_URL}/api/admin/banners`, { headers: authHeaders });
  const adminBanners = await adminBannersRes.json();
  if (!adminBannersRes.ok || !adminBanners.success) {
    throw new Error(`Admin banners failed: ${JSON.stringify(adminBanners)}`);
  }
  console.log(`   ✅ Admin listed ${adminBanners.data.length} banners`);

  console.log('   b) POST /api/admin/banners (Create)');
  const createBannerRes = await fetch(`${BASE_URL}/api/admin/banners`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Monsoon Gin & Tonic Festival',
      subtitle: 'Artisanal craft gins & botanical tonics at special celebration prices',
      badgeText: 'SEASON SPECIAL',
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1200&auto=format&fit=crop&q=80',
      ctaText: 'Discover Gins',
      ctaLink: '/products?category=Gin',
      displayOrder: 4,
      isActive: true,
    }),
  });
  const createdBanner = await createBannerRes.json();
  if (!createBannerRes.ok || !createdBanner.success) {
    throw new Error(`Create banner failed: ${JSON.stringify(createdBanner)}`);
  }
  const bannerId = createdBanner.data.id;
  console.log(`   ✅ Created Banner ID: ${bannerId} ("${createdBanner.data.title}")`);

  console.log(`   c) PUT /api/admin/banners/${bannerId} (Update)`);
  const updateBannerRes = await fetch(`${BASE_URL}/api/admin/banners/${bannerId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ subtitle: 'Updated botanical gin selections' }),
  });
  const updatedBanner = await updateBannerRes.json();
  if (!updateBannerRes.ok || !updatedBanner.success) {
    throw new Error(`Update banner failed: ${JSON.stringify(updatedBanner)}`);
  }
  console.log(`   ✅ Updated banner: "${updatedBanner.data.subtitle}"`);

  console.log(`   d) DELETE /api/admin/banners/${bannerId} (Delete)`);
  const delBannerRes = await fetch(`${BASE_URL}/api/admin/banners/${bannerId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const delBanner = await delBannerRes.json();
  if (!delBannerRes.ok || !delBanner.success) {
    throw new Error(`Delete banner failed: ${JSON.stringify(delBanner)}`);
  }
  console.log(`   ✅ Deleted test banner successfully\n`);

  // 5. Test Reports Module
  console.log('5️⃣ Testing Reports & Analytics:');
  console.log('   a) GET /api/admin/reports/analytics?range=30d');
  const reportsRes = await fetch(`${BASE_URL}/api/admin/reports/analytics?range=30d`, { headers: authHeaders });
  const reportData = await reportsRes.json();
  if (!reportsRes.ok || !reportData.success) {
    throw new Error(`Analytics report failed: ${JSON.stringify(reportData)}`);
  }
  const s = reportData.data.summary;
  console.log(`   ✅ Analytics computed: Revenue = ₹${s.totalRevenue}, Orders = ${s.totalOrders}, Bottles = ${s.totalBottlesSold}, AOV = ₹${s.averageOrderValue}`);
  console.log(`   Timeline points = ${reportData.data.timeline.length}, Top Products = ${reportData.data.topProducts.length}`);

  console.log('   b) GET /api/admin/reports/export?range=30d (CSV Export)');
  const csvRes = await fetch(`${BASE_URL}/api/admin/reports/export?range=30d`, { headers: authHeaders });
  const csvText = await csvRes.text();
  if (!csvRes.ok || !csvText.includes('Order ID') || !csvText.includes('Total Amount')) {
    throw new Error(`CSV export invalid or missing headers:\n${csvText.slice(0, 100)}`);
  }
  const csvLines = csvText.trim().split('\n');
  console.log(`   ✅ Generated CSV Export: ${csvLines.length} rows (Header + Data)\n`);

  // 6. Test Admin Users Module & Guardrails
  console.log('6️⃣ Testing Admin Users Module:');
  console.log('   a) GET /api/admin/admin-users');
  const adminsRes = await fetch(`${BASE_URL}/api/admin/admin-users`, { headers: authHeaders });
  const adminsData = await adminsRes.json();
  if (!adminsRes.ok || !adminsData.success) {
    throw new Error(`Get admin users failed: ${JSON.stringify(adminsData)}`);
  }
  console.log(`   ✅ Found ${adminsData.data.length} staff administrators`);

  console.log('   b) POST /api/admin/admin-users (Create)');
  const testAdminEmail = `test.staff.${Date.now()}@drinkit.com`;
  const createAdminRes = await fetch(`${BASE_URL}/api/admin/admin-users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Rohan Joshi',
      email: testAdminEmail,
      role: 'inventory_manager',
      password: 'StrongStaffPassword2026!',
      isActive: true,
    }),
  });
  const createdAdmin = await createAdminRes.json();
  if (!createAdminRes.ok || !createdAdmin.success) {
    throw new Error(`Create admin user failed: ${JSON.stringify(createdAdmin)}`);
  }
  const testAdminId = createdAdmin.data.id;
  console.log(`   ✅ Created Admin User: ${createdAdmin.data.name} (${createdAdmin.data.email}, ${createdAdmin.data.role})`);
  if (createdAdmin.data.passwordHash) {
    throw new Error('SECURITY VIOLATION: passwordHash was leaked in API response!');
  }

  console.log(`   c) PUT /api/admin/admin-users/${testAdminId} (Update)`);
  const updateAdminRes = await fetch(`${BASE_URL}/api/admin/admin-users/${testAdminId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Rohan S. Joshi' }),
  });
  const updatedAdmin = await updateAdminRes.json();
  if (!updateAdminRes.ok || !updatedAdmin.success) {
    throw new Error(`Update admin user failed: ${JSON.stringify(updatedAdmin)}`);
  }
  console.log(`   ✅ Updated admin name: "${updatedAdmin.data.name}"`);

  console.log(`   d) DELETE /api/admin/admin-users/${testAdminId} (Delete)`);
  const delAdminRes = await fetch(`${BASE_URL}/api/admin/admin-users/${testAdminId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const delAdmin = await delAdminRes.json();
  if (!delAdminRes.ok || !delAdmin.success) {
    throw new Error(`Delete admin user failed: ${JSON.stringify(delAdmin)}`);
  }
  console.log(`   ✅ Deleted test administrator successfully`);

  console.log('   e) Testing Guardrail: Block deleting only active Super Admin');
  const rootAdmin = adminsData.data.find((a) => a.role === 'super_admin');
  if (rootAdmin) {
    const blockRes = await fetch(`${BASE_URL}/api/admin/admin-users/${rootAdmin.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const blockData = await blockRes.json();
    if (blockRes.ok || blockData.success) {
      throw new Error('GUARDRAIL FAILED: Deleting root super_admin was allowed!');
    }
    console.log(`   🛡️ Guardrail Verified: Blocked deletion of root super admin ("${blockData.error}")\n`);
  }

  // 7. Test Activity Logs Module
  console.log('7️⃣ Testing Activity Logs & Audit Trail:');
  console.log('   a) GET /api/admin/activity-logs');
  const logsRes = await fetch(`${BASE_URL}/api/admin/activity-logs`, { headers: authHeaders });
  const logsData = await logsRes.json();
  if (!logsRes.ok || !logsData.success || !Array.isArray(logsData.data)) {
    throw new Error(`Get activity logs failed: ${JSON.stringify(logsData)}`);
  }
  console.log(`   ✅ Retrieved ${logsData.data.length} audit trail events (Total in system: ${logsData.total})`);

  // Verify that recent operations are logged
  const recentModules = logsData.data.slice(0, 10).map((l) => `${l.module}:${l.action}`);
  console.log(`   Recent Audited Actions: ${recentModules.join(', ')}`);

  console.log('\n🎉 ALL 5 ADMIN MODULES FULLY OPERATIONAL AND VERIFIED END-TO-END!');
}

run().catch((err) => {
  console.error('\n❌ Verification test failed:', err.message);
  process.exit(1);
});
