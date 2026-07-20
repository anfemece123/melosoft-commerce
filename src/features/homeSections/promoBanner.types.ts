/** Per-banner visual settings for "Banners promocionales" — stored in
 * store_home_section_items.settings (jsonb, migration 079). Deliberately
 * per-item, not per-section: each banner in the same section can have its
 * own layout/background so a "combo" banner and a "20% OFF" banner don't
 * have to look identical. Decoded defensively the same way
 * homeSections.mapper.ts decodes section-level `content` — an unknown/
 * malformed/missing settings blob (every banner saved before this feature
 * existed has `{}`) falls back to defaultPromoBannerSettings(), which is
 * the new premium look, not the old plain one — same "upgrade existing
 * content for free" convention already used for featured_products'
 * `layout` field. */

/** How many banners the section-level grid layout expects — the wizard's
 * "Diseño" step (count first) uses this to know how many Banner N blocks
 * to generate/show in the following "Banners" step, and the save flow
 * uses it to know how many items to actually persist.
 *
 * Deliberately capped at 2 — a 3-column grid produced cramped split
 * layouts, unbalanced cards, and too many size/proportion combinations to
 * keep looking professional. 1 or 2 banners is the whole supported range;
 * see homeSections.mapper.ts for how a pre-existing section with 3 saved
 * items degrades safely (max 2 rendered, never 3). */
export function promoBannerCountForLayout(layout: 'grid_1' | 'grid_2'): number {
  return layout === 'grid_1' ? 1 : 2;
}

/** The subset of fields (shared between HomeSectionDraftItem and
 * PublicHomeSectionItem — every field name and type already matches
 * exactly on both) that decide whether a banner counts as "empty". */
export interface PromoBannerContentFields {
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  linkLabel: string | null;
  body: string | null;
}

/** The single source of truth for "is this banner empty" — a banner is
 * empty only when it has NONE of title/subtitle/image/CTA/eyebrow
 * (whitespace-only text counts as absent). Used identically by:
 * - the public renderer's own filter (never render an empty banner as a
 *   blank card in the real store);
 * - the wizard's live preview (draftToPublicPreviewSection), so it never
 *   shows a "banner that will never actually render" while editing;
 * - the wizard's per-banner inline warning and the Banners step's
 *   `isValid` gate (never let "Guardar sección" persist one).
 * Previously the renderer only checked `imageUrl || title`, which was
 * *narrower* than this — a banner with only a subtitle+CTA and no title/
 * image would have been silently hidden even though it has real,
 * intentional content. */
export function isPromoBannerContentEmpty(fields: PromoBannerContentFields): boolean {
  return (
    !fields.title?.trim() && !fields.subtitle?.trim() && !fields.imageUrl && !fields.linkLabel?.trim() && !fields.body?.trim()
  );
}

// ── Recommended content length per field, scaled by how many banners
// share the row — a title that reads fine alone in a full-width banner
// crowds out the image/padding once its column shrinks to half the width
// in a 2-banner row. These are *soft* recommendations (the wizard shows a
// counter + a gentle note past the limit, never blocks "Siguiente"/
// "Guardar") — the actual visual safety net is line-clamp in the renderer
// (see PromoBannersSectionRenderer.tsx), which these numbers are tuned to
// fill without truncating mid-word in the common case. ──

export function promoRecommendedTitleLength(bannerCount: number): number {
  return bannerCount === 2 ? 45 : 60;
}

export function promoRecommendedSubtitleLength(bannerCount: number): number {
  return bannerCount === 2 ? 80 : 110;
}

export function promoRecommendedEyebrowLength(): number {
  return 30;
}

export function promoRecommendedButtonLabelLength(): number {
  return 20;
}

export type PromoBannerLayout = 'hero_center' | 'split' | 'promo_card' | 'image_focus' | 'minimal';
export type PromoBannerBackgroundType = 'theme' | 'solid' | 'gradient' | 'image';
export type PromoBannerGradientPreset = 'vibrant' | 'warm' | 'dark' | 'soft';
export type PromoBannerImagePosition = 'left' | 'right';
export type PromoBannerContentAlign = 'left' | 'center' | 'right';
export type PromoBannerOverlay = 'auto' | 'soft' | 'strong' | 'none';

/** Free-form placement of the text block over the image — only meaningful
 * for layout === 'image_focus' (the only composition where the image is a
 * full-bleed backdrop with no fixed "column" for the text, see section D
 * of the banners redesign). Encoded as `${vertical}_${horizontal}`, except
 * the dead-center case which has no horizontal suffix — see
 * promoBannerContentPositionParts, which is the single place that decodes
 * this back into two axes. */
export type PromoBannerContentPosition =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'center_left'
  | 'center'
  | 'center_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right';

export const PROMO_BANNER_CONTENT_POSITION_LABELS: Record<PromoBannerContentPosition, string> = {
  top_left: 'Arriba izquierda',
  top_center: 'Arriba centro',
  top_right: 'Arriba derecha',
  center_left: 'Centro izquierda',
  center: 'Centro',
  center_right: 'Centro derecha',
  bottom_left: 'Abajo izquierda',
  bottom_center: 'Abajo centro',
  bottom_right: 'Abajo derecha',
};

/** Decodes a position into independent vertical/horizontal axes — every
 * value splits cleanly on '_' except the plain 'center' case, which has no
 * second segment and defaults its horizontal axis to 'center' too. */
export function promoBannerContentPositionParts(
  position: PromoBannerContentPosition
): { vertical: 'top' | 'center' | 'bottom'; horizontal: 'left' | 'center' | 'right' } {
  const [vertical, horizontal] = position.split('_') as ['top' | 'center' | 'bottom', ('left' | 'center' | 'right') | undefined];
  return { vertical, horizontal: horizontal ?? 'center' };
}

/** Flex classes that actually place the content block at the chosen
 * position inside an `absolute inset-0 flex flex-col` overlay. */
export function promoBannerContentPositionClasses(position: PromoBannerContentPosition): string {
  const { vertical, horizontal } = promoBannerContentPositionParts(position);
  const justify = vertical === 'top' ? 'justify-start' : vertical === 'bottom' ? 'justify-end' : 'justify-center';
  const items =
    horizontal === 'left' ? 'items-start text-left' : horizontal === 'right' ? 'items-end text-right' : 'items-center text-center';
  return `${justify} ${items}`;
}

function isPromoBannerContentPosition(value: unknown): value is PromoBannerContentPosition {
  return (
    value === 'top_left' ||
    value === 'top_center' ||
    value === 'top_right' ||
    value === 'center_left' ||
    value === 'center' ||
    value === 'center_right' ||
    value === 'bottom_left' ||
    value === 'bottom_center' ||
    value === 'bottom_right'
  );
}

/** Uniform text color for eyebrow+title+subtitle together — deliberately
 * ONE control, not three, per the "no quiero demasiados controles, pero
 * que funcione de verdad" brief: 'auto' picks light/dark based on the
 * actual resolved background (see isColorDark/isBannerBackdropDark/
 * isContentBackgroundDark in the renderer), 'light'/'dark' force a side,
 * 'theme' uses the store's brand primary color, 'custom' is a picked hex. */
export type PromoTextColorMode = 'auto' | 'light' | 'dark' | 'theme' | 'custom';

/** Same shape as PromoTextColorMode but for the CTA button's accent color
 * (its fill for 'solid'/'soft', its ink+border for 'outline'/'minimal' —
 * see PromoButtonVariant). Kept as a separate type (not reused) because
 * 'auto' means something different for each: text 'auto' picks light-vs-
 * dark relative to the background it sits on; button 'auto' does the same
 * but historically defaulted to a fixed white pill — see
 * resolveButtonAccentColor for why that default only changes for
 * light backgrounds, never for the existing dark/colorful ones. */
export type PromoButtonColorMode = 'auto' | 'white' | 'dark' | 'theme' | 'custom';

/** How the button's resolved accent color gets applied. 'solid' is the
 * only style that existed before this field shipped (a solid white pill),
 * so it's the default — zero visual change for banners saved earlier. */
export type PromoButtonVariant = 'solid' | 'outline' | 'soft' | 'minimal';

/** Background of the text block — only meaningful for compositions where
 * the text sits in its own colorable area separate from the banner's
 * image (split, promo_card): hero_center/minimal paint their *entire*
 * card via `backgroundType` already (no separate box), and image_focus's
 * text sits directly on the image with its own overlay scrim (no separate
 * box either) — see the wizard's per-layout field visibility. 'auto'
 * mirrors whatever `backgroundType`/`backgroundColor`/`gradientPreset`
 * already resolve to, which is exactly what split/promo_card rendered
 * before this field existed, so a banner saved earlier never changes. */
export type PromoContentBackgroundMode = 'auto' | 'transparent' | 'theme' | 'solid' | 'white' | 'dark';

/** Alpha preset layered on top of the resolved content-background color —
 * presets rather than a raw percentage slider, per "no necesito algo
 * complejo, pero sí usable". Only applied to the solid-family modes above
 * ('theme'/'solid'/'white'/'dark') — 'auto' keeps rendering the real
 * gradient/image backdrop untouched (flattening a gradient to "70%
 * opacity of one color" isn't a coherent operation), and 'transparent'
 * mode is already fully see-through regardless of this preset. */
export type PromoContentBackgroundOpacity = 'transparent' | 'soft' | 'medium' | 'solid';

export interface PromoBannerSettings {
  layout: PromoBannerLayout;
  backgroundType: PromoBannerBackgroundType;
  /** Hex color, used when backgroundType === 'solid'. Falls back to
   * theme.primary at render time when not set. */
  backgroundColor: string | null;
  /** Used when backgroundType === 'gradient' — the actual colors are
   * always derived from the current store theme (see
   * resolvePromoBannerBackdrop in PromoBannersSectionRenderer), never
   * hardcoded, so the gradient can never clash with the store's palette. */
  gradientPreset: PromoBannerGradientPreset;
  /** Used by layouts that don't have a fixed side for the image
   * (hero_center, minimal, promo_card) — image_focus uses
   * `contentPosition` instead, which already encodes horizontal alignment
   * alongside vertical placement. */
  contentAlign: PromoBannerContentAlign;
  /** Used only when layout === 'split' — which side the image sits on. */
  imagePosition: PromoBannerImagePosition;
  /** Used only when layout === 'image_focus' — where the text block sits
   * over the full-bleed image. Defaults to 'bottom_center', which is
   * visually identical to the layout's old (fixed) behavior, so existing
   * banners never jump on first load after this field shipped. */
  contentPosition: PromoBannerContentPosition;
  /** How strong the legibility scrim is over an image (image_focus, or
   * hero_center/minimal with backgroundType 'image'). 'auto' picks a
   * sensible strength on its own; 'none' skips the scrim entirely (only
   * safe with a naturally dark/high-contrast image). */
  overlay: PromoBannerOverlay;
  /** Eyebrow + title + subtitle color — see PromoTextColorMode. */
  textColorMode: PromoTextColorMode;
  /** Hex color, used when textColorMode === 'custom'. */
  customTextColor: string | null;
  /** Background of the separate text block — split/promo_card only, see
   * PromoContentBackgroundMode. */
  contentBackgroundMode: PromoContentBackgroundMode;
  /** Hex color, used when contentBackgroundMode === 'solid'. */
  customContentBackgroundColor: string | null;
  /** Alpha preset for contentBackgroundMode's solid-family modes — see
   * PromoContentBackgroundOpacity. */
  contentBackgroundOpacity: PromoContentBackgroundOpacity;
  /** CTA button accent color — see PromoButtonColorMode. */
  buttonColorMode: PromoButtonColorMode;
  /** Hex color, used when buttonColorMode === 'custom'. */
  customButtonColor: string | null;
  /** CTA button style — see PromoButtonVariant. */
  buttonVariant: PromoButtonVariant;
}

export const PROMO_BANNER_LAYOUT_LABELS: Record<PromoBannerLayout, string> = {
  hero_center: 'Banner centrado',
  split: 'Texto a un lado',
  promo_card: 'Tarjeta promocional',
  image_focus: 'Imagen destacada',
  minimal: 'Minimalista',
};

export const PROMO_BANNER_BACKGROUND_LABELS: Record<PromoBannerBackgroundType, string> = {
  theme: 'Color del tema',
  solid: 'Color sólido',
  gradient: 'Degradado',
  image: 'Imagen de fondo',
};

export const PROMO_BANNER_GRADIENT_LABELS: Record<PromoBannerGradientPreset, string> = {
  vibrant: 'Vibrante',
  warm: 'Cálido',
  dark: 'Oscuro elegante',
  soft: 'Suave',
};

export const PROMO_BANNER_OVERLAY_LABELS: Record<PromoBannerOverlay, string> = {
  auto: 'Automático',
  soft: 'Suave',
  strong: 'Fuerte',
  none: 'Ninguno',
};

export const PROMO_TEXT_COLOR_MODE_LABELS: Record<PromoTextColorMode, string> = {
  auto: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
  theme: 'Color del tema',
  custom: 'Personalizado',
};

export const PROMO_TEXT_COLOR_MODE_HINTS: Record<PromoTextColorMode, string> = {
  auto: 'Busca mantener el contraste con el fondo — claro sobre fondos oscuros, oscuro sobre fondos claros.',
  light: 'Siempre texto blanco.',
  dark: 'Siempre texto oscuro.',
  theme: 'Usa el color principal de tu marca.',
  custom: 'Elige el color exacto que quieras.',
};

export const PROMO_BUTTON_COLOR_MODE_LABELS: Record<PromoButtonColorMode, string> = {
  auto: 'Automático',
  white: 'Blanco',
  dark: 'Oscuro',
  theme: 'Color del tema',
  custom: 'Personalizado',
};

export const PROMO_BUTTON_COLOR_MODE_HINTS: Record<PromoButtonColorMode, string> = {
  auto: 'Blanco sobre fondos oscuros, color del tema sobre fondos claros — nunca invisible.',
  white: 'Siempre botón blanco.',
  dark: 'Siempre botón oscuro.',
  theme: 'Usa el color principal de tu marca.',
  custom: 'Elige el color exacto que quieras.',
};

export const PROMO_BUTTON_VARIANT_LABELS: Record<PromoButtonVariant, string> = {
  solid: 'Relleno',
  outline: 'Contorno',
  soft: 'Suave',
  minimal: 'Minimalista',
};

export const PROMO_BUTTON_VARIANT_HINTS: Record<PromoButtonVariant, string> = {
  solid: 'Botón sólido, máxima visibilidad',
  outline: 'Solo borde, más discreto',
  soft: 'Fondo tenue del mismo color',
  minimal: 'Sin fondo ni borde, como un enlace',
};

export const PROMO_CONTENT_BACKGROUND_MODE_LABELS: Record<PromoContentBackgroundMode, string> = {
  auto: 'Automático',
  transparent: 'Transparente',
  theme: 'Color del tema',
  solid: 'Color sólido',
  white: 'Blanco',
  dark: 'Oscuro',
};

export const PROMO_CONTENT_BACKGROUND_MODE_HINTS: Record<PromoContentBackgroundMode, string> = {
  auto: 'Usa el fondo/color que ya elegiste para este banner.',
  transparent: 'Sin color propio — se integra con el fondo de la página.',
  theme: 'Usa el color principal de tu marca.',
  solid: 'Elige el color exacto que quieras.',
  white: 'Fondo blanco, ideal para texto oscuro.',
  dark: 'Fondo oscuro, ideal para texto claro.',
};

export const PROMO_CONTENT_BACKGROUND_OPACITY_LABELS: Record<PromoContentBackgroundOpacity, string> = {
  transparent: 'Transparente',
  soft: 'Suave',
  medium: 'Medio',
  solid: 'Sólido',
};

export function defaultPromoBannerSettings(): PromoBannerSettings {
  return {
    layout: 'hero_center',
    backgroundType: 'theme',
    backgroundColor: null,
    gradientPreset: 'vibrant',
    contentAlign: 'center',
    imagePosition: 'right',
    contentPosition: 'bottom_center',
    overlay: 'auto',
    textColorMode: 'auto',
    customTextColor: null,
    contentBackgroundMode: 'auto',
    customContentBackgroundColor: null,
    contentBackgroundOpacity: 'solid',
    buttonColorMode: 'auto',
    customButtonColor: null,
    buttonVariant: 'solid',
  };
}

/** Simplified sRGB relative-luminance check — not full WCAG contrast math,
 * but enough to reliably pick "light or dark text/button" against a given
 * background without pulling in a color library. Accepts `#rgb`/`#rrggbb`
 * and `rgb()`/`rgba()` strings (everything `withAlpha` can produce);
 * anything else (e.g. an unrecognized format) defaults to "dark" so the
 * caller's light-text fallback stays legible more often than not.
 *
 * A translucent `rgba()` color (e.g. the "Suave"/"Medio" content-
 * background opacity presets) is composited over an assumed white page
 * background before measuring luminance — otherwise a dark brand color at
 * 35% alpha (which actually *reads* as a pale tint once painted) would
 * still test as "dark" from its full-strength base color alone, and pick
 * white text that's technically legible but not the best contrast against
 * what's actually a light chip. */
export function isColorDark(color: string): boolean {
  const value = color.trim();
  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;
  let a = 1;

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length === 3 || hex.length === 4 ? hex.split('').map((c) => c + c).join('').slice(0, 6) : hex.slice(0, 6);
    if (full.length === 6 && /^[0-9a-fA-F]{6}$/.test(full)) {
      r = Number.parseInt(full.slice(0, 2), 16);
      g = Number.parseInt(full.slice(2, 4), 16);
      b = Number.parseInt(full.slice(4, 6), 16);
    }
  } else {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
      if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
        [r, g, b] = parts;
        if (parts.length >= 4 && Number.isFinite(parts[3])) a = parts[3];
      }
    }
  }

  if (r === null || g === null || b === null) return true;
  if (a < 1) {
    r = r * a + 255 * (1 - a);
    g = g * a + 255 * (1 - a);
    b = b * a + 255 * (1 - a);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
}

function isPromoBannerLayout(value: unknown): value is PromoBannerLayout {
  return (
    value === 'hero_center' || value === 'split' || value === 'promo_card' || value === 'image_focus' || value === 'minimal'
  );
}

function isPromoBannerBackgroundType(value: unknown): value is PromoBannerBackgroundType {
  return value === 'theme' || value === 'solid' || value === 'gradient' || value === 'image';
}

function isPromoBannerGradientPreset(value: unknown): value is PromoBannerGradientPreset {
  return value === 'vibrant' || value === 'warm' || value === 'dark' || value === 'soft';
}

function isPromoBannerContentAlign(value: unknown): value is PromoBannerContentAlign {
  return value === 'left' || value === 'center' || value === 'right';
}

function isPromoBannerOverlay(value: unknown): value is PromoBannerOverlay {
  return value === 'auto' || value === 'soft' || value === 'strong' || value === 'none';
}

function isPromoTextColorMode(value: unknown): value is PromoTextColorMode {
  return value === 'auto' || value === 'light' || value === 'dark' || value === 'theme' || value === 'custom';
}

function isPromoButtonColorMode(value: unknown): value is PromoButtonColorMode {
  return value === 'auto' || value === 'white' || value === 'dark' || value === 'theme' || value === 'custom';
}

function isPromoButtonVariant(value: unknown): value is PromoButtonVariant {
  return value === 'solid' || value === 'outline' || value === 'soft' || value === 'minimal';
}

function isPromoContentBackgroundMode(value: unknown): value is PromoContentBackgroundMode {
  return (
    value === 'auto' || value === 'transparent' || value === 'theme' || value === 'solid' || value === 'white' || value === 'dark'
  );
}

function isPromoContentBackgroundOpacity(value: unknown): value is PromoContentBackgroundOpacity {
  return value === 'transparent' || value === 'soft' || value === 'medium' || value === 'solid';
}

function parseOptionalHexColor(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parsePromoBannerSettings(raw: unknown): PromoBannerSettings {
  const fallback = defaultPromoBannerSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const record = raw as Record<string, unknown>;

  return {
    layout: isPromoBannerLayout(record.layout) ? record.layout : fallback.layout,
    backgroundType: isPromoBannerBackgroundType(record.backgroundType) ? record.backgroundType : fallback.backgroundType,
    backgroundColor: typeof record.backgroundColor === 'string' && record.backgroundColor.trim() ? record.backgroundColor : null,
    gradientPreset: isPromoBannerGradientPreset(record.gradientPreset) ? record.gradientPreset : fallback.gradientPreset,
    // Was missing 'center' before, so an explicitly-saved 'center' would
    // fall through to the fallback — harmless only because the fallback
    // itself happens to be 'center' too. Fixed to accept all three.
    contentAlign: isPromoBannerContentAlign(record.contentAlign) ? record.contentAlign : fallback.contentAlign,
    imagePosition: record.imagePosition === 'left' ? 'left' : fallback.imagePosition,
    contentPosition: isPromoBannerContentPosition(record.contentPosition) ? record.contentPosition : fallback.contentPosition,
    overlay: isPromoBannerOverlay(record.overlay) ? record.overlay : fallback.overlay,
    // Every field below is new — missing on any banner saved before this
    // shipped, so it falls through to `fallback` (all 'auto'/'solid'),
    // which renders identically to the old hardcoded behavior. See each
    // resolver in PromoBannersSectionRenderer.tsx for how 'auto' derives
    // the same look the banner already had.
    textColorMode: isPromoTextColorMode(record.textColorMode) ? record.textColorMode : fallback.textColorMode,
    customTextColor: parseOptionalHexColor(record.customTextColor),
    contentBackgroundMode: isPromoContentBackgroundMode(record.contentBackgroundMode)
      ? record.contentBackgroundMode
      : fallback.contentBackgroundMode,
    customContentBackgroundColor: parseOptionalHexColor(record.customContentBackgroundColor),
    contentBackgroundOpacity: isPromoContentBackgroundOpacity(record.contentBackgroundOpacity)
      ? record.contentBackgroundOpacity
      : fallback.contentBackgroundOpacity,
    buttonColorMode: isPromoButtonColorMode(record.buttonColorMode) ? record.buttonColorMode : fallback.buttonColorMode,
    customButtonColor: parseOptionalHexColor(record.customButtonColor),
    buttonVariant: isPromoButtonVariant(record.buttonVariant) ? record.buttonVariant : fallback.buttonVariant,
  };
}

export function serializePromoBannerSettings(settings: PromoBannerSettings): Record<string, unknown> {
  return { ...settings };
}

// ── Section-level size controls (Diseño step, apply to every banner
// uniformly). Split into four independent axes on purpose — the original
// single "tamaño de sección" coupled shell size (padding/height) with
// content typography, which is exactly what produced the "fondo enorme,
// texto diminuto" complaint: a banner tall enough to look "Destacado" but
// with tiny default-sized text has no way to grow the text to match. Now
// the shell (this section) only governs padding and spacing;
// PromoContentSize/PromoButtonSize/PromoContentWidth (below) independently
// govern typography, the button, and how wide the text block sits, so any
// combination — grande banner + contenido grande, compacto + pequeño, or a
// mismatched pairing the owner wants on purpose — is explicitly reachable. ──

export type PromoSectionSize = 'compact' | 'normal' | 'large' | 'featured';

export const PROMO_SECTION_SIZE_LABELS: Record<PromoSectionSize, string> = {
  compact: 'Compacto',
  normal: 'Normal',
  large: 'Grande',
  featured: 'Destacado',
};

export const PROMO_SECTION_SIZE_HINTS: Record<PromoSectionSize, string> = {
  compact: 'Menos alto, ideal para promociones secundarias',
  normal: 'Tamaño equilibrado — recomendado',
  large: 'Más espacio para imagen y texto',
  featured: 'Protagonista, para una campaña principal',
};

/** Concrete Tailwind classes per size tier — the "shell" only (padding and
 * min-height via padding). One set per banner
 * composition family: "hero" (full-bleed backdrop: hero_center, minimal)
 * and "block" (image + text block: split, promo_card, image_focus).
 * Hand-picked per tier rather than computed from a multiplier so nothing
 * can compound into an exaggerated result — "featured" is deliberately
 * still modest, never "absurdamente grande".
 *
 * Dedicated media uses one stable 4:3 crop for the split composition;
 * card/full-bleed compositions choose their own ratio in the renderer.
 * Keeping that ratio independent from the size tier is intentional: the
 * crop dialog and the storefront now agree on the same geometry. */
export interface PromoBannerShellScale {
  heroPaddingClassName: string;
  blockPaddingClassName: string;
  imageAspectClassName: string;
  minimalPaddingClassName: string;
}

export const PROMO_SECTION_SIZE_SCALES: Record<PromoSectionSize, PromoBannerShellScale> = {
  compact: {
    heroPaddingClassName: 'px-6 py-6 sm:px-8 sm:py-7',
    blockPaddingClassName: 'px-4 py-4',
    imageAspectClassName: 'aspect-[4/3]',
    minimalPaddingClassName: 'px-5 py-4',
  },
  normal: {
    heroPaddingClassName: 'px-6 py-8 sm:px-10 sm:py-10',
    blockPaddingClassName: 'px-5 py-5',
    imageAspectClassName: 'aspect-[4/3]',
    minimalPaddingClassName: 'px-6 py-5',
  },
  large: {
    heroPaddingClassName: 'px-8 py-10 sm:px-14 sm:py-14',
    blockPaddingClassName: 'px-6 py-6',
    imageAspectClassName: 'aspect-[4/3]',
    minimalPaddingClassName: 'px-7 py-6',
  },
  featured: {
    heroPaddingClassName: 'px-8 py-12 sm:px-16 sm:py-16',
    blockPaddingClassName: 'px-7 py-7',
    imageAspectClassName: 'aspect-[4/3]',
    minimalPaddingClassName: 'px-8 py-7',
  },
};

export function resolvePromoSectionSize(value: unknown): PromoSectionSize {
  return value === 'compact' || value === 'large' || value === 'featured' ? value : 'normal';
}

// ── Content (typography) size — independent of shell size on purpose, see
// note above. Controls eyebrow/title/subtitle sizes and the gap between
// them, per banner composition family. Five tiers (not three) so the jump
// from one end to the other is dramatic and unmistakable in the preview —
// the previous 3-tier range ('small'..'large') was too narrow to fix the
// "fondo grande, contenido diminuto" complaint even at its top end; 'xl'
// now reaches genuinely hero-sized type. ──

export type PromoContentSize = 'xs' | 'small' | 'normal' | 'large' | 'xl';

export const PROMO_CONTENT_SIZE_LABELS: Record<PromoContentSize, string> = {
  xs: 'XS',
  small: 'Pequeño',
  normal: 'Normal',
  large: 'Grande',
  xl: 'XL',
};

export const PROMO_CONTENT_SIZE_HINTS: Record<PromoContentSize, string> = {
  xs: 'Muy discreto, casi decorativo',
  small: 'Útil si el banner tiene poco texto',
  normal: 'Tamaño equilibrado — recomendado',
  large: 'Para campañas más visuales, con más presencia de texto',
  xl: 'Máxima presencia — para el banner protagonista de la página',
};

export interface PromoContentSizeScale {
  eyebrowClassName: string;
  heroTitleClassName: string;
  heroSubtitleClassName: string;
  blockTitleClassName: string;
  blockSubtitleClassName: string;
  minimalTitleClassName: string;
  /** Vertical gap between eyebrow/título/subtítulo/botón. */
  gapClassName: string;
}

export const PROMO_CONTENT_SIZE_SCALES: Record<PromoContentSize, PromoContentSizeScale> = {
  xs: {
    eyebrowClassName: 'text-[9px] px-2 py-0.5',
    heroTitleClassName: 'text-base sm:text-lg',
    heroSubtitleClassName: 'text-[11px] sm:text-xs',
    blockTitleClassName: 'text-xs sm:text-sm',
    blockSubtitleClassName: 'text-[11px]',
    minimalTitleClassName: 'text-xs sm:text-sm',
    gapClassName: 'gap-1',
  },
  small: {
    eyebrowClassName: 'text-[10px] px-2.5 py-0.5',
    heroTitleClassName: 'text-lg sm:text-xl',
    heroSubtitleClassName: 'text-xs sm:text-sm',
    blockTitleClassName: 'text-sm sm:text-base',
    blockSubtitleClassName: 'text-xs',
    minimalTitleClassName: 'text-sm sm:text-base',
    gapClassName: 'gap-1',
  },
  normal: {
    eyebrowClassName: 'text-xs px-3 py-1',
    heroTitleClassName: 'text-2xl sm:text-3xl',
    heroSubtitleClassName: 'text-sm sm:text-base',
    blockTitleClassName: 'text-lg',
    blockSubtitleClassName: 'text-sm',
    minimalTitleClassName: 'text-lg',
    gapClassName: 'gap-2',
  },
  large: {
    eyebrowClassName: 'text-xs px-3.5 py-1.5',
    heroTitleClassName: 'text-3xl sm:text-5xl',
    heroSubtitleClassName: 'text-base sm:text-lg',
    blockTitleClassName: 'text-xl sm:text-2xl',
    blockSubtitleClassName: 'text-sm sm:text-base',
    minimalTitleClassName: 'text-xl sm:text-2xl',
    gapClassName: 'gap-3',
  },
  xl: {
    eyebrowClassName: 'text-sm px-4 py-2',
    heroTitleClassName: 'text-4xl sm:text-6xl lg:text-7xl',
    heroSubtitleClassName: 'text-lg sm:text-xl',
    blockTitleClassName: 'text-2xl sm:text-3xl',
    blockSubtitleClassName: 'text-base sm:text-lg',
    minimalTitleClassName: 'text-2xl sm:text-3xl',
    gapClassName: 'gap-4',
  },
};

export function resolvePromoContentSize(value: unknown): PromoContentSize {
  return value === 'xs' || value === 'small' || value === 'large' || value === 'xl' ? value : 'normal';
}

// ── Button size — independent so a big banner doesn't strand a tiny CTA
// ("botón diminuto" from the reported screenshot). Five tiers, same reason
// as PromoContentSize above: 'xl' now reads as a real, prominent CTA
// instead of a marginally bigger pill. ──

export type PromoButtonSize = 'xs' | 'small' | 'normal' | 'large' | 'xl';

export const PROMO_BUTTON_SIZE_LABELS: Record<PromoButtonSize, string> = {
  xs: 'XS',
  small: 'Pequeño',
  normal: 'Normal',
  large: 'Grande',
  xl: 'XL',
};

export const PROMO_BUTTON_SIZE_HINTS: Record<PromoButtonSize, string> = {
  xs: 'Muy discreto, casi un enlace',
  small: 'Discreto, para banners compactos',
  normal: 'Tamaño equilibrado — recomendado',
  large: 'Más visible, para campañas destacadas',
  xl: 'Máxima visibilidad — protagonista del banner',
};

export const PROMO_BUTTON_SIZE_SCALES: Record<PromoButtonSize, string> = {
  xs: 'px-3 py-1.5 text-[11px]',
  small: 'px-4 py-2 text-xs',
  normal: 'px-5 py-2.5 text-sm',
  large: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
};

export function resolvePromoButtonSize(value: unknown): PromoButtonSize {
  return value === 'xs' || value === 'small' || value === 'large' || value === 'xl' ? value : 'normal';
}

// ── Content width — how much of the banner the text block claims, so it
// doesn't read as "lost" in a wide empty backdrop or feel cramped when
// there's more copy to fit. ──

export type PromoContentWidth = 'narrow' | 'medium' | 'wide';

export const PROMO_CONTENT_WIDTH_LABELS: Record<PromoContentWidth, string> = {
  narrow: 'Estrecho',
  medium: 'Medio',
  wide: 'Ancho',
};

export const PROMO_CONTENT_WIDTH_HINTS: Record<PromoContentWidth, string> = {
  narrow: 'Bloque elegante y concentrado',
  medium: 'Más legible — recomendado',
  wide: 'Para campañas con más texto',
};

export interface PromoContentWidthScale {
  /** Applied to hero_center/minimal, whose text sits directly over the
   * full-width backdrop. */
  heroClassName: string;
  /** Applied to split/promo_card/image_focus, whose text already sits in
   * its own column — still meaningful as an upper bound on very wide
   * columns. */
  blockClassName: string;
}

export const PROMO_CONTENT_WIDTH_SCALES: Record<PromoContentWidth, PromoContentWidthScale> = {
  narrow: { heroClassName: 'max-w-sm', blockClassName: 'max-w-xs' },
  medium: { heroClassName: 'max-w-lg', blockClassName: 'max-w-sm' },
  wide: { heroClassName: 'max-w-3xl', blockClassName: 'max-w-lg' },
};

export function resolvePromoContentWidth(value: unknown): PromoContentWidth {
  return value === 'narrow' || value === 'wide' ? value : 'medium';
}

// ── Spacing between banners — only visible with 2 banners side by side
// (a single banner has no sibling to space out from). Section-level,
// applied to the grid's gap, not per-banner. ──

export type PromoSectionSpacing = 'compact' | 'normal' | 'relaxed';

export const PROMO_SECTION_SPACING_LABELS: Record<PromoSectionSpacing, string> = {
  compact: 'Compacto',
  normal: 'Normal',
  relaxed: 'Amplio',
};

export const PROMO_SECTION_SPACING_HINTS: Record<PromoSectionSpacing, string> = {
  compact: 'Banners más juntos, se sienten como un solo bloque',
  normal: 'Espaciado equilibrado — recomendado',
  relaxed: 'Más aire entre banners, cada uno respira por separado',
};

export const PROMO_SECTION_SPACING_GAP_CLASSES: Record<PromoSectionSpacing, string> = {
  compact: 'gap-3',
  normal: 'gap-5',
  relaxed: 'gap-6 lg:gap-8',
};

export function resolvePromoSectionSpacing(value: unknown): PromoSectionSpacing {
  return value === 'compact' || value === 'relaxed' ? value : 'normal';
}
