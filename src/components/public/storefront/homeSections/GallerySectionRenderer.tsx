import { Link } from 'react-router-dom';
import type { PublicHomeSection, PublicHomeSectionItem } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { StorefrontMediaFrame } from '../StorefrontMediaFrame';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import type { Json } from '@/types/database.types';

interface GallerySectionRendererProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
}

function GalleryTile({ item }: { item: PublicHomeSectionItem }) {
  const frame = (
    <StorefrontMediaFrame
      src={item.imageUrl}
      alt={item.title ?? ''}
      aspectClassName="aspect-square"
      roundedClassName="rounded-2xl"
      className="bg-transparent shadow-sm transition-transform duration-300 hover:scale-[1.02]"
      imageClassName="h-full w-full object-cover"
      fallback={<div className="h-full w-full bg-gray-100" />}
    />
  );
  return item.linkUrl ? (
    <Link to={item.linkUrl} className="block">
      {frame}
    </Link>
  ) : (
    frame
  );
}

export function GallerySectionRenderer({ section, theme }: GallerySectionRendererProps) {
  const items = section.items.filter((item) => item.imageUrl);
  if (items.length === 0) return null;

  const content = parseHomeSectionContent('gallery', section.content as Json);
  const layout = content.sectionType === 'gallery' ? content.layout : 'grid';

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className={`mx-auto ${STOREFRONT_CONTAINER_CLASS}`}>
        {(section.heading || section.subheading) && (
          <div className="mb-6 text-center">
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

        {layout === 'carousel' ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
            {items.map((item) => (
              <div key={item.id} className="w-[70%] shrink-0 snap-start sm:w-[40%] lg:w-[28%]">
                <GalleryTile item={item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
            {items.map((item) => (
              <GalleryTile key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
