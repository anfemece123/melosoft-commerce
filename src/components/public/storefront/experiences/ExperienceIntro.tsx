import { clsx } from 'clsx';
import type { PublicCategoryExperience } from '@/types/common.types';
import { withAlpha, type StorefrontTheme } from '../storefrontTheme';

interface ExperienceIntroProps {
  experience: PublicCategoryExperience;
  theme: StorefrontTheme;
  /** When a cover banner sits right above, the logo overlaps its edge. */
  overlapsCover: boolean;
}

/** Identity block of the active experience: logo, tagline, name in the
 * experience typeface and description, with a small ornament. */
export function ExperienceIntro({ experience, theme, overlapsCover }: ExperienceIntroProps) {
  return (
    <header
      key={experience.id}
      data-testid="experience-intro"
      className={clsx(
        'storefront-rise-in relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center',
        overlapsCover ? '-mt-16 mb-6 sm:-mt-20' : 'mb-6 pt-4 sm:pt-8',
      )}
    >
      <div
        className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-xl ring-4 sm:h-28 sm:w-28"
        style={{
          backgroundColor: theme.background,
          '--tw-ring-color': theme.background,
          boxShadow: `0 18px 50px ${withAlpha(theme.primary, 0.25)}`,
        } as React.CSSProperties}
      >
        {experience.logoUrl ? (
          <img src={experience.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl font-bold" data-storefront-heading style={{ color: theme.primary }}>
            {experience.displayName.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {experience.tagline && (
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: theme.accent }}>
          {experience.tagline}
        </p>
      )}

      <h1
        className={clsx('text-4xl font-bold leading-tight tracking-tight sm:text-5xl', experience.tagline ? 'mt-2' : 'mt-5')}
        style={{ color: theme.text }}
      >
        {experience.displayName}
      </h1>

      <div aria-hidden="true" className="mt-4 flex items-center gap-3">
        <span className="h-px w-10" style={{ backgroundColor: withAlpha(theme.primary, 0.45) }} />
        <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: theme.primary }} />
        <span className="h-px w-10" style={{ backgroundColor: withAlpha(theme.primary, 0.45) }} />
      </div>

      {experience.description && (
        <p className="mt-4 max-w-xl text-base leading-7" style={{ color: theme.mutedText }}>
          {experience.description}
        </p>
      )}
    </header>
  );
}
