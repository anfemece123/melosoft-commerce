import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react';
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
      ? 'text-4xl font-black tracking-[-0.035em] sm:text-7xl'
      : 'text-4xl font-black tracking-[-0.05em] sm:text-6xl';
  const imageFrameClassName = isMinimal
    ? 'aspect-[4/3] max-w-2xl rounded-[2rem] sm:aspect-[16/7]'
    : isGallery
      ? 'aspect-[4/3] max-w-2xl rounded-t-[42%] rounded-b-[2.5rem] sm:aspect-[16/10]'
      : 'aspect-square max-w-md rounded-[42%]';
  const headerGradientDirection = isGallery ? '180deg' : isMinimal ? '160deg' : '135deg';
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
      <div className={`relative z-10 mx-auto flex w-full ${STOREFRONT_CONTAINER_CLASS} flex-col items-center`}>
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
  categoryImageUrl,
  page,
  theme,
}: {
  category: PublicCartaCategory;
  categoryImageUrl: string | null;
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

  if (page.templateKey === 'gallery' && categoryImageUrl) {
    return (
      <div className="relative mb-6 min-h-52 overflow-hidden rounded-[2rem] sm:min-h-64" style={{ boxShadow: `0 22px 60px ${theme.shadow}` }}>
        <img src={categoryImageUrl} alt={category.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div className="relative flex min-h-52 flex-col justify-end p-6 text-white sm:min-h-64 sm:p-9">
          <h2 className="text-3xl font-black sm:text-5xl">{category.name}</h2>
          {page.showCategoryDescriptions && category.description && <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{category.description}</p>}
        </div>
      </div>
    );
  }

  const centered = page.categoryHeadingAlignment === 'center';
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

function resolveCategoryImageUrl(category: PublicCartaCategory, page: PublicCartaPage): string | null {
  if (page.productImageMode === 'none') return null;
  if (page.productImageMode === 'all') return category.imageUrl;

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
  const showProductImages = page.productImageMode === 'all';
  const categoryImageUrl = resolveCategoryImageUrl(category, page);
  const headingImageUrl = page.productImageMode === 'all' ? categoryImageUrl : null;
  const categoryImagePosition = category.id ? page.categoryImagePositions[category.id] ?? 'beside_right' : 'beside_right';
  const categoryImageSize = category.id ? page.categoryImageSizes[category.id] ?? 'medium' : 'medium';
  const imageBesideProducts = categoryImagePosition === 'beside_left' || categoryImagePosition === 'beside_right';
  const categoryImageIsPng = isLikelyPngAsset(categoryImageUrl);
  const editorialImageShape = page.templateKey === 'gallery'
    ? 'rounded-t-[45%] rounded-b-[1.75rem]'
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
  const productCards = category.products.map((product) => (
    <CartaProductCard
      key={product.id}
      product={product}
      currency={page.currency}
      theme={theme}
      variant={cardStyle}
      showDescription={page.showProductDescriptions}
      showImage={showProductImages}
      compact={page.productImageMode === 'first_per_category' && imageBesideProducts && Boolean(categoryImageUrl)}
    />
  ));
  return (
    <section
      data-carta-category={category.id ?? 'uncategorized'}
      className={`relative isolate scroll-mt-24 overflow-hidden ${isSignature ? 'py-12 sm:py-16 lg:py-20' : 'py-8 sm:py-12'}`}
    >
      <div className="relative z-10">
        {page.productImageMode === 'first_per_category' && categoryImagePosition === 'above_heading' && (
          <div className="mb-7 sm:mb-9">{renderCategoryImage(false)}</div>
        )}
        <CategoryHeading category={category} categoryImageUrl={headingImageUrl} page={page} theme={theme} />
        {page.productImageMode === 'first_per_category' && categoryImagePosition === 'below_heading' && (
          <div className="mb-7 sm:mb-9">{renderCategoryImage(false)}</div>
        )}
        {page.productImageMode === 'first_per_category' ? (
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
                ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3'
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
  const categoryRefs = useRef(new Map<string, HTMLElement>());
  const categories = page.categories;
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, categories.length - 1));
  const gradientAccent = resolveCartaGradientAccent(theme);
  const gradientOpacity = theme.mode === 'dark' ? 0.1 : 0.055;

  function selectCategory(index: number) {
    setActiveIndex(index);
    if (page.navigationMode === 'continuous') {
      const id = categories[index]?.id ?? 'uncategorized';
      categoryRefs.current.get(id)?.scrollIntoView({ behavior: preview ? 'auto' : 'smooth', block: 'start' });
    }
  }

  const visibleCategories = page.navigationMode === 'paginated' ? categories.slice(safeActiveIndex, safeActiveIndex + 1) : categories;

  return (
    <div
      className="min-h-screen"
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
        <nav
          aria-label="Categorías de la carta"
          className="pointer-events-none sticky top-0 z-30"
        >
          <div className={`no-scrollbar pointer-events-auto mx-auto w-full ${STOREFRONT_CONTAINER_CLASS} overflow-x-auto px-4 py-3 sm:px-6`}>
            <div data-carta-category-strip className="flex w-max min-w-full justify-center gap-2">
              {categories.map((category, index) => {
                const active = index === safeActiveIndex;
                return (
                  <button
                    key={category.id ?? 'uncategorized'}
                    type="button"
                    onClick={() => selectCategory(index)}
                    className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-all"
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

        {page.navigationMode === 'paginated' && categories.length > 1 && (
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
