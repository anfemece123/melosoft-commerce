import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PublicHomeSection, PublicHomeSectionItem } from '@/types/common.types';
import { withAlpha, STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from '../storefrontTheme';
import { StorefrontMediaFrame } from '../StorefrontMediaFrame';
import { StorefrontProductCarousel } from './StorefrontProductCarousel';
import { parseHomeSectionContent } from '@/features/homeSections/homeSections.mapper';
import {
  parsePromoBannerSettings,
  promoBannerContentPositionClasses,
  promoBannerContentPositionParts,
  isColorDark,
  isPromoBannerContentEmpty,
  PROMO_SECTION_SIZE_SCALES,
  PROMO_CONTENT_SIZE_SCALES,
  PROMO_BUTTON_SIZE_SCALES,
  PROMO_CONTENT_WIDTH_SCALES,
  PROMO_SECTION_SPACING_GAP_CLASSES,
  resolvePromoSectionSize,
  resolvePromoContentSize,
  resolvePromoButtonSize,
  resolvePromoContentWidth,
  resolvePromoSectionSpacing,
  type PromoBannerSettings,
  type PromoBannerOverlay,
  type PromoBannerShellScale,
  type PromoContentSizeScale,
  type PromoContentWidthScale,
} from '@/features/homeSections/promoBanner.types';
import type { Json } from '@/types/database.types';

interface PromoBannersSectionRendererProps {
  section: PublicHomeSection;
  theme: StorefrontTheme;
}

const GRID_CLASSES: Record<'grid_1' | 'grid_2', string> = {
  grid_1: '',
  grid_2: 'sm:grid-cols-2',
};

const ALIGN_CLASSES: Record<PromoBannerSettings['contentAlign'], string> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

/** Every gradient is derived from the *actual* store theme, never a
 * hardcoded generic palette — a banner can never clash with the store's
 * own colors, and if the owner changes the theme later, every gradient
 * banner updates automatically. */
function gradientCss(preset: PromoBannerSettings['gradientPreset'], theme: StorefrontTheme): string {
  switch (preset) {
    case 'warm':
      return `linear-gradient(135deg, ${theme.accent}, ${theme.primary})`;
    case 'dark':
      return `linear-gradient(135deg, ${theme.text}, ${theme.primary})`;
    case 'soft':
      return `linear-gradient(135deg, ${withAlpha(theme.primary, 0.85)}, ${withAlpha(theme.accent, 0.7)})`;
    case 'vibrant':
    default:
      return `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`;
  }
}

/** How strong the legibility scrim over an image should be — shared by
 * resolveBackdropStyle's 'image' branch and ImageFocusBanner, so the same
 * "Overlay" choice behaves consistently everywhere an image sits directly
 * behind text. `null` means no scrim at all (only safe with an already
 * dark/high-contrast image, hence 'none' being an explicit opt-in). */
function overlayAlphas(overlay: PromoBannerOverlay): { from: number; to: number } | null {
  switch (overlay) {
    case 'none':
      return null;
    case 'soft':
      return { from: 0.55, to: 0.03 };
    case 'strong':
      return { from: 0.92, to: 0.25 };
    case 'auto':
    default:
      return { from: 0.85, to: 0.05 };
  }
}

/** Resolves a banner's chosen background into real CSS. 'image' falls
 * back to a plain theme.primary backdrop when there's no imageUrl to use
 * (e.g. promo_card/split pass `null` here on purpose — they already show
 * the image as its own element, so "image" isn't a meaningful backdrop
 * choice for their text block and silently degrades to 'theme' instead of
 * needing special-case handling at each call site). */
function resolveBackdropStyle(settings: PromoBannerSettings, theme: StorefrontTheme, imageUrl: string | null): CSSProperties {
  switch (settings.backgroundType) {
    case 'solid':
      return { backgroundColor: settings.backgroundColor ?? theme.primary };
    case 'gradient':
      return { backgroundImage: gradientCss(settings.gradientPreset, theme) };
    case 'image': {
      if (!imageUrl) return { backgroundColor: theme.primary };
      const alphas = overlayAlphas(settings.overlay);
      return {
        backgroundImage: alphas
          ? `linear-gradient(to top, ${withAlpha(theme.text, alphas.from)}, ${withAlpha(theme.text, alphas.to)}), url(${imageUrl})`
          : `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    case 'theme':
    default:
      return { backgroundColor: theme.primary };
  }
}

// ── Color resolution — the single source of truth for "what color does
// this banner's text/button/content-box actually render as", used by
// every composition below. Nothing here is hardcoded (no bg-white/
// text-gray-900/text-white classes downstream of this point) — every
// color is either theme-derived or an explicit owner choice, with 'auto'
// picking light-vs-dark from the *real* resolved background so text never
// goes invisible. ──

/** Whole-card backdrop darkness — used by hero_center/minimal, whose
 * `backgroundType` paints the entire card (no separate text box), and as
 * the representative sample for split/promo_card's content-background
 * 'auto' mode (see isContentBackgroundDark), since 'auto' there mirrors
 * this same backgroundType. Gradient/theme both sample theme.primary — an
 * exact per-pixel gradient sample isn't worth the complexity for a
 * light/dark decision, and every gradient preset is built from primary/
 * accent, so primary is a representative enough proxy. */
function isBannerBackdropDark(settings: PromoBannerSettings, theme: StorefrontTheme): boolean {
  switch (settings.backgroundType) {
    case 'solid':
      return isColorDark(settings.backgroundColor ?? theme.primary);
    case 'image':
      // Always has a legibility scrim unless the owner explicitly turned
      // it off — 'none' is documented as only safe with an already dark/
      // high-contrast image, so it's still fine to assume dark here.
      return true;
    case 'gradient':
    case 'theme':
    default:
      return isColorDark(theme.primary);
  }
}

/** Text/eyebrow/subtitle color — one control for all three, per the "no
 * demasiados controles" brief. `backgroundIsDark` is supplied by the
 * caller because what counts as "the background" differs per composition
 * (whole card vs. content box vs. image+overlay). */
function resolvePromoTextColor(settings: PromoBannerSettings, theme: StorefrontTheme, backgroundIsDark: boolean): string {
  switch (settings.textColorMode) {
    case 'light':
      return '#ffffff';
    case 'dark':
      return theme.text;
    case 'theme':
      return theme.primary;
    case 'custom':
      return settings.customTextColor ?? (backgroundIsDark ? '#ffffff' : theme.text);
    case 'auto':
    default:
      return backgroundIsDark ? '#ffffff' : theme.text;
  }
}

const CONTENT_BG_OPACITY_ALPHAS: Record<PromoBannerSettings['contentBackgroundOpacity'], number> = {
  transparent: 0,
  soft: 0.35,
  medium: 0.65,
  solid: 1,
};

/** Representative solid color for the content-background's 'auto' mode —
 * mirrors resolveBackdropStyle's own resolution exactly (same theme.primary
 * fallback, same solid/backgroundColor precedence), so a banner saved
 * before this field existed still resolves to *the same visual color* it
 * always had, whether used here (for the light/dark decision) or in
 * resolveContentBackgroundStyle (for the actual paint). */
function resolveContentBackgroundColor(settings: PromoBannerSettings, theme: StorefrontTheme): string {
  switch (settings.contentBackgroundMode) {
    case 'transparent':
      return 'transparent';
    case 'theme':
      return theme.primary;
    case 'solid':
      return settings.customContentBackgroundColor ?? theme.primary;
    case 'white':
      return '#ffffff';
    case 'dark':
      return theme.text;
    case 'auto':
    default:
      return settings.backgroundType === 'solid' ? settings.backgroundColor ?? theme.primary : theme.primary;
  }
}

/** The actual CSS for split/promo_card's text block. 'auto' renders the
 * *real* resolveBackdropStyle output (a true gradient/solid, not
 * flattened) — opacity presets only apply to the solid-family modes,
 * since "opacity of a gradient" isn't a coherent single knob. */
function resolveContentBackgroundStyle(settings: PromoBannerSettings, theme: StorefrontTheme): CSSProperties {
  if (settings.contentBackgroundMode === 'auto') {
    return resolveBackdropStyle(settings, theme, null);
  }
  if (settings.contentBackgroundMode === 'transparent') {
    return { backgroundColor: 'transparent' };
  }
  const alpha = CONTENT_BG_OPACITY_ALPHAS[settings.contentBackgroundOpacity];
  return { backgroundColor: withAlpha(resolveContentBackgroundColor(settings, theme), alpha) };
}

/** Mirrors resolveContentBackgroundStyle's own logic exactly (auto = full
 * base color, transparent = light page context, everything else = base
 * color at its actual painted opacity) — otherwise a dark brand color
 * chosen at "Suave" (35%) would test as a dark background from its full-
 * strength base color alone, even though what's actually painted is a
 * pale tint that reads much better with dark text. */
function isContentBackgroundDark(settings: PromoBannerSettings, theme: StorefrontTheme): boolean {
  if (settings.contentBackgroundMode === 'transparent') return false;
  if (settings.contentBackgroundMode === 'auto') {
    return isColorDark(resolveContentBackgroundColor(settings, theme));
  }
  const alpha = CONTENT_BG_OPACITY_ALPHAS[settings.contentBackgroundOpacity];
  return isColorDark(withAlpha(resolveContentBackgroundColor(settings, theme), alpha));
}

/** CTA accent color before the variant (solid/outline/soft/minimal)
 * decides how it's actually applied. 'auto' keeps today's fixed white
 * pill on dark/colorful backgrounds (the common case, so existing banners
 * render pixel-identical) but switches to the theme color on a light
 * background instead of staying white — a white button on a white/near-
 * white background was exactly the "botón invisible" bug being fixed. */
function resolveButtonAccentColor(settings: PromoBannerSettings, theme: StorefrontTheme, backgroundIsDark: boolean): string {
  switch (settings.buttonColorMode) {
    case 'white':
      return '#ffffff';
    case 'dark':
      return theme.text;
    case 'theme':
      return theme.primary;
    case 'custom':
      return settings.customButtonColor ?? theme.primary;
    case 'auto':
    default:
      return backgroundIsDark ? '#ffffff' : theme.primary;
  }
}

interface ResolvedButtonStyle {
  className: string;
  style: CSSProperties;
}

/** Turns an accent color + variant into the actual paint. 'solid' matches
 * the only style that existed before buttonVariant shipped (solid pill,
 * shadow, dark ink on a light accent / white ink on a dark accent), so a
 * banner saved earlier renders identically once its accent resolves the
 * same as today's hardcoded white. */
function resolveButtonStyle(settings: PromoBannerSettings, theme: StorefrontTheme, backgroundIsDark: boolean): ResolvedButtonStyle {
  const accent = resolveButtonAccentColor(settings, theme, backgroundIsDark);
  const accentIsDark = isColorDark(accent);
  const onAccentText = accentIsDark ? '#ffffff' : theme.mode === 'dark' ? '#0b0f19' : '#111827';

  switch (settings.buttonVariant) {
    case 'outline':
      return { className: 'bg-transparent border-2', style: { borderColor: accent, color: accent } };
    case 'soft':
      return { className: 'border-0', style: { backgroundColor: withAlpha(accent, 0.16), color: accent } };
    case 'minimal':
      return { className: 'border-0 bg-transparent px-0 shadow-none', style: { color: accent } };
    case 'solid':
    default:
      return { className: 'border-0 shadow-sm', style: { backgroundColor: accent, color: onAccentText } };
  }
}

// A very long eyebrow would either wrap (breaking the pill's rounded
// shape) or blow out the card's width — `max-w-full truncate` keeps it a
// single line, always, regardless of what the owner typed.
function Eyebrow({ text, className, textColor }: { text: string | null; className: string; textColor: string }) {
  if (!text) return null;
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full font-semibold uppercase tracking-wide backdrop-blur-sm ${className}`}
      style={{ backgroundColor: withAlpha(textColor, 0.18), color: textColor }}
    >
      {text}
    </span>
  );
}

/** `min-w-0` on the truncating inner span is required, not decorative —
 * without it, a flex child's default `min-width: auto` refuses to shrink
 * below its content's natural size, which silently defeats `truncate`
 * (the ellipsis never kicks in, the pill just overflows instead). */
function BannerCta({
  item,
  buttonClassName,
  buttonStyle,
}: {
  item: PublicHomeSectionItem;
  buttonClassName: string;
  buttonStyle: ResolvedButtonStyle;
}) {
  if (!item.linkLabel || !item.linkUrl) return null;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full font-semibold transition-transform group-hover:scale-[1.03] ${buttonClassName} ${buttonStyle.className}`}
      style={buttonStyle.style}
    >
      <span className="min-w-0 truncate">{item.linkLabel}</span>
      <span aria-hidden className="shrink-0">→</span>
    </span>
  );
}

/** Everything a banner composition needs to render proportionally: the
 * per-item layout/background/etc (`settings`), and the three independent
 * size axes chosen once for the whole section — shell (padding/height),
 * content (typography/gap) and content width. Button size is applied via
 * `buttonClassName` directly on BannerCta rather than threaded through
 * this bag, since it only ever reaches one place. Kept as one bag (rather
 * than 4 separate props per component) so growing/shrinking any axis is a
 * one-line change at the call site, never a per-component prop drill. */
interface BannerProps {
  item: PublicHomeSectionItem;
  theme: StorefrontTheme;
  settings: PromoBannerSettings;
  shell: PromoBannerShellScale;
  contentScale: PromoContentSizeScale;
  width: PromoContentWidthScale;
  buttonClassName: string;
  /** Configured section grid, used to keep the renderer's media ratio in
   * sync with the crop preset selected by the admin uploader. */
  sectionGridLayout: 'grid_1' | 'grid_2';
}

function HeroCenterBanner({ item, theme, settings, shell, contentScale, width, buttonClassName }: BannerProps) {
  const backgroundIsDark = isBannerBackdropDark(settings, theme);
  const textColor = resolvePromoTextColor(settings, theme, backgroundIsDark);
  const buttonStyle = resolveButtonStyle(settings, theme, backgroundIsDark);
  const imageBackdropAspectClassName = settings.backgroundType === 'image' && item.imageUrl
    ? 'aspect-[16/9] sm:aspect-[3/1]'
    : '';

  return (
    // `flex flex-col justify-center` on the stretched h-full root (not
    // just `relative`) — same reasoning as PromoCardBanner: a short
    // banner (e.g. title-only) next to a taller sibling in the same grid
    // row gets stretched to match it, and without justify-center the
    // padding block pins to the top, leaving bare backdrop color below.
    <div
      className={`relative flex h-full flex-col justify-center overflow-hidden rounded-3xl ${imageBackdropAspectClassName}`}
      style={resolveBackdropStyle(settings, theme, item.imageUrl)}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className={`relative flex flex-col ${shell.heroPaddingClassName} ${ALIGN_CLASSES[settings.contentAlign]}`}>
        <div className={`flex w-full flex-col ${contentScale.gapClassName} ${width.heroClassName} ${ALIGN_CLASSES[settings.contentAlign]}`}>
          <Eyebrow text={item.body} className={contentScale.eyebrowClassName} textColor={textColor} />
          {item.title && (
            <p className={`line-clamp-2 font-extrabold tracking-tight ${contentScale.heroTitleClassName}`} style={{ color: textColor }}>
              {item.title}
            </p>
          )}
          {item.subtitle && (
            <p className={`line-clamp-2 ${contentScale.heroSubtitleClassName}`} style={{ color: withAlpha(textColor, 0.85) }}>
              {item.subtitle}
            </p>
          )}
          <BannerCta item={item} buttonClassName={buttonClassName} buttonStyle={buttonStyle} />
        </div>
      </div>
    </div>
  );
}

function MinimalBanner({ item, theme, settings, shell, contentScale, width, buttonClassName }: BannerProps) {
  const backgroundIsDark = isBannerBackdropDark(settings, theme);
  const textColor = resolvePromoTextColor(settings, theme, backgroundIsDark);
  const buttonStyle = resolveButtonStyle(settings, theme, backgroundIsDark);
  const imageBackdropAspectClassName = settings.backgroundType === 'image' && item.imageUrl
    ? 'aspect-[16/9] sm:aspect-[3/1]'
    : '';

  return (
    // Same fix as HeroCenterBanner — see its comment.
    <div
      className={`relative flex h-full flex-col justify-center overflow-hidden rounded-2xl ${imageBackdropAspectClassName}`}
      style={resolveBackdropStyle(settings, theme, item.imageUrl)}
    >
      <div className={`relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${shell.minimalPaddingClassName}`}>
        <div className={`flex min-w-0 flex-1 flex-col ${contentScale.gapClassName} ${width.heroClassName} text-center sm:text-left`}>
          <Eyebrow text={item.body} className={contentScale.eyebrowClassName} textColor={textColor} />
          {item.title && (
            <p className={`line-clamp-2 font-bold ${contentScale.minimalTitleClassName}`} style={{ color: textColor }}>
              {item.title}
            </p>
          )}
          {item.subtitle && (
            <p className={`line-clamp-1 ${contentScale.heroSubtitleClassName}`} style={{ color: withAlpha(textColor, 0.85) }}>
              {item.subtitle}
            </p>
          )}
        </div>
        {/* `shrink` (not `shrink-0`) + `min-w-0` + a max-width cap: a long
            CTA now truncates with an ellipsis via BannerCta's own
            `truncate`, instead of refusing to shrink and pushing past the
            card's edge — the exact "botón salido" bug this cap fixes. */}
        {item.linkLabel && item.linkUrl && (
          <div className="min-w-0 max-w-[65%] shrink self-center sm:max-w-[55%]">
            <BannerCta item={item} buttonClassName={buttonClassName} buttonStyle={buttonStyle} />
          </div>
        )}
      </div>
    </div>
  );
}

/** image_focus's legibility scrim adapts to where the text actually sits —
 * a fixed bottom-to-top gradient (the old, only behavior) makes sense when
 * the text is at the bottom, but leaves top/center placements almost
 * unreadable against a busy image. Top placements get a top-to-bottom
 * gradient instead, and center placements get a soft radial "spotlight"
 * anchored under the text (following its horizontal position too), rather
 * than an edge gradient that never reaches the middle of the image. */
function imageFocusOverlayStyle(settings: PromoBannerSettings, overlayColor: string): CSSProperties | undefined {
  const alphas = overlayAlphas(settings.overlay);
  if (!alphas) return undefined;
  const { vertical, horizontal } = promoBannerContentPositionParts(settings.contentPosition);

  if (vertical === 'top') {
    return { background: `linear-gradient(to bottom, ${withAlpha(overlayColor, alphas.from)}, ${withAlpha(overlayColor, alphas.to)} 60%, transparent)` };
  }
  if (vertical === 'bottom') {
    return { background: `linear-gradient(to top, ${withAlpha(overlayColor, alphas.from)}, ${withAlpha(overlayColor, alphas.to)} 60%, transparent)` };
  }
  const anchorX = horizontal === 'left' ? '25%' : horizontal === 'right' ? '75%' : '50%';
  return {
    background: `radial-gradient(ellipse 75% 65% at ${anchorX} 50%, ${withAlpha(overlayColor, alphas.from)}, ${withAlpha(overlayColor, alphas.to)} 55%, transparent 85%)`,
  };
}

/** "Imagen destacada" uses the same panoramic geometry as its uploader:
 * 3:1 on desktop. Mobile needs more height for readable overlaid content,
 * so it uses a conventional 16:9 crop with the center kept as the safe
 * area. The source dimensions can no longer make the block arbitrarily
 * tall because both ratios are explicit. */
function ImageFocusBanner({ item, theme, settings, shell, contentScale, width, buttonClassName }: BannerProps) {
  const overlayColor =
    settings.backgroundType === 'solid'
      ? settings.backgroundColor ?? theme.text
      : settings.backgroundType === 'gradient'
      ? theme.accent
      : settings.backgroundType === 'theme'
      ? theme.primary
      : theme.text;
  // The text sits directly on the uploaded image (plus its legibility
  // scrim, unless the owner explicitly disabled it) — there's no separate
  // colorable box to sample, so 'auto' text/button color always assumes a
  // dark backdrop here, same as this layout's behavior before these
  // fields existed.
  const backgroundIsDark = true;
  const textColor = resolvePromoTextColor(settings, theme, backgroundIsDark);
  const buttonStyle = resolveButtonStyle(settings, theme, backgroundIsDark);

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-3xl sm:aspect-[3/1]">
      <StorefrontMediaFrame
        src={item.imageUrl}
        alt={item.title ?? ''}
        aspectClassName="h-full"
        roundedClassName="rounded-none"
        className="bg-transparent"
        imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surfaceAlt }} />}
      />
      <div
        className={`absolute inset-0 flex flex-col ${shell.blockPaddingClassName} ${promoBannerContentPositionClasses(settings.contentPosition)}`}
        style={imageFocusOverlayStyle(settings, overlayColor)}
      >
        <div className={`flex w-full flex-col ${contentScale.gapClassName} ${width.blockClassName} ${promoBannerContentPositionClasses(settings.contentPosition)}`}>
          <Eyebrow text={item.body} className={contentScale.eyebrowClassName} textColor={textColor} />
          {item.title && (
            <p className={`line-clamp-2 font-bold drop-shadow ${contentScale.blockTitleClassName}`} style={{ color: textColor }}>
              {item.title}
            </p>
          )}
          {item.subtitle && (
            <p className={`line-clamp-2 ${contentScale.blockSubtitleClassName}`} style={{ color: withAlpha(textColor, 0.85) }}>
              {item.subtitle}
            </p>
          )}
          <BannerCta item={item} buttonClassName={buttonClassName} buttonStyle={buttonStyle} />
        </div>
      </div>
    </div>
  );
}

function PromoCardBanner({ item, theme, settings, shell, contentScale, width, buttonClassName, sectionGridLayout }: BannerProps) {
  const backgroundIsDark = isContentBackgroundDark(settings, theme);
  const textColor = resolvePromoTextColor(settings, theme, backgroundIsDark);
  const buttonStyle = resolveButtonStyle(settings, theme, backgroundIsDark);
  const mediaAspectClassName = sectionGridLayout === 'grid_1'
    ? 'aspect-[16/9] sm:aspect-[3/1]'
    : 'aspect-[16/9]';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <StorefrontMediaFrame
        src={item.imageUrl}
        alt={item.title ?? ''}
        aspectClassName={mediaAspectClassName}
        roundedClassName="rounded-none"
        imageClassName="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
        pngImageClassName="h-full w-full object-contain p-0 transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ backgroundColor: theme.surfaceAlt }}
        fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surfaceAlt }} />}
      />
      <div
        // `justify-center`, not just `flex-1`: in a 3-column grid row,
        // CSS Grid stretches every card to match the *tallest* sibling —
        // a banner with only a title (no subtitle/CTA) still gets
        // stretched to that shared row height, and without justify-center
        // the short content pins to the top, leaving a large empty block
        // of the content-background color below it. That empty block —
        // not a missing/empty banner — was the real "tarjeta azul vacía
        // gigante" the owner was seeing next to two fuller siblings.
        className={`flex flex-1 flex-col justify-center ${shell.blockPaddingClassName} ${ALIGN_CLASSES[settings.contentAlign]}`}
        style={resolveContentBackgroundStyle(settings, theme)}
      >
        <div className={`flex w-full flex-col ${contentScale.gapClassName} ${width.blockClassName} ${ALIGN_CLASSES[settings.contentAlign]}`}>
          <Eyebrow text={item.body} className={contentScale.eyebrowClassName} textColor={textColor} />
          {item.title && (
            <p className={`line-clamp-2 font-bold ${contentScale.blockTitleClassName}`} style={{ color: textColor }}>
              {item.title}
            </p>
          )}
          {item.subtitle && (
            <p className={`line-clamp-2 ${contentScale.blockSubtitleClassName}`} style={{ color: withAlpha(textColor, 0.85) }}>
              {item.subtitle}
            </p>
          )}
          <BannerCta item={item} buttonClassName={buttonClassName} buttonStyle={buttonStyle} />
        </div>
      </div>
    </div>
  );
}

/** "Texto a un lado" — side-by-side image+text. With the section capped at
 * 2 banners max, each column is at least ~half the STOREFRONT_CONTAINER_CLASS
 * desktop width — comfortably wide enough for a 50/50 split to read as intentional
 * rather than cramped, so this never needs a forced-stacked fallback (that
 * existed only for the old, now-removed 3-column layout). Below the `sm`
 * breakpoint this collapses to stacked on its own (`sm:grid-cols-2`). */
function SplitBanner({ item, theme, settings, shell, contentScale, width, buttonClassName }: BannerProps) {
  const imageFirst = settings.imagePosition === 'left';
  const backgroundIsDark = isContentBackgroundDark(settings, theme);
  const textColor = resolvePromoTextColor(settings, theme, backgroundIsDark);
  const buttonStyle = resolveButtonStyle(settings, theme, backgroundIsDark);

  return (
    // The 4:3 image cell is the same ratio enforced by the crop dialog.
    // The actual media is absolutely positioned, so its raw dimensions
    // never participate in grid sizing; if a very large text block makes
    // the row taller, object-contain preserves the complete image while
    // the themed canvas fills the extra space cleanly.
    <div className="grid h-full overflow-hidden rounded-3xl sm:grid-cols-2">
      <div className={`relative ${shell.imageAspectClassName} ${imageFirst ? 'order-1' : 'order-2'}`}>
        <StorefrontMediaFrame
          src={item.imageUrl}
          alt={item.title ?? ''}
          aspectClassName="absolute inset-0 h-full w-full"
          roundedClassName="rounded-none"
          imageClassName="h-full w-full object-contain"
          pngImageClassName="h-full w-full object-contain p-0"
          style={{ backgroundColor: theme.surfaceAlt }}
          fallback={<div className="h-full w-full" style={{ backgroundColor: theme.surfaceAlt }} />}
        />
      </div>
      <div
        className={`flex flex-col justify-center ${shell.blockPaddingClassName} ${imageFirst ? 'order-2' : 'order-1'} ${ALIGN_CLASSES[settings.contentAlign]}`}
        style={resolveContentBackgroundStyle(settings, theme)}
      >
        <div className={`flex w-full flex-col ${contentScale.gapClassName} ${width.blockClassName} ${ALIGN_CLASSES[settings.contentAlign]}`}>
          <Eyebrow text={item.body} className={contentScale.eyebrowClassName} textColor={textColor} />
          {item.title && (
            <p className={`line-clamp-2 font-bold ${contentScale.blockTitleClassName}`} style={{ color: textColor }}>
              {item.title}
            </p>
          )}
          {item.subtitle && (
            <p className={`line-clamp-2 ${contentScale.blockSubtitleClassName}`} style={{ color: withAlpha(textColor, 0.85) }}>
              {item.subtitle}
            </p>
          )}
          <BannerCta item={item} buttonClassName={buttonClassName} buttonStyle={buttonStyle} />
        </div>
      </div>
    </div>
  );
}

interface BannerCardScales {
  shell: PromoBannerShellScale;
  contentScale: PromoContentSizeScale;
  width: PromoContentWidthScale;
  buttonClassName: string;
  sectionGridLayout: 'grid_1' | 'grid_2';
}

function BannerCard({ item, theme, scales }: { item: PublicHomeSectionItem; theme: StorefrontTheme; scales: BannerCardScales }) {
  const settings = parsePromoBannerSettings(item.settings);
  const isExternal = item.linkUrl?.startsWith('http');
  const bannerProps = { item, theme, settings, ...scales };

  let inner: ReactNode;
  switch (settings.layout) {
    case 'split':
      inner = <SplitBanner {...bannerProps} />;
      break;
    case 'promo_card':
      inner = <PromoCardBanner {...bannerProps} />;
      break;
    case 'image_focus':
      inner = <ImageFocusBanner {...bannerProps} />;
      break;
    case 'minimal':
      inner = <MinimalBanner {...bannerProps} />;
      break;
    case 'hero_center':
    default:
      inner = <HeroCenterBanner {...bannerProps} />;
  }

  const className = 'group block h-full';

  if (!item.linkUrl) {
    return <div className={className}>{inner}</div>;
  }

  return isExternal ? (
    <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link to={item.linkUrl} className={className}>
      {inner}
    </Link>
  );
}

export function PromoBannersSectionRenderer({ section, theme }: PromoBannersSectionRendererProps) {
  // Never render a banner with none of title/subtitle/image/CTA/eyebrow —
  // see isPromoBannerContentEmpty for the shared definition (also used by
  // the wizard's live preview and its own save-gate, so this never
  // disagrees with what the owner saw while editing). `.slice(0, 2)` is a
  // hard safety net independent of whatever `content.layout` says — a
  // section saved before the 3-banner grid was removed could still have 3
  // real items sitting in the DB; this guarantees the public page never
  // renders more than 2, no matter what.
  const items = section.items.filter((item) => !isPromoBannerContentEmpty(item)).slice(0, 2);
  if (items.length === 0) return null;

  const content = parseHomeSectionContent('promo_banners', section.content as Json);
  const isPromo = content.sectionType === 'promo_banners';
  const layout = isPromo ? content.layout : 'grid_2';
  const sectionSize = resolvePromoSectionSize(isPromo ? content.sectionSize : undefined);
  const contentSize = resolvePromoContentSize(isPromo ? content.contentSize : undefined);
  const buttonSize = resolvePromoButtonSize(isPromo ? content.buttonSize : undefined);
  const contentWidth = resolvePromoContentWidth(isPromo ? content.contentWidth : undefined);
  const spacing = resolvePromoSectionSpacing(isPromo ? content.spacing : undefined);
  // A grid configured for two banners must not leave a blank half-row when
  // one item is inactive or still empty in the live preview. As soon as a
  // second renderable banner exists, the intended two-column grid returns.
  const renderedGridLayout = items.length === 1 ? 'grid_1' : layout;

  const scales: BannerCardScales = {
    shell: PROMO_SECTION_SIZE_SCALES[sectionSize],
    contentScale: PROMO_CONTENT_SIZE_SCALES[contentSize],
    width: PROMO_CONTENT_WIDTH_SCALES[contentWidth],
    buttonClassName: PROMO_BUTTON_SIZE_SCALES[buttonSize],
    sectionGridLayout: renderedGridLayout,
  };

  // 2 banners get a horizontal swipeable carousel on mobile instead of a
  // vertical stack — "una lista aburrida y pesada" was the exact
  // complaint a plain grid-cols-1 produced below `sm`. Reuses the same
  // StorefrontProductCarousel every other multi-item home section already
  // uses (scroll-snap, peek-next-card, dots), so this doesn't invent a
  // second carousel implementation. Rendered as a *second*, mobile-only
  // DOM tree alongside the desktop grid (each hidden via CSS at the
  // other's breakpoint) rather than one tree that mutates layout via JS —
  // no window-width listener, no hydration/flicker risk, just two
  // responsive-visibility wrappers around the same BannerCard elements.
  const showMobileCarousel = items.length > 1;
  const bannerCards = items.map((item) => <BannerCard key={item.id} item={item} theme={theme} scales={scales} />);

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

        {showMobileCarousel && (
          <div className="sm:hidden">
            <StorefrontProductCarousel
              items={bannerCards}
              itemKeys={items.map((item) => item.id)}
              columnsDesktop={1}
              visibleMobile={1}
              theme={theme}
            />
          </div>
        )}

        <div
          className={`grid grid-cols-1 ${PROMO_SECTION_SPACING_GAP_CLASSES[spacing]} ${GRID_CLASSES[renderedGridLayout]} ${
            showMobileCarousel ? 'hidden sm:grid' : ''
          }`}
        >
          {bannerCards}
        </div>
      </div>
    </section>
  );
}
