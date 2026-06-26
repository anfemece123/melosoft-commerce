import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MessageCircle, Package, UtensilsCrossed, Tag, AlertCircle, Clock, Info, MapPin } from 'lucide-react';
import { storesService } from '@/features/stores/storesService';
import { productsService } from '@/features/products/productsService';
import { offersService } from '@/features/offers/offersService';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import type { PublicStoreHeroSlide, PublicStorePage, PublicProductPage, StoreCampaignOffer } from '@/types/common.types';
import { formatCurrency } from '@/utils/formatCurrency';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { StorefrontActionButton } from '@/components/public/storefront/StorefrontActionButton';
import { StorefrontHero } from '@/components/public/storefront/StorefrontHero';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { StorefrontRatingStars } from '@/components/public/storefront/StorefrontRatingStars';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { useCart } from '@/lib/cart/cartContext';
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

interface StoreHomeCachePayload {
  store: PublicStorePage | null;
  products: PublicProductPage[];
  campaigns: StoreCampaignOffer[];
  heroSlides: PublicStoreHeroSlide[];
}

export function StoreHomePage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
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
          return;
        }

        const [productsData, campaignsData, slides] = await Promise.all([
          productsService.getPublicProductsByStoreSlug(storeSlug),
          offersService.getPublicStoreCampaignOffers(storeSlug),
          storesService.getPublicStoreHeroSlides(storeData.storeId),
        ]);
        setProducts(productsData);
        setCampaigns(campaignsData);
        setHeroSlides(slides);
        writePublicPageCache(cacheKey, {
          store: storeData,
          products: productsData,
          campaigns: campaignsData,
          heroSlides: slides,
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
            <span className="font-mono text-indigo-600">/s/{storeSlug}</span>
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

  function handleAddProductToCart(
    event: MouseEvent<HTMLElement>,
    product: PublicProductPage
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (unavailableProductIds.has(product.productId)) return;

    addItem({
      productId: product.productId,
      productSlug: product.productSlug,
      productName: product.productName,
      imageUrl: product.mainImageUrl,
      unitPrice: getActivePrice(product.regularPrice, product.salePrice),
      customizationNotes: null,
    });

    notify.cartSuccess(`"${product.productName}" agregado al pedido`);
  }

  function persistCurrentScrollPosition() {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    writePublicScrollPosition(routeKey, window.scrollY);
  }

  return (
    <div style={{ backgroundColor: bgColor, color: theme.text, minHeight: '100vh', ...theme.cssVars }}>
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

      {/* Products / Menu section */}
      <section
        id="storefront-catalog"
        className={hasHero ? 'py-12 px-4' : 'px-4 pb-12 pt-8 md:pt-10'}
        style={{ backgroundColor: theme.secondary }}
      >
        <div className="max-w-5xl mx-auto">
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
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((product) => {
                const isUnavailable = unavailableProductIds.has(product.productId);
                return (
                <Link
                  key={product.productId}
                  to={`/s/${storeSlug}/p/${product.productSlug}`}
                  state={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
                  onClick={persistCurrentScrollPosition}
                  className={`flex h-full flex-col overflow-hidden transition-opacity hover:opacity-95 ${isUnavailable ? 'opacity-60' : ''}`}
                >
                  <div className="relative">
                    <StorefrontMediaFrame
                      src={product.mainImageUrl}
                      alt={product.productName}
                      aspectClassName="aspect-square"
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
                          No disponible
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
                      {product.category && (
                        <span className="text-xs font-medium" style={{ color: theme.primary }}>
                          {product.category}
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
                        No disponible en esta sede
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
          )}
        </div>
      </section>

      {/* Campaign offers section */}
      {campaigns.length > 0 && (
        <section id="storefront-offers" className="py-12 px-4" style={{ backgroundColor: bgColor }}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Tag className="w-5 h-5" style={{ color: theme.primary }} />
              <h2 className="text-lg font-bold" style={{ color: theme.text }}>
                Ofertas especiales
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campaigns.map((campaign) => {
                const hasDiscount = campaign.regularPrice > 0 && campaign.offerPrice < campaign.regularPrice;
                const displayImage = campaign.heroImageUrl ?? campaign.productMainImageUrl;
                return (
                  <Link
                    key={campaign.id}
                    to={`/s/${storeSlug}/o/${campaign.offerSlug}`}
                    state={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
                    onClick={persistCurrentScrollPosition}
                    className="rounded-xl overflow-hidden border transition-shadow hover:shadow-md flex gap-4 p-4"
                    style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt }}
                  >
                    {displayImage && (
                      <StorefrontMediaFrame
                        src={displayImage}
                        alt={campaign.title}
                        aspectClassName="h-20 w-20 shrink-0"
                        roundedClassName="rounded-lg"
                        imageClassName="h-full w-full object-cover"
                        pngImageClassName="h-full w-full object-contain p-2 drop-shadow-[0_10px_12px_rgba(0,0,0,0.18)]"
                        fallback={<div className="h-full w-full bg-gray-100" />}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm line-clamp-1" style={{ color: theme.text }}>
                        {campaign.title}
                      </p>
                      {campaign.productName && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: theme.mutedText }}>
                          {campaign.productName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: theme.primary }}>
                          {formatCurrency(campaign.offerPrice, 'es-CO', store.currency)}
                        </span>
                        {hasDiscount && (
                          <>
                            <span className="text-xs line-through" style={{ color: theme.mutedText }}>
                              {formatCurrency(campaign.regularPrice, 'es-CO', store.currency)}
                            </span>
                            <DiscountBadge
                              percentage={calculateDiscountPercentage(
                                campaign.regularPrice,
                                campaign.offerPrice
                              )}
                            />
                          </>
                        )}
                      </div>
                      {campaign.showCountdown && campaign.endsAt && (
                        <p
                          className="text-xs mt-1 flex items-center gap-1"
                          style={{ color: theme.mutedText }}
                        >
                          <Clock className="w-3 h-3" />
                          Oferta por tiempo limitado
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* WhatsApp CTA — only if commerce settings allow WhatsApp orders */}
      {showWhatsappCta && (
        <section className="py-12 px-4" style={{ backgroundColor: bgColor }}>
          <div className="max-w-5xl mx-auto text-center">
            <StorefrontActionButton
              as="a"
              href={whatsappHref!}
              target="_blank"
              rel="noopener noreferrer"
              variant="whatsapp"
              theme={theme}
              className="gap-2 px-6 py-3"
            >
              <MessageCircle className="w-5 h-5" />
              Contáctanos por WhatsApp
            </StorefrontActionButton>
            {store.supportEmail && (
              <p className="text-xs mt-3" style={{ color: theme.mutedText }}>
                {store.supportEmail}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Contact fallback: WhatsApp available but checkout disabled */}
      {!showWhatsappCta && whatsappHref && !canUseWhatsappCheckout(commerceConfig) && (
        <section className="py-10 px-4" style={{ backgroundColor: bgColor }}>
          <div className="max-w-5xl mx-auto text-center">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm underline underline-offset-2"
              style={{ color: theme.mutedText }}
            >
              <MessageCircle className="w-4 h-4" />
              Contáctanos por WhatsApp
            </a>
          </div>
        </section>
      )}

    </div>
  );
}
