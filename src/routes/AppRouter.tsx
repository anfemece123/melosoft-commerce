import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PlatformAdminRoute } from './PlatformAdminRoute';
import { StoreAccessRoute } from './StoreAccessRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { SetPasswordPage } from '@/pages/auth/SetPasswordPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { StoresPage } from '@/pages/admin/StoresPage';
import { StoreFormPage } from '@/pages/admin/StoreFormPage';
import { StoreDetailPage } from '@/pages/admin/StoreDetailPage';
import { StoreSettingsPage } from '@/pages/admin/StoreSettingsPage';
import { ProductsPage } from '@/pages/admin/ProductsPage';
import { ProductFormPage } from '@/pages/admin/ProductFormPage';
import { OffersPage } from '@/pages/admin/OffersPage';
import { OfferFormPage } from '@/pages/admin/OfferFormPage';
import { LocationsPage } from '@/pages/admin/LocationsPage';
import { OrdersPage } from '@/pages/admin/OrdersPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { StoreHomePage } from '@/pages/public/StoreHomePage';
import { ProductLandingPage } from '@/pages/public/ProductLandingPage';
import { OfferLandingPage } from '@/pages/public/OfferLandingPage';
import { StorePoliciesPage } from '@/pages/public/StorePoliciesPage';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />

        {/* Protected admin — requires login */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            {/* Dashboard: all authenticated users */}
            <Route path="/admin" element={<DashboardPage />} />

            {/* Stores list + create: platform_admin only */}
            <Route element={<PlatformAdminRoute />}>
              <Route path="/admin/stores" element={<StoresPage />} />
              <Route path="/admin/stores/new" element={<StoreFormPage />} />
            </Route>

            {/* Per-store routes: any member of the store (or platform_admin) */}
            <Route element={<StoreAccessRoute />}>
              <Route path="/admin/stores/:storeId" element={<StoreDetailPage />} />
              <Route path="/admin/stores/:storeId/settings" element={<StoreSettingsPage />} />
              <Route path="/admin/stores/:storeId/locations" element={<LocationsPage />} />
              <Route path="/admin/stores/:storeId/products" element={<ProductsPage />} />
              <Route path="/admin/stores/:storeId/products/new" element={<ProductFormPage />} />
              <Route
                path="/admin/stores/:storeId/products/:productId/edit"
                element={<ProductFormPage />}
              />
              <Route path="/admin/stores/:storeId/offers" element={<OffersPage />} />
              <Route path="/admin/stores/:storeId/offers/new" element={<OfferFormPage />} />
              <Route
                path="/admin/stores/:storeId/offers/:offerId/edit"
                element={<OfferFormPage />}
              />
              <Route path="/admin/stores/:storeId/orders" element={<OrdersPage />} />
              <Route path="/admin/stores/:storeId/payments" element={<PaymentsPage />} />
            </Route>
          </Route>
        </Route>

        {/* Public store pages */}
        <Route element={<PublicLayout />}>
          <Route path="/s/:storeSlug" element={<StoreHomePage />} />
          <Route path="/s/:storeSlug/p/:productSlug" element={<ProductLandingPage />} />
          <Route path="/s/:storeSlug/o/:offerSlug" element={<OfferLandingPage />} />
          <Route path="/s/:storeSlug/policies" element={<StorePoliciesPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
