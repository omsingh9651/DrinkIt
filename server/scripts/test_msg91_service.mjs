import assert from 'node:assert/strict';
import {
  isRateLimitResponse,
  isAuthFailureResponse,
  isIpRestrictionResponse,
  formatIndianMobile,
  getMsg91Credentials,
  isMsg91Configured,
  Msg91Error,
} from '../services/msg91.js';

console.log('====================================================');
console.log('MSG91 SERVICE DIAGNOSTICS & ROBUSTNESS TESTS');
console.log('====================================================');

// TEST 1: formatIndianMobile
console.log('\n[TEST 1] Mobile number formatting to international 91 format');
assert.equal(formatIndianMobile('9876543210'), '919876543210');
assert.equal(formatIndianMobile('+91 98765 43210'), '919876543210');
assert.equal(formatIndianMobile('09876543210'), '919876543210');
assert.equal(formatIndianMobile('919876543210'), '919876543210');
console.log('✓ PASS: formatIndianMobile correctly formats 10-digit Indian numbers.');

// TEST 2: isAuthFailureResponse
console.log('\n[TEST 2] Authentication failure detection');
assert.equal(isAuthFailureResponse(401, 'AuthenticationFailure'), true);
assert.equal(isAuthFailureResponse('401', 'AuthenticationFailure'), true);
assert.equal(isAuthFailureResponse(201, 'AuthenticationFailure'), true);
assert.equal(isAuthFailureResponse('207', 'Invalid Authkey'), true);
assert.equal(isAuthFailureResponse('204', 'Permission not enabled'), true);
assert.equal(isAuthFailureResponse(200, 'Invalid authkey specified'), true);
assert.equal(isAuthFailureResponse(200, 'Success'), false);
console.log('✓ PASS: isAuthFailureResponse correctly identifies auth failure codes and messages.');

// TEST 3: isIpRestrictionResponse
console.log('\n[TEST 3] IP Restriction detection');
assert.equal(isIpRestrictionResponse(418, 'IP not whitelisted'), true);
assert.equal(isIpRestrictionResponse('208', 'IP address is not allowed'), true);
assert.equal(isIpRestrictionResponse(200, 'IP security violation'), true);
assert.equal(isIpRestrictionResponse(200, 'Invalid OTP'), false);
console.log('✓ PASS: isIpRestrictionResponse correctly identifies IP security codes.');

// TEST 4: isRateLimitResponse
console.log('\n[TEST 4] Rate limit detection');
assert.equal(isRateLimitResponse(429, ''), true);
assert.equal(isRateLimitResponse(200, 'Too many OTP requests. Please wait 15 minutes.'), true);
assert.equal(isRateLimitResponse(200, 'Rate limit exceeded'), true);
assert.equal(isRateLimitResponse(200, 'OTP verified successfully'), false);
console.log('✓ PASS: isRateLimitResponse correctly identifies rate limit responses.');

// TEST 5: Msg91Error class
console.log('\n[TEST 5] Msg91Error properties');
const err = new Msg91Error('Test auth error', {
  statusCode: 502,
  isAuthFailure: true,
  isIpRestriction: true,
  cause: new Error('Underlying MSG91 401'),
});
assert.equal(err.name, 'Msg91Error');
assert.equal(err.statusCode, 502);
assert.equal(err.isAuthFailure, true);
assert.equal(err.isIpRestriction, true);
assert.equal(err.cause?.message, 'Underlying MSG91 401');
console.log('✓ PASS: Msg91Error correctly stores statusCode, flags, and cause.');

// TEST 6: getMsg91Credentials sanitization
console.log('\n[TEST 6] getMsg91Credentials sanitization and normalization');
const origEnv = { ...process.env };

try {
  // Scenario A: Enclosing quotes and trailing whitespace
  process.env.MSG91_AUTH_KEY = ' "382716abcdef"  ';
  process.env.MSG91_WIDGET_ID = " '336762testwidget' \r\n ";
  process.env.MSG91_TOKEN_AUTH = '';
  process.env.MSG91_TEMPLATE_ID = '';

  let creds = getMsg91Credentials();
  assert.equal(creds.authKey, '382716abcdef', 'Must strip quotes and whitespace from authKey');
  assert.equal(creds.widgetId, '336762testwidget', 'Must strip quotes and carriage returns from widgetId');

  // Scenario B: Accidental key prefix (e.g. authkey=xxxx)
  process.env.MSG91_AUTH_KEY = 'authkey: 408139Arealauthkey';
  process.env.MSG91_WIDGET_ID = 'widgetId=336872testwidgetid';
  creds = getMsg91Credentials();
  assert.equal(creds.authKey, '408139Arealauthkey', 'Must strip prefix "authkey:"');
  assert.equal(creds.widgetId, '336872testwidgetid', 'Must strip prefix "widgetId="');

  // Scenario C: User pasted JWT token into MSG91_AUTH_KEY
  // Standard JWT is 3 dot-separated segments
  const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  process.env.MSG91_AUTH_KEY = fakeJwt;
  process.env.MSG91_WIDGET_ID = '336872testwidgetid';
  creds = getMsg91Credentials();
  assert.equal(creds.authKey, '', 'Must clear authKey so JWT is not sent as invalid authkey header');
  assert.equal(creds.tokenAuth, fakeJwt, 'Must move JWT to tokenAuth');
  assert.equal(isMsg91Configured(), true, 'Must still report configured via tokenAuth');

  console.log('✓ PASS: getMsg91Credentials cleanly sanitizes quotes, prefixes, and JWT tokens.');
} finally {
  process.env = origEnv;
}

console.log('\n====================================================');
console.log('ALL MSG91 DIAGNOSTICS & ROBUSTNESS TESTS PASSED!');
console.log('====================================================\n');
