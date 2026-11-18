import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { CustomerLayout } from './components/CustomerLayout';
import { AppSplashScreen } from './components/AppSplashScreen';
import { SeoHead } from './components/SeoHead';
import { ErrorBoundary } from './components/ui';
import { StoreProvider } from './context/StoreContext';
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';

const ProductPage = lazy(() =>
  import('./pages/ProductPage').then((m) => ({ default: m.ProductPage }))
);
const CartPage = lazy(() =>
  import('./pages/CartCheckoutPages').then((m) => ({ default: m.CartPage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CartCheckoutPages').then((m) => ({ default: m.CheckoutPage }))
);
const OrderSuccessPage = lazy(() =>
  import('./pages/CartCheckoutPages').then((m) => ({ default: m.OrderSuccessPage }))
);
const AuthPage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.AuthPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.ProfilePage }))
);
const OrdersPage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.OrdersPage }))
);
const RewardsPage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.RewardsPage }))
);
const ReviewsPage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.ReviewsPage }))
);
const PoliciesPage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.PoliciesPage }))
);
const ContactPage = lazy(() =>
  import('./pages/AccountAndInfoPages').then((m) => ({ default: m.ContactPage }))
);

const AdminLoginPage = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminLayout = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminLayout }))
);
const AdminDashboardSection = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminDashboardSection }))
);
const AdminOrdersSection = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminOrdersSection }))
);
const AdminProductsSection = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminProductsSection }))
);
const AdminCategoriesSection = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminCategoriesSection }))
);
const AdminInventorySection = lazy(() =>
  import('./pages/AdminShellAndCore').then((m) => ({ default: m.AdminInventorySection }))
);

const AdminNotificationsSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminNotificationsSection }))
);
const AdminOffersSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminOffersSection }))
);
const AdminReviewsSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminReviewsSection }))
);
const AdminRewardsSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminRewardsSection }))
);
const AdminPoliciesSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminPoliciesSection }))
);
const AdminSocialLinksSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminSocialLinksSection }))
);
const AdminAISettingsSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminAISettingsSection }))
);
const AdminSettingsSection = lazy(() =>
  import('./pages/AdminEngagementAndSettings').then((m) => ({ default: m.AdminSettingsSection }))
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-muted">
    Loading Home Food Corner…
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <StoreProvider>
          <AppSplashScreen />
          <BrowserRouter>
            <ScrollToTop />
            <SeoHead />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route
                  path="/admin"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminDashboardSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/orders"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminOrdersSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/products"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminProductsSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/categories"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminCategoriesSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/inventory"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminInventorySection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/notifications"
                  element={
                    <AdminLayout>
                      {({ reload }) => <AdminNotificationsSection reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/offers"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminOffersSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/reviews"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminReviewsSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/rewards"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminRewardsSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/policies"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminPoliciesSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/social-links"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminSocialLinksSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/ai-settings"
                  element={
                    <AdminLayout>
                      {() => <AdminAISettingsSection />}
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminLayout>
                      {({ data, reload }) => <AdminSettingsSection data={data} reload={reload} />}
                    </AdminLayout>
                  }
                />

                {/* Customer Storefront Routes */}
                <Route path="/" element={<CustomerLayout><HomePage /></CustomerLayout>} />
                <Route path="/menu" element={<CustomerLayout><MenuPage /></CustomerLayout>} />
                <Route path="/category/:slug" element={<CustomerLayout><MenuPage /></CustomerLayout>} />
                <Route path="/product/:slug" element={<CustomerLayout><ProductPage /></CustomerLayout>} />
                <Route path="/cart" element={<CustomerLayout><CartPage /></CustomerLayout>} />
                <Route path="/checkout" element={<CustomerLayout><CheckoutPage /></CustomerLayout>} />
                <Route path="/order-success" element={<CustomerLayout><OrderSuccessPage /></CustomerLayout>} />
                <Route path="/orders" element={<CustomerLayout><OrdersPage /></CustomerLayout>} />
                <Route path="/profile" element={<CustomerLayout><ProfilePage /></CustomerLayout>} />
                <Route path="/rewards" element={<CustomerLayout><RewardsPage /></CustomerLayout>} />
                <Route path="/reviews" element={<CustomerLayout><ReviewsPage /></CustomerLayout>} />
                <Route path="/policies" element={<CustomerLayout><PoliciesPage /></CustomerLayout>} />
                <Route path="/contact" element={<CustomerLayout><ContactPage /></CustomerLayout>} />
                <Route path="/login" element={<CustomerLayout><AuthPage mode="login" /></CustomerLayout>} />
                <Route path="/signup" element={<CustomerLayout><AuthPage mode="signup" /></CustomerLayout>} />

                {/* Catch-all fallback to Home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </StoreProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
