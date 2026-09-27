import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure server/.env is loaded strictly for MongoDB configuration
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

let isConnected = false;

/**
 * Safely extract host without printing username, password, or query tokens
 */
export function getSafeHost(uri) {
  if (!uri) return 'unknown';
  try {
    const atSplit = uri.split('@');
    if (atSplit.length > 1) {
      const hostPortion = atSplit[1].split('/')[0].split('?')[0];
      return hostPortion;
    }
    const clean = uri.replace(/^mongodb(\+srv)?:\/\//i, '').split('/')[0].split('?')[0];
    return clean;
  } catch {
    return 'hidden-host';
  }
}

/**
 * Check if MongoDB connection is active
 */
export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Establish connection to MongoDB Atlas with mandatory persistence
 * Does NOT silently fall back to localhost or in-memory mode
 */
export async function connectDB() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri || !rawUri.trim()) {
    const errorMsg = '❌ FATAL: MONGODB_URI is not defined in server/.env. Database connection is required.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const uri = rawUri.trim();
  const dbName = (process.env.MONGODB_DB_NAME || 'drinkit').trim();
  const safeHost = getSafeHost(uri);

  // Connection lifecycle listeners
  mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.warn(`⚠️ MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('ℹ️ MongoDB disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('🔄 MongoDB reconnected successfully.');
  });

  try {
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      autoIndex: true,
    });

    isConnected = true;
    const activeHost = mongoose.connection.host || safeHost;
    const activeDb = mongoose.connection.name || dbName;

    console.log(`🍃 Connected to MongoDB (Host: ${activeHost}, Database: ${activeDb})`);

    // Startup canary test: create, read, and delete a temporary document
    const canaryColl = mongoose.connection.collection('_connection_canary');
    const canaryDoc = { canary: true, timestamp: new Date() };
    const insertRes = await canaryColl.insertOne(canaryDoc);
    const readRes = await canaryColl.findOne({ _id: insertRes.insertedId });
    if (!readRes) {
      throw new Error('Canary verification failed: document was inserted but could not be read back.');
    }
    await canaryColl.deleteOne({ _id: insertRes.insertedId });
    console.log('✅ MongoDB startup write/read canary test passed.');

    return true;
  } catch (err) {
    isConnected = false;
    console.error(
      `❌ FATAL: Failed to connect to MongoDB:\n` +
      `   Error: ${err.message}\n` +
      `   Target Host: ${safeHost}\n` +
      `   Database: ${dbName}\n` +
      `   In-memory fallback is disabled. Server cannot start without database connection.`
    );
    throw err;
  }
}

/**
 * Gracefully disconnect from MongoDB (useful for tests and shutdown)
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

// Handle graceful process termination
process.on('SIGINT', async () => {
  if (isDbConnected()) {
    await mongoose.connection.close();
    console.log('🍃 MongoDB connection closed through app termination.');
  }
});

export default { connectDB, disconnectDB, isDbConnected, getSafeHost, mongoose };
