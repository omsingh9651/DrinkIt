import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { UserProvider } from './context/UserContext';
import { LocationProvider } from './context/LocationContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import ScrollToTop from './components/ScrollToTop';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast from './components/Toast';
import LocationPickerModal from './components/LocationPickerModal';

// Customer Public Pages
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import About from './pages/About';
import Login from './pages/Login';

// Customer Protected Account Pages
import CustomerRoute from './components/CustomerRoute';
import ProfileSetup from './pages/ProfileSetup';
import AccountLayout from './components/account/AccountLayout';
import Account from './pages/Account';
import AccountProfile from './pages/account/AccountProfile';
import AccountAddresses from './pages/account/AccountAddresses';
import AccountOrders from './pages/account/AccountOrders';
import AccountOrderDetail from './pages/account/AccountOrderDetail';
import OrderTracking from './pages/account/OrderTracking';
import AccountWishlist from './pages/account/AccountWishlist';
import AccountCoupons from './pages/account/AccountCoupons';
import AccountNotifications from './pages/account/AccountNotifications';
import AccountPrivacy from './pages/account/AccountPrivacy';

// Admin System
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminBrands from './pages/admin/AdminBrands';
import AdminMedia from './pages/admin/AdminMedia';
import AdminOrders from './pages/admin/AdminOrders';
import AdminInventory from './pages/admin/AdminInventory';
import AdminStockHistory from './pages/admin/AdminStockHistory';
import AdminPayments from './pages/admin/AdminPayments';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminBanners from './pages/admin/AdminBanners';
import AdminReports from './pages/admin/AdminReports';
import AdminUsers from './pages/admin/AdminUsers';
import AdminActivityLogs from './pages/admin/AdminActivityLogs';
import AdminDelivery from './pages/admin/AdminDelivery';
import AdminDeliverySimulator from './pages/admin/AdminDeliverySimulator';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';

import './App.css';

/**
 * Customer Storefront Layout Wrapper
 * Renders customer navbar, main content, footer, and toasts.
 */
function CustomerLayout() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Toast />
      <LocationPickerModal />
    </div>
  );
}

/**
 * Root Application component.
 * Provides AdminAuthProvider, AuthProvider, UserProvider, LocationProvider, CartProvider, and React Router routes.
 */
function App() {
  return (
    <AdminAuthProvider>
      <AuthProvider>
        <UserProvider>
          <LocationProvider>
            <CartProvider>
              <Router>
              <ScrollToTop />
              <Routes>
                {/* Customer Storefront Routes */}
                <Route element={<CustomerLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<ProductDetails />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route
                    path="/checkout"
                    element={
                      <CustomerRoute>
                        <Checkout />
                      </CustomerRoute>
                    }
                  />
                  <Route path="/about" element={<About />} />
                  <Route path="/login" element={<Login />} />

                  {/* Customer Onboarding (Protected) */}
                  <Route
                    path="/profile/setup"
                    element={
                      <CustomerRoute>
                        <ProfileSetup />
                      </CustomerRoute>
                    }
                  />

                  {/* Customer Live Delivery Tracking */}
                  <Route
                    path="/account/orders/:orderId/track"
                    element={
                      <CustomerRoute>
                        <OrderTracking />
                      </CustomerRoute>
                    }
                  />

                  {/* Customer Account Dashboard & Sub-pages (Protected) */}
                  <Route
                    path="/account"
                    element={
                      <CustomerRoute>
                        <AccountLayout />
                      </CustomerRoute>
                    }
                  >
                    <Route index element={<Account />} />
                    <Route path="profile" element={<AccountProfile />} />
                    <Route path="addresses" element={<AccountAddresses />} />
                    <Route path="orders" element={<AccountOrders />} />
                    <Route path="orders/:id" element={<AccountOrderDetail />} />
                    <Route path="wishlist" element={<AccountWishlist />} />
                    <Route path="coupons" element={<AccountCoupons />} />
                    <Route path="notifications" element={<AccountNotifications />} />
                    <Route path="privacy" element={<AccountPrivacy />} />
                  </Route>
                </Route>

                {/* Admin Portal: Public Login */}
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Admin Portal: Protected Routes */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <Navigate to="/admin/dashboard" replace />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/dashboard"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminDashboard />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/products"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminProducts />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/categories"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminCategories />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/brands"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminBrands />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/media"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminMedia />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/inventory"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminInventory />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/stock-history"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminStockHistory />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/orders"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminOrders />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/payments"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminPayments />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/coupons"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminCoupons />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/delivery"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminDelivery />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/delivery/simulator"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminDeliverySimulator />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/customers"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminCustomers />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/banners"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminBanners />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminReports />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/admin-users"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminUsers />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/activity-logs"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <AdminActivityLogs />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />

                {/* Catch-all Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </CartProvider>
        </LocationProvider>
      </UserProvider>
    </AuthProvider>
    </AdminAuthProvider>
  );
}

export default App;