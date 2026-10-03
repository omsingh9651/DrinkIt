import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import './config/env.js';
import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/auth.js';
import adminAuthRoutes from './routes/adminAuth.js';
import productRoutes from './routes/products.js';
import userRoutes from './routes/users.js';
import orderRoutes from './routes/orders.js';
import adminOrderRoutes from './routes/adminOrders.js';
import adminInventoryRoutes from './routes/adminInventory.js';
import locationRoutes from './routes/location.js';
import deliveryRoutes from './routes/delivery.js';
import paymentRoutes from './routes/payment.js';
import categoriesRoutes from './routes/categories.js';
import adminCategoryRoutes from './routes/adminCategories.js';
import brandRoutes from './routes/brands.js';
import adminBrandRoutes from './routes/adminBrands.js';
import adminMediaRoutes from './routes/media.js';
import adminPaymentRoutes from './routes/adminPayments.js';
import couponRoutes from './routes/coupons.js';
import adminCouponRoutes from './routes/adminCoupons.js';
import adminCustomerRoutes from './routes/adminCustomers.js';
import bannerRoutes from './routes/banners.js';
import adminBannerRoutes from './routes/adminBanners.js';
import adminReportRoutes from './routes/adminReports.js';
import adminUserRoutes from './routes/adminUsers.js';
import adminActivityLogRoutes from './routes/adminActivityLogs.js';
import { isMsg91Configured, logMsg91Diagnostics } from './services/msg91.js';
import { setupDeliveryTrackingSocket } from './services/deliveryTrackingService.js';
import mongoose from 'mongoose';
import { connectDB, isDbConnected } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Trust reverse proxy for Render deployment.
// Setting trust proxy to 1 trusts the first hop (Render load balancer / edge proxy)
// and properly resolves req.ip from X-Forwarded-For while preventing IP spoofing.
// Fixes: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
const trustProxyHops = process.env.TRUST_PROXY
  ? (Number.isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY))
  : 1;
app.set('trust proxy', trustProxyHops);

// CORS origin configuration supporting local dev and production frontend (CLIENT_URL)
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://drink-it-omega.vercel.app',
];
const allowedOrigins = [...defaultOrigins];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .forEach((url) => {
      const clean = url.replace(/\/+$/, '');
      if (!allowedOrigins.includes(clean)) allowedOrigins.push(clean);
      if (!allowedOrigins.includes(url)) allowedOrigins.push(url);
    });
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    const isAllowed =
      allowedOrigins.some((allowed) => allowed.replace(/\/+$/, '') === cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      /^https:\/\/[a-z0-9-]+(\.vercel\.app)$/i.test(cleanOrigin);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};

// Create HTTP server for Express + Socket.IO
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: corsOptions,
});

// Initialize real-time delivery tracking socket handlers
setupDeliveryTrackingSocket(io);

// Enable CORS
app.use(cors(corsOptions));

// Parse JSON request bodies & cookies
app.use(express.json());
app.use(cookieParser());

// Serve static uploads
const uploadsDir = path.resolve(__dirname, '../public/uploads');
app.use('/uploads', express.static(uploadsDir));

// API Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DrinkIt Backend API',
  });
});

// Safe database health check endpoint (Requirement 12)
app.get('/api/health/database', (req, res) => {
  const connected = isDbConnected();
  res.json({
    success: true,
    status: connected ? 'connected' : 'disconnected',
    database: connected ? mongoose.connection.name : null,
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/inventory', adminInventoryRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/brands', adminBrandRoutes);
app.use('/api/admin/media', adminMediaRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/coupons', adminCouponRoutes);
app.use('/api/admin/customers', adminCustomerRoutes);
app.use('/api/admin/banners', adminBannerRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/admin-users', adminUserRoutes);
app.use('/api/admin/activity-logs', adminActivityLogRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/payment', paymentRoutes);

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
  });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Connect to database and start listening
async function startServer() {
  try {
    await connectDB();
  } catch (err) {
    console.error('❌ Server startup aborted: Database connection failed:', err.message);
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🥃 DrinkIt Backend API & Socket.IO running on http://0.0.0.0:${PORT} (port ${PORT})`);
    console.log(`🍃 Database Status: CONNECTED (Database: ${mongoose.connection.name})`);
    console.log(`🔒 MSG91 Authkey is secured on the server.`);
    logMsg91Diagnostics();
    console.log(`📡 MSG91 Live Status: ${isMsg91Configured() ? 'CONFIGURED (Ready for Real SMS OTP)' : 'NOT CONFIGURED'}`);
    console.log(`🗺️  Location Engine: OpenStreetMap & Photon (Zero Google Cloud Dependency)`);
    console.log(`⚡ Live Delivery Tracking: Socket.IO & OSRM Routing Active`);
  });
}

export { app, server, io, startServer };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
