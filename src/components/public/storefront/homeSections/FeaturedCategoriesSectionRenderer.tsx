import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { PublicHomeSection, PublicStoreCategory } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { StorefrontMediaFrame } from '../StorefrontMediaFrame';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import type { Json } from '@/types/database.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface FeaturedCategoriesSectionRendererProps {
  section: PublicHomeSection;
  categories: PublicStoreCategory[];
  theme: StorefrontTheme;
  storeSlug: string;
}

export function FeaturedCategoriesSectionRenderer({
  section,
  categories,
  theme,
  storeSlug,
}: FeaturedCategoriesSectionRendererProps) {
  const content = parseHomeSectionContent('featured_categories', section.content as Json);
  const maxItems = content.sectionType === 'featured_categories' ? content.maxItems : 6;
  const selectionMode = content.sectionType === 'featured_categories' ? content.selectionMode : 'auto';

  let resolvedCategories: PublicStoreCategory[];
  if (selectionMode === 'manual') {
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    resolvedCategories = section.items
      .filter((item) => item.linkedEntityType === 'category' && item.linkedEntityId)
      .map((item) => categoriesById.get(item.linkedEntityId as string))
      .filter((c): c is PublicStoreCategory => Boolean(c));
  } else {
    resolvedCategories = categories.filter((c) => !c.parentId);
  }
  resolvedCategories = resolvedCategories.slice(0, maxItems);

  if (resolvedCategories.length === 0) return null;

  // The catalog only resolves a category filter by root slug (?cat=) or
  // root+child (?cat=&sub=) — see StoreCatalogPage's fullCategoryTree.find,
  // which searches roots only. A manually-featured subcategory therefore
  // needs its parent's slug too, or the catalog silently fails to filter.
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  function buildCatalogHref(category: PublicStoreCategory): string {
    if (!category.parentId) {
      return buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(category.slug)}`);
    }
    const parent = categoriesById.get(category.parentId);
    if (!parent) return buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(category.slug)}`);
    return buildStorefrontPath(
      storeSlug,
      `/catalog?cat=${encodeURIComponent(parent.slug)}&sub=${encodeURIComponent(category.slug)}`,
    );
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className={`mx-auto ${STOREFRONT_CONTAINER_CLASS}`}>
        {(section.heading || section.subheading) && (
          <div className="mb-5 text-center">
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
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
          {resolvedCategories.map((category) => (
            <Link
              key={category.id}
              to={buildCatalogHref(category)}
              className="group overflow-hidden rounded-2xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ backgroundColor: theme.surfaceAlt }}
            >
              <StorefrontMediaFrame
                src={category.imageUrl}
                alt={category.name}
                aspectClassName="aspect-square"
                className="bg-transparent"
                imageClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                fallback={
                  <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: `${theme.primary}14` }}>
                    <Package className="h-8 w-8" style={{ color: theme.primary }} />
                  </div>
                }
              />
              <div className="p-3 text-center">
                <p className="text-sm font-semibold" style={{ color: theme.text }}>
                  {category.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
