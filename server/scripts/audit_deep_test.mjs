const BASE_URL = 'http://127.0.0.1:5001';

async function runAuditTests() {
  console.log('🔬 STARTING DEEP PRODUCTION-READINESS AUDIT TESTS\n');
  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  function pass(name, detail = '') {
    console.log(`  ✅ [PASS] ${name}${detail ? ` - ${detail}` : ''}`);
    results.passed.push({ name, detail });
  }

  function fail(name, error = '') {
    console.log(`  ❌ [FAIL] ${name}${error ? ` - ${error}` : ''}`);
    results.failed.push({ name, error });
  }

  function warn(name, issue = '') {
    console.log(`  ⚠️  [WARN] ${name}${issue ? ` - ${issue}` : ''}`);
    results.warnings.push({ name, issue });
  }

  // =========================================================================
  // 1. HEALTH & CONFIGURATION CHECKS
  // =========================================================================
  console.log('--- 1. Health & Configuration ---');
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      pass('API Health Check', `Status: ${data.status}, Service: ${data.service}`);
    } else {
      fail('API Health Check', `Unexpected response: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    fail('API Health Check', e.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/payment/config`);
    const data = await res.json();
    if (res.ok && data.success && data.keyId) {
      if (data.keySecret || data.secret) {
        fail('Razorpay Secret Exposure', 'CRITICAL: Secret key leaked in public config endpoint!');
      } else {
        pass('Razorpay Public Config', `KeyID: ${data.keyId}, Mode: ${data.mode} (No secrets leaked)`);
      }
    } else {
      fail('Razorpay Public Config', `Failed to get payment config: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    fail('Razorpay Public Config', e.message);
  }

  // =========================================================================
  // 2. CUSTOMER AUTH & SESSION INTEGRITY
  // =========================================================================
  console.log('\n--- 2. Customer Auth & Session Integrity ---');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '12345' }), // Invalid format
    });
    const data = await res.json();
    if (res.status === 400 && data.success === false) {
      pass('Customer Send OTP: Validation Check', 'Properly rejected invalid mobile number');
    } else {
      fail('Customer Send OTP: Validation Check', `Expected 400, got ${res.status}`);
    }
  } catch (e) {
    fail('Customer Send OTP: Validation Check', e.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '9876543210', otp: '00' }), // Invalid length
    });
    const data = await res.json();
    if (res.status === 400 && data.success === false) {
      pass('Customer Verify OTP: Validation Check', 'Properly rejected incomplete OTP');
    } else {
      fail('Customer Verify OTP: Validation Check', `Expected 400, got ${res.status}`);
    }
  } catch (e) {
    fail('Customer Verify OTP: Validation Check', e.message);
  }

  // Check customer session security: Header spoofing vulnerability
  try {
    const spoofPhone = '9876543210';
    const res = await fetch(`${BASE_URL}/api/orders/my-orders`, {
      headers: {
        'x-drinkit-customer-phone': spoofPhone,
      },
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.orders)) {
      warn(
        'Customer Identity Spoofing Vulnerability',
        `Unauthenticated request with "x-drinkit-customer-phone: ${spoofPhone}" returned ${data.orders.length} orders without cryptographic token!`
      );
    } else {
      pass('Customer Identity Protection', 'Header spoofing rejected');
    }
  } catch (e) {
    fail('Customer Identity Check', e.message);
  }

  // =========================================================================
  // 3. PRODUCT CATALOG, STOCK & CART LIMITS
  // =========================================================================
  console.log('\n--- 3. Product Catalog & Inventory Integrity ---');
  let testProduct = null;
  try {
    const res = await fetch(`${BASE_URL}/api/products`);
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.products) && data.products.length > 0) {
      pass('Product Catalog Browsing', `Found ${data.products.length} products`);
      testProduct = data.products.find((p) => p.inStock && (p.stockQuantity || p.stock) > 2) || data.products[0];
    } else {
      fail('Product Catalog Browsing', 'No products returned');
    }
  } catch (e) {
    fail('Product Catalog Browsing', e.message);
  }

  if (testProduct) {
    try {
      const res = await fetch(`${BASE_URL}/api/products/${testProduct.id}`);
      const data = await res.json();
      if (res.ok && data.success && data.product.id === testProduct.id) {
        pass('Product Details Lookup', `${data.product.name} (Stock: ${data.product.stockQuantity ?? data.product.stock})`);
      } else {
        fail('Product Details Lookup', `Failed to load product ${testProduct.id}`);
      }
    } catch (e) {
      fail('Product Details Lookup', e.message);
    }
  }

  // =========================================================================
  // 4. ORDER CREATION, ATOMIC INVENTORY DEDUCTION & RESTORATION
  // =========================================================================
  console.log('\n--- 4. Order Creation & Atomic Stock Deduction/Restoration ---');
  let createdOrderId = null;
  const initialStock = testProduct ? Number(testProduct.stockQuantity ?? testProduct.stock ?? 0) : 0;

  if (testProduct && initialStock >= 2) {
    const customerPhone = '9876543210';
    try {
      const orderPayload = {
        customerPhone,
        customerName: 'Aarav Sharma',
        items: [{ productId: testProduct.id, quantity: 1 }],
        deliveryAddress: {
          fullName: 'Aarav Sharma',
          mobileNumber: customerPhone,
          house: 'Flat 402, Tower 5',
          street: 'Sector 62',
          city: 'Noida',
          state: 'Uttar Pradesh',
          pinCode: '201309',
        },
        paymentMethod: 'COD',
      };

      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-drinkit-customer-phone': customerPhone,
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (res.status === 201 && data.success && data.order?.id) {
        createdOrderId = data.order.id;
        pass('Order Creation (COD)', `Order #${createdOrderId} placed for ₹${data.order.total}`);

        // Verify stock deducted
        const prodAfterRes = await fetch(`${BASE_URL}/api/products/${testProduct.id}`);
        const prodAfterData = await prodAfterRes.json();
        const newStock = Number(prodAfterData.product.stockQuantity ?? prodAfterData.product.stock ?? 0);
        if (newStock === initialStock - 1) {
          pass('Atomic Stock Deduction', `Stock decreased from ${initialStock} to ${newStock}`);
        } else {
          fail('Atomic Stock Deduction', `Expected ${initialStock - 1}, found ${newStock}`);
        }
      } else {
        fail('Order Creation (COD)', `Order failed: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      fail('Order Creation (COD)', e.message);
    }

    // Now test Customer Cancellation & Stock Restoration
    if (createdOrderId) {
      try {
        const cancelRes = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/cancel`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-drinkit-customer-phone': customerPhone,
          },
          body: JSON.stringify({ reason: 'Audit Test Cancellation' }),
        });

        const cancelData = await cancelRes.json();
        if (cancelRes.ok && cancelData.success) {
          pass('Customer Order Cancellation', `Order #${createdOrderId} cancelled successfully`);

          // Verify stock restored
          const prodRestoredRes = await fetch(`${BASE_URL}/api/products/${testProduct.id}`);
          const prodRestoredData = await prodRestoredRes.json();
          const restoredStock = Number(prodRestoredData.product.stockQuantity ?? prodRestoredData.product.stock ?? 0);
          if (restoredStock === initialStock) {
            pass('Atomic Stock Restoration', `Stock restored back to original: ${restoredStock}`);
          } else {
            fail('Atomic Stock Restoration', `Expected ${initialStock}, found ${restoredStock}`);
          }

          // Duplicate cancellation attempt check
          const dupCancelRes = await fetch(`${BASE_URL}/api/orders/${createdOrderId}/cancel`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-drinkit-customer-phone': customerPhone,
            },
            body: JSON.stringify({ reason: 'Duplicate cancel attempt' }),
          });
          const dupCancelData = await dupCancelRes.json();
          if (!dupCancelRes.ok || !dupCancelData.success) {
            pass('Duplicate Cancellation Guard', `Properly blocked duplicate cancellation: "${dupCancelData.error}"`);
          } else {
            fail('Duplicate Cancellation Guard', 'Duplicate cancellation was allowed!');
          }
        } else {
          fail('Customer Order Cancellation', `Cancellation failed: ${JSON.stringify(cancelData)}`);
        }
      } catch (e) {
        fail('Customer Order Cancellation', e.message);
      }
    }
  }

  // =========================================================================
  // 5. RAZORPAY TEST MODE & CRYPTOGRAPHIC VERIFICATION
  // =========================================================================
  console.log('\n--- 5. Razorpay Test Mode Cryptographic Verification ---');
  let rzpOrderId = null;
  let localOrderId = null;
  const customerPhone = '9876543210';

  try {
    const res = await fetch(`${BASE_URL}/api/payment/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-drinkit-customer-phone': customerPhone,
      },
      body: JSON.stringify({
        customerName: 'Aarav Sharma',
        items: [{ productId: testProduct.id, quantity: 1 }],
        deliveryAddress: {
          fullName: 'Aarav Sharma',
          mobileNumber: customerPhone,
          house: 'Flat 402, Tower 5',
          street: 'Sector 62',
          city: 'Noida',
          state: 'Uttar Pradesh',
          pinCode: '201309',
        },
      }),
    });

    const data = await res.json();
    if (res.status === 201 && data.success && data.razorpayOrder?.id) {
      rzpOrderId = data.razorpayOrder.id;
      localOrderId = data.order.id;
      pass('Razorpay Order Initialization', `Created Local #${localOrderId} + RZP #${rzpOrderId} (Amount: ₹${data.razorpayOrder.amount / 100})`);
    } else {
      fail('Razorpay Order Initialization', `Failed: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    fail('Razorpay Order Initialization', e.message);
  }

  // Test Tampered HMAC Signature (Must be rejected)
  if (rzpOrderId && localOrderId) {
    try {
      const tamperedRes = await fetch(`${BASE_URL}/api/payment/razorpay/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-drinkit-customer-phone': customerPhone,
        },
        body: JSON.stringify({
          orderId: localOrderId,
          razorpayPaymentId: 'pay_test_tampered_123',
          razorpayOrderId: rzpOrderId,
          razorpaySignature: 'invalid_fake_forged_hmac_signature_000000000000000000000000000000000000',
        }),
      });
      const tamperedData = await tamperedRes.json();
      if (tamperedRes.status === 400 && tamperedData.success === false) {
        pass('Cryptographic Signature Tamper Rejection', `Properly rejected forged HMAC: "${tamperedData.error}"`);
      } else {
        fail('Cryptographic Signature Tamper Rejection', `FORGED SIGNATURE ACCEPTED! Status: ${tamperedRes.status}`);
      }
    } catch (e) {
      fail('Cryptographic Signature Tamper Rejection', e.message);
    }
  }

  // =========================================================================
  // 6. ROUTE PROTECTION & UNPROTECTED ENDPOINT CHECK
  // =========================================================================
  console.log('\n--- 6. Route Protection & Authorization Flaws ---');

  // Test unauthenticated delivery assign endpoint
  try {
    const unauthAssignRes = await fetch(`${BASE_URL}/api/delivery/orders/ORD-TEST-DUMMY/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId: 'partner-1' }),
    });
    // If it returns 401 or 403, it is protected. If it returns 404 (order not found) without auth, it's UNPROTECTED!
    if (unauthAssignRes.status === 401 || unauthAssignRes.status === 403) {
      pass('Delivery Assignment Auth Check', 'Properly protected with authentication');
    } else {
      warn(
        'Delivery Assign Unprotected Endpoint',
        `PATCH /api/delivery/orders/:id/assign returned HTTP ${unauthAssignRes.status} without any auth tokens (Missing requireAdmin)!`
      );
    }
  } catch (e) {
    fail('Delivery Assignment Auth Check', e.message);
  }

  // Test unauthenticated delivery reset endpoint
  try {
    const unauthResetRes = await fetch(`${BASE_URL}/api/delivery/orders/ORD-TEST-DUMMY/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (unauthResetRes.status === 401 || unauthResetRes.status === 403) {
      pass('Delivery Reset Auth Check', 'Properly protected with authentication');
    } else {
      warn(
        'Delivery Reset Unprotected Endpoint',
        `POST /api/delivery/orders/:id/reset returned HTTP ${unauthResetRes.status} without any auth tokens (Missing requireAdmin)!`
      );
    }
  } catch (e) {
    fail('Delivery Reset Auth Check', e.message);
  }

  // =========================================================================
  // 7. ADMIN RBAC & STORE_MANAGER BUG VERIFICATION
  // =========================================================================
  console.log('\n--- 7. Admin RBAC & STORE_MANAGER Bug Verification ---');
  // Log in as an inventory manager to see if STORE_MANAGER bug affects them
  let adminCookie = '';
  try {
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'inventory@drinkit.com',
        password: process.env.ADMIN_PASSWORD || '',
      }),
    });
    const adminData = await adminLoginRes.json();
    const cookie = adminLoginRes.headers.get('set-cookie');
    if (adminLoginRes.ok && cookie) {
      adminCookie = cookie.split(';')[0];
      pass('Staff Login (inventory_manager)', `Role: ${adminData.admin.role}`);
    } else {
      fail('Staff Login (inventory_manager)', `Failed: ${JSON.stringify(adminData)}`);
    }
  } catch (e) {
    fail('Staff Login (inventory_manager)', e.message);
  }

  // Now test access to categories with this staff account
  if (adminCookie) {
    try {
      const catRes = await fetch(`${BASE_URL}/api/admin/categories`, {
        headers: { Cookie: adminCookie },
      });
      const catData = await catRes.json();
      if (catRes.status === 403) {
        fail(
          'RBAC STORE_MANAGER Typo Bug',
          `HTTP 403: "Access denied. Requires one of roles: super_admin, undefined." (Due to requireRole([ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.STORE_MANAGER]))`
        );
      } else if (catRes.ok) {
        pass('Category RBAC Access', 'Successfully accessed categories');
      }
    } catch (e) {
      fail('Category RBAC Access', e.message);
    }
  }

  console.log('\n======================================================');
  console.log(`AUDIT EXECUTION SUMMARY:`);
  console.log(`  Passed Checks:   ${results.passed.length}`);
  console.log(`  Failed Checks:   ${results.failed.length}`);
  console.log(`  Security Warnings: ${results.warnings.length}`);
  console.log('======================================================\n');
}

runAuditTests().catch(console.error);
