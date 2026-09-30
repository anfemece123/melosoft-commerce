import { Link } from 'react-router-dom';
import type { PublicCategoryExperience } from '@/types/common.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { withAlpha, type StorefrontTheme } from '../storefrontTheme';

interface ExperienceSwitcherProps {
  experiences: PublicCategoryExperience[];
  activeExperience: PublicCategoryExperience | null;
  theme: StorefrontTheme;
  storeSlug: string;
}

/** Segmented control to jump between the company experiences (e.g. its two
 * restaurants). Each option previews its own color so the visitor knows
 * where they are going before the whole page changes. */
export function ExperienceSwitcher({ experiences, activeExperience, theme, storeSlug }: ExperienceSwitcherProps) {
  if (experiences.length < 2) return null;

  return (
    <nav aria-label="Cambiar de experiencia" className="mb-6 flex justify-center">
      <div
        className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border p-1 shadow-sm backdrop-blur-md"
        style={{ borderColor: theme.border, backgroundColor: withAlpha(theme.background, 0.72) }}
      >
        {experiences.map((experience) => {
          const active = experience.id === activeExperience?.id;
          return (
            <Link
              key={experience.id}
              to={buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(experience.categorySlug)}`)}
              aria-current={active ? 'page' : undefined}
              className="flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-all duration-300"
              style={active
                ? { backgroundColor: experience.primaryColor, color: '#ffffff', boxShadow: `0 6px 20px ${withAlpha(experience.primaryColor, 0.35)}` }
                : { color: theme.mutedText }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
                style={{ backgroundColor: active ? 'rgba(255,255,255,0.95)' : experience.primaryColor, color: active ? experience.primaryColor : '#ffffff' }}
              >
                {experience.logoUrl
                  ? <img src={experience.logoUrl} alt="" className="h-full w-full object-cover" />
                  : experience.displayName.trim().charAt(0).toUpperCase()}
              </span>
              <span className="whitespace-nowrap">{experience.displayName}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
