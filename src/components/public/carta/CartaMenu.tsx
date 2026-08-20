import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, UtensilsCrossed, X } from 'lucide-react';
import type { PublicCartaCategory, PublicCartaPage } from '@/features/carta/carta.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { STOREFRONT_CONTAINER_CLASS, withAlpha } from '@/components/public/storefront/storefrontTheme';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';
import { CartaProductCard } from './CartaProductCard';

interface CartaMenuProps {
  page: PublicCartaPage;
  theme: StorefrontTheme;
  preview?: boolean;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

function parseHexColor(color: string): RgbColor | null {
  const value = color.trim().replace(/^#/, '');
  const expanded = value.length === 3
    ? value.split('').map((character) => character.repeat(2)).join('')
    : value;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function resolveCartaGradientAccent(theme: StorefrontTheme): string {
  const background = parseHexColor(theme.background);
  const secondary = parseHexColor(theme.secondary);
  if (!background || !secondary) return theme.secondary;

  const difference = Math.abs(background.red - secondary.red)
    + Math.abs(background.green - secondary.green)
    + Math.abs(background.blue - secondary.blue);
  return difference >= 36 ? theme.secondary : theme.primary;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function BrandMark({ page, theme }: { page: PublicCartaPage; theme: StorefrontTheme }) {
  if (!page.showLogo) return null;
  return page.logoUrl ? (
    <img
      src={page.logoUrl}
      alt={page.storeName}
      className="h-16 w-16 rounded-full object-cover shadow-lg ring-4 sm:h-20 sm:w-20"
      style={{ boxShadow: `0 14px 40px ${theme.shadow}`, '--tw-ring-color': theme.background } as React.CSSProperties}
    />
  ) : (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg ring-4 sm:h-20 sm:w-20"
      style={{ backgroundColor: theme.primary, color: '#fff', '--tw-ring-color': theme.background } as React.CSSProperties}
    >
      <UtensilsCrossed className="h-7 w-7" />
    </div>
  );
}

function CartaCover({ page, theme }: { page: PublicCartaPage; theme: StorefrontTheme }) {
  const title = page.title?.trim() || null;
  const allDishImages = page.categories
    .flatMap((category) => category.products)
    .map((product) => ({ id: product.id, src: product.imageUrl, alt: product.name }))
    .filter((image): image is { id: string; src: string; alt: string } => Boolean(image.src));
  const imagesByProductId = new Map(allDishImages.map((image) => [image.id, image]));
  const selectedProductImages = page.coverProductIds
    .map((productId) => imagesByProductId.get(productId))
    .filter((image): image is { id: string; src: string; alt: string } => Boolean(image));
  const customCoverImage = page.coverImageUrl
    ? [{ id: '__custom_cover__', src: page.coverImageUrl, alt: `Portada de ${page.storeName}` }]
    : [];
  const selectedImages = [...customCoverImage, ...selectedProductImages];
  const coverImage = page.coverLayout === 'none' ? null : selectedImages[0] ?? null;
  const isMinimal = page.templateKey === 'minimal';
  const isGallery = page.templateKey === 'gallery';
  const titleClassName = isMinimal
    ? 'text-3xl font-bold tracking-tight sm:text-5xl'
    : isGallery
      ? 'text-4xl font-black tracking-[-0.045em] sm:text-6xl'
      : 'text-4xl font-black tracking-[-0.05em] sm:text-6xl';
  const imageFrameClassName = isMinimal
    ? 'aspect-[4/3] max-w-2xl rounded-[2rem] sm:aspect-[16/7]'
    : isGallery
      ? 'aspect-[4/3] max-w-3xl rounded-[2rem] sm:aspect-[16/8] sm:rounded-[2.75rem]'
      : 'aspect-square max-w-md rounded-[42%]';
  const headerGradientDirection = isGallery ? '145deg' : isMinimal ? '160deg' : '135deg';
  const gradientAccent = resolveCartaGradientAccent(theme);
  const coverAccentOpacity = theme.mode === 'dark' ? 0.12 : 0.07;
  const headerBackground = [
    `linear-gradient(${headerGradientDirection}, ${withAlpha(gradientAccent, coverAccentOpacity)} 0%, transparent 46%, ${withAlpha(gradientAccent, coverAccentOpacity * 0.45)} 100%)`,
    theme.background,
  ].join(', ');

  return (
    <header
      data-carta-cover
      className="relative isolate overflow-hidden px-4 py-10 text-center sm:mb-8 sm:rounded-b-[3rem] sm:px-6 sm:py-16"
      style={{ background: headerBackground, boxShadow: `0 20px 50px ${withAlpha(theme.text, 0.06)}` }}
    >
      {page.coverBackgroundImageUrl && (
        <>
          <div data-carta-cover-background-frame className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <img
              data-carta-cover-background
              src={page.coverBackgroundImageUrl}
              alt=""
              className="block h-full w-full origin-top scale-125 object-cover object-top sm:origin-center sm:scale-110 sm:object-center"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                `linear-gradient(${headerGradientDirection}, ${withAlpha(gradientAccent, coverAccentOpacity)} 0%, transparent 58%)`,
                `linear-gradient(180deg, ${withAlpha(theme.background, 0.74)} 0%, ${withAlpha(theme.background, 0.64)} 50%, ${withAlpha(theme.background, 0.7)} 100%)`,
              ].join(', '),
            }}
          />
        </>
      )}
      <div data-carta-cover-content className={`relative z-10 mx-auto flex w-full ${STOREFRONT_CONTAINER_CLASS} flex-col items-center`}>
        <BrandMark page={page} theme={theme} />
        <p className={`${page.showLogo ? 'mt-4' : ''} text-sm font-bold uppercase tracking-[0.16em]`} style={{ color: theme.mutedText }}>{page.storeName}</p>
        {title && <h1 className={`mt-4 ${titleClassName}`} style={{ color: theme.text }}>{title}</h1>}
        {page.subtitle && <p className={`${title ? 'mt-3' : 'mt-4'} max-w-xl text-sm leading-6 sm:text-base`} style={{ color: theme.mutedText }}>{page.subtitle}</p>}
        {coverImage && (
          <div className={`mt-8 w-full overflow-hidden shadow-2xl sm:mt-10 ${imageFrameClassName}`} style={{ backgroundColor: theme.surfaceAlt, boxShadow: `0 24px 64px ${theme.shadow}` }}>
            <img src={coverImage.src} alt={coverImage.alt} className="h-full w-full object-cover object-center" />
          </div>
        )}
      </div>
    </header>
  );
}

function CategoryHeading({
  category,
  page,
  theme,
}: {
  category: PublicCartaCategory;
  page: PublicCartaPage;
  theme: StorefrontTheme;
}) {
  if (page.templateKey === 'minimal') {
    return (
      <div className="mb-5 flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: theme.border }}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>{category.name}</h2>
          {page.showCategoryDescriptions && category.description && (
            <p className="mt-1 max-w-2xl text-sm" style={{ color: theme.mutedText }}>{category.description}</p>
          )}
        </div>
      </div>
    );
  }

  const centered = page.categoryHeadingAlignment === 'center';

  if (page.templateKey === 'gallery') {
    return (
      <div data-carta-editorial-heading className={`mb-5 sm:mb-7 ${centered ? 'text-center' : ''}`}>
        <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-5xl" style={{ color: theme.text }}>{category.name}</h2>
        {page.showCategoryDescriptions && category.description && (
          <p className={`mt-1.5 text-sm leading-6 ${centered ? 'mx-auto max-w-xl' : 'max-w-2xl'}`} style={{ color: theme.mutedText }}>
            {category.description}
          </p>
        )}
        <div
          aria-hidden="true"
          className={`mt-3 h-px w-16 sm:mt-4 sm:w-20 ${centered ? 'mx-auto' : ''}`}
          style={{
            background: centered
              ? `linear-gradient(90deg, transparent, ${theme.primary}, transparent)`
              : `linear-gradient(90deg, ${theme.primary}, ${withAlpha(theme.primary, 0.12)})`,
          }}
        />
      </div>
    );
  }

  return (
    <div className={`mb-6 ${centered ? 'text-center' : ''}`}>
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: theme.text }}>{category.name}</h2>
      {page.showCategoryDescriptions && category.description && (
        <p className={`mt-2 text-sm leading-6 ${centered ? 'mx-auto max-w-xl' : 'max-w-2xl'}`} style={{ color: theme.mutedText }}>
          {category.description}
        </p>
      )}
      {page.templateKey === 'signature' && <div className={`mt-4 h-1 w-12 rounded-full ${centered ? 'mx-auto' : ''}`} style={{ backgroundColor: theme.primary }} />}
    </div>
  );
}

function resolveCategoryImageUrl(category: PublicCartaCategory, page: PublicCartaPage, imageMode: PublicCartaPage['productImageMode']): string | null {
  if (imageMode === 'none') return null;
  if (imageMode === 'all') return category.imageUrl;

  const selection = category.id ? page.categoryImageSelections[category.id] : undefined;
  if (selection === 'category' && category.imageUrl) return category.imageUrl;
  if (selection?.startsWith('product:')) {
    const productId = selection.slice('product:'.length);
    const selectedProduct = category.products.find((product) => product.id === productId && product.imageUrl);
    if (selectedProduct?.imageUrl) return selectedProduct.imageUrl;
  }

  return category.imageUrl ?? category.products.find((product) => product.imageUrl)?.imageUrl ?? null;
}

function CategorySection({ category, index, page, theme }: { category: PublicCartaCategory; index: number; page: PublicCartaPage; theme: StorefrontTheme }) {
  const cardStyle = page.templateKey;
  const isSignature = page.templateKey === 'signature';
  const productImageMode = category.id ? page.categoryImageModes[category.id] ?? page.productImageMode : page.productImageMode;
  const showProductImages = productImageMode === 'all';
  const categoryImageUrl = resolveCategoryImageUrl(category, page, productImageMode);
  const categoryImagePosition = category.id ? page.categoryImagePositions[category.id] ?? 'beside_right' : 'beside_right';
  const categoryImageSize = category.id ? page.categoryImageSizes[category.id] ?? 'medium' : 'medium';
  const imageBesideProducts = categoryImagePosition === 'beside_left' || categoryImagePosition === 'beside_right';
  const categoryImageIsPng = isLikelyPngAsset(categoryImageUrl);
  const editorialImageShape = page.templateKey === 'gallery'
    ? 'rounded-[30%]'
    : page.templateKey === 'minimal'
      ? 'rounded-[1.5rem]'
      : 'rounded-[36%]';
  const imageWidthClass = imageBesideProducts
    ? categoryImageSize === 'small'
      ? 'max-w-[104px] sm:max-w-[132px] lg:max-w-[160px]'
      : categoryImageSize === 'large'
        ? 'max-w-[156px] sm:max-w-[190px] lg:max-w-[220px]'
        : 'max-w-[132px] sm:max-w-[160px] lg:max-w-[190px]'
    : categoryImageSize === 'small'
      ? 'max-w-[132px] sm:max-w-[170px]'
      : categoryImageSize === 'large'
        ? 'max-w-[200px] sm:max-w-[270px]'
        : 'max-w-[170px] sm:max-w-[220px]';
  const mobileAlignmentClass = imageBesideProducts
    ? categoryImagePosition === 'beside_right' ? 'ml-auto mr-0' : 'ml-0 mr-auto'
    : 'mx-auto';
  const sideGridClass = categoryImagePosition === 'beside_right'
    ? categoryImageSize === 'small'
      ? 'grid-cols-[minmax(0,1fr)_104px] sm:grid-cols-[minmax(0,1fr)_132px] lg:grid-cols-[minmax(0,1fr)_170px]'
      : categoryImageSize === 'large'
        ? 'grid-cols-[minmax(0,1fr)_156px] sm:grid-cols-[minmax(0,1fr)_190px] lg:grid-cols-[minmax(0,1fr)_230px]'
        : 'grid-cols-[minmax(0,1fr)_132px] sm:grid-cols-[minmax(0,1fr)_160px] lg:grid-cols-[minmax(0,1fr)_200px]'
    : categoryImageSize === 'small'
      ? 'grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[170px_minmax(0,1fr)]'
      : categoryImageSize === 'large'
        ? 'grid-cols-[156px_minmax(0,1fr)] sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)]'
        : 'grid-cols-[132px_minmax(0,1fr)] sm:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)]';
  const renderCategoryImage = (beside: boolean) => categoryImageUrl ? (
    <figure
      data-carta-category-media
      data-category-image-position={categoryImagePosition}
      data-category-image-size={categoryImageSize}
      data-category-image-format={categoryImageIsPng ? 'floating-png' : 'photo'}
      className={`isolate relative w-full ${imageWidthClass} ${mobileAlignmentClass}`}
    >
      {categoryImageIsPng ? (
        <div className={`flex items-center justify-center overflow-visible ${beside ? 'aspect-square' : 'aspect-[4/3]'}`}>
          <img src={categoryImageUrl} alt={category.name} className="h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(15,23,42,0.18)]" />
        </div>
      ) : (
        <>
          <div className={`pointer-events-none absolute -inset-2 -z-10 opacity-55 ${editorialImageShape}`} style={{ backgroundColor: withAlpha(index % 2 === 0 ? theme.primary : theme.accent, 0.1) }} />
          <div className={`overflow-hidden ${beside ? 'aspect-[4/5]' : 'aspect-[4/3]'} ${editorialImageShape}`} style={{ boxShadow: `0 16px 36px ${theme.shadow}` }}>
            <img src={categoryImageUrl} alt={category.name} className="h-full w-full object-cover object-center" />
          </div>
        </>
      )}
    </figure>
  ) : null;
  const productCards = category.products.map((product, productIndex) => (
    <div
      key={product.id}
      data-carta-product-reveal
      style={{ '--carta-reveal-delay': `${Math.min(productIndex, 6) * 45}ms` } as React.CSSProperties}
    >
      <CartaProductCard
        product={product}
        currency={page.currency}
        theme={theme}
        variant={cardStyle}
        showDescription={page.showProductDescriptions}
        showImage={showProductImages}
        compact={productImageMode === 'first_per_category' && imageBesideProducts && Boolean(categoryImageUrl)}
        imagePosition={page.productImagePositions[product.id]}
      />
    </div>
  ));
  return (
    <section
      data-carta-category={category.id ?? 'uncategorized'}
      data-carta-reveal
      className={`relative isolate scroll-mt-24 overflow-hidden pt-0 ${isSignature ? 'pb-6 sm:pb-8 lg:pb-9' : 'pb-5 sm:pb-6'}`}
    >
      <div className="relative z-10">
        {productImageMode === 'first_per_category' && categoryImagePosition === 'above_heading' && (
          <div className="mb-7 sm:mb-9">{renderCategoryImage(false)}</div>
        )}
        <CategoryHeading category={category} page={page} theme={theme} />
        {productImageMode === 'first_per_category' && categoryImagePosition === 'below_heading' && (
          <div className="mb-7 sm:mb-9">{renderCategoryImage(false)}</div>
        )}
        {productImageMode === 'first_per_category' ? (
          imageBesideProducts && categoryImageUrl ? (
            <div className={`relative grid items-start gap-4 sm:gap-6 ${sideGridClass} lg:gap-10`}>
              <div className={categoryImagePosition === 'beside_right' ? 'order-2' : 'order-1'}>{renderCategoryImage(true)}</div>
              <div className={categoryImagePosition === 'beside_right' ? 'order-1' : 'order-2'}>
                {productCards}
              </div>
            </div>
          ) : (
            <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-x-10 md:grid-cols-2">{productCards}</div>
          )
        ) : (
          <div data-carta-products-grid className={`relative ${
            !showProductImages
              ? 'grid grid-cols-1 gap-x-10 md:grid-cols-2'
              : page.templateKey === 'gallery'
                ? 'grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-x-10'
                : page.templateKey === 'minimal'
                  ? 'grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-x-6'
                  : 'grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-x-6 md:gap-y-1'
          }`}>
            {productCards}
          </div>
        )}
      </div>
    </section>
  );
}

export function CartaMenu({ page, theme, preview = false }: CartaMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryNavStuck, setCategoryNavStuck] = useState(false);
  const categoryRefs = useRef(new Map<string, HTMLElement>());
  const categoryNavRef = useRef<HTMLElement>(null);
  const categoryNavSentinelRef = useRef<HTMLDivElement>(null);
  const cartaRootRef = useRef<HTMLDivElement>(null);
  const categories = page.categories;
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, categories.length - 1));
  const gradientAccent = resolveCartaGradientAccent(theme);
  const gradientOpacity = theme.mode === 'dark' ? 0.1 : 0.055;
  const normalizedQuery = normalizeSearchValue(searchQuery.trim());
  const matchingCategories = normalizedQuery
    ? categories
        .map((category) => {
          const categoryMatches = normalizeSearchValue(category.name).includes(normalizedQuery);
          const products = categoryMatches
            ? category.products
            : category.products.filter((product) => normalizeSearchValue([
                product.name,
                product.shortDescription ?? '',
              ].join(' ')).includes(normalizedQuery));
          return { ...category, products };
        })
        .filter((category) => category.products.length > 0)
    : categories;
  const searchResultCount = matchingCategories.reduce((total, category) => total + category.products.length, 0);
  const motionEnabled = !preview
    && typeof IntersectionObserver !== 'undefined'
    && (typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const sentinel = categoryNavSentinelRef.current;
    const cartaRoot = cartaRootRef.current;
    if (!sentinel || !cartaRoot || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        if (target.hasAttribute('data-carta-category-sentinel')) {
          setCategoryNavStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
          continue;
        }
        if (entry.isIntersecting && target.hasAttribute('data-carta-reveal')) {
          target.setAttribute('data-carta-visible', 'true');
          observer.unobserve(target);
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });

    observer.observe(sentinel);
    if (motionEnabled) {
      cartaRoot.querySelectorAll<HTMLElement>('[data-carta-reveal]').forEach((section) => {
        if (section.getAttribute('data-carta-visible') !== 'true') observer.observe(section);
      });
    }
    return () => observer.disconnect();
  }, [categories, motionEnabled, normalizedQuery, page.navigationMode, safeActiveIndex]);

  function selectCategory(index: number) {
    setActiveIndex(index);

    const navigateToCategory = () => {
      if (page.navigationMode !== 'continuous') return;
      const id = categories[index]?.id ?? 'uncategorized';
      const target = categoryRefs.current.get(id);
      if (!target) return;

      const navigationHeight = categoryNavRef.current?.getBoundingClientRect().height ?? 0;
      const currentScrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const targetTop = Math.max(0, Math.round(target.getBoundingClientRect().top + currentScrollTop - navigationHeight - 16));
      const prefersReducedMotion = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: targetTop,
        behavior: preview || prefersReducedMotion ? 'auto' : 'smooth',
      });
    };

    if (normalizedQuery) {
      setSearchQuery('');
      window.requestAnimationFrame(navigateToCategory);
    } else {
      navigateToCategory();
    }
  }

  const visibleCategories = normalizedQuery
    ? matchingCategories
    : page.navigationMode === 'paginated'
      ? categories.slice(safeActiveIndex, safeActiveIndex + 1)
      : categories;

  return (
    <div
      ref={cartaRootRef}
      className="min-h-screen"
      data-carta-motion={motionEnabled ? 'ready' : 'off'}
      data-carta-gradient-color={gradientAccent}
      style={{
        backgroundColor: theme.background,
        backgroundImage: [
          `linear-gradient(145deg, transparent 0%, transparent 24%, ${withAlpha(gradientAccent, gradientOpacity)} 39%, transparent 56%)`,
          `linear-gradient(325deg, transparent 0%, transparent 64%, ${withAlpha(gradientAccent, gradientOpacity * 0.62)} 80%, transparent 96%)`,
        ].join(', '),
        color: theme.text,
        ...theme.cssVars,
      }}
    >
      <CartaCover page={page} theme={theme} />

      {categories.length > 0 && (
        <section
          aria-label="Buscar en la carta"
          className={`mx-auto w-full ${STOREFRONT_CONTAINER_CLASS} px-4 pt-5 sm:px-6 sm:pt-6`}
          data-carta-search
        >
          <div className="mx-auto max-w-xl">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: theme.mutedText }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Buscar platos o categorías"
                placeholder="Buscar platos o categorías"
                className="h-12 w-full rounded-full border bg-transparent py-3 pl-12 pr-12 text-sm font-medium outline-none transition-shadow placeholder:opacity-55 focus:ring-2 sm:h-14 sm:text-base"
                style={{
                  backgroundColor: theme.mode === 'dark' ? withAlpha(theme.text, 0.07) : theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                  boxShadow: `0 12px 32px ${withAlpha(theme.text, theme.mode === 'dark' ? 0.08 : 0.06)}`,
                  '--tw-ring-color': withAlpha(theme.primary, 0.34),
                } as React.CSSProperties}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-opacity hover:opacity-75"
                  style={{ backgroundColor: withAlpha(theme.text, 0.1), color: theme.text }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {normalizedQuery && (
              <p className="mt-2 text-center text-xs font-medium" role="status" style={{ color: theme.mutedText }}>
                {searchResultCount === 1 ? '1 plato encontrado' : `${searchResultCount} platos encontrados`}
              </p>
            )}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <>
          <div ref={categoryNavSentinelRef} className="h-px" aria-hidden="true" data-carta-category-sentinel />
          <nav
            ref={categoryNavRef}
            aria-label="Categorías de la carta"
            data-carta-category-nav-stuck={categoryNavStuck ? 'true' : 'false'}
            className={`pointer-events-none sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${categoryNavStuck ? 'backdrop-blur-xl' : 'border-transparent'}`}
            style={categoryNavStuck ? {
              background: `linear-gradient(180deg, ${withAlpha(theme.background, 0.92)} 0%, ${withAlpha(theme.background, 0.78)} 100%)`,
              borderColor: withAlpha(theme.text, 0.09),
              boxShadow: `0 10px 30px ${withAlpha(theme.text, 0.08)}`,
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            } : undefined}
          >
            <div className={`no-scrollbar pointer-events-auto mx-auto w-full ${STOREFRONT_CONTAINER_CLASS} overflow-x-auto px-4 py-3 sm:overflow-x-visible sm:px-6`}>
              <div
                data-carta-category-strip
                className="grid w-max min-w-full gap-2 sm:flex sm:w-max sm:min-w-full sm:justify-center"
                style={categories.length > 2 ? {
                  gridTemplateColumns: `repeat(${Math.ceil(categories.length / 2)}, minmax(96px, max-content))`,
                  gridTemplateRows: 'repeat(2, minmax(0, auto))',
                  justifyContent: 'center',
                } : {
                  gridTemplateColumns: `repeat(${Math.max(categories.length, 1)}, minmax(96px, max-content))`,
                  justifyContent: 'center',
                }}
              >
                {categories.map((category, index) => {
                  const active = index === safeActiveIndex;
                  return (
                    <button
                      key={category.id ?? 'uncategorized'}
                      type="button"
                      onClick={() => selectCategory(index)}
                      className="min-w-[96px] whitespace-nowrap rounded-full border px-2 py-2 text-xs font-semibold leading-4 shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] motion-reduce:transition-none sm:shrink-0 sm:px-4 sm:text-sm"
                      title={category.name}
                      style={active
                        ? { backgroundColor: theme.primary, borderColor: theme.primary, color: '#fff', boxShadow: `0 8px 24px ${withAlpha(theme.primary, 0.24)}` }
                        : theme.mode === 'dark'
                          ? { backgroundColor: withAlpha(theme.text, 0.94), borderColor: withAlpha(theme.text, 0.94), color: theme.background }
                          : { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </>
      )}

      <main className={`mx-auto w-full ${STOREFRONT_CONTAINER_CLASS} px-4 pb-12 sm:px-6 sm:pb-20`}>
        {visibleCategories.map((category) => {
          const realIndex = categories.findIndex((item) => item.id === category.id);
          const refKey = category.id ?? 'uncategorized';
          return (
            <div key={refKey} ref={(node) => {
              if (node) categoryRefs.current.set(refKey, node);
              else categoryRefs.current.delete(refKey);
            }}>
              <CategorySection category={category} index={realIndex} page={page} theme={theme} />
            </div>
          );
        })}

        {normalizedQuery && searchResultCount === 0 && (
          <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
            <Search className="h-7 w-7" aria-hidden="true" style={{ color: theme.primary }} />
            <h2 className="mt-4 text-xl font-bold" style={{ color: theme.text }}>No encontramos ese plato</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: theme.mutedText }}>
              Prueba con otro nombre, ingrediente o categoría.
            </p>
          </div>
        )}

        {!normalizedQuery && page.navigationMode === 'paginated' && categories.length > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3 pt-4">
            <button
              type="button"
              disabled={safeActiveIndex === 0}
              onClick={() => setActiveIndex(Math.max(0, safeActiveIndex - 1))}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35"
              style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              type="button"
              disabled={safeActiveIndex === categories.length - 1}
              onClick={() => setActiveIndex(Math.min(categories.length - 1, safeActiveIndex + 1))}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
              style={{ backgroundColor: theme.primary }}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>

    </div>
  );
}
