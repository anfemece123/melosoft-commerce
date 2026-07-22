import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PlatformAdminRoute } from './PlatformAdminRoute';
import { StoreAccessRoute } from './StoreAccessRoute';
import { CustomDomainRoute } from './CustomDomainRoute';
import { PlatformHostRoute } from './PlatformHostRoute';
import { StorefrontDomainProvider } from '@/components/layout/StorefrontDomainProvider';
import { LoginPage } from '@/pages/auth/LoginPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { SetPasswordPage } from '@/pages/auth/SetPasswordPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { StoresPage } from '@/pages/admin/StoresPage';
import { StoreFormPage } from '@/pages/admin/StoreFormPage';
import { StoreDetailPage } from '@/pages/admin/StoreDetailPage';
import { StoreSettingsPage } from '@/pages/admin/StoreSettingsPage';
import { HomeBuilderPage } from '@/pages/admin/HomeBuilderPage';
import { ProductsPage } from '@/pages/admin/ProductsPage';
import { ProductFormPage } from '@/pages/admin/ProductFormPage';
import { OffersPage } from '@/pages/admin/OffersPage';
import { OfferFormPage } from '@/pages/admin/OfferFormPage';
import { LocationsPage } from '@/pages/admin/LocationsPage';
import { ProductsLayout } from '@/pages/admin/products/ProductsLayout';
import { ProductCategoriesPage } from '@/pages/admin/products/ProductCategoriesPage';
import { ProductCollectionsPage } from '@/pages/admin/products/ProductCollectionsPage';
import { ProductFiltersPage } from '@/pages/admin/products/ProductFiltersPage';
import { OrdersPage } from '@/pages/admin/OrdersPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { WhatsappSettingsPage } from '@/pages/admin/WhatsappSettingsPage';
import { PlatformWhatsappConnectionsPage } from '@/pages/admin/PlatformWhatsappConnectionsPage';
import { MyStoresPage } from '@/pages/admin/MyStoresPage';
import { StoreHomePage } from '@/pages/public/StoreHomePage';
import { StoreCatalogPage } from '@/pages/public/StoreCatalogPage';
import { StoreCartPage } from '@/pages/public/StoreCartPage';
import { StoreCheckoutPage } from '@/pages/public/StoreCheckoutPage';
import { ProductLandingPage } from '@/pages/public/ProductLandingPage';
import { OfferLandingPage } from '@/pages/public/OfferLandingPage';
import { StorePoliciesPage } from '@/pages/public/StorePoliciesPage';
import { PaymentResultPage } from '@/pages/public/PaymentResultPage';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <StorefrontDomainProvider>
        <Routes>
        {/* Every admin/auth route — login, auth callbacks, and the whole
            /admin tree — is gated by PlatformHostRoute first: none of it
            may render from a storefront (subdomain or custom domain),
            only from the panel's own host or localhost. */}
        <Route element={<PlatformHostRoute />}>
          {/* Public auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />

          {/* Protected admin — requires login */}
          <Route element={<ProtectedRoute />}>
            {/* Multi-store selection — own page, outside AdminLayout */}
            <Route path="/admin/my-stores" element={<MyStoresPage />} />

            <Route element={<AdminLayout />}>
              {/* Dashboard: all authenticated users */}
              <Route path="/admin" element={<DashboardPage />} />

              {/* Stores list + create: platform_admin only */}
              <Route element={<PlatformAdminRoute />}>
                <Route path="/admin/stores" element={<StoresPage />} />
                <Route path="/admin/stores/new" element={<StoreFormPage />} />
                <Route path="/admin/whatsapp-connections" element={<PlatformWhatsappConnectionsPage />} />
              </Route>

              {/* Per-store routes: any member of the store (or platform_admin) */}
              <Route element={<StoreAccessRoute />}>
                <Route path="/admin/stores/:storeId" element={<StoreDetailPage />} />
                <Route path="/admin/stores/:storeId/settings" element={<StoreSettingsPage />} />
                <Route path="/admin/stores/:storeId/home-builder" element={<HomeBuilderPage />} />
                <Route path="/admin/stores/:storeId/locations" element={<LocationsPage />} />
                <Route path="/admin/stores/:storeId/products" element={<ProductsLayout />}>
                  <Route index element={<ProductsPage />} />
                  <Route path="categories" element={<ProductCategoriesPage />} />
                  <Route path="collections" element={<ProductCollectionsPage />} />
                  <Route path="filters" element={<ProductFiltersPage />} />
                </Route>
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
                <Route path="/admin/stores/:storeId/whatsapp" element={<WhatsappSettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* Public store pages */}
        <Route element={<PublicLayout />}>
          <Route path="/s/:storeSlug" element={<StoreHomePage />} />
          <Route path="/s/:storeSlug/catalog" element={<StoreCatalogPage />} />
          <Route path="/s/:storeSlug/cart" element={<StoreCartPage />} />
          <Route path="/s/:storeSlug/checkout" element={<StoreCheckoutPage />} />
          <Route path="/s/:storeSlug/p/:productSlug" element={<ProductLandingPage />} />
          <Route path="/s/:storeSlug/o/:offerSlug" element={<OfferLandingPage />} />
          <Route path="/s/:storeSlug/policies" element={<StorePoliciesPage />} />
          <Route path="/s/:storeSlug/payment-result" element={<PaymentResultPage />} />

          <Route element={<CustomDomainRoute />}>
            <Route path="/" element={<StoreHomePage />} />
            <Route path="/catalog" element={<StoreCatalogPage />} />
            <Route path="/cart" element={<StoreCartPage />} />
            <Route path="/checkout" element={<StoreCheckoutPage />} />
            <Route path="/p/:productSlug" element={<ProductLandingPage />} />
            <Route path="/o/:offerSlug" element={<OfferLandingPage />} />
            <Route path="/policies" element={<StorePoliciesPage />} />
            <Route path="/payment-result" element={<PaymentResultPage />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </StorefrontDomainProvider>
    </BrowserRouter>
  );
}
