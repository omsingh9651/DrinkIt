#!/usr/bin/env node

/**
 * DrinkIt Admin Password Hash Generator
 *
 * Usage:
 *   node server/scripts/generateAdminHash.js "YourStrongPasswordHere"
 *
 * This utility uses bcryptjs to generate a salted password hash suitable
 * for storing in server/.env as ADMIN_PASSWORD_HASH.
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('\x1b[31mError: Please provide a password as an argument.\x1b[0m');
  console.log('\nUsage:');
  console.log('  node server/scripts/generateAdminHash.js "YourPassword123!"\n');
  process.exit(1);
}

const SALT_ROUNDS = 12;

console.log('\n🔐 Generating secure bcrypt hash (12 salt rounds)...');
bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
  if (err) {
    console.error('Failed to hash password:', err);
    process.exit(1);
  }

  console.log('\n\x1b[32m✔ Password hash generated successfully!\x1b[0m\n');
  console.log('Add the following line to your \x1b[33mserver/.env\x1b[0m file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
});
