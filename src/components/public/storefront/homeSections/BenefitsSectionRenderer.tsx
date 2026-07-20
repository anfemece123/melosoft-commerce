import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicHomeSection, PublicHomeSectionItem } from '@/types/common.types';
import { withAlpha, STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { StorefrontProductCarousel } from './StorefrontProductCarousel';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import { resolveBenefitIcon } from '@/lib/homeSections/benefitIcons';
import { parseBenefitItemSettings, resolveBenefitItemDisplay } from '@/features/homeSections/benefitItem.types';
import { isColorDark } from '@/features/homeSections/promoBanner.types';
import type { BenefitsItemSize, BenefitsLayout, BenefitsStyle } from '@/features/homeSections/benefitSection.types';
import { useAutoScroll } from '@/lib/storefront/useAutoScroll';
import type { Json } from '@/types/database.types';

interface BenefitsSectionRendererProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
}

interface ItemSizeScale {
  iconWrapperClassName: string;
  iconClassName: string;
  titleClassName: string;
  bodyClassName: string;
  gapClassName: string;
  paddingClassName: string;
  logoHeightClassName: string;
}

const ITEM_SIZE_SCALES: Record<BenefitsItemSize, ItemSizeScale> = {
  compact: {
    iconWrapperClassName: 'h-9 w-9',
    iconClassName: 'h-4 w-4',
    titleClassName: 'text-xs font-semibold',
    bodyClassName: 'text-[11px]',
    gapClassName: 'gap-2',
    paddingClassName: 'p-3',
    logoHeightClassName: 'h-7',
  },
  normal: {
    iconWrapperClassName: 'h-11 w-11',
    iconClassName: 'h-5 w-5',
    titleClassName: 'text-sm font-semibold',
    bodyClassName: 'text-xs',
    gapClassName: 'gap-3',
    paddingClassName: 'p-4',
    logoHeightClassName: 'h-9',
  },
  large: {
    iconWrapperClassName: 'h-14 w-14',
    iconClassName: 'h-6 w-6',
    titleClassName: 'text-base font-semibold',
    bodyClassName: 'text-sm',
    gapClassName: 'gap-4',
    paddingClassName: 'p-5',
    logoHeightClassName: 'h-12',
  },
};

interface StyleChrome {
  shellClassName: string;
  shellStyle: CSSProperties;
  textColor: string;
  mutedColor: string;
  iconBg: string;
  iconColor: string;
}

/** Item "chrome" (background/border/text) per section-level `style` — a
 * per-item custom color (from BenefitItemSettings) always wins over the
 * style's own default, so one section can mix a themed background with a
 * single custom-colored standout item. `minimal` reproduces today's exact
 * look (no card shell at all, just the icon badge). */
function resolveStyleChrome(
  style: BenefitsStyle,
  theme: StorefrontTheme,
  customBg: string | null,
  customText: string | null
): StyleChrome {
  switch (style) {
    case 'card':
      return {
        shellClassName: 'rounded-2xl border shadow-sm',
        shellStyle: { backgroundColor: customBg ?? theme.surface, borderColor: theme.border },
        textColor: customText ?? theme.text,
        mutedColor: theme.mutedText,
        iconBg: withAlpha(theme.primary, 0.1),
        iconColor: theme.primary,
      };
    case 'outline':
      return {
        shellClassName: 'rounded-2xl border',
        shellStyle: { backgroundColor: customBg ?? 'transparent', borderColor: theme.border },
        textColor: customText ?? theme.text,
        mutedColor: theme.mutedText,
        iconBg: withAlpha(theme.primary, 0.1),
        iconColor: theme.primary,
      };
    case 'soft':
      return {
        shellClassName: 'rounded-2xl',
        shellStyle: { backgroundColor: customBg ?? withAlpha(theme.primary, 0.06) },
        textColor: customText ?? theme.text,
        mutedColor: theme.mutedText,
        iconBg: withAlpha(theme.primary, 0.14),
        iconColor: theme.primary,
      };
    case 'theme': {
      const bg = customBg ?? theme.primary;
      const dark = isColorDark(bg);
      const text = customText ?? (dark ? '#ffffff' : theme.text);
      return {
        shellClassName: 'rounded-2xl',
        shellStyle: { backgroundColor: bg },
        textColor: text,
        mutedColor: withAlpha(text, 0.75),
        iconBg: withAlpha(text, 0.18),
        iconColor: text,
      };
    }
    case 'minimal':
    default:
      return {
        shellClassName: '',
        shellStyle: customBg ? { backgroundColor: customBg } : {},
        textColor: customText ?? theme.text,
        mutedColor: theme.mutedText,
        iconBg: withAlpha(theme.primary, 0.08),
        iconColor: theme.primary,
      };
  }
}

function IconOrLogo({
  item,
  iconKey,
  chrome,
  size,
  grayscaleUntilHover,
}: {
  item: PublicHomeSectionItem;
  iconKey: ReturnType<typeof resolveBenefitItemDisplay>['iconKey'];
  chrome: StyleChrome;
  size: ItemSizeScale;
  grayscaleUntilHover?: boolean;
}) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.title ?? ''}
        className={`w-auto object-contain ${size.logoHeightClassName} ${
          grayscaleUntilHover ? 'grayscale transition-all duration-200 hover:grayscale-0' : ''
        }`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${size.iconWrapperClassName}`}
      style={{ backgroundColor: chrome.iconBg, color: chrome.iconColor }}
    >
      {renderBenefitIcon(iconKey, size.iconClassName)}
    </span>
  );
}

/** Plain (lowercase, non-component) helper — the eslint react-compiler
 * rule's "components created during render" check is keyed on capitalized
 * function names, so a `const Icon = resolveBenefitIcon(...); return <Icon
 * .../>` shape trips it as soon as it lives inside its own named
 * component, even though nothing is actually being created (just a lookup
 * into the fixed BENEFIT_ICONS map). A lowercase function that directly
 * returns the JSX element sidesteps that analysis entirely. */
function renderBenefitIcon(iconKey: ReturnType<typeof resolveBenefitItemDisplay>['iconKey'], className: string) {
  const Icon = resolveBenefitIcon(iconKey);
  return <Icon className={className} />;
}

function BenefitLinkWrap({ linkUrl, className, children }: { linkUrl: string | null; className: string; children: ReactNode }) {
  if (!linkUrl) return <div className={className}>{children}</div>;
  return linkUrl.startsWith('http') ? (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={linkUrl} className={className}>
      {children}
    </Link>
  );
}

function GridOrCarouselCard({ item, style, size, theme }: { item: PublicHomeSectionItem; style: BenefitsStyle; size: ItemSizeScale; theme: StorefrontTheme }) {
  const settings = parseBenefitItemSettings(item.settings);
  const { iconKey, linkUrl } = resolveBenefitItemDisplay(item);
  const chrome = resolveStyleChrome(style, theme, settings.customBackgroundColor, settings.customTextColor);

  return (
    <BenefitLinkWrap linkUrl={linkUrl} className="block h-full transition-transform hover:-translate-y-0.5">
      <div
        className={`flex h-full flex-col items-center text-center sm:items-start sm:text-left ${chrome.shellClassName} ${size.paddingClassName}`}
        style={chrome.shellStyle}
      >
        <IconOrLogo item={item} iconKey={iconKey} chrome={chrome} size={size} />
        {item.title && (
          <p className={`mt-3 ${size.titleClassName}`} style={{ color: chrome.textColor }}>
            {item.title}
          </p>
        )}
        {item.body && (
          <p className={`mt-1 leading-5 ${size.bodyClassName}`} style={{ color: chrome.mutedColor }}>
            {item.body}
          </p>
        )}
      </div>
    </BenefitLinkWrap>
  );
}

function BandItem({ item, style, size, theme }: { item: PublicHomeSectionItem; style: BenefitsStyle; size: ItemSizeScale; theme: StorefrontTheme }) {
  const settings = parseBenefitItemSettings(item.settings);
  const { iconKey, linkUrl } = resolveBenefitItemDisplay(item);
  const chrome = resolveStyleChrome(style, theme, settings.customBackgroundColor, settings.customTextColor);

  return (
    <BenefitLinkWrap linkUrl={linkUrl} className="block shrink-0 snap-start">
      <div className={`flex items-center ${size.gapClassName} ${chrome.shellClassName} ${size.paddingClassName}`} style={chrome.shellStyle}>
        <IconOrLogo item={item} iconKey={iconKey} chrome={chrome} size={size} />
        {item.title && (
          <span className={`whitespace-nowrap ${size.titleClassName}`} style={{ color: chrome.textColor }}>
            {item.title}
          </span>
        )}
      </div>
    </BenefitLinkWrap>
  );
}

function LogoItem({ item, style, size, theme }: { item: PublicHomeSectionItem; style: BenefitsStyle; size: ItemSizeScale; theme: StorefrontTheme }) {
  const settings = parseBenefitItemSettings(item.settings);
  const { iconKey, linkUrl } = resolveBenefitItemDisplay(item);
  const chrome = resolveStyleChrome(style, theme, settings.customBackgroundColor, settings.customTextColor);

  return (
    <BenefitLinkWrap linkUrl={linkUrl} className="block shrink-0 snap-start">
      <div
        className={`flex items-center justify-center gap-2 ${chrome.shellClassName} ${size.paddingClassName}`}
        style={chrome.shellStyle}
      >
        <IconOrLogo item={item} iconKey={iconKey} chrome={chrome} size={size} grayscaleUntilHover={Boolean(item.imageUrl)} />
        {!item.imageUrl && item.title && (
          <span className={`whitespace-nowrap ${size.titleClassName}`} style={{ color: chrome.textColor }}>
            {item.title}
          </span>
        )}
      </div>
    </BenefitLinkWrap>
  );
}

/** `band`/`logos` share the same lightweight hand-rolled scroll-snap strip
 * (no arrows/dots — a continuous strip, not a paged carousel), optionally
 * auto-scrolling. */
function ScrollStrip({ children, autoScroll }: { children: ReactNode; autoScroll: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  useAutoScroll(trackRef, autoScroll);

  return (
    <div ref={trackRef} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  );
}

const GRID_COLUMN_CLASSES: Record<BenefitsItemSize, string> = {
  compact: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  normal: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export function BenefitsSectionRenderer({ section, theme }: BenefitsSectionRendererProps) {
  const items = section.items.filter((item) => item.title || item.imageUrl);
  if (items.length === 0) return null;

  const content = parseHomeSectionContent('benefits', section.content as Json);
  const isBenefits = content.sectionType === 'benefits';
  const layout: BenefitsLayout = isBenefits ? content.layout : 'grid';
  const itemSize: BenefitsItemSize = isBenefits ? content.itemSize : 'normal';
  const style: BenefitsStyle = isBenefits ? content.style : 'minimal';
  const showArrows = isBenefits ? content.showArrows : true;
  const showDots = isBenefits ? content.showDots : true;
  const autoScroll = isBenefits ? content.autoScroll : false;
  const size = ITEM_SIZE_SCALES[itemSize];

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
          <StorefrontProductCarousel
            items={items.map((item) => (
              <GridOrCarouselCard key={item.id} item={item} style={style} size={size} theme={theme} />
            ))}
            itemKeys={items.map((item) => item.id)}
            columnsDesktop={4}
            visibleMobile={1}
            theme={theme}
            showArrows={showArrows}
            showDots={showDots}
          />
        ) : layout === 'band' ? (
          <ScrollStrip autoScroll={autoScroll}>
            {items.map((item) => (
              <BandItem key={item.id} item={item} style={style} size={size} theme={theme} />
            ))}
          </ScrollStrip>
        ) : layout === 'logos' ? (
          <ScrollStrip autoScroll={autoScroll}>
            {items.map((item) => (
              <LogoItem key={item.id} item={item} style={style} size={size} theme={theme} />
            ))}
          </ScrollStrip>
        ) : (
          <div className={`grid gap-6 ${GRID_COLUMN_CLASSES[itemSize]}`}>
            {items.map((item) => (
              <GridOrCarouselCard key={item.id} item={item} style={style} size={size} theme={theme} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
