import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import type {
  PublicStoreCategory,
  PublicStoreCollection,
  PublicStoreFacet,
} from '@/types/common.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface MegaMenuPanelProps {
  theme: StorefrontTheme;
  storeSlug: string;
  catalogLabel: string;
  categoryTree: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  activeCategory?: PublicStoreCategory | null;
  megaMenuFacets?: PublicStoreFacet[];
  onClose: () => void;
}

function categoryHref(storeSlug: string, categorySlug: string): string {
  return buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(categorySlug)}`);
}

function subcategoryHref(storeSlug: string, categorySlug: string, subcategorySlug: string): string {
  return buildStorefrontPath(
    storeSlug,
    `/catalog?cat=${encodeURIComponent(categorySlug)}&sub=${encodeURIComponent(subcategorySlug)}`,
  );
}

function MenuImage({
  src,
  alt,
  sizeClassName,
}: {
  src: string | null;
  alt: string;
  sizeClassName: string;
}) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`shrink-0 rounded-xl object-cover ${sizeClassName}`}
    />
  );
}

function GlobalCatalogMenu({
  theme,
  storeSlug,
  catalogLabel,
  categoryTree,
  collections,
  onClose,
}: Omit<MegaMenuPanelProps, 'activeCategory' | 'megaMenuFacets'>) {
  return (
    <nav
      className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-5 py-7 lg:px-10 lg:py-8`}
      aria-label={`Categorías de ${catalogLabel}`}
    >
      <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categoryTree.map((category) => {
          const children = (category.children ?? []).filter((child) => child.showInMenu);
          return (
            <section key={category.id} className="min-w-0">
              <Link
                to={categoryHref(storeSlug, category.slug)}
                onClick={onClose}
                className="group flex items-center gap-4 rounded-2xl px-2 py-2 outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/5"
                style={{ color: theme.text }}
              >
                <MenuImage src={category.imageUrl} alt="" sizeClassName="h-16 w-16" />
                <span className="flex min-w-0 flex-1 items-center gap-2 text-[18px] font-semibold leading-tight">
                  <span className="truncate">{category.name}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>

              {children.length > 0 ? (
                <div className={category.imageUrl ? 'ml-[80px] mt-3 space-y-1' : 'mt-3 space-y-1'}>
                  {children.slice(0, 6).map((child) => (
                    <Link
                      key={child.id}
                      to={subcategoryHref(storeSlug, category.slug, child.slug)}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl py-2 text-[15px] outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/5"
                      style={{ color: theme.mutedText }}
                    >
                      <MenuImage src={child.imageUrl} alt="" sizeClassName="h-8 w-8 rounded-lg" />
                      <span className="truncate">{child.name}</span>
                    </Link>
                  ))}
                  {children.length > 6 ? (
                    <Link
                      to={categoryHref(storeSlug, category.slug)}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold hover:opacity-60"
                      style={{ color: theme.primary }}
                    >
                      Ver más <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}

        {collections.map((collection) => (
          <Link
            key={collection.id}
            to={buildStorefrontPath(storeSlug, `/catalog?collection=${encodeURIComponent(collection.slug)}`)}
            onClick={onClose}
            className="group flex min-w-0 items-center gap-4 self-start rounded-2xl px-2 py-2 outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/5"
            style={{ color: theme.text }}
          >
            <MenuImage src={collection.imageUrl} alt="" sizeClassName="h-16 w-16" />
            <span className="flex min-w-0 flex-1 items-center gap-2 text-[18px] font-semibold leading-tight">
              <span className="truncate">{collection.name}</span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function CategoryMenu({
  theme,
  storeSlug,
  activeCategory,
  megaMenuFacets,
  onClose,
}: MegaMenuPanelProps & { activeCategory: PublicStoreCategory }) {
  const subcategories = (activeCategory.children ?? []).filter((category) => category.showInMenu);
  const visibleFacets = (megaMenuFacets ?? []).filter((facet) => facet.values.length > 0).slice(0, 4);

  return (
    <nav
      className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-5 py-7 lg:px-10 lg:py-8`}
      aria-label={`Opciones de ${activeCategory.name}`}
    >
      <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <section className="min-w-0">
          <Link
            to={categoryHref(storeSlug, activeCategory.slug)}
            onClick={onClose}
            className="group flex items-center gap-4 rounded-2xl px-2 py-2 outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/5"
            style={{ color: theme.text }}
          >
            <MenuImage src={activeCategory.imageUrl} alt="" sizeClassName="h-[72px] w-[72px]" />
            <span className="flex min-w-0 flex-1 items-center gap-2 text-[20px] font-semibold leading-tight">
              <span className="truncate">{activeCategory.name}</span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          {subcategories.length > 0 ? (
            <div className={activeCategory.imageUrl ? 'ml-[88px] mt-3 space-y-1' : 'mt-3 space-y-1'}>
              {subcategories.slice(0, 8).map((subcategory) => (
                <Link
                  key={subcategory.id}
                  to={subcategoryHref(storeSlug, activeCategory.slug, subcategory.slug)}
                  onClick={onClose}
                  className="group flex items-center gap-3 rounded-xl py-2 text-base outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/5"
                  style={{ color: theme.mutedText }}
                >
                  <MenuImage src={subcategory.imageUrl} alt="" sizeClassName="h-8 w-8 rounded-lg" />
                  <span className="min-w-0 flex-1 truncate">{subcategory.name}</span>
                </Link>
              ))}
              {subcategories.length > 8 ? (
                <Link
                  to={categoryHref(storeSlug, activeCategory.slug)}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold hover:opacity-60"
                  style={{ color: theme.primary }}
                >
                  Ver más <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>

        {visibleFacets.map((facet) => (
          <section key={facet.id} className="min-w-0">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: theme.mutedText }}>
              {facet.name}
            </p>
            <div className="space-y-0.5">
              {facet.values.slice(0, 8).map((value) => (
                <Link
                  key={value.id}
                  to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(activeCategory.slug)}&f_${encodeURIComponent(facet.slug)}=${encodeURIComponent(value.slug)}`)}
                  onClick={onClose}
                  className="block rounded-xl px-2 py-2 text-base outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/5"
                  style={{ color: theme.text }}
                >
                  {value.value}
                </Link>
              ))}
              {facet.values.length > 8 ? (
                <Link
                  to={categoryHref(storeSlug, activeCategory.slug)}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold hover:opacity-60"
                  style={{ color: theme.primary }}
                >
                  Ver más <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}

export function MegaMenuPanel(props: MegaMenuPanelProps) {
  const categoryTree = props.categoryTree.filter((category) => category.showInMenu);
  const collections = props.collections.filter((collection) => collection.showInMenu);
  const hasGlobalContent = categoryTree.length > 0 || collections.length > 0;
  const hasCategoryContent = Boolean(
    props.activeCategory && (
      (props.activeCategory.children ?? []).some((category) => category.showInMenu)
      || (props.megaMenuFacets ?? []).some((facet) => facet.values.length > 0)
    ),
  );

  if (props.activeCategory ? !hasCategoryContent : !hasGlobalContent) return null;

  return (
    <div
      id="storefront-mega-menu"
      className="absolute inset-x-0 top-full z-50 max-h-[min(78vh,700px)] w-full overflow-y-auto overscroll-contain"
      data-layout="overlay"
      style={{
        backgroundColor: props.theme.mode === 'dark'
          ? `${props.theme.background}fa`
          : `${props.theme.background}fd`,
        borderColor: props.theme.border,
        boxShadow: `0 18px 45px ${props.theme.shadow}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      role="region"
      aria-label={props.activeCategory ? `Opciones de ${props.activeCategory.name}` : `Explorar ${props.catalogLabel}`}
    >
      {props.activeCategory ? (
        <CategoryMenu {...props} activeCategory={props.activeCategory} />
      ) : (
        <GlobalCatalogMenu
          theme={props.theme}
          storeSlug={props.storeSlug}
          catalogLabel={props.catalogLabel}
          categoryTree={categoryTree}
          collections={collections}
          onClose={props.onClose}
        />
      )}
    </div>
  );
}
