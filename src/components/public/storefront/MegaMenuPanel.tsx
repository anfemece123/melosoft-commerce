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
      className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-5 py-5 lg:px-8 lg:py-6`}
      aria-label={`Categorías de ${catalogLabel}`}
    >
      <div className="grid gap-x-9 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categoryTree.map((category) => {
          const children = (category.children ?? []).filter((child) => child.showInMenu);
          return (
            <section key={category.id} className="min-w-0">
              <Link
                to={categoryHref(storeSlug, category.slug)}
                onClick={onClose}
                className="group flex items-center gap-3 rounded-xl py-1 outline-none transition-opacity hover:opacity-70 focus-visible:ring-2"
                style={{ color: theme.text }}
              >
                <MenuImage src={category.imageUrl} alt="" sizeClassName="h-12 w-12" />
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold">
                  <span className="truncate">{category.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>

              {children.length > 0 ? (
                <div className={category.imageUrl ? 'ml-[60px] mt-2 space-y-0.5' : 'mt-2 space-y-0.5'}>
                  {children.slice(0, 6).map((child) => (
                    <Link
                      key={child.id}
                      to={subcategoryHref(storeSlug, category.slug, child.slug)}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg py-1.5 text-[13px] outline-none transition-opacity hover:opacity-60 focus-visible:ring-2"
                      style={{ color: theme.mutedText }}
                    >
                      <MenuImage src={child.imageUrl} alt="" sizeClassName="h-6 w-6 rounded-md" />
                      <span className="truncate">{child.name}</span>
                    </Link>
                  ))}
                  {children.length > 6 ? (
                    <Link
                      to={categoryHref(storeSlug, category.slug)}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 pt-1 text-xs font-semibold hover:opacity-60"
                      style={{ color: theme.primary }}
                    >
                      Ver más <ArrowRight className="h-3 w-3" />
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
            className="group flex min-w-0 items-center gap-3 self-start rounded-xl py-1 outline-none transition-opacity hover:opacity-70 focus-visible:ring-2"
            style={{ color: theme.text }}
          >
            <MenuImage src={collection.imageUrl} alt="" sizeClassName="h-12 w-12" />
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold">
              <span className="truncate">{collection.name}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
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
      className={`mx-auto ${STOREFRONT_CONTAINER_CLASS} px-5 py-5 lg:px-8 lg:py-6`}
      aria-label={`Opciones de ${activeCategory.name}`}
    >
      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <section className="min-w-0">
          <Link
            to={categoryHref(storeSlug, activeCategory.slug)}
            onClick={onClose}
            className="group flex items-center gap-3 rounded-xl py-1 outline-none transition-opacity hover:opacity-70 focus-visible:ring-2"
            style={{ color: theme.text }}
          >
            <MenuImage src={activeCategory.imageUrl} alt="" sizeClassName="h-14 w-14" />
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-base font-semibold">
              <span className="truncate">{activeCategory.name}</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          {subcategories.length > 0 ? (
            <div className={activeCategory.imageUrl ? 'ml-[68px] mt-2 space-y-0.5' : 'mt-2 space-y-0.5'}>
              {subcategories.slice(0, 8).map((subcategory) => (
                <Link
                  key={subcategory.id}
                  to={subcategoryHref(storeSlug, activeCategory.slug, subcategory.slug)}
                  onClick={onClose}
                  className="group flex items-center gap-2 rounded-lg py-1.5 text-sm outline-none transition-opacity hover:opacity-60 focus-visible:ring-2"
                  style={{ color: theme.mutedText }}
                >
                  <MenuImage src={subcategory.imageUrl} alt="" sizeClassName="h-7 w-7 rounded-md" />
                  <span className="min-w-0 flex-1 truncate">{subcategory.name}</span>
                </Link>
              ))}
              {subcategories.length > 8 ? (
                <Link
                  to={categoryHref(storeSlug, activeCategory.slug)}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 pt-1 text-xs font-semibold hover:opacity-60"
                  style={{ color: theme.primary }}
                >
                  Ver más <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>

        {visibleFacets.map((facet) => (
          <section key={facet.id} className="min-w-0">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: theme.mutedText }}>
              {facet.name}
            </p>
            <div className="space-y-0.5">
              {facet.values.slice(0, 8).map((value) => (
                <Link
                  key={value.id}
                  to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(activeCategory.slug)}&f_${encodeURIComponent(facet.slug)}=${encodeURIComponent(value.slug)}`)}
                  onClick={onClose}
                  className="block rounded-md py-1.5 text-sm outline-none transition-opacity hover:opacity-60 focus-visible:ring-2"
                  style={{ color: theme.text }}
                >
                  {value.value}
                </Link>
              ))}
              {facet.values.length > 8 ? (
                <Link
                  to={categoryHref(storeSlug, activeCategory.slug)}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 pt-2 text-xs font-semibold hover:opacity-60"
                  style={{ color: theme.primary }}
                >
                  Ver más <ArrowRight className="h-3 w-3" />
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
      className="absolute inset-x-0 top-full z-50 max-h-[min(70vh,580px)] w-full overflow-y-auto overscroll-contain"
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
