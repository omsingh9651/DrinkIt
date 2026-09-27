import assert from 'node:assert/strict';
import { isRateLimitResponse, Msg91Error, RATE_LIMIT_MESSAGE } from '../services/msg91.js';
import { otpSendLimiter } from '../middleware/rateLimiter.js';

console.log('--- TEST 1: MSG91 Rate Limit Detection Helper ---');

// Test standard MSG91 IP rate-limit message
const msg1 = 'Too many OTP requests from this IP address. Please wait 15 minutes before requesting again.';
assert.equal(isRateLimitResponse(200, msg1), true, 'Should detect MSG91 IP rate limit message');

// Test HTTP 429 with empty or random message
assert.equal(isRateLimitResponse(429, ''), true, 'Should detect HTTP 429');
assert.equal(isRateLimitResponse(429, 'Rate limit exceeded'), true, 'Should detect HTTP 429 with message');

// Test variations
assert.equal(isRateLimitResponse(400, 'Rate limit reached, wait 15 minutes'), true);
assert.equal(isRateLimitResponse(200, 'Too many requests'), true);
assert.equal(isRateLimitResponse(200, 'Please wait 5 minutes before trying again'), true);

// Test non-rate-limit messages
assert.equal(isRateLimitResponse(200, 'OTP sent successfully'), false);
assert.equal(isRateLimitResponse(400, 'Invalid mobile number'), false);
assert.equal(isRateLimitResponse(500, 'Internal Server Error'), false);

console.log('✓ TEST 1 Passed: Rate limit detection accurately identifies MSG91 rate limit patterns.');

console.log('\n--- TEST 2: Msg91Error Object Structure ---');
const err = new Msg91Error(RATE_LIMIT_MESSAGE, {
  statusCode: 429,
  isRateLimit: true,
  retryAfter: 900,
});

assert.equal(err.message, 'Too many OTP attempts. Please try again after 15 minutes.');
assert.equal(err.statusCode, 429);
assert.equal(err.isRateLimit, true);
assert.equal(err.retryAfter, 900);

console.log('✓ TEST 2 Passed: Msg91Error captures statusCode 429, isRateLimit, and retryAfter 900.');

console.log('\n--- TEST 3: In-Memory Express Rate Limiter Middleware Execution ---');

function createMockReqRes(ip = '127.0.0.1') {
  let statusCode = 200;
  let responseData = null;
  const headers = {};

  const req = {
    ip,
    headers: {},
    app: {
      get: () => false,
    },
  };

  const res = {
    setHeader(k, v) {
      headers[k] = v;
      return this;
    },
    getHeader(k) {
      return headers[k];
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getBody() {
      return responseData;
    },
  };

  return { req, res };
}

// Perform 5 allowed requests
for (let i = 0; i < 5; i++) {
  const { req, res } = createMockReqRes('192.168.1.50');
  let nextCalled = false;
  otpSendLimiter(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, `Request ${i + 1} should call next()`);
}

// 6th request from same IP must be blocked with HTTP 429 and exact message
const { req: blockedReq, res: blockedRes } = createMockReqRes('192.168.1.50');
let blockedNextCalled = false;
otpSendLimiter(blockedReq, blockedRes, () => {
  blockedNextCalled = true;
});

assert.equal(blockedNextCalled, false, '6th request must NOT call next()');
assert.equal(blockedRes.getStatusCode(), 429, 'Status code must be 429');
const body = blockedRes.getBody();
assert.equal(body.success, false, 'Response success must be false');
assert.equal(body.error, 'Too many OTP attempts. Please try again after 15 minutes.');
assert.equal(body.retryAfter, 900, 'retryAfter must be 900');

console.log('✓ TEST 3 Passed: In-memory rate limiter cleanly allows 5 calls and intercepts 6th with HTTP 429, retryAfter: 900, and exact error message.');

console.log('\nAll rate limiting tests passed successfully!');

