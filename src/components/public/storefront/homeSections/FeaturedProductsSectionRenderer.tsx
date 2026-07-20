import type { MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PublicHomeSection, PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { buildCatalogItems } from '@/lib/storefront/catalogItems';
import { StorefrontProductCard } from '../StorefrontProductCard';
import { StorefrontProductCarousel } from './StorefrontProductCarousel';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import type { Json } from '@/types/database.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface FeaturedProductsSectionRendererProps {
  section: PublicHomeSection;
  products: PublicProductPage[];
  categories: PublicStoreCategory[];
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  unavailableProductIds: Set<string>;
  onAddToCart?: (event: MouseEvent<HTMLElement>, product: PublicProductPage) => void;
}

const DESKTOP_COLUMN_CLASSES: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

/** Resolves the section's manual/auto product selection against the
 * products array StoreHomePage already has in memory (no extra fetch),
 * then reuses the exact same buildCatalogItems()/StorefrontProductCard
 * pipeline as the catalog page — so variant pricing, showVariantsAsCards
 * splitting, and stock state never diverge between catalog and home. */
export function FeaturedProductsSectionRenderer({
  section,
  products,
  categories,
  theme,
  storeSlug,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  unavailableProductIds,
  onAddToCart,
}: FeaturedProductsSectionRendererProps) {
  const location = useLocation();
  const content = parseHomeSectionContent('featured_products', section.content as Json);
  const maxItems = content.sectionType === 'featured_products' ? content.maxItems : 8;
  const selectionMode = content.sectionType === 'featured_products' ? content.selectionMode : 'auto';
  const columnsDesktop = content.sectionType === 'featured_products' ? content.columnsDesktop : 4;
  const showViewAllButton = content.sectionType === 'featured_products' ? content.showViewAllButton : true;
  const viewAllLabel = content.sectionType === 'featured_products' ? content.viewAllLabel : 'Ver catálogo';
  const layout = content.sectionType === 'featured_products' ? content.layout : 'carousel';

  let resolvedProducts: PublicProductPage[];
  if (selectionMode === 'manual') {
    const productsById = new Map(products.map((p) => [p.productId, p]));
    resolvedProducts = section.items
      .filter((item) => item.linkedEntityType === 'product' && item.linkedEntityId)
      .map((item) => productsById.get(item.linkedEntityId as string))
      .filter((p): p is PublicProductPage => Boolean(p));
  } else {
    resolvedProducts = [...products].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }
  resolvedProducts = resolvedProducts.slice(0, maxItems);

  if (resolvedProducts.length === 0) return null;

  const items = buildCatalogItems(resolvedProducts);

  const cards = items.map((item) => {
    const product = item.product;
    const isUnavailable = unavailableProductIds.has(product.productId) || item.isOutOfStock;
    const categoryLabel = product.categoryParentId
      ? `${categories.find((cat) => cat.id === product.categoryParentId)?.name ?? 'Categoría'} > ${product.categoryName}`
      : product.categoryName;
    return (
      <StorefrontProductCard
        item={item}
        theme={theme}
        storeSlug={storeSlug}
        currency={currency}
        isMenu={isMenu}
        isUnavailable={isUnavailable}
        showCartButton={showCartButton}
        productCardCtaLabel={productCardCtaLabel}
        categoryLabel={categoryLabel}
        linkState={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
        onAddToCart={onAddToCart}
      />
    );
  });

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8" style={{ backgroundColor: theme.secondary }}>
      <div className={`mx-auto ${STOREFRONT_CONTAINER_CLASS}`}>
        {(section.heading || section.subheading) && (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              {section.heading && (
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: theme.text }}>
                  {section.heading}
                </h2>
              )}
              {section.subheading && (
                <p className="mt-1.5 text-sm sm:text-base" style={{ color: theme.mutedText }}>
                  {section.subheading}
                </p>
              )}
            </div>
            {showViewAllButton && (
              <Link
                to={buildStorefrontPath(storeSlug, '/catalog')}
                className="hidden shrink-0 text-sm font-semibold sm:inline-flex sm:items-center sm:gap-1"
                style={{ color: theme.primary }}
              >
                {viewAllLabel} <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        )}

        {layout === 'carousel' ? (
          <StorefrontProductCarousel
            items={cards}
            itemKeys={items.map((item) => item.id)}
            columnsDesktop={columnsDesktop}
            visibleMobile={1}
            theme={theme}
          />
        ) : (
          <div className={`grid grid-cols-2 gap-4 lg:gap-6 ${DESKTOP_COLUMN_CLASSES[columnsDesktop] ?? 'md:grid-cols-4'}`}>
            {items.map((item, index) => (
              <div key={item.id}>{cards[index]}</div>
            ))}
          </div>
        )}

        {showViewAllButton && (
          <div className="mt-6 flex justify-center sm:hidden">
            <Link
              to={buildStorefrontPath(storeSlug, '/catalog')}
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: theme.primary, color: theme.primary }}
            >
              {viewAllLabel}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
