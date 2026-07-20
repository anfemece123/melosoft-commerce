import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MessageCircle, AlertCircle, Lock, ShoppingBag, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { getProductIcon } from '@/features/products/productDescriptionIcons';
import { StorefrontActionButton } from '@/components/public/storefront/StorefrontActionButton';
import { StorefrontBackButton } from '@/components/public/storefront/StorefrontBackButton';
import { StorefrontBreadcrumbs } from '@/components/public/storefront/StorefrontBreadcrumbs';
import { StorefrontProductCustomizer } from '@/components/public/storefront/StorefrontProductCustomizer';
import { StorefrontPurchaseDialog } from '@/components/public/storefront/StorefrontPurchaseDialog';
import { StorefrontSizeChartDialog } from '@/components/public/storefront/StorefrontSizeChartDialog';
import { StorefrontProductDetailSkeleton } from '@/components/public/storefront/StorefrontSkeletons';
import { StorefrontProductCard } from '@/components/public/storefront/StorefrontProductCard';
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
  buildCustomizationPricedLines,
  buildCustomizationSummaryLines,
  buildInitialProductOptionSelections,
  buildSelectedProductOptions,
  calculateCustomizationTotal,
  toggleProductOptionSelection,
  type ProductOptionSelections,
  validateProductOptionSelections,
} from '@/lib/products/productOptions.utils';
import { formatCurrency } from '@/utils/formatCurrency';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { ProductImageZoom } from '@/components/public/storefront/ProductImageZoom';
import { buildStorefrontTheme, withAlpha, STOREFRONT_CONTAINER_CLASS } from '@/components/public/storefront/storefrontTheme';
import {
  hasActiveDiscount,
  getActivePrice,
  calculateDiscountPercentage,
  calculateDiscountAmount,
} from '@/lib/pricing/pricing.utils';
import {
  resolveInitialVariantSelection,
  findVariantByOptionValueIds,
  resolveVariantPrice,
  getVariantPriceRange,
  isVariantAvailable,
  isProductFullyOutOfStock,
  buildVariantLabel,
  resolveVariantGalleryImages,
  isOptionValueSelectable,
} from '@/lib/products/productVariants.utils';
import type { PublicProductVariant } from '@/types/common.types';
import {
  getProductPageCtaConfig,
  canUseWebOrders,
  type PublicCommerceConfig,
} from '@/lib/commerce/commerceConfig.utils';
import { readPublicPageCache, writePublicPageCache } from '@/lib/storefront/publicPageCache';
import { buildCatalogItems } from '@/lib/storefront/catalogItems';
import { useResolvedStoreSlug } from '@/lib/storefront/storefrontDomainContext';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface ProductPageCachePayload {
  product: PublicProductPage | null;
}

interface ProductAvailabilityState {
  productId: string;
  locationId: string;
  map: Record<string, boolean>;
}

interface RecommendedAvailabilityState {
  storeId: string;
  locationId: string;
  unavailableIds: Set<string>;
}

const RECOMMENDATION_REFERENCE_TIME = Date.now();
const EMPTY_PRODUCT_ID_SET = new Set<string>();

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
    hasVariants: p.hasVariants ?? false,
    showVariantsAsCards: p.showVariantsAsCards ?? false,
    sizeChart: p.sizeChart ?? null,
    variantOptions: Array.isArray(p.variantOptions) ? p.variantOptions : [],
    variants: Array.isArray(p.variants) ? p.variants : [],
  };
}

export function ProductLandingPage() {
  const { storeSlug: routeStoreSlug, productSlug } = useParams<{ storeSlug: string; productSlug: string }>();
  const storeSlug = useResolvedStoreSlug(routeStoreSlug);
  if (!storeSlug || !productSlug) return null;
  return <ProductLandingContent storeSlug={storeSlug} productSlug={productSlug} />;
}

function ProductLandingContent({ storeSlug, productSlug }: { storeSlug: string; productSlug: string }) {
  const { branding: storeBranding } = usePublicStoreBranding();
  const { setRouteReady } = usePublicRouteReady();
  const { addItem } = useCart();
  const [searchParams] = useSearchParams();
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
  const [selectedValueIds, setSelectedValueIds] = useState<Record<string, string>>({});
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [loading, setLoading] = useState(!cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const [productAvailability, setProductAvailability] = useState<ProductAvailabilityState | null>(null);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [openDetailKeys, setOpenDetailKeys] = useState<string[] | null>(null);
  const [recommendedProductsSource, setRecommendedProductsSource] = useState<PublicProductPage[]>([]);
  const [recommendedAvailability, setRecommendedAvailability] = useState<RecommendedAvailabilityState | null>(null);

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
          setActiveImageIndex(0);
          setOpenDetailKeys(null);
          return;
        }
        const optionGroups = await productOptionsService.getPublicProductOptionGroups(data.productId);
        const payload = normalizePublicProduct({ ...data, optionGroups }) as PublicProductPage;
        setProduct(payload);
        setActiveImageIndex(0);
        setOpenDetailKeys(null);
        writePublicPageCache(`product:${storeSlug}:${productSlug}`, { product: payload } satisfies ProductPageCachePayload);
        setSelections(buildInitialProductOptionSelections(optionGroups));
        // A catalog card for one visual value (e.g. "Zapatos deportivos -
        // Verde") links here with ?opt=<optionValueId> so the PDP opens with
        // that Color/Modelo preselected — only that one option value; the
        // rest (e.g. Talla) is deliberately left for the customer to choose,
        // same as clicking it manually. Falls back to the default/only
        // variant when there's no preset (typical direct PDP visit).
        setSelectedValueIds(
          resolveInitialVariantSelection(payload, searchParams.get('opt'))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando producto');
      } finally {
        setLoading(false);
      }
    }
    void load();
  // Preset value is only applied once, at initial load — re-running this
  // effect on every searchParams change would refetch the whole product.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug, productSlug]);

  useEffect(() => {
    setRouteReady(!loading);
  }, [loading, setRouteReady]);

  useEffect(() => {
    if (!product || !selectedLocation || locations.length <= 1) {
      return;
    }
    let cancelled = false;
    const productId = product.productId;
    const locationId = selectedLocation.locationId;
    productAvailabilityService.getProductAvailability(product.productId)
      .then(map => {
        if (!cancelled) setProductAvailability({ productId, locationId, map });
      })
      .catch(() => {
        if (!cancelled) setProductAvailability({ productId, locationId, map: {} });
      });
    return () => { cancelled = true; };
  }, [product, selectedLocation, locations.length]);

  useEffect(() => {
    let cancelled = false;
    productsService.getPublicProductsByStoreSlug(storeSlug)
      .then((items) => {
        if (!cancelled) setRecommendedProductsSource(items);
      })
      .catch(() => {
        if (!cancelled) setRecommendedProductsSource([]);
      });
    return () => { cancelled = true; };
  }, [storeSlug]);

  useEffect(() => {
    if (!storeBranding?.storeId || !selectedLocation) {
      return;
    }
    let cancelled = false;
    const storeId = storeBranding.storeId;
    const locationId = selectedLocation.locationId;
    productAvailabilityService
      .getUnavailableProductIds(storeId, locationId)
      .then((unavailableIds) => {
        if (!cancelled) setRecommendedAvailability({ storeId, locationId, unavailableIds });
      })
      .catch(() => {
        if (!cancelled) setRecommendedAvailability({ storeId, locationId, unavailableIds: new Set() });
      });
    return () => { cancelled = true; };
  }, [selectedLocation, storeBranding?.storeId]);

  const productAvailabilityMatches = Boolean(
    product
      && selectedLocation
      && locations.length > 1
      && productAvailability?.productId === product.productId
      && productAvailability.locationId === selectedLocation.locationId
  );
  const availabilityMap = productAvailabilityMatches ? productAvailability!.map : {};
  const isUnavailableInLocation = Boolean(
    productAvailabilityMatches
      && selectedLocation
      && availabilityMap[selectedLocation.locationId] === false
  );
  const recommendedAvailabilityMatches = Boolean(
    storeBranding?.storeId
      && selectedLocation
      && recommendedAvailability?.storeId === storeBranding.storeId
      && recommendedAvailability.locationId === selectedLocation.locationId
  );
  const recommendedUnavailableIds = recommendedAvailabilityMatches
    ? recommendedAvailability!.unavailableIds
    : EMPTY_PRODUCT_ID_SET;

  // Keep every hook above the loading/error/not-found returns below. These
  // values deliberately support a null product so the hook order is stable
  // while the product request is in flight.
  const selectedVariant: PublicProductVariant | null = product?.hasVariants
    ? findVariantByOptionValueIds(product, Object.values(selectedValueIds))
    : null;
  const galleryImages = product
    ? resolveVariantGalleryImages(product, selectedVariant, selectedValueIds)
    : [];
  const safeGalleryImages = galleryImages.length > 0
    ? galleryImages
    : product
      ? [{ imageUrl: '', altText: product.productName, sortOrder: 0, isPrimary: true }]
      : [];
  const visibleDescriptionSections = (product?.descriptionSections ?? [])
    .filter((section) => section?.isVisible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const detailAccordionItems = [
    product?.shortDescription
      ? {
          key: 'summary',
          title: 'Resumen',
          content: product.shortDescription,
          icon: null,
        }
      : null,
    product?.description
      ? {
          key: 'description',
          title: 'Descripcion',
          content: product.description,
          icon: null,
        }
      : null,
    ...visibleDescriptionSections.map((section) => ({
      key: section.id,
      title: section.title,
      content: section.content,
      icon: section.icon,
    })),
  ].filter(Boolean) as Array<{ key: string; title: string; content: string; icon: string | null }>;
  const recommendedItems = useMemo(() => {
    if (!product) return [];

    const currentProduct = product;
    const currentCollectionIds = new Set(currentProduct.collections.map((collection) => collection.id));
    const currentFacetValueIds = new Set(currentProduct.facetValues.map((facet) => facet.valueId));

    const scoredProducts = recommendedProductsSource
      .filter((candidate) => candidate.productId !== currentProduct.productId)
      .filter((candidate) => candidate.productType === currentProduct.productType)
      .filter((candidate) => candidate.isAvailable)
      .map((candidate) => {
        let score = 0;

        if (candidate.categoryId && candidate.categoryId === currentProduct.categoryId) score += 40;
        if (candidate.categoryParentId && candidate.categoryParentId === currentProduct.categoryParentId) score += 18;
        if (candidate.categoryName && candidate.categoryName === currentProduct.categoryName) score += 12;

        const sharedCollections = candidate.collections.filter((collection) => currentCollectionIds.has(collection.id)).length;
        score += sharedCollections * 14;

        const sharedFacets = candidate.facetValues.filter((facet) => currentFacetValueIds.has(facet.valueId)).length;
        score += Math.min(sharedFacets, 4) * 8;

        if (candidate.isFeatured) score += 6;
        if (candidate.hasVariants === currentProduct.hasVariants) score += 4;

        const ageMs = Math.max(0, RECOMMENDATION_REFERENCE_TIME - new Date(candidate.createdAt).getTime());
        const freshnessBoost = Math.max(0, 10 - Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30)));
        score += freshnessBoost;

        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score || a.candidate.productName.localeCompare(b.candidate.productName))
      .map(({ candidate }) => candidate);

    return buildCatalogItems(scoredProducts)
      .filter((item) => item.product.productId !== currentProduct.productId)
      .filter((item, index, array) => array.findIndex((entry) => entry.product.productId === item.product.productId) === index)
      .slice(0, 4);
  }, [product, recommendedProductsSource]);

  const shellTheme = buildStorefrontTheme({
    mode: storeBranding?.themeMode,
    primaryColor: storeBranding?.primaryColor,
    secondaryColor: storeBranding?.secondaryColor,
    accentColor: storeBranding?.accentColor,
    backgroundColor: storeBranding?.backgroundColor,
    textColor: storeBranding?.textColor,
    buttonRadius: storeBranding?.buttonRadius,
  });

  if (loading) {
    return <StorefrontProductDetailSkeleton branding={storeBranding} storeSlug={storeSlug} />;
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: shellTheme.background, color: shellTheme.text }}
      >
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10" style={{ color: shellTheme.primary }} />
          <p className="text-sm" style={{ color: shellTheme.mutedText }}>{error}</p>
          <Link
            to={buildStorefrontPath(storeSlug)}
            className="mt-4 inline-block text-sm hover:underline"
            style={{ color: shellTheme.primary }}
          >
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: shellTheme.background, color: shellTheme.text }}
      >
        <div className="text-center">
          <h1 className="mb-2 text-xl font-bold" style={{ color: shellTheme.text }}>Producto no encontrado</h1>
          <Link to={buildStorefrontPath(storeSlug)} className="text-sm hover:underline" style={{ color: shellTheme.primary }}>
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const bgColor = product.backgroundColor ?? '#ffffff';
  const currentProduct = product;
  const variantSelectionComplete =
    !currentProduct.hasVariants || currentProduct.variantOptions.length === Object.keys(selectedValueIds).length;
  const variantReady = !currentProduct.hasVariants || (variantSelectionComplete && selectedVariant !== null);
  const outOfStock = !currentProduct.isAvailable || (currentProduct.hasVariants
    ? selectedVariant
      ? !isVariantAvailable(selectedVariant)
      : isProductFullyOutOfStock(currentProduct)
    : isOutOfStock(currentProduct));
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

  const activePrice = currentProduct.hasVariants
    ? resolveVariantPrice(currentProduct, selectedVariant)
    : getActivePrice(currentProduct.regularPrice, currentProduct.salePrice);
  const customizationTotal = calculateCustomizationTotal(currentProduct.optionGroups, selections);
  const finalPrice = activePrice + customizationTotal;
  const primaryCategory = currentProduct.categoryName && currentProduct.categorySlug
    ? { name: currentProduct.categoryName, slug: currentProduct.categorySlug }
    : null;
  const parentCategory = currentProduct.categoryParentId
    ? categories.find((c) => c.id === currentProduct.categoryParentId) ?? null
    : null;
  const catalogLabel = product.productType === 'menu_item' ? 'Menú' : 'Catálogo';
  const renderedActiveImageIndex = Math.min(activeImageIndex, safeGalleryImages.length - 1);
  const activeGalleryImage = safeGalleryImages[renderedActiveImageIndex];
  const renderedOpenDetailKeys = openDetailKeys
    ?? (detailAccordionItems[0] ? [detailAccordionItems[0].key] : []);
  const mediaOption = currentProduct.variantOptions
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((option) => option.controlsMedia)
    ?? null;
  const otherVariantOptions = currentProduct.variantOptions
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((option) => !option.controlsMedia);
  const productEyebrow = currentProduct.isFeatured
    ? 'Lo mas nuevo'
    : primaryCategory?.name ?? 'Producto destacado';
  const productSubtitle = product.shortDescription
    ?? primaryCategory?.name
    ?? (isMenu ? 'Preparado para pedir' : 'Disponible para compra');

  function validateBeforeCheckout() {
    if (currentProduct.hasVariants && (!variantSelectionComplete || !selectedVariant)) {
      notify.error('Selecciona una variante disponible antes de continuar.');
      return false;
    }
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
    const selectedOptions = buildSelectedProductOptions(currentProduct.optionGroups, selections);
    const pricedLines = buildCustomizationPricedLines(selectedOptions);
    const variantLines = selectedVariant
      ? [
          ...selectedVariant.optionValues.map((ov) => `${ov.optionName}: ${ov.value}`),
          ...(selectedVariant.sku ? [`SKU: ${selectedVariant.sku}`] : []),
        ]
      : [];
    // Only mention the sede when there's more than one — a single-location
    // store doesn't need this line, it's implicit.
    const sedeLines = locations.length > 1 && selectedLocation
      ? [`Sede: ${selectedLocation.name}${selectedLocation.city ? ` · ${selectedLocation.city}` : ''}`]
      : [];
    const lines = [
      `Hola, quiero pedir: ${currentProduct.productName}`,
      ...variantLines,
      ...sedeLines,
      ...(pricedLines.length > 0 ? ['Adiciones:', ...pricedLines] : []),
      ...(specialInstructions.trim() ? [`Notas: ${specialInstructions.trim()}`] : []),
      `Total estimado: ${formatCurrency(finalPrice, 'es-CO', 'COP')}`,
    ];
    const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
    setPurchaseDialogOpen(false);
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function commitAddToCart() {
    const selectedOptions = buildSelectedProductOptions(currentProduct.optionGroups, selections);
    const summaryLines = buildCustomizationSummaryLines(currentProduct.optionGroups, selections, '');
    const notes = summaryLines.length > 0 ? summaryLines.join(', ') : null;
    const added = addItem({
      productId: currentProduct.productId,
      storeId: storeBranding?.storeId ?? '',
      productSlug: currentProduct.productSlug,
      productName: currentProduct.productName,
      productType: currentProduct.productType,
      imageUrl: resolveVariantGalleryImages(currentProduct, selectedVariant, selectedValueIds)[0]?.imageUrl ?? null,
      unitPrice: finalPrice,
      customizationNotes: notes,
      customizations: selectedOptions,
      variantId: selectedVariant?.id ?? null,
      variantLabel: selectedVariant ? buildVariantLabel(selectedVariant) : null,
      variantSku: selectedVariant?.sku ?? null,
      stock: selectedVariant ? selectedVariant.stockQuantity : currentProduct.stock,
      trackInventory: selectedVariant ? selectedVariant.stockPolicy !== 'allow_backorder' : currentProduct.trackInventory,
      isAvailable: currentProduct.isAvailable,
    });
    if (!added) {
      notify.warning(
        isMenu
          ? `"${currentProduct.productName}" está agotado por el momento.`
          : `"${currentProduct.productName}" no tiene stock disponible.`
      );
      return;
    }
    setPurchaseDialogOpen(false);
    setSpecialInstructions('');
    notify.cartSuccess(`"${currentProduct.productName}" agregado al pedido`);
  }

  // Selecting a value (e.g. Color: Verde) can make an already-selected value
  // on another option (e.g. Talla: 41) stop being reachable. Rather than
  // leaving an invalid combination silently selected, drop it — the CTA
  // already blocks checkout on incomplete/invalid selections, so this just
  // makes that visible immediately instead of after a failed attempt.
  function handleVariantOptionSelect(optionId: string, valueId: string) {
    setActiveImageIndex(0);
    setSelectedValueIds((current) => {
      const next: Record<string, string> = { ...current, [optionId]: valueId };
      for (const otherOptionId of Object.keys(next)) {
        if (otherOptionId === optionId) continue;
        const otherValueId = next[otherOptionId];
        const otherSelections = Object.fromEntries(
          Object.entries(next).filter(([key]) => key !== otherOptionId)
        );
        if (!isOptionValueSelectable(currentProduct, otherOptionId, otherValueId, otherSelections)) {
          delete next[otherOptionId];
        }
      }
      return next;
    });
  }

  function showPreviousImage() {
    setActiveImageIndex((current) => (current - 1 + safeGalleryImages.length) % safeGalleryImages.length);
  }

  function showNextImage() {
    setActiveImageIndex((current) => (current + 1) % safeGalleryImages.length);
  }

  function toggleDetailItem(key: string) {
    setOpenDetailKeys((current) => {
      const resolvedCurrent = current ?? (detailAccordionItems[0] ? [detailAccordionItems[0].key] : []);
      return resolvedCurrent.includes(key)
        ? resolvedCurrent.filter((item) => item !== key)
        : [...resolvedCurrent, key];
    });
  }

  return (
    <div style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh' }}>
      <main className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-4 py-6 lg:px-6 lg:py-8`}>
        <StorefrontBreadcrumbs
          theme={theme}
          className="mb-4"
          items={[
            { label: 'Inicio', href: buildStorefrontPath(storeSlug) },
            { label: catalogLabel, href: buildStorefrontPath(storeSlug, '/catalog') },
            ...(parentCategory
              ? [
                  { label: parentCategory.name, href: buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(parentCategory.slug)}`) },
                  ...(primaryCategory
                    ? [{
                        label: primaryCategory.name,
                        href: buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(parentCategory.slug)}&sub=${encodeURIComponent(primaryCategory.slug)}`),
                      }]
                    : []),
                ]
              : primaryCategory
              ? [{ label: primaryCategory.name, href: buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(primaryCategory.slug)}`) }]
              : []),
            { label: product.productName },
          ]}
        />
        <StorefrontBackButton
          storeSlug={storeSlug}
          className="mb-6"
          color={textColor}
          label="Volver al catálogo"
          fallbackPath={buildStorefrontPath(storeSlug, '/catalog')}
        />
        {/* `1.3fr/1fr` (not a fixed-px image column) — both sides scale
            proportionally with the viewport instead of the image column
            being effectively unbounded next to a fixed-width sibling,
            which is what made it feel oversized. This settles the image
            around ~750-800px on this page's widest container — bigger
            than the pre-redesign 620px cap, smaller than the unbounded
            version, without any dead space on either very wide or
            in-between viewports. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-10 lg:items-start">
          <section className="grid gap-3 lg:grid-cols-[56px_minmax(0,1fr)] lg:items-start">
            <div className="order-2 flex gap-2 overflow-x-auto pb-2 lg:order-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {safeGalleryImages.map((image, index) => {
                const selected = index === renderedActiveImageIndex;
                return (
                  <button
                    key={`${image.imageUrl}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className="w-12 shrink-0 overflow-hidden rounded-sm border transition lg:w-16"
                    style={{
                      borderColor: selected ? theme.text : theme.border,
                      backgroundColor: theme.surface,
                    }}
                    aria-label={`Ver imagen ${index + 1}`}
                  >
                    <StorefrontMediaFrame
                      src={image.imageUrl}
                      alt={image.altText || `${product.productName} ${index + 1}`}
                      aspectClassName="aspect-square"
                      roundedClassName="rounded-none"
                      imageClassName="h-full w-full object-cover"
                      pngImageClassName="h-full w-full object-cover"
                      fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surface }} />}
                    />
                  </button>
                );
              })}
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative aspect-square overflow-hidden rounded-sm" style={{ backgroundColor: theme.surface }}>
                <ProductImageZoom
                  src={activeGalleryImage?.imageUrl || null}
                  alt={activeGalleryImage?.altText || product.productName}
                  fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surface }} />}
                />

                {safeGalleryImages.length > 1 && (
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
                      style={{
                        backgroundColor: withAlpha(theme.background, 0.92),
                        color: theme.text,
                        boxShadow: `0 8px 20px ${theme.shadow}`,
                      }}
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={showNextImage}
                      className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
                      style={{
                        backgroundColor: withAlpha(theme.background, 0.92),
                        color: theme.text,
                        boxShadow: `0 8px 20px ${theme.shadow}`,
                      }}
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="space-y-5 pt-1">
            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: theme.primary }}>
                {productEyebrow}
              </p>
              <div className="space-y-1">
                <h1 className="text-[1.55rem] font-medium leading-tight lg:text-[1.8rem]" style={{ color: theme.text }}>
                  {product.productName}
                </h1>
                <p className="text-[0.95rem]" style={{ color: theme.mutedText }}>
                  {productSubtitle}
                </p>
              </div>

              {currentProduct.hasVariants ? (
                !variantSelectionComplete ? (() => {
                  const range = getVariantPriceRange(currentProduct);
                  return (
                    <p className="pt-1 text-[1.45rem] font-medium lg:text-[1.6rem]" style={{ color: theme.text }}>
                      {range && range.min !== range.max
                        ? `Desde ${formatCurrency(range.min, 'es-CO', 'COP')}`
                        : formatCurrency(range?.min ?? activePrice, 'es-CO', 'COP')}
                    </p>
                  );
                })() : (
                  <div className="space-y-1 pt-1">
                    <p className="text-[1.45rem] font-medium lg:text-[1.6rem]" style={{ color: theme.text }}>
                      {formatCurrency(activePrice, 'es-CO', 'COP')}
                    </p>
                    {selectedVariant?.sku && (
                      <p className="text-sm" style={{ color: theme.mutedText }}>SKU: {selectedVariant.sku}</p>
                    )}
                  </div>
                )
              ) : hasActiveDiscount(product.regularPrice, product.salePrice) ? (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[1.45rem] font-medium lg:text-[1.6rem]" style={{ color: theme.text }}>
                      {formatCurrency(product.salePrice!, 'es-CO', 'COP')}
                    </p>
                    <DiscountBadge
                      percentage={calculateDiscountPercentage(product.regularPrice, product.salePrice!)}
                      size="md"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="line-through" style={{ color: withAlpha(theme.text, 0.4) }}>
                      {formatCurrency(product.regularPrice, 'es-CO', 'COP')}
                    </span>
                    <span className="font-medium" style={{ color: theme.primary }}>
                      Ahorras {formatCurrency(calculateDiscountAmount(product.regularPrice, product.salePrice!), 'es-CO', 'COP')}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="pt-1 text-[1.45rem] font-medium lg:text-[1.6rem]" style={{ color: theme.text }}>
                  {formatCurrency(product.regularPrice, 'es-CO', 'COP')}
                </p>
              )}
            </div>

            {mediaOption && (
              <div className="space-y-2.5">
                <p className="text-sm font-medium" style={{ color: theme.text }}>{mediaOption.name}</p>
                <div className="flex flex-wrap gap-2">
                  {mediaOption.values.map((value) => {
                    const selected = selectedValueIds[mediaOption.id] === value.id;
                    return (
                      <button
                        key={value.id}
                        type="button"
                        onClick={() => handleVariantOptionSelect(mediaOption.id, value.id)}
                        className="overflow-hidden rounded-md border"
                        style={{
                          borderColor: selected ? theme.text : theme.border,
                          backgroundColor: theme.surface,
                        }}
                        aria-label={`${mediaOption.name}: ${value.value}`}
                      >
                        <div className="h-[56px] w-[56px] lg:h-[60px] lg:w-[60px]" style={{ backgroundColor: theme.surface }}>
                          <StorefrontMediaFrame
                            src={value.images[0]?.imageUrl ?? selectedVariant?.imageUrl ?? currentProduct.mainImageUrl}
                            alt={value.value}
                            aspectClassName="aspect-square"
                            roundedClassName="rounded-none"
                            imageClassName="h-full w-full object-cover"
                            pngImageClassName="h-full w-full object-cover"
                            fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surface }} />}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {otherVariantOptions.map((option) => {
              const otherSelectionsBase = Object.fromEntries(
                Object.entries(selectedValueIds).filter(([optionId]) => optionId !== option.id)
              );
              return (
                <div key={option.id} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[0.95rem] font-medium lg:text-[1rem]" style={{ color: theme.text }}>
                      {option.type === 'size' ? 'Selecciona la talla' : option.name}
                    </p>
                    {option.type === 'size' && currentProduct.sizeChart && (
                      <button
                        type="button"
                        onClick={() => setSizeChartOpen(true)}
                        className="text-[0.95rem] font-medium lg:text-[1rem]"
                        style={{ color: theme.mutedText }}
                      >
                        Guia de tallas
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {option.values.map((value) => {
                      const selected = selectedValueIds[option.id] === value.id;
                      const selectable = isOptionValueSelectable(product, option.id, value.id, otherSelectionsBase);
                      return (
                        <button
                          key={value.id}
                          type="button"
                          disabled={!selectable}
                          onClick={() => handleVariantOptionSelect(option.id, value.id)}
                          className="flex min-h-[44px] items-center justify-center rounded-md border px-3 text-[0.95rem] transition disabled:cursor-not-allowed"
                          style={{
                            borderColor: selected ? theme.text : theme.border,
                            backgroundColor: selected ? theme.text : selectable ? theme.background : theme.surfaceAlt,
                            color: selected ? theme.background : selectable ? theme.text : theme.mutedText,
                          }}
                        >
                          {value.value}
                        </button>
                      );
                    })}
                  </div>

                  {variantSelectionComplete && !selectedVariant && (
                    <p className="text-sm" style={{ color: theme.primary }}>Esa combinación no está disponible.</p>
                  )}
                </div>
              );
            })}

            {!isMenu && !currentProduct.hasVariants && product.stock <= 0 && (
              <p className="text-sm font-medium" style={{ color: theme.primary }}>Sin stock disponible</p>
            )}
            {!isMenu && !currentProduct.hasVariants && product.stock > 0 && product.stock <= 5 && (
              <p className="text-sm" style={{ color: theme.mutedText }}>Últimas {product.stock} unidades</p>
            )}
            {!isMenu && selectedVariant && selectedVariant.stockQuantity > 0 && selectedVariant.stockQuantity <= 5 && (
              <p className="text-sm" style={{ color: theme.mutedText }}>Últimas {selectedVariant.stockQuantity} unidades</p>
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
              <div className="space-y-2 text-sm" style={{ color: theme.mutedText }}>
                <div className="flex items-center justify-between">
                  <span>Base</span>
                  <span style={{ color: theme.text }}>{formatCurrency(activePrice, 'es-CO', 'COP')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Extras seleccionados</span>
                  <span style={{ color: theme.text }}>+{formatCurrency(customizationTotal, 'es-CO', 'COP')}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-base font-medium">
                  <span style={{ color: theme.text }}>Total estimado</span>
                  <span style={{ color: theme.text }}>{formatCurrency(finalPrice, 'es-CO', 'COP')}</span>
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
                {isMenu
                  ? 'Agotado por el momento. Vuelve a consultar más tarde.'
                  : 'Este producto no tiene stock disponible.'}
              </div>
            )}

            {/* Variant selection required before any CTA is enabled */}
            {currentProduct.hasVariants && !variantReady && !outOfStock && (
              <div
                className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3.5 text-sm font-medium opacity-70"
                style={{ borderColor: theme.border, color: theme.mutedText }}
              >
                Selecciona una variante para continuar
              </div>
            )}

            {/* CTA — web order mode: "Agregar al pedido" */}
            {isWebOrderMode && !isUnavailableInLocation && !outOfStock && variantReady && (
              <StorefrontActionButton
                as="button"
                type="button"
                onClick={handleAddToCartAction}
                variant="primary"
                theme={theme}
                fullWidth
                className="gap-2 rounded-full py-3.5 text-sm font-medium"
              >
                <ShoppingBag className="w-5 h-5" />
                Agregar a la bolsa de compras
              </StorefrontActionButton>
            )}

            {/* CTA — WhatsApp mode */}
            {!isWebOrderMode && ctaConfig.show && ctaConfig.variant === 'whatsapp' && variantReady && (
              <StorefrontActionButton
                as="button"
                type="button"
                onClick={handleWhatsAppAction}
                variant="whatsapp"
                theme={theme}
                fullWidth
                className="gap-2 rounded-full py-3.5 text-sm font-medium"
              >
                <MessageCircle className="w-5 h-5" />
                {ctaConfig.label}
              </StorefrontActionButton>
            )}

            {/* Coming soon placeholder */}
            {ctaConfig.show && ctaConfig.isComingSoon && (
              <div
                className="flex items-center justify-center gap-2 w-full rounded-full border px-4 py-3.5 text-sm font-medium opacity-60 cursor-not-allowed"
                style={{ borderColor: theme.border, color: theme.mutedText }}
              >
                <Lock className="w-4 h-4" />
                {ctaConfig.label}
              </div>
            )}
          </div>
        </div>

        {detailAccordionItems.length > 0 && (
          <section className="mt-14 border-t pt-2" style={{ borderColor: theme.border }}>
            <div style={{ borderColor: theme.border }} className="divide-y">
              {detailAccordionItems.map((item) => {
                const open = renderedOpenDetailKeys.includes(item.key);
                return (
                  <div key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggleDetailItem(item.key)}
                      className="flex w-full items-center justify-between gap-4 py-6 text-left"
                    >
                      <span className="flex items-center gap-2 text-[1.05rem] font-semibold" style={{ color: theme.text }}>
                        {item.icon ? (
                          <span style={{ color: withAlpha(theme.text, 0.8) }}>
                            {getProductIcon(item.icon, { className: 'h-4 w-4' })}
                          </span>
                        ) : null}
                        {item.title}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                        style={{ color: theme.text }}
                      />
                    </button>

                    {open && (
                      <div className="pb-6 pr-10">
                        <p className="whitespace-pre-line text-sm leading-7" style={{ color: theme.mutedText }}>
                          {item.content}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {recommendedItems.length > 0 && (
          <section className="mt-16 border-t pt-10" style={{ borderColor: theme.border }}>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.mutedText }}>
                  Recomendado para ti
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {recommendedItems.map((item) => {
                const categoryLabel = item.product.categoryParentId
                  ? `${categories.find((cat) => cat.id === item.product.categoryParentId)?.name ?? 'Categoria'} > ${item.product.categoryName ?? ''}`
                  : item.product.categoryName;
                const isUnavailable = recommendedUnavailableIds.has(item.product.productId) || item.isOutOfStock;

                return (
                  <div key={item.id} className="min-w-0">
                    <StorefrontProductCard
                      item={item}
                      theme={theme}
                      storeSlug={storeSlug}
                      currency="COP"
                      isMenu={isMenu}
                      isUnavailable={isUnavailable}
                      showCartButton={false}
                      productCardCtaLabel="Ver producto"
                      categoryLabel={categoryLabel}
                    />
                  </div>
                );
              })}
            </div>
          </section>
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

      {currentProduct.sizeChart && (
        <StorefrontSizeChartDialog
          open={sizeChartOpen}
          theme={theme}
          sizeChart={currentProduct.sizeChart}
          onClose={() => setSizeChartOpen(false)}
        />
      )}

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
