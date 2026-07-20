import { useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PublicHomeSection, PublicProductPage, PublicStoreCategory } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { buildCatalogItems, type CatalogItem } from '@/lib/storefront/catalogItems';
import { StorefrontProductCard } from '../StorefrontProductCard';
import { StorefrontProductCarousel } from './StorefrontProductCarousel';
import { StorefrontCategoryTabs, type StorefrontCategoryTab } from '../StorefrontCategoryTabs';
import { CATALOG_ALL_TAB_ID } from '@/features/homeSections/catalogNav.types';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import type { Json } from '@/types/database.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface CatalogProductsSectionRendererProps {
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

function sortCatalogItems(items: CatalogItem[], order: 'recent' | 'featured' | 'name_asc' | 'price_asc'): CatalogItem[] {
  const sorted = [...items];
  switch (order) {
    case 'price_asc':
      sorted.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case 'name_asc':
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
      break;
    case 'featured':
      sorted.sort((a, b) => (b.product.isFeatured ? 1 : 0) - (a.product.isFeatured ? 1 : 0));
      break;
    case 'recent':
    default:
      sorted.sort((a, b) => b.product.createdAt.localeCompare(a.product.createdAt));
      break;
  }
  return sorted;
}

/** True when `product` belongs to the tab for `categoryId` — either
 * directly (its own category) or as a child of it (its parent category) —
 * so selecting a root category tab also surfaces products filed under one
 * of its subcategories, same semantics as StoreCatalogPage's own category
 * filter. */
function productMatchesCategoryTab(product: PublicProductPage, categoryId: string): boolean {
  return product.categoryId === categoryId || product.categoryParentId === categoryId;
}

/** Shows a capped, ordered sample of the store's *entire* public catalog on
 * the homepage (as opposed to featured_products, which is a curated pick).
 * Reuses buildCatalogItems()/StorefrontProductCard exactly like
 * FeaturedProductsSectionRenderer — same variant/color-card/stock pipeline,
 * no parallel implementation. The maxItems cap is applied to the final
 * catalog items (post-buildCatalogItems), never to the parent product
 * list, so a product that expands into several color/model cards can't
 * blow past the configured limit — and since category filtering happens on
 * `products` *before* that cap, `maxItems` naturally applies per-category. */
export function CatalogProductsSectionRenderer({
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
}: CatalogProductsSectionRendererProps) {
  const location = useLocation();
  const content = parseHomeSectionContent('catalog_products', section.content as Json);
  const isCatalog = content.sectionType === 'catalog_products';

  const maxItems = isCatalog ? content.maxItems : 8;
  const order = isCatalog ? content.order : 'recent';
  const layout = isCatalog ? content.layout : 'carousel';
  const columnsDesktop = isCatalog ? content.columnsDesktop : 4;
  const visibleMobile = isCatalog ? content.visibleMobile : 1;
  const showViewAllButton = isCatalog ? content.showViewAllButton : true;
  const viewAllLabel = isCatalog ? content.viewAllLabel : 'Ver catálogo completo';
  const showCategoryNav = isCatalog ? content.showCategoryNav : false;
  const categoryNavMode = isCatalog ? content.categoryNavMode : 'all';
  const manualCategoryIds = isCatalog ? content.manualCategoryIds : [];
  const defaultCategoryId = isCatalog ? content.defaultCategoryId : null;
  const navStyle = isCatalog ? content.navStyle : 'pills';
  const navAlign = isCatalog ? content.navAlign : 'left';
  const maxVisibleCategories = isCatalog ? content.maxVisibleCategories : 6;

  // Plain (non-memoized) computation — the underlying lists are small
  // (a store's own category/product count), so recomputing every render is
  // cheap and avoids fighting the React Compiler over "this dependency may
  // be mutated later" on props-derived array/string deps.
  function hasMatchingProduct(categoryId: string): boolean {
    return products.some((p) => productMatchesCategoryTab(p, categoryId));
  }
  let categoryTabs: StorefrontCategoryTab[] = [];
  if (showCategoryNav) {
    if (categoryNavMode === 'manual') {
      const byId = new Map(categories.map((c) => [c.id, c]));
      categoryTabs = manualCategoryIds
        .map((id) => byId.get(id))
        .filter((c): c is PublicStoreCategory => Boolean(c && hasMatchingProduct(c.id)))
        .slice(0, maxVisibleCategories)
        .map((c) => ({ id: c.id, name: c.name }));
    } else {
      const pool = categoryNavMode === 'root_only' ? categories.filter((c) => !c.parentId) : categories;
      categoryTabs = pool
        .filter((c) => hasMatchingProduct(c.id))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, maxVisibleCategories)
        .map((c) => ({ id: c.id, name: c.name }));
    }
  }

  function resolveDefaultSelection(): string {
    if (defaultCategoryId && categoryTabs.some((tab) => tab.id === defaultCategoryId)) return defaultCategoryId;
    return CATALOG_ALL_TAB_ID;
  }

  // Every hook below is called unconditionally (before any early return) —
  // `content.sectionType` never actually mismatches 'catalog_products' at
  // runtime here (parseHomeSectionContent always decodes against the type
  // it's asked for), the `isCatalog` checks above exist purely for
  // TypeScript narrowing, not real branching.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(resolveDefaultSelection);
  // Re-syncs the highlighted/active tab whenever the config itself changes
  // (e.g. the owner picks a different default category in the wizard) —
  // without this, the wizard's live preview would keep showing whichever
  // tab was selected before the edit, since a real click never happens
  // there (see StorefrontSectionPreviewFrame's click-capture guard). Uses
  // the React-documented "adjust state during render" pattern instead of
  // an effect (see https://react.dev/learn/you-might-not-need-an-effect) —
  // no setState-in-effect, and the reset is visible in the very same
  // render instead of one tick later.
  const selectionKey = `${defaultCategoryId ?? ''}|${categoryNavMode}|${manualCategoryIds.join(',')}|${maxVisibleCategories}|${section.id}`;
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey);
  if (prevSelectionKey !== selectionKey) {
    setPrevSelectionKey(selectionKey);
    setSelectedCategoryId(resolveDefaultSelection());
  }

  if (!isCatalog) return null;

  const scopedProducts =
    showCategoryNav && selectedCategoryId !== CATALOG_ALL_TAB_ID
      ? products.filter((p) => productMatchesCategoryTab(p, selectedCategoryId))
      : products;

  const allItems = buildCatalogItems(scopedProducts);
  const items = sortCatalogItems(allItems, order).slice(0, maxItems);

  // Nothing to show at all (no nav, no products) — matches the original
  // behavior exactly. When the nav itself has tabs, keep it visible even if
  // the selected category happens to have zero items, so the owner/visitor
  // isn't left disoriented by the whole section vanishing after a click.
  if (items.length === 0 && categoryTabs.length === 0) return null;

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
    <section className="px-4 py-12 sm:px-6 lg:px-8">
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

        {categoryTabs.length > 0 && (
          <StorefrontCategoryTabs
            tabs={categoryTabs}
            activeId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            style={navStyle}
            align={navAlign}
            theme={theme}
          />
        )}

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center" style={{ borderColor: theme.border }}>
            <p className="text-sm" style={{ color: theme.mutedText }}>
              No hay productos en esta categoría por el momento.
            </p>
          </div>
        ) : layout === 'carousel' ? (
          <StorefrontProductCarousel
            items={cards}
            itemKeys={items.map((item) => item.id)}
            columnsDesktop={columnsDesktop}
            visibleMobile={visibleMobile}
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
