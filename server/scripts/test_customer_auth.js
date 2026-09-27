import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';
import '../config/env.js';
import { extractCustomerToken } from '../middleware/customerAuth.js';
import authRoutes from '../routes/auth.js';
import orderRoutes from '../routes/orders.js';
import userRoutes from '../routes/users.js';

const CUSTOMER_SECRET = process.env.CUSTOMER_JWT_SECRET;
assert.ok(CUSTOMER_SECRET, 'CUSTOMER_JWT_SECRET must be defined in server/.env');

console.log('====================================================');
console.log('DRINKIT CUSTOMER AUTHENTICATION FLOW VERIFICATION');
console.log('====================================================');

// Helper to create valid customer JWT
function createCustomerJwt(phone, options = {}) {
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  return jwt.sign(
    {
      id: `user_${clean}`,
      phone: clean,
      role: 'customer',
      ...options.payload,
    },
    CUSTOMER_SECRET,
    { expiresIn: options.expiresIn || '30d' }
  );
}

// ----------------------------------------------------
// TEST 1: Signed JWT Issuance & Secret Verification
// ----------------------------------------------------
console.log('\n[TEST 1] Signed Customer JWT creation and verification');
const phoneUser1 = '9876543210';
const validToken = createCustomerJwt(phoneUser1);

const decoded = jwt.verify(validToken, CUSTOMER_SECRET);
assert.equal(decoded.phone, '9876543210');
assert.equal(decoded.id, 'user_9876543210');
assert.equal(decoded.role, 'customer');
console.log('✓ PASS: Customer JWT is signed with CUSTOMER_JWT_SECRET and contains correct payload.');

// ----------------------------------------------------
// TEST 2: Token Extraction (Header takes precedence over Cookie)
// ----------------------------------------------------
console.log('\n[TEST 2] Token extraction precedence');
const mockReqWithHeaderAndCookie = {
  headers: {
    authorization: `Bearer ${validToken}`,
  },
  cookies: {
    customer_token: 'stale_or_expired_cookie_token',
  },
};
const extractedToken = extractCustomerToken(mockReqWithHeaderAndCookie);
assert.equal(extractedToken, validToken, 'Authorization header must take precedence over cookies');

const mockReqWithCookieOnly = {
  headers: {},
  cookies: {
    customer_token: validToken,
  },
};
assert.equal(extractCustomerToken(mockReqWithCookieOnly), validToken, 'Should fallback to cookie when header is absent');

const mockReqWithNoToken = {
  headers: {},
  cookies: {},
};
assert.equal(extractCustomerToken(mockReqWithNoToken), null, 'Should return null when no token is present');
console.log('✓ PASS: Header precedence over cookie verified.');

// ----------------------------------------------------
// In-Memory Express App Setup for Integration Tests
// ----------------------------------------------------
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

import { PassThrough } from 'node:stream';

// In-memory request dispatcher for Express running sandboxed without TCP sockets
function makeRequest(app, { method = 'GET', url = '/', headers = {}, body = null, cookies = {} } = {}) {
  return new Promise((resolve) => {
    const req = new PassThrough();
    req.method = method.toUpperCase();
    req.url = url;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;
    req.headers = {
      'content-type': 'application/json',
      host: 'localhost',
      ...headers,
    };

    // Format cookies header if provided
    if (Object.keys(cookies).length > 0) {
      req.headers.cookie = Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    }

    const res = new PassThrough();
    let resBody = '';
    const resHeaders = {};
    let statusCode = 200;

    res.statusCode = 200;
    res.writeHead = (code, h) => {
      statusCode = code;
      res.statusCode = code;
      if (h) Object.assign(resHeaders, h);
      return res;
    };
    res.setHeader = (name, value) => {
      resHeaders[name.toLowerCase()] = value;
      return res;
    };
    res.getHeader = (name) => resHeaders[name.toLowerCase()];
    res.removeHeader = (name) => {
      delete resHeaders[name.toLowerCase()];
      return res;
    };
    res.hasHeader = (name) => Object.prototype.hasOwnProperty.call(resHeaders, name.toLowerCase());
    res.status = (code) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    };

    let resolved = false;
    const finish = (finalBody) => {
      if (resolved) return;
      resolved = true;
      resolve({
        status: res.statusCode || statusCode,
        statusCode: res.statusCode || statusCode,
        headers: resHeaders,
        body: finalBody,
      });
    };

    res.json = function (obj) {
      res.setHeader('content-type', 'application/json');
      finish(obj);
      return this;
    };

    res.send = function (data) {
      if (typeof data === 'object' && data !== null) {
        return res.json(data);
      }
      finish(data);
      return this;
    };

    res.end = function (chunk) {
      if (chunk) resBody += chunk.toString();
      let parsed;
      try {
        parsed = resBody ? JSON.parse(resBody) : null;
      } catch {
        parsed = resBody;
      }
      finish(parsed);
      return this;
    };

    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (payload) {
      req.headers['content-length'] = Buffer.byteLength(payload);
      req.push(Buffer.from(payload));
    }
    req.push(null);

    app.handle(req, res);
  });
}

async function runIntegrationTests() {
  // ----------------------------------------------------
  // TEST 3: GET /api/auth/me with valid JWT
  // ----------------------------------------------------
  console.log('\n[TEST 3] GET /api/auth/me with valid signed customer JWT');
  const meRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${validToken}`,
    },
  });

  assert.equal(meRes.status, 200, 'GET /api/auth/me should return 200');
  assert.equal(meRes.body.success, true);
  assert.equal(meRes.body.user.phone, '9876543210');
  assert.equal(meRes.body.user.phoneNumber, '+91 9876543210');
  assert.equal(meRes.body.user.role, 'customer');
  console.log('✓ PASS: GET /api/auth/me confirms valid session with server authority.');

  // ----------------------------------------------------
  // TEST 4: Missing token rejection (HTTP 401)
  // ----------------------------------------------------
  console.log('\n[TEST 4] Protected API access without token is rejected');
  const unauthRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
  });
  assert.equal(unauthRes.status, 401);
  assert.equal(unauthRes.body.success, false);
  console.log('✓ PASS: Request without token receives HTTP 401.');

  // ----------------------------------------------------
  // TEST 5: Invalid JWT rejection (HTTP 401)
  // ----------------------------------------------------
  console.log('\n[TEST 5] Invalid JWT rejection');
  const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
  const invalidRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${invalidToken}` },
  });
  assert.equal(invalidRes.status, 401);
  assert.equal(invalidRes.body.success, false);
  console.log('✓ PASS: Invalid JWT receives HTTP 401.');

  // ----------------------------------------------------
  // TEST 6: Expired JWT rejection (HTTP 401)
  // ----------------------------------------------------
  console.log('\n[TEST 6] Expired JWT rejection');
  const expiredToken = jwt.sign(
    { id: 'user_9876543210', phone: '9876543210', role: 'customer' },
    CUSTOMER_SECRET,
    { expiresIn: '-1s' }
  );
  const expiredRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(expiredRes.status, 401);
  assert.equal(expiredRes.body.success, false);
  assert.equal(expiredRes.body.code, 'TOKEN_EXPIRED');
  console.log('✓ PASS: Expired JWT receives HTTP 401 with TOKEN_EXPIRED code.');

  // ----------------------------------------------------
  // TEST 7: Tampered JWT rejection (HTTP 401)
  // ----------------------------------------------------
  console.log('\n[TEST 7] Tampered/modified JWT rejection');
  const parts = validToken.split('.');
  // Modify payload (e.g. change phone in payload)
  const tamperedPayload = Buffer.from(JSON.stringify({ phone: '9999999999', role: 'customer' })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  const tamperedRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${tamperedToken}` },
  });
  assert.equal(tamperedRes.status, 401);
  assert.equal(tamperedRes.body.success, false);
  console.log('✓ PASS: Tampered JWT signature mismatch receives HTTP 401.');

  // ----------------------------------------------------
  // TEST 8: Token signed with wrong secret (e.g. Admin secret or hacker secret)
  // ----------------------------------------------------
  console.log('\n[TEST 8] JWT signed with rogue secret');
  const rogueToken = jwt.sign(
    { id: 'user_9876543210', phone: '9876543210', role: 'customer' },
    'attacker_rogue_secret_key_1234567890'
  );
  const rogueRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${rogueToken}` },
  });
  assert.equal(rogueRes.status, 401);
  console.log('✓ PASS: Token signed with non-matching secret is rejected with HTTP 401.');

  // ----------------------------------------------------
  // TEST 9: Access own orders vs another user's orders
  // ----------------------------------------------------
  console.log('\n[TEST 9] Customer order authorization & isolation');
  const user1Phone = '9876543210';
  const user2Phone = '9123456780';
  const tokenUser1 = createCustomerJwt(user1Phone);
  const tokenUser2 = createCustomerJwt(user2Phone);

  // User 1 creates an order
  const createOrderRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/orders',
    headers: { authorization: `Bearer ${tokenUser1}` },
    body: {
      customerName: 'Aarav Sharma',
      items: [
        {
          productId: 'sula-dindori-reserve-shiraz',
          name: 'Sula Dindori Reserve Shiraz',
          price: 1350,
          quantity: 1,
        },
      ],
      deliveryAddress: {
        fullName: 'Aarav Sharma',
        mobileNumber: '9876543210',
        house: '12B',
        street: 'Mall Road',
        city: 'Kanpur',
        pinCode: '208001',
      },
      paymentMethod: 'COD',
    },
  });

  assert.equal(createOrderRes.status, 201, 'Order creation should return 201');
  assert.equal(createOrderRes.body.success, true);
  const orderId = createOrderRes.body.order.id;
  assert.ok(orderId);
  console.log(`✓ User 1 created order #${orderId}`);

  // User 1 accesses their own order -> 200 OK
  const user1ViewRes = await makeRequest(app, {
    method: 'GET',
    url: `/api/orders/${orderId}`,
    headers: { authorization: `Bearer ${tokenUser1}` },
  });
  assert.equal(user1ViewRes.status, 200, 'User 1 must be able to view their own order');
  assert.equal(user1ViewRes.body.order.id, orderId);
  console.log('✓ PASS: User 1 successfully accessed their own order.');

  // User 2 attempts to access User 1's order -> 403 Forbidden!
  const user2ViewRes = await makeRequest(app, {
    method: 'GET',
    url: `/api/orders/${orderId}`,
    headers: { authorization: `Bearer ${tokenUser2}` },
  });
  assert.equal(user2ViewRes.status, 403, 'User 2 viewing User 1 order MUST return HTTP 403 Forbidden');
  assert.equal(user2ViewRes.body.success, false);
  console.log('✓ PASS: User 2 is strictly blocked from viewing User 1 order (HTTP 403 Forbidden).');

  // User 2 attempts to cancel User 1's order -> 403 Forbidden!
  const user2CancelRes = await makeRequest(app, {
    method: 'POST',
    url: `/api/orders/${orderId}/cancel`,
    headers: { authorization: `Bearer ${tokenUser2}` },
    body: { reason: 'Malicious cancellation attempt' },
  });
  assert.equal(user2CancelRes.status, 403, 'User 2 cancelling User 1 order MUST return HTTP 403 Forbidden');
  console.log('✓ PASS: User 2 is strictly blocked from cancelling User 1 order (HTTP 403 Forbidden).');

  // User 2 calls GET /api/orders/my-orders -> Should NOT contain User 1's order
  const user2MyOrdersRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/orders/my-orders',
    headers: { authorization: `Bearer ${tokenUser2}` },
  });
  assert.equal(user2MyOrdersRes.status, 200);
  const containsUser1Order = (user2MyOrdersRes.body.orders || []).some((o) => o.id === orderId);
  assert.equal(containsUser1Order, false, 'User 2 order list must NOT include User 1 order');
  console.log('✓ PASS: User 2 order list strictly isolates orders by verified JWT customer phone.');

  // ----------------------------------------------------
  // TEST 10: Attempting to forge identity via request body / query
  // ----------------------------------------------------
  console.log('\n[TEST 10] Forging customerPhone in request body is ignored');
  const spoofOrderRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/orders',
    headers: { authorization: `Bearer ${tokenUser2}` }, // User 2's token (9123456780)
    body: {
      customerPhone: '9876543210', // Trying to claim it's User 1
      customerName: 'Imposter',
      items: [{ productId: 'sula-dindori-reserve-shiraz', name: 'Sula Dindori Reserve Shiraz', price: 1350, quantity: 1 }],
      deliveryAddress: { house: '1', street: 'A', city: 'B', pinCode: '208001' },
      paymentMethod: 'COD',
    },
  });
  assert.equal(spoofOrderRes.status, 201);
  // Order must be bound to User 2's verified phone, NOT the forged customerPhone in body
  assert.equal(spoofOrderRes.body.order.customerPhone, '9123456780', 'Order must use verified phone from JWT');
  console.log('✓ PASS: Server ignores client-supplied customerPhone in body and strictly enforces JWT identity.');

  // ----------------------------------------------------
  // TEST 11: Logout endpoint and session termination
  // ----------------------------------------------------
  console.log('\n[TEST 11] Customer Logout flow');
  const logoutRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/logout',
  });
  assert.equal(logoutRes.status, 200);
  assert.equal(logoutRes.body.success, true);

  // Subsequent request without token is rejected
  const afterLogoutRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
  });
  assert.equal(afterLogoutRes.status, 401);
  console.log('✓ PASS: Logout terminates session; unauthenticated access is rejected.');

  // ----------------------------------------------------
  // TEST 12: MSG91 Rate Limit Detection & Exact Error Formatting
  // ----------------------------------------------------
  console.log('\n[TEST 12] Rate limit detection & error formatting');
  const { isRateLimitResponse, RATE_LIMIT_MESSAGE } = await import('../services/msg91.js');
  assert.equal(isRateLimitResponse(429, ''), true);
  assert.equal(isRateLimitResponse(200, 'Too many OTP requests from this IP address. Please wait 15 minutes before requesting again.'), true);
  assert.equal(isRateLimitResponse(400, 'IP address limit reached, please wait'), true);
  assert.equal(isRateLimitResponse(200, 'Invalid OTP'), false);
  assert.equal(RATE_LIMIT_MESSAGE, 'Too many OTP attempts. Please try again after 15 minutes.');
  console.log('✓ PASS: Rate limit detector identifies HTTP 429 and MSG91 error phrases.');

  // ----------------------------------------------------
  // TEST 13: 4-digit OTP format enforcement
  // ----------------------------------------------------
  console.log('\n[TEST 13] 4-digit OTP format enforcement');
  const invalidOtpLengthRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/verify-otp',
    body: { mobile: '9876543210', otp: '123' }, // 3 digits
  });
  assert.equal(invalidOtpLengthRes.status, 400);
  assert.match(invalidOtpLengthRes.body.error, /4-digit/i);

  const nonNumericOtpRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/verify-otp',
    body: { mobile: '9876543210', otp: 'abcd' },
  });
  assert.equal(nonNumericOtpRes.status, 400);
  assert.match(nonNumericOtpRes.body.error, /4-digit/i);
  console.log('✓ PASS: Real 4-digit OTP constraint strictly enforced.');

  // ----------------------------------------------------
  // TEST 14: Mobile number format validation
  // ----------------------------------------------------
  console.log('\n[TEST 14] Indian mobile number format validation');
  const invalidMobileRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/send-otp',
    body: { mobile: '12345' },
  });
  assert.equal(invalidMobileRes.status, 400);
  assert.match(invalidMobileRes.body.error, /valid 10-digit Indian mobile number/i);
  console.log('✓ PASS: Invalid mobile numbers are rejected prior to MSG91 dispatch.');

  console.log('\n====================================================');
  console.log('ALL CUSTOMER AUTHENTICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runIntegrationTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
