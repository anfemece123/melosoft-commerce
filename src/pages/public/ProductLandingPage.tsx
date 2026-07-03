import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Clock, AlertCircle, Lock, ShoppingBag } from 'lucide-react';
import { getProductIcon } from '@/features/products/productDescriptionIcons';
import { StorefrontActionButton } from '@/components/public/storefront/StorefrontActionButton';
import { StorefrontBackButton } from '@/components/public/storefront/StorefrontBackButton';
import { StorefrontBreadcrumbs } from '@/components/public/storefront/StorefrontBreadcrumbs';
import { StorefrontProductCustomizer } from '@/components/public/storefront/StorefrontProductCustomizer';
import { StorefrontPurchaseDialog } from '@/components/public/storefront/StorefrontPurchaseDialog';
import { StorefrontProductDetailSkeleton } from '@/components/public/storefront/StorefrontSkeletons';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { useCart, isOutOfStock } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useLocationChangeWithCheck } from '@/lib/locations/useLocationChangeWithCheck';
import { LocationConflictModal } from '@/components/public/locations/LocationConflictModal';
import { productOptionsService } from '@/features/products/productOptionsService';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import { productsService } from '@/features/products/productsService';
import { categoriesService } from '@/features/categories/categoriesService';
import type { PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import { notify } from '@/lib/notifications';
import {
  buildCustomizationSummaryLines,
  buildInitialProductOptionSelections,
  calculateCustomizationTotal,
  toggleProductOptionSelection,
  type ProductOptionSelections,
  validateProductOptionSelections,
} from '@/lib/products/productOptions.utils';
import { formatCurrency } from '@/utils/formatCurrency';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { StorefrontImageGallery } from '@/components/public/storefront/StorefrontImageGallery';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import {
  hasActiveDiscount,
  getActivePrice,
  calculateDiscountPercentage,
  calculateDiscountAmount,
} from '@/lib/pricing/pricing.utils';
import {
  getProductPageCtaConfig,
  canUseWebOrders,
  type PublicCommerceConfig,
} from '@/lib/commerce/commerceConfig.utils';
import { readPublicPageCache, writePublicPageCache } from '@/lib/storefront/publicPageCache';

interface ProductPageCachePayload {
  product: PublicProductPage | null;
}

// Normalizes a cached product to guarantee fields added after the cache was written
// are always arrays/non-null (avoids crashes when old sessionStorage entries are read).
function normalizePublicProduct(p: PublicProductPage | null): PublicProductPage | null {
  if (!p) return null;
  return {
    ...p,
    descriptionSections: Array.isArray(p.descriptionSections) ? p.descriptionSections : [],
    collections: Array.isArray(p.collections) ? p.collections : [],
    facetValues: Array.isArray(p.facetValues) ? p.facetValues : [],
    images: Array.isArray(p.images) ? p.images : [],
    optionGroups: Array.isArray(p.optionGroups) ? p.optionGroups : [],
  };
}

export function ProductLandingPage() {
  const { storeSlug, productSlug } = useParams<{ storeSlug: string; productSlug: string }>();
  if (!storeSlug || !productSlug) return null;
  return <ProductLandingContent storeSlug={storeSlug} productSlug={productSlug} />;
}

function ProductLandingContent({ storeSlug, productSlug }: { storeSlug: string; productSlug: string }) {
  const { branding: storeBranding } = usePublicStoreBranding();
  const { setRouteReady } = usePublicRouteReady();
  const { addItem } = useCart();
  const { selectedLocation, locations } = useSelectedLocation();
  const cachedPayload = readPublicPageCache<ProductPageCachePayload>(`product:${storeSlug}:${productSlug}`);
  const { requestLocationChange, confirmLocationChange, cancelLocationChange, pendingChange } =
    useLocationChangeWithCheck();
  const [product, setProduct] = useState<PublicProductPage | null>(
    normalizePublicProduct(cachedPayload?.product ?? null)
  );
  const [selections, setSelections] = useState<ProductOptionSelections>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [loading, setLoading] = useState(!cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const [isUnavailableInLocation, setIsUnavailableInLocation] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);

  // Only used to resolve the parent category's name/slug for the breadcrumb
  // (the product page itself only carries categoryParentId, not its name).
  useEffect(() => {
    let cancelled = false;
    categoriesService.getPublicCategories(storeSlug)
      .then((cats) => { if (!cancelled) setCategories(cats); })
      .catch(() => { /* breadcrumb parent level is optional */ });
    return () => { cancelled = true; };
  }, [storeSlug]);

  useEffect(() => {
    async function load() {
      try {
        const data = await productsService.getPublicProductBySlug(storeSlug, productSlug);
        if (!data) {
          setProduct(null);
          return;
        }
        const optionGroups = await productOptionsService.getPublicProductOptionGroups(data.productId);
        const payload = normalizePublicProduct({ ...data, optionGroups }) as PublicProductPage;
        setProduct(payload);
        writePublicPageCache(`product:${storeSlug}:${productSlug}`, { product: payload } satisfies ProductPageCachePayload);
        setSelections(buildInitialProductOptionSelections(optionGroups));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando producto');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [storeSlug, productSlug]);

  useEffect(() => {
    setRouteReady(!loading);
  }, [loading, setRouteReady]);

  useEffect(() => {
    if (!product || !selectedLocation || locations.length <= 1) {
      setIsUnavailableInLocation(false);
      setAvailabilityMap({});
      return;
    }
    productAvailabilityService.getProductAvailability(product.productId)
      .then(map => {
        setAvailabilityMap(map);
        setIsUnavailableInLocation(map[selectedLocation.locationId] === false);
      })
      .catch(() => {
        setAvailabilityMap({});
        setIsUnavailableInLocation(false);
      });
  }, [product, selectedLocation, locations.length]);

  if (loading) {
    return <StorefrontProductDetailSkeleton branding={storeBranding} storeSlug={storeSlug} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{error}</p>
          <Link to={`/s/${storeSlug}`} className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Producto no encontrado</h1>
          <Link to={`/s/${storeSlug}`} className="text-sm text-indigo-600 hover:underline">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const bgColor = product.backgroundColor ?? '#ffffff';
  const currentProduct = product;
  const outOfStock = isOutOfStock(currentProduct);
  const theme = buildStorefrontTheme({
    mode: currentProduct.themeMode,
    primaryColor: currentProduct.primaryColor,
    secondaryColor: currentProduct.secondaryColor,
    accentColor: currentProduct.accentColor,
    backgroundColor: currentProduct.backgroundColor,
    textColor: currentProduct.textColor,
    buttonRadius: currentProduct.buttonRadius,
  });
  const textColor = theme.text;
  const primaryColor = theme.primary;

  const isMenu = currentProduct.productType === 'menu_item';
  const whatsappNumber = (currentProduct.storeWhatsappNumber ?? '').replace(/\D/g, '');

  const commerceConfig: PublicCommerceConfig = {
    catalogType: currentProduct.catalogType,
    commerceMode: currentProduct.commerceMode,
    allowsPickup: null,
    allowsLocalDelivery: null,
    allowsNationalShipping: null,
    whatsappCheckoutEnabled: currentProduct.whatsappCheckoutEnabled,
    webOrderEnabled: currentProduct.webOrderEnabled,
    cashOnDeliveryEnabled: null, // Not exposed in public_product_pages view
    onlineCheckoutEnabled: null, // Reserved for Wompi (Fase 7)
    localDeliveryNotes: null,
    shippingNotes: null,
  };

  const ctaConfig = getProductPageCtaConfig(commerceConfig, !!whatsappNumber);
  const isWebOrderMode = canUseWebOrders(commerceConfig);

  const activePrice = getActivePrice(currentProduct.regularPrice, currentProduct.salePrice);
  const customizationTotal = calculateCustomizationTotal(currentProduct.optionGroups, selections);
  const finalPrice = activePrice + customizationTotal;
  const primaryCategory = currentProduct.categoryName && currentProduct.categorySlug
    ? { name: currentProduct.categoryName, slug: currentProduct.categorySlug }
    : null;
  const parentCategory = currentProduct.categoryParentId
    ? categories.find((c) => c.id === currentProduct.categoryParentId) ?? null
    : null;
  const catalogLabel = product.productType === 'menu_item' ? 'Menú' : 'Catálogo';

  function validateBeforeCheckout() {
    const errors = validateProductOptionSelections(currentProduct.optionGroups, selections);
    if (errors.length > 0) {
      notify.error(errors[0]);
      return false;
    }
    return true;
  }

  function handleWhatsAppAction() {
    if (!validateBeforeCheckout()) return;
    if (currentProduct.allowsSpecialInstructions) {
      setPurchaseDialogOpen(true);
      return;
    }
    sendWhatsAppOrder();
  }

  function handleAddToCartAction() {
    if (!validateBeforeCheckout()) return;
    commitAddToCart();
  }

  function sendWhatsAppOrder() {
    if (!whatsappNumber) return;
    const summaryLines = buildCustomizationSummaryLines(currentProduct.optionGroups, selections, specialInstructions);
    const lines = [
      `Hola, quiero pedir: ${currentProduct.productName}`,
      `Total estimado: ${formatCurrency(finalPrice, 'es-CO', 'COP')}`,
      ...summaryLines,
    ];
    const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
    setPurchaseDialogOpen(false);
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function commitAddToCart() {
    const summaryLines = buildCustomizationSummaryLines(currentProduct.optionGroups, selections, '');
    const notes = summaryLines.length > 0 ? summaryLines.join(', ') : null;
    const added = addItem({
      productId: currentProduct.productId,
      storeId: storeBranding?.storeId ?? '',
      productSlug: currentProduct.productSlug,
      productName: currentProduct.productName,
      imageUrl: currentProduct.images[0]?.imageUrl ?? null,
      unitPrice: finalPrice,
      customizationNotes: notes,
      stock: currentProduct.stock,
      trackInventory: currentProduct.trackInventory,
      isAvailable: currentProduct.isAvailable,
    });
    if (!added) {
      notify.warning(`"${currentProduct.productName}" no tiene stock disponible.`);
      return;
    }
    setPurchaseDialogOpen(false);
    setSpecialInstructions('');
    notify.cartSuccess(`"${currentProduct.productName}" agregado al pedido`);
  }

  return (
    <div style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh' }}>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <StorefrontBreadcrumbs
          theme={theme}
          className="mb-4"
          items={[
            { label: 'Inicio', href: `/s/${storeSlug}` },
            { label: catalogLabel, href: `/s/${storeSlug}/catalog` },
            ...(parentCategory
              ? [
                  { label: parentCategory.name, href: `/s/${storeSlug}/catalog?cat=${encodeURIComponent(parentCategory.slug)}` },
                  ...(primaryCategory
                    ? [{
                        label: primaryCategory.name,
                        href: `/s/${storeSlug}/catalog?cat=${encodeURIComponent(parentCategory.slug)}&sub=${encodeURIComponent(primaryCategory.slug)}`,
                      }]
                    : []),
                ]
              : primaryCategory
              ? [{ label: primaryCategory.name, href: `/s/${storeSlug}/catalog?cat=${encodeURIComponent(primaryCategory.slug)}` }]
              : []),
            { label: product.productName },
          ]}
        />
        <StorefrontBackButton
          storeSlug={storeSlug}
          className="mb-6"
          color={textColor}
          label="Volver al catálogo"
          fallbackPath={`/s/${storeSlug}/catalog`}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Image */}
          <StorefrontImageGallery
            images={product.images}
            productName={product.productName}
            isMenu={isMenu}
            theme={theme}
            mode="detail"
          />

          {/* Info */}
          <div className="space-y-4">
            {primaryCategory && (
              <span className="text-sm font-medium" style={{ color: primaryColor }}>
                {primaryCategory.name}
              </span>
            )}

            <h1 className="text-2xl font-bold" style={{ color: textColor }}>
              {product.productName}
            </h1>

            {/* Price */}
            {hasActiveDiscount(product.regularPrice, product.salePrice) ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(product.salePrice!, 'es-CO', 'COP')}
                  </span>
                  <DiscountBadge
                    percentage={calculateDiscountPercentage(
                      product.regularPrice,
                      product.salePrice!
                    )}
                    size="md"
                  />
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 line-through">
                    {formatCurrency(product.regularPrice, 'es-CO', 'COP')}
                  </span>
                  <span className="text-green-600 font-medium">
                    Ahorras{' '}
                    {formatCurrency(
                      calculateDiscountAmount(product.regularPrice, product.salePrice!),
                      'es-CO',
                      'COP'
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                {formatCurrency(product.regularPrice, 'es-CO', 'COP')}
              </span>
            )}

            {/* Menu: prep time */}
            {isMenu && product.preparationTimeMinutes && (
              <div
                className="flex items-center gap-1.5 text-sm"
                style={{ color: textColor, opacity: 0.6 }}
              >
                <Clock className="w-4 h-4" />
                Tiempo de preparación: {product.preparationTimeMinutes} min
              </div>
            )}

            {/* Physical: stock warning */}
            {!isMenu && product.stock <= 0 && (
              <p className="text-sm text-red-500 font-medium">Sin stock disponible</p>
            )}
            {!isMenu && product.stock > 0 && product.stock <= 5 && (
              <p className="text-sm text-amber-500">Últimas {product.stock} unidades</p>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-sm leading-relaxed" style={{ color: textColor, opacity: 0.8 }}>
                {product.description}
              </p>
            )}

            {/* Advanced description sections */}
            {(product.descriptionSections ?? []).filter((s) => s?.isVisible !== false).length > 0 && (
              <div className="space-y-4 pt-1">
                {(product.descriptionSections ?? [])
                  .filter((s) => s?.isVisible !== false)
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((section) => (
                    <div key={section.id} className="rounded-xl border p-4" style={{ borderColor: `${textColor}18` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ color: primaryColor }}>
                          {getProductIcon(section.icon, { className: 'h-4 w-4' })}
                        </span>
                        <h4 className="text-sm font-semibold" style={{ color: textColor }}>
                          {section.title}
                        </h4>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: textColor, opacity: 0.75 }}>
                        {section.content}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {product.optionGroups.length > 0 || product.allowsSpecialInstructions ? (
              <StorefrontProductCustomizer
                theme={theme}
                currency="COP"
                groups={product.optionGroups}
                selections={selections}
                onToggleOption={(group, itemId) => {
                  setSelections((current) => toggleProductOptionSelection(group, current, itemId));
                }}
              />
            ) : null}

            {(product.optionGroups.length > 0 || product.allowsSpecialInstructions) && customizationTotal > 0 ? (
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: `${textColor}10` }}>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: `${textColor}B3` }}>Base</span>
                  <span style={{ color: textColor }}>{formatCurrency(activePrice, 'es-CO', 'COP')}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span style={{ color: `${textColor}B3` }}>Extras seleccionados</span>
                  <span style={{ color: textColor }}>+{formatCurrency(customizationTotal, 'es-CO', 'COP')}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: `${textColor}10` }}>
                  <span className="text-sm font-semibold" style={{ color: textColor }}>Total estimado</span>
                  <span className="text-xl font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(finalPrice, 'es-CO', 'COP')}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Unavailable in selected location */}
            {isUnavailableInLocation && (() => {
              const availableLocations = locations.filter(
                loc => loc.locationId !== selectedLocation?.locationId && (availabilityMap[loc.locationId] ?? true)
              );
              return (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: theme.border, backgroundColor: `${theme.mutedText}0d`, color: theme.mutedText }}
                >
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No disponible en {selectedLocation?.name ?? 'esta sucursal'}</span>
                  </div>
                  {availableLocations.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs mb-1.5">Disponible en:</p>
                      <div className="flex flex-wrap gap-2">
                        {availableLocations.map(loc => (
                          <button
                            key={loc.locationId}
                            type="button"
                            onClick={() => void requestLocationChange(loc)}
                            className="text-xs underline underline-offset-2 hover:opacity-80 transition-opacity"
                            style={{ color: theme.primary }}
                          >
                            {loc.name}{loc.city ? ` · ${loc.city}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Out of stock */}
            {!isUnavailableInLocation && outOfStock && (
              <div
                className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium"
                style={{ borderColor: theme.border, backgroundColor: `${theme.mutedText}0d`, color: theme.mutedText }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                Este producto no tiene stock disponible.
              </div>
            )}

            {/* CTA — web order mode: "Agregar al pedido" */}
            {isWebOrderMode && !isUnavailableInLocation && !outOfStock && (
              <StorefrontActionButton
                as="button"
                type="button"
                onClick={handleAddToCartAction}
                variant="primary"
                theme={theme}
                fullWidth
                className="gap-2 py-3 text-base font-medium"
              >
                <ShoppingBag className="w-5 h-5" />
                Agregar al pedido
              </StorefrontActionButton>
            )}

            {/* CTA — WhatsApp mode */}
            {!isWebOrderMode && ctaConfig.show && ctaConfig.variant === 'whatsapp' && (
              <StorefrontActionButton
                as="button"
                type="button"
                onClick={handleWhatsAppAction}
                variant="whatsapp"
                theme={theme}
                fullWidth
                className="gap-2 py-3 text-base font-medium"
              >
                <MessageCircle className="w-5 h-5" />
                {ctaConfig.label}
              </StorefrontActionButton>
            )}

            {/* Coming soon placeholder */}
            {ctaConfig.show && ctaConfig.isComingSoon && (
              <div
                className="flex items-center justify-center gap-2 w-full rounded-xl border px-4 py-3 text-sm font-medium opacity-60 cursor-not-allowed"
                style={{ borderColor: theme.border, color: theme.mutedText }}
              >
                <Lock className="w-4 h-4" />
                {ctaConfig.label}
              </div>
            )}
          </div>
        </div>

        {/* Short description */}
        {product.shortDescription && (
          <div
            className="mt-10 pt-8 border-t text-sm leading-relaxed"
            style={{ borderColor: `${textColor}11`, color: `${textColor}` , opacity: 0.7 }}
          >
            {product.shortDescription}
          </div>
        )}
      </main>

      {product.allowsSpecialInstructions ? (
        <StorefrontPurchaseDialog
          open={purchaseDialogOpen}
          theme={theme}
          currency="COP"
          title={product.productName}
          totalPrice={finalPrice}
          instructionsLabel={product.specialInstructionsLabel ?? 'Indicaciones para tu pedido'}
          instructionsPlaceholder={product.specialInstructionsPlaceholder ?? 'Ej: sin cebolla, salsa aparte, término medio'}
          instructionsMaxLength={product.specialInstructionsMaxLength}
          instructionsValue={specialInstructions}
          onInstructionsChange={setSpecialInstructions}
          onClose={() => setPurchaseDialogOpen(false)}
          onConfirm={sendWhatsAppOrder}
        />
      ) : null}

      {pendingChange && (
        <LocationConflictModal
          theme={theme}
          targetLocation={pendingChange.location}
          result={pendingChange.result}
          onCancel={cancelLocationChange}
          onConfirm={confirmLocationChange}
        />
      )}
    </div>
  );
}
