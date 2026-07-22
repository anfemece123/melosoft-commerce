import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ShoppingBag } from 'lucide-react';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { StorefrontBackButton } from '@/components/public/storefront/StorefrontBackButton';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { useCart } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useEffect, useState, type MouseEvent } from 'react';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import { CartItemsList } from '@/components/public/cart/CartItemsList';
import { CartEmptyState } from '@/components/public/cart/CartEmptyState';
import { CheckoutPaymentSelector } from '@/components/public/cart/CheckoutPaymentSelector';
import { formatCurrency } from '@/utils/formatCurrency';
import { canUseWebOrders, type PublicCommerceConfig } from '@/lib/commerce/commerceConfig.utils';
import { CartRecommendationsSection } from '@/components/public/cart/CartRecommendationsSection';
import { getActivePrice } from '@/lib/pricing/pricing.utils';
import type { PublicProductPage } from '@/types/common.types';
import { notify } from '@/lib/notifications';
import { hasShippingRuleConfigured } from '@/lib/commerce/shippingRules';
import { getFulfillmentMethodLabel } from '@/lib/orders/fulfillmentLabels';
import { useResolvedStoreSlug } from '@/lib/storefront/storefrontDomainContext';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { OrderingStatusNotice } from '@/components/public/cart/OrderingStatusNotice';

export function StoreCartPage() {
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const storeSlug = useResolvedStoreSlug(routeStoreSlug);
  const navigate = useNavigate();
  const { branding } = usePublicStoreBranding();
  const { items, totalItems, totalPrice, updateQuantity, removeItem, addItem } = useCart();
  const { selectedLocation, orderStatus, scheduleLoading } = useSelectedLocation();
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());

  if (!storeSlug || !branding) return null;
  const currentBranding = branding;

  const theme = buildStorefrontTheme({
    mode: currentBranding.themeMode,
    primaryColor: currentBranding.primaryColor,
    secondaryColor: currentBranding.secondaryColor,
    accentColor: currentBranding.accentColor,
    backgroundColor: currentBranding.backgroundColor,
    textColor: currentBranding.textColor,
    buttonRadius: currentBranding.buttonRadius,
  });

  const commerceConfig: PublicCommerceConfig = {
    catalogType: currentBranding.catalogType,
    commerceMode: currentBranding.commerceMode,
    allowsPickup: currentBranding.allowsPickup,
    allowsLocalDelivery: currentBranding.allowsLocalDelivery,
    allowsNationalShipping: currentBranding.allowsNationalShipping,
    whatsappCheckoutEnabled: currentBranding.whatsappCheckoutEnabled,
    webOrderEnabled: currentBranding.webOrderEnabled,
    cashOnDeliveryEnabled: currentBranding.cashOnDeliveryEnabled,
    onlineCheckoutEnabled: currentBranding.onlineCheckoutEnabled,
    localDeliveryNotes: currentBranding.localDeliveryNotes,
    shippingNotes: currentBranding.shippingNotes,
  };
  const showCartButton = canUseWebOrders(commerceConfig);
  const showCod = currentBranding.cashOnDeliveryEnabled !== false;
  const showOnline = currentBranding.onlineCheckoutEnabled === true;
  const showPaymentChoice = showCod && showOnline;
  const showShippingRules = hasShippingRuleConfigured({
    localDeliveryBaseFee: currentBranding.localDeliveryBaseFee,
    localDeliveryFreeFrom: currentBranding.localDeliveryFreeFrom,
    nationalShippingBaseFee: currentBranding.nationalShippingBaseFee,
    nationalShippingFreeFrom: currentBranding.nationalShippingFreeFrom,
  });

  useEffect(() => {
    if (!currentBranding.storeId || !selectedLocation) {
      setUnavailableIds(new Set());
      return;
    }
    productAvailabilityService
      .getUnavailableProductIds(currentBranding.storeId, selectedLocation.locationId)
      .then((ids) => setUnavailableIds(ids))
      .catch(() => setUnavailableIds(new Set()));
  }, [currentBranding.storeId, selectedLocation]);

  function handleAddRecommendedProduct(event: MouseEvent<HTMLElement>, product: PublicProductPage) {
    event.preventDefault();
    event.stopPropagation();
    const added = addItem({
      productId: product.productId,
      storeId: currentBranding.storeId,
      productSlug: product.productSlug,
      productName: product.productName,
      productType: product.productType,
      imageUrl: product.mainImageUrl,
      unitPrice: getActivePrice(product.regularPrice, product.salePrice),
      customizationNotes: null,
      customizations: [],
      stock: product.stock,
      trackInventory: product.trackInventory,
      isAvailable: product.isAvailable,
    });
    if (!added) {
      notify.warning(
        product.productType === 'menu_item'
          ? `"${product.productName}" está agotado por el momento.`
          : `"${product.productName}" no tiene stock disponible.`
      );
      return;
    }
    notify.cartSuccess(`"${product.productName}" agregado al pedido`);
  }

  const unavailableItems = items.filter((item) => unavailableIds.has(item.productId));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
      <StorefrontBackButton
        storeSlug={storeSlug}
        className="mb-6"
        color={theme.text}
        label="Seguir comprando"
        fallbackPath={buildStorefrontPath(storeSlug, '/catalog')}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.mutedText }}>
              Carrito
            </p>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: theme.text }}>
              Tu pedido
            </h1>
            <p className="text-sm" style={{ color: theme.mutedText }}>
              Revisa productos, cantidades y prepara el pedido antes de continuar.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[2rem] border p-8" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
              <CartEmptyState />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: theme.border }}>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" style={{ color: theme.primary }} />
                  <p className="font-semibold" style={{ color: theme.text }}>
                    {totalItems} producto{totalItems !== 1 ? 's' : ''} en el carrito
                  </p>
                </div>
                <Link to={buildStorefrontPath(storeSlug, '/catalog')} className="text-sm font-medium" style={{ color: theme.primary }}>
                  Agregar más
                </Link>
              </div>
              <CartItemsList items={items} theme={theme} currency={currentBranding.currency} onUpdateQuantity={updateQuantity} onRemove={removeItem} />
            </div>
          )}

          {items.length > 0 && (
            <CartRecommendationsSection
              theme={theme}
              storeSlug={storeSlug}
              currency={currentBranding.currency}
              isMenu={currentBranding.catalogType === 'menu'}
              excludedProductIds={items.map((item) => item.productId)}
              unavailableProductIds={unavailableIds}
              showCartButton={showCartButton}
              onAddToCart={handleAddRecommendedProduct}
            />
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[2rem] border p-5" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>
              Resumen del pedido
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span style={{ color: theme.mutedText }}>Productos</span>
              <span style={{ color: theme.text }}>{totalItems}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: theme.border }}>
              <span className="text-sm font-semibold" style={{ color: theme.text }}>Total estimado</span>
              <span className="text-2xl font-bold" style={{ color: theme.primary }}>
                {formatCurrency(totalPrice, 'es-CO', currentBranding.currency)}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {(showCod || showOnline) ? (
                <CheckoutPaymentSelector
                  theme={theme}
                  showPaymentChoice={showPaymentChoice}
                  showOnline={showOnline}
                  paymentChoice={showOnline && !showCod ? 'online' : 'cash_on_delivery'}
                  onChange={() => undefined}
                />
              ) : (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium"
                  style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b1a', color: '#b45309' }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Esta tienda no tiene métodos de pedido web activos en este momento.
                </div>
              )}

              {selectedLocation && (
                <div className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: `${theme.primary}12`, color: theme.text }}>
                  <p className="font-medium">Sede seleccionada</p>
                  <p className="mt-0.5 text-xs" style={{ color: theme.mutedText }}>
                    {selectedLocation.name}{selectedLocation.city ? ` · ${selectedLocation.city}` : ''}
                  </p>
                </div>
              )}

              {showShippingRules && (
                <div className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: theme.surfaceAlt, color: theme.text }}>
                  <p className="font-medium">Condiciones de envío</p>
                  {currentBranding.allowsLocalDelivery && (
                    <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>
                      {getFulfillmentMethodLabel('local_delivery', { city: selectedLocation?.city })}:
                      {` ${currentBranding.localDeliveryBaseFee && currentBranding.localDeliveryBaseFee > 0
                        ? formatCurrency(currentBranding.localDeliveryBaseFee, 'es-CO', currentBranding.currency)
                        : 'Gratis'}`}
                      {currentBranding.localDeliveryFreeFrom
                        ? ` · gratis desde ${formatCurrency(currentBranding.localDeliveryFreeFrom, 'es-CO', currentBranding.currency)}`
                        : ''}
                    </p>
                  )}
                  {currentBranding.allowsNationalShipping && (
                    <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>
                      {getFulfillmentMethodLabel('national_shipping')}:
                      {` ${currentBranding.nationalShippingBaseFee && currentBranding.nationalShippingBaseFee > 0
                        ? formatCurrency(currentBranding.nationalShippingBaseFee, 'es-CO', currentBranding.currency)
                        : 'Gratis'}`}
                      {currentBranding.nationalShippingFreeFrom
                        ? ` · gratis desde ${formatCurrency(currentBranding.nationalShippingFreeFrom, 'es-CO', currentBranding.currency)}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              {unavailableItems.length > 0 && (
                <div
                  className="rounded-2xl border px-4 py-3 text-sm"
                  style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b1a', color: '#b45309' }}
                >
                  Hay productos que no están disponibles en esta sede. Revísalos antes de continuar.
                </div>
              )}

              <OrderingStatusNotice theme={theme} />

              <button
                type="button"
                onClick={() => void navigate(buildStorefrontPath(storeSlug, '/checkout'))}
                disabled={items.length === 0 || unavailableItems.length > 0 || !(showCod || showOnline) || scheduleLoading || orderStatus?.isAcceptingOrders !== true}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: theme.primary }}
              >
                Continuar con el pedido
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
