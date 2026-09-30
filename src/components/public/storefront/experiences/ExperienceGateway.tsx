import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { PublicCategoryExperience, PublicExperienceGateway } from '@/types/common.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import {
  buildExperienceBackdropStyle,
  EXPERIENCE_HEADING_FONTS,
  useExperienceHeadingFont,
} from '@/lib/storefront/experienceAmbience';
import { withAlpha, type StorefrontTheme } from '../storefrontTheme';

interface ExperienceGatewayProps {
  gateway: PublicExperienceGateway;
  experiences: PublicCategoryExperience[];
  theme: StorefrontTheme;
  storeSlug: string;
  storeName: string;
  storeLogoUrl: string | null;
  isMenu: boolean;
  /** Full-height portada vs. a section placed under the regular hero. */
  asPortada: boolean;
}

/** "Choose your experience" entry for multi-brand companies — e.g. two
 * restaurants sharing one storefront. Each panel carries its own cover,
 * logo, colors and typeface; on desktop the hovered panel widens. */
export function ExperienceGateway({
  gateway,
  experiences,
  theme,
  storeSlug,
  storeName,
  storeLogoUrl,
  isMenu,
  asPortada,
}: ExperienceGatewayProps) {
  const pair = experiences.length === 2;
  const title = gateway.title?.trim();
  const subtitle = gateway.subtitle?.trim();

  return (
    <section
      id="storefront-experience-gateway"
      aria-label={title || `Experiencias de ${storeName}`}
      className={clsx(!asPortada && 'px-4 py-12 sm:px-6 lg:px-8')}
    >
      {(title || subtitle) && (
        <div className={clsx('storefront-rise-in mx-auto max-w-2xl text-center', asPortada ? 'px-4 pb-6 pt-8 sm:pt-10' : 'pb-8')}>
          {title && (
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: theme.text }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-3 text-base leading-7" style={{ color: theme.mutedText }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div
        className={clsx(
          'group/gateway relative flex flex-col gap-2 md:flex-row',
          asPortada ? 'px-2 pb-2 sm:px-3 sm:pb-3' : 'mx-auto max-w-[1440px]',
          pair && 'md:gap-3',
        )}
      >
        {experiences.map((experience, index) => (
          <GatewayPanel
            key={experience.id}
            experience={experience}
            storeSlug={storeSlug}
            isMenu={isMenu}
            index={index}
            tall={asPortada}
            count={experiences.length}
          />
        ))}

        {pair && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 md:block md:group-hover/gateway:opacity-0 md:group-focus-within/gateway:opacity-0"
          >
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 shadow-2xl"
              style={{ borderColor: theme.background, backgroundColor: theme.background }}
            >
              {storeLogoUrl ? (
                <img src={storeLogoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-3xl italic" style={{ color: theme.text }}>&amp;</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function GatewayPanel({
  experience,
  storeSlug,
  isMenu,
  index,
  tall,
  count,
}: {
  experience: PublicCategoryExperience;
  storeSlug: string;
  isMenu: boolean;
  index: number;
  tall: boolean;
  count: number;
}) {
  useExperienceHeadingFont(experience.headingFont);
  const fontFamily = EXPERIENCE_HEADING_FONTS[experience.headingFont].family ?? undefined;
  const href = buildStorefrontPath(storeSlug, `/catalog?cat=${encodeURIComponent(experience.categorySlug)}`);
  const hasCover = Boolean(experience.coverImageUrl);
  // Covers are photos: always read text in white over a dark veil. Without a
  // cover the panel uses the experience's own ambience and text color.
  const textColor = hasCover ? '#ffffff' : experience.textColor;
  const mutedColor = hasCover ? 'rgba(255,255,255,0.82)' : withAlpha(experience.textColor, 0.72);
  const ambience = buildExperienceBackdropStyle({
    ...experience,
    backgroundStyle: experience.backgroundStyle === 'solid' ? 'gradient' : experience.backgroundStyle,
    backgroundIntensity: Math.max(experience.backgroundIntensity, 65),
  });

  return (
    <Link
      to={href}
      data-testid="experience-gateway-panel"
      className={clsx(
        'storefront-rise-in group relative isolate flex min-w-0 flex-1 overflow-hidden rounded-[28px] outline-none',
        'transition-[flex-grow,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:hover:grow-[1.45] md:focus-visible:grow-[1.45]',
        'focus-visible:ring-4',
        tall
          ? count > 2 ? 'min-h-[46svh] md:min-h-[72svh]' : 'min-h-[52svh] md:min-h-[78svh]'
          : 'min-h-[380px] md:min-h-[480px]',
      )}
      style={{
        animationDelay: `${120 + index * 140}ms`,
        backgroundColor: experience.backgroundColor,
        '--tw-ring-color': withAlpha(experience.primaryColor, 0.45),
      } as React.CSSProperties}
    >
      {hasCover ? (
        <img
          src={experience.coverImageUrl ?? undefined}
          alt=""
          loading={index === 0 ? 'eager' : 'lazy'}
          className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={ambience} />
      )}

      {hasCover && (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 transition-opacity duration-700 group-hover:opacity-90"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.18) 40%, ${withAlpha(experience.primaryColor, 0.55)} 78%, rgba(0,0,0,0.82) 100%)`,
          }}
        />
      )}

      <div className="relative flex w-full flex-col items-center justify-end px-6 pb-10 pt-16 text-center sm:px-10 md:pb-14">
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full shadow-xl ring-4 transition-transform duration-700 group-hover:-translate-y-1 sm:h-24 sm:w-24"
          style={{
            backgroundColor: experience.backgroundColor,
            '--tw-ring-color': hasCover ? 'rgba(255,255,255,0.35)' : withAlpha(experience.primaryColor, 0.25),
          } as React.CSSProperties}
        >
          {experience.logoUrl ? (
            <img src={experience.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold" style={{ color: experience.primaryColor, fontFamily }}>
              {experience.displayName.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {experience.tagline && (
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: hasCover ? experience.secondaryColor : experience.accentColor }}
          >
            {experience.tagline}
          </p>
        )}

        <h3
          data-storefront-heading
          className="max-w-md text-4xl font-bold leading-[1.05] tracking-tight drop-shadow-sm sm:text-5xl"
          style={{ color: textColor, fontFamily }}
        >
          {experience.displayName}
        </h3>

        {experience.description && (
          <p className="mt-3 line-clamp-2 max-w-sm text-sm leading-6 sm:text-base" style={{ color: mutedColor }}>
            {experience.description}
          </p>
        )}

        <span
          className="mt-7 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold shadow-lg transition-all duration-500 group-hover:gap-3 group-hover:shadow-xl"
          style={{
            backgroundColor: experience.primaryColor,
            color: '#ffffff',
            borderRadius: experience.buttonRadius,
          }}
        >
          {isMenu ? 'Ver menú' : 'Explorar'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
