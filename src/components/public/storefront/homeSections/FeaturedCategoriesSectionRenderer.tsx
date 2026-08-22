import { ArrowUpRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import type {
  PublicCategoryExperience,
  PublicHomeSection,
  PublicStoreCategory,
} from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { StorefrontMediaFrame } from '../StorefrontMediaFrame';
import { StorefrontCategoryCoverCarousel } from './StorefrontCategoryCoverCarousel';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import type { Json } from '@/types/database.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

interface FeaturedCategoriesSectionRendererProps {
  section: PublicHomeSection;
  categories: PublicStoreCategory[];
  experiences: PublicCategoryExperience[];
  theme: StorefrontTheme;
  storeSlug: string;
}

interface CategoryCardEntry {
  category: PublicStoreCategory;
  experience: PublicCategoryExperience | null;
  customImageUrl: string | null;
}

function buildCatalogHref(storeSlug: string, category: PublicStoreCategory, categoriesById: Map<string, PublicStoreCategory>): string {
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

function legacyCategoryCard(
  entry: CategoryCardEntry,
  href: string,
  theme: StorefrontTheme,
): ReactElement {
  const { category } = entry;
  return (
    <Link
      to={href}
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
  );
}

function coverCategoryCard(
  entry: CategoryCardEntry,
  href: string,
  imageSource: 'experience_cover' | 'category_image',
  theme: StorefrontTheme,
): ReactElement {
  const { category, experience, customImageUrl } = entry;
  const imageUrl = customImageUrl
    ?? (imageSource === 'experience_cover' ? experience?.coverImageUrl : null)
    ?? category.imageUrl;
  const title = imageSource === 'experience_cover'
    ? experience?.displayName?.trim() || category.name
    : category.name;

  return (
    <Link
      to={href}
      className="group relative isolate block aspect-[16/8] overflow-hidden rounded-[1.35rem] bg-slate-200 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
    >
      <StorefrontMediaFrame
        src={imageUrl}
        alt={title}
        aspectClassName="absolute inset-0 h-full w-full"
        roundedClassName="rounded-none"
        className="bg-transparent"
        imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        fallback={
          <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ backgroundColor: `${theme.primary}18` }}>
            <Package className="h-9 w-9" style={{ color: theme.primary }} />
            <span className="text-xs font-semibold" style={{ color: theme.text }}>{category.name}</span>
          </div>
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white drop-shadow-sm sm:text-lg">{title}</p>
          {experience && experience.displayName.trim() !== category.name && (
            <p className="mt-0.5 truncate text-xs font-medium text-white/75">{category.name}</p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition-transform group-hover:translate-x-0.5">
          Ver más
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export function FeaturedCategoriesSectionRenderer({
  section,
  categories,
  experiences,
  theme,
  storeSlug,
}: FeaturedCategoriesSectionRendererProps) {
  const content = parseHomeSectionContent('featured_categories', section.content as Json);
  const maxItems = content.sectionType === 'featured_categories' ? content.maxItems : 6;
  const selectionMode = content.sectionType === 'featured_categories' ? content.selectionMode : 'auto';
  const imageSource = content.sectionType === 'featured_categories' ? content.imageSource : 'category_image';
  const layout = content.sectionType === 'featured_categories' ? content.layout : 'grid';

  let resolvedCategories: PublicStoreCategory[];
  if (selectionMode === 'manual') {
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    resolvedCategories = section.items
      .filter((item) => item.linkedEntityType === 'category' && item.linkedEntityId)
      .map((item) => categoriesById.get(item.linkedEntityId as string))
      .filter((category): category is PublicStoreCategory => Boolean(category));
  } else {
    resolvedCategories = categories.filter((category) => !category.parentId);
  }
  resolvedCategories = resolvedCategories.slice(0, maxItems);

  if (resolvedCategories.length === 0) return null;

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const experiencesByCategoryId = new Map(experiences.map((experience) => [experience.categoryId, experience]));
  const itemByCategoryId = new Map(
    section.items
      .filter((item) => item.linkedEntityType === 'category' && item.linkedEntityId)
      .map((item) => [item.linkedEntityId as string, item]),
  );
  const entries: CategoryCardEntry[] = resolvedCategories.map((category) => ({
    category,
    experience: experiencesByCategoryId.get(category.id) ?? null,
    customImageUrl: itemByCategoryId.get(category.id)?.imageUrl ?? null,
  }));
  const useCoverCards = imageSource === 'experience_cover'
    || layout !== 'grid'
    || entries.some((entry) => Boolean(entry.customImageUrl));
  const shouldUseCarousel = layout === 'carousel' || (layout === 'adaptive' && entries.length > 4);

  const cards = entries.map((entry) => {
    const href = buildCatalogHref(storeSlug, entry.category, categoriesById);
    return useCoverCards
      ? coverCategoryCard(entry, href, imageSource, theme)
      : legacyCategoryCard(entry, href, theme);
  });

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className={`mx-auto ${STOREFRONT_CONTAINER_CLASS}`}>
        {(section.heading || section.subheading) && (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div className="min-w-0">
              {section.heading && (
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: theme.text }}>
                  {section.heading}
                </h2>
              )}
              {section.subheading && (
                <p className="mt-1.5 max-w-2xl text-sm sm:text-base" style={{ color: theme.mutedText }}>
                  {section.subheading}
                </p>
              )}
            </div>
            {shouldUseCarousel && (
              <span className="hidden shrink-0 text-xs font-medium sm:block" style={{ color: theme.mutedText }}>
                Desliza para explorar
              </span>
            )}
          </div>
        )}

        {shouldUseCarousel ? (
          <StorefrontCategoryCoverCarousel
            items={cards}
            itemKeys={entries.map((entry) => entry.category.id)}
            theme={theme}
          />
        ) : (
          <div className={`grid grid-cols-1 gap-4 sm:gap-5 ${
            entries.length === 1
              ? 'mx-auto max-w-3xl'
              : entries.length === 2
              ? 'sm:grid-cols-2'
              : entries.length === 3
              ? 'sm:grid-cols-2 lg:grid-cols-3'
              : 'sm:grid-cols-2 lg:grid-cols-4'
          }`}>
            {cards.map((card, index) => <div key={entries[index].category.id}>{card}</div>)}
          </div>
        )}
      </div>
    </section>
  );
}
