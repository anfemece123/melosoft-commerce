import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Package, UtensilsCrossed, AlertCircle, Info, MapPin } from 'lucide-react';
import { storesService } from '@/features/stores/storesService';
import { productsService } from '@/features/products/productsService';
import { offersService } from '@/features/offers/offersService';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import { categoriesService } from '@/features/categories/categoriesService';
import { homeSectionsService } from '@/features/homeSections/homeSectionsService';
import type {
  PublicStoreHeroSlide,
  PublicStorePage,
  PublicProductPage,
  PublicStoreCategory,
  PublicHomeSection,
  StoreCampaignOffer,
} from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { StorefrontActionButton } from '@/components/public/storefront/StorefrontActionButton';
import { StorefrontHero } from '@/components/public/storefront/StorefrontHero';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { StorefrontRatingStars } from '@/components/public/storefront/StorefrontRatingStars';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import { StorefrontCampaignOffersSection } from '@/components/public/storefront/StorefrontCampaignOffersSection';
import { StorefrontWhatsappCtaSection } from '@/components/public/storefront/StorefrontWhatsappCtaSection';
import { HomeSectionRenderer } from '@/components/public/storefront/homeSections/HomeSectionRenderer';
import { buildStorefrontTheme, STOREFRONT_CONTAINER_CLASS } from '@/components/public/storefront/storefrontTheme';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { useCart, isOutOfStock } from '@/lib/cart/cartContext';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { LocationSelector } from '@/components/public/locations/LocationSelector';
import { notify } from '@/lib/notifications';
import {
  hasActiveDiscount,
  getActivePrice,
  calculateDiscountPercentage,
} from '@/lib/pricing/pricing.utils';
import {
  getCatalogLabel,
  getProductCardCtaLabel,
  getNoPurchaseMethodMessage,
  canUseWhatsappCheckout,
  canUseWebOrders,
  type PublicCommerceConfig,
} from '@/lib/commerce/commerceConfig.utils';
import { readPublicPageCache, writePublicPageCache } from '@/lib/storefront/publicPageCache';
import { writePublicScrollPosition } from '@/lib/storefront/publicScrollRestoration';
import { useResolvedStoreSlug } from '@/lib/storefront/storefrontDomainContext';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface StoreHomeCachePayload {
  store: PublicStorePage | null;
  products: PublicProductPage[];
  campaigns: StoreCampaignOffer[];
  heroSlides: PublicStoreHeroSlide[];
  categories: PublicStoreCategory[];
  homeSections: PublicHomeSection[];
}

export function StoreHomePage() {
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const storeSlug = useResolvedStoreSlug(routeStoreSlug);
  if (!storeSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <h1 className="text-xl font-bold text-gray-800">Tienda no encontrada</h1>
      </div>
    );
  }
  return <StoreHomeContent storeSlug={storeSlug} />;
}

function StoreHomeContent({ storeSlug }: { storeSlug: string }) {
  const location = useLocation();
  const { branding: storeBranding } = usePublicStoreBranding();
  const { setRouteReady } = usePublicRouteReady();
  const { addItem } = useCart();
  const { locations, selectedLocation } = useSelectedLocation();
  const cacheKey = `store-home:${storeSlug}`;
  const cachedPayload = useMemo(
    () => readPublicPageCache<StoreHomeCachePayload>(cacheKey),
    [cacheKey],
  );
  const [store, setStore] = useState<PublicStorePage | null>(cachedPayload?.store ?? storeBranding);
  const [products, setProducts] = useState<PublicProductPage[]>(cachedPayload?.products ?? []);
  const [campaigns, setCampaigns] = useState<StoreCampaignOffer[]>(cachedPayload?.campaigns ?? []);
  const [heroSlides, setHeroSlides] = useState<PublicStoreHeroSlide[]>(cachedPayload?.heroSlides ?? []);
  const [categories, setCategories] = useState<PublicStoreCategory[]>(cachedPayload?.categories ?? []);
  const [homeSections, setHomeSections] = useState<PublicHomeSection[]>(cachedPayload?.homeSections ?? []);
  const [storeResolved, setStoreResolved] = useState(Boolean(cachedPayload?.store ?? storeBranding));
  const [contentLoading, setContentLoading] = useState(!cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const [unavailableProductIds, setUnavailableProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (storeBranding) {
      setStore((current) => current ?? storeBranding);
    }
  }, [storeBranding]);

  useEffect(() => {
    async function load() {
      setError(null);
      if (!cachedPayload) {
        setContentLoading(true);
      }
      try {
        const storeData = await storesService.getPublicStoreBySlug(storeSlug);
        setStore(storeData);
        setStoreResolved(true);
        if (!storeData?.storeId) {
          setHeroSlides([]);
          setProducts([]);
          setCampaigns([]);
          setCategories([]);
          setHomeSections([]);
          return;
        }

        const [productsData, campaignsData, slides, categoriesData, homeSectionsData] = await Promise.all([
          productsService.getPublicProductsByStoreSlug(storeSlug),
          offersService.getPublicStoreCampaignOffers(storeSlug),
          storesService.getPublicStoreHeroSlides(storeData.storeId),
          categoriesService.getPublicCategories(storeSlug),
          homeSectionsService.getPublicHomeSections(storeData.storeId),
        ]);
        setProducts(productsData);
        setCampaigns(campaignsData);
        setHeroSlides(slides);
        setCategories(categoriesData);
        setHomeSections(homeSectionsData);
        writePublicPageCache(cacheKey, {
          store: storeData,
          products: productsData,
          campaigns: campaignsData,
          heroSlides: slides,
          categories: categoriesData,
          homeSections: homeSectionsData,
        } satisfies StoreHomeCachePayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando tienda');
      } finally {
        setStoreResolved(true);
        setContentLoading(false);
      }
    }
    void load();
  }, [cacheKey, cachedPayload, storeSlug]);

  useEffect(() => {
    const isReady = !contentLoading;
    setRouteReady(isReady);
  }, [contentLoading, setRouteReady]);

  useEffect(() => {
    if (!store?.storeId || !selectedLocation) {
      setUnavailableProductIds(new Set());
      return;
    }
    const locationId = selectedLocation.locationId;
    const storeId = store.storeId;
    productAvailabilityService.getUnavailableProductIds(storeId, locationId)
      .then(ids => setUnavailableProductIds(ids))
      .catch(() => setUnavailableProductIds(new Set()));
  }, [selectedLocation, store?.storeId]);

  if (!store && !storeResolved) {
    return <StorefrontPageLoader branding={storeBranding} label="Estamos preparando el catálogo de esta empresa." />;
  }

  if (contentLoading) {
    return <StorefrontPageLoader branding={store ?? storeBranding} label="Estamos preparando el catálogo de esta empresa." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-800 mb-1">Ocurrió un error</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Tienda no encontrada</h1>
          <p className="text-gray-500 text-sm">
            No existe ninguna tienda en{' '}
            <span className="font-mono text-indigo-600">{buildStorefrontPath(storeSlug)}</span>
          </p>
        </div>
      </div>
    );
  }

  const bgColor = store.backgroundColor ?? '#ffffff';
  const theme = buildStorefrontTheme({
    mode: store.themeMode,
    primaryColor: store.primaryColor,
    secondaryColor: store.secondaryColor,
    accentColor: store.accentColor,
    backgroundColor: store.backgroundColor,
    textColor: store.textColor,
    buttonRadius: store.buttonRadius,
  });
  const whatsappNumber = store.whatsappNumber;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}`
    : null;

  const commerceConfig: PublicCommerceConfig = {
    catalogType: store.catalogType,
    commerceMode: store.commerceMode,
    allowsPickup: store.allowsPickup,
    allowsLocalDelivery: store.allowsLocalDelivery,
    allowsNationalShipping: store.allowsNationalShipping,
    whatsappCheckoutEnabled: store.whatsappCheckoutEnabled,
    webOrderEnabled: store.webOrderEnabled,
    cashOnDeliveryEnabled: store.cashOnDeliveryEnabled,
    onlineCheckoutEnabled: store.onlineCheckoutEnabled,
    localDeliveryNotes: store.localDeliveryNotes,
    shippingNotes: store.shippingNotes,
  };

  const catalogLabel = getCatalogLabel(commerceConfig);
  const productCardCtaLabel = getProductCardCtaLabel(commerceConfig);
  const noPurchaseMessage = getNoPurchaseMethodMessage(commerceConfig);
  const showWhatsappCta = canUseWhatsappCheckout(commerceConfig) && !canUseWebOrders(commerceConfig) && !!whatsappHref;
  const showCartButton = canUseWebOrders(commerceConfig);

  const isMenu = store.catalogType === 'menu';
  const heroTitle = store.heroTitle?.trim() || store.slogan?.trim() || store.storeName;
  const heroDescription = store.heroSubtitle?.trim() || store.description?.trim() || null;
  const hasHero = store.heroEnabled !== false;
  const resolvedHeroSlides = heroSlides.length > 0
    ? heroSlides
    : [
        {
          id: `${store.storeId}-legacy-hero`,
          storeId: store.storeId,
          sortOrder: 1,
          isActive: true,
          showTitle: true,
          showSubtitle: true,
          showCta: true,
          showMainImage: true,
          showBadgeImage: true,
          title: heroTitle,
          subtitle: heroDescription,
          ctaLabel: store.heroCtaLabel?.trim() || `Ver ${catalogLabel.toLowerCase()}`,
          mainImageUrl: store.heroImageUrl,
          backgroundImageUrl: store.heroBackgroundImageUrl,
          badgeImageUrl: null,
        },
      ];

  // Home Builder sections are ADDED to the base home, never replace it.
  // The base home is: hero/portada (always, from store_hero_slides /
  // StoreSettingsPage — same as before this feature existed) + either the
  // Home Builder's own sections (if the owner configured any) or the
  // legacy hardcoded product grid as a fallback (if they haven't). 'hero'
  // is filtered out defensively — the Home Builder no longer creates that
  // type, and Store Settings already renders it above, unconditionally.
  const dynamicSections = homeSections.filter((s) => s.sectionType !== 'hero');
  const hasDynamicSections = dynamicSections.length > 0;

  function handleAddProductToCart(
    event: MouseEvent<HTMLElement>,
    product: PublicProductPage
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (unavailableProductIds.has(product.productId)) return;

    const added = addItem({
      productId: product.productId,
      storeId: storeBranding?.storeId ?? '',
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

  function persistCurrentScrollPosition() {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    writePublicScrollPosition(routeKey, window.scrollY);
  }

  return (
    <div style={{ backgroundColor: bgColor, color: theme.text, minHeight: '100vh', ...theme.cssVars }}>
      {/* Portada/Hero — always rendered from store_hero_slides / Store
          Settings, independent of the Home Builder. */}
      {hasHero ? (
        <StorefrontHero
          theme={theme}
          storeName={store.storeName}
          storeLogoUrl={store.logoUrl}
          ctaHref="#storefront-catalog"
          fallbackCtaLabel={`Ver ${catalogLabel.toLowerCase()}`}
          slides={resolvedHeroSlides}
        />
      ) : null}

      {hasDynamicSections ? (
        <div id="storefront-catalog">
          {dynamicSections.map((section) => (
            <HomeSectionRenderer
              key={section.id}
              section={section}
              theme={theme}
              storeSlug={storeSlug}
              currency={store.currency}
              isMenu={isMenu}
              showCartButton={showCartButton}
              productCardCtaLabel={productCardCtaLabel}
              products={products}
              categories={categories}
              unavailableProductIds={unavailableProductIds}
              onAddToCart={handleAddProductToCart}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Products / Menu section — legacy fallback shown only when the
              owner hasn't configured any Home Builder section yet. */}
          <section
            id="storefront-catalog"
            className={hasHero ? 'py-12 px-4 sm:px-6 lg:px-8' : 'px-4 pb-12 pt-8 sm:px-6 md:pt-10 lg:px-8'}
            style={{ backgroundColor: theme.secondary }}
          >
            <div className={`${STOREFRONT_CONTAINER_CLASS} mx-auto`}>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {isMenu
                    ? <UtensilsCrossed className="w-5 h-5" style={{ color: theme.primary }} />
                    : <Package className="w-5 h-5" style={{ color: theme.primary }} />}
                  <h2 className="text-lg font-bold" style={{ color: theme.text }}>
                    {catalogLabel}
                  </h2>
                </div>
                {locations.length === 1 && selectedLocation && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: theme.mutedText }}>
                    <MapPin className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                    <span>{selectedLocation.city ?? selectedLocation.name}</span>
                  </div>
                )}
                {locations.length > 1 && <LocationSelector theme={theme} storeId={store.storeId} />}
              </div>

              {/* No purchase method notice */}
              {noPurchaseMessage && (
                <div
                  className="flex items-start gap-2 rounded-xl border px-4 py-3 mb-5 text-sm"
                  style={{ borderColor: theme.border, backgroundColor: `${theme.primary}08`, color: theme.mutedText }}
                >
                  <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: theme.primary }} />
                  <p>{noPurchaseMessage}</p>
                </div>
              )}

              {products.length === 0 ? (
                <div
                  className="text-center py-12 border border-dashed rounded-xl text-sm bg-white"
                  style={{ borderColor: theme.border, color: theme.mutedText }}
                >
                  {isMenu ? 'El menú está vacío por el momento' : 'Aún no hay productos disponibles'}
                </div>
              ) : (() => {
                const displayedProducts = [...products]
                  .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
                  .slice(0, 8);
                return (
                <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {displayedProducts.map((product) => {
                    const outOfStock = isOutOfStock(product);
                    const isUnavailable = unavailableProductIds.has(product.productId) || outOfStock;
                    return (
                    <Link
                      key={product.productId}
                      to={buildStorefrontPath(storeSlug, `/p/${product.productSlug}`)}
                      state={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
                      onClick={persistCurrentScrollPosition}
                      className={`flex h-full flex-col overflow-hidden transition-opacity hover:opacity-95 ${isUnavailable ? 'opacity-60' : ''}`}
                    >
                      <div className="relative">
                        <StorefrontMediaFrame
                          src={product.mainImageUrl}
                          alt={product.productName}
                          aspectClassName="aspect-square"
                          className="bg-transparent"
                          imageClassName="h-full w-full object-cover"
                          fallback={
                            <div className="flex h-full w-full items-center justify-center">
                              {isMenu
                                ? <UtensilsCrossed className="w-8 h-8 text-gray-300" />
                                : <Package className="w-8 h-8 text-gray-300" />}
                            </div>
                          }
                        />
                        {isUnavailable && (
                          <div className="absolute inset-0 flex items-end pb-2 px-2">
                            <span className="text-xs font-medium bg-black/60 text-white rounded-full px-2 py-0.5">
                              {outOfStock && isMenu ? 'Agotado por el momento' : 'No disponible'}
                            </span>
                          </div>
                        )}
                        {!isUnavailable && hasActiveDiscount(product.regularPrice, product.salePrice) ? (
                          <div className="absolute left-3 top-3">
                            <DiscountBadge
                              percentage={calculateDiscountPercentage(
                                product.regularPrice,
                                product.salePrice!
                              )}
                              size="md"
                              className="px-3 py-1.5 text-sm shadow-lg"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-1 flex-col p-3">
                        <div className="min-h-4">
                          {product.categoryName && (
                            <span className="text-xs font-medium" style={{ color: theme.primary }}>
                              {product.categoryName}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 min-h-[2.5rem] text-sm font-semibold leading-5 line-clamp-2" style={{ color: theme.text }}>
                          {product.productName}
                        </p>
                        <div className="min-h-[1rem] -mt-0.5">
                          <StorefrontRatingStars
                            theme={theme}
                            rating={5}
                            count={product.isFeatured ? 24 : 12}
                          />
                        </div>
                        <div className="mt-1.5 min-h-[2rem]">
                          <div className="min-w-0">
                            {hasActiveDiscount(product.regularPrice, product.salePrice) ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-base font-bold" style={{ color: theme.text }}>
                                  {formatCurrency(
                                    getActivePrice(product.regularPrice, product.salePrice),
                                    'es-CO',
                                    store.currency
                                  )}
                                </span>
                                <span className="text-xs line-through" style={{ color: theme.mutedText }}>
                                  {formatCurrency(product.regularPrice, 'es-CO', store.currency)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-base font-bold" style={{ color: theme.text }}>
                                {formatCurrency(product.regularPrice, 'es-CO', store.currency)}
                              </span>
                            )}
                          </div>
                        </div>

                        {isUnavailable ? (
                          <div
                            className="mt-3 h-10 flex items-center justify-center text-xs font-medium rounded-lg border"
                            style={{ borderColor: theme.border, color: theme.mutedText }}
                          >
                            {outOfStock
                              ? (isMenu ? 'Agotado por el momento' : 'Sin stock disponible')
                              : 'No disponible en esta sede'}
                          </div>
                        ) : showCartButton ? (
                          <StorefrontActionButton
                            as="button"
                            type="button"
                            theme={theme}
                            variant="outline"
                            fullWidth
                            className="mt-3 h-10 text-sm font-semibold"
                            onClick={(event) => handleAddProductToCart(event, product)}
                          >
                            {productCardCtaLabel}
                          </StorefrontActionButton>
                        ) : (
                          <StorefrontActionButton
                            as="div"
                            theme={theme}
                            variant="outline"
                            fullWidth
                            className="mt-3 h-10 text-sm font-semibold"
                          >
                            {productCardCtaLabel}
                          </StorefrontActionButton>
                        )}
                      </div>
                    </Link>
                    );
                  })}
                </div>
                {products.length > 8 && (
                  <div className="mt-6 flex justify-center">
                    <Link
                      to={buildStorefrontPath(storeSlug, '/catalog')}
                      className="inline-flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{ borderColor: theme.primary, color: theme.primary }}
                    >
                      Ver todos ({products.length})
                    </Link>
                  </div>
                )}
                </>
                );
              })()}
            </div>
          </section>
        </>
      )}

      <StorefrontCampaignOffersSection
        campaigns={campaigns}
        theme={theme}
        storeSlug={storeSlug}
        currency={store.currency}
      />

      <StorefrontWhatsappCtaSection
        theme={theme}
        whatsappHref={whatsappHref}
        supportEmail={store.supportEmail}
        showPrimaryCta={showWhatsappCta}
        showFallbackLink={!showWhatsappCta && !canUseWhatsappCheckout(commerceConfig)}
      />
    </div>
  );
}
