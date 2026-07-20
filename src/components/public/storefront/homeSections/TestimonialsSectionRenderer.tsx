import { Quote, Star, UserCircle } from 'lucide-react';
import type { PublicHomeSection, PublicHomeSectionItem } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import type { Json } from '@/types/database.types';

interface TestimonialsSectionRendererProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
}

function TestimonialStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-3.5 w-3.5"
          style={{ color: '#fbbf24', fill: index < rating ? '#fbbf24' : 'transparent' }}
        />
      ))}
    </div>
  );
}

function TestimonialCard({ item, theme }: { item: PublicHomeSectionItem; theme: StorefrontTheme }) {
  return (
    <div
      className="flex h-full flex-col rounded-2xl p-5 shadow-sm"
      style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}
    >
      <Quote className="h-5 w-5" style={{ color: `${theme.primary}80` }} />
      {item.rating && (
        <div className="mt-2">
          <TestimonialStars rating={item.rating} />
        </div>
      )}
      {item.body && (
        <p className="mt-2 flex-1 text-sm leading-6" style={{ color: theme.text }}>
          “{item.body}”
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title ?? ''} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <UserCircle className="h-10 w-10" style={{ color: `${theme.primary}60` }} />
        )}
        <div className="min-w-0">
          {item.title && (
            <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>
              {item.title}
            </p>
          )}
          {item.subtitle && (
            <p className="truncate text-xs" style={{ color: theme.mutedText }}>
              {item.subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSectionRenderer({ section, theme }: TestimonialsSectionRendererProps) {
  const items = section.items.filter((item) => item.title || item.body);
  if (items.length === 0) return null;

  const content = parseHomeSectionContent('testimonials', section.content as Json);
  const layout = content.sectionType === 'testimonials' ? content.layout : 'grid';

  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8" style={{ backgroundColor: theme.secondary }}>
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
              <div key={item.id} className="w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[32%]">
                <TestimonialCard item={item} theme={theme} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <TestimonialCard key={item.id} item={item} theme={theme} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
