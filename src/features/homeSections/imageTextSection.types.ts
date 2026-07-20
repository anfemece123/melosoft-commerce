/** Style system for "Imagen con texto" (Home Builder) — mirrors the
 * conventions established by promoBanner.types.ts: plain literal unions,
 * owner-facing label/hint maps, `resolveX(value: unknown): X` defensive
 * fallbacks (so a section saved before a field existed degrades to a
 * default that renders the same as before), and Tailwind-class scale maps
 * per tier. Everything here is section-level (this section has no
 * repeatable item list), so it lives flat on HomeSectionContent's
 * `image_text` member — see homeSections.types.ts. */

export type ImageTextLayout = 'side_by_side' | 'background' | 'stacked' | 'card_overlay';
export type ImageTextImagePosition = 'left' | 'right' | 'top' | 'bottom';
export type ImageTextAspect = 'square' | 'portrait' | 'landscape' | 'wide' | 'auto';
export type ImageTextRounded = 'none' | 'md' | 'xl' | 'full';
export type ImageTextOverlay = 'none' | 'soft' | 'medium' | 'strong';
export type ImageTextTitleSize = 'sm' | 'md' | 'lg' | 'xl';
export type ImageTextSubtitleSize = 'sm' | 'md' | 'lg';
export type ImageTextButtonSize = 'sm' | 'md' | 'lg';
export type ImageTextButtonStyle = 'solid' | 'outline' | 'ghost';
export type ImageTextColorMode = 'theme_text' | 'theme_muted' | 'theme_primary' | 'white' | 'black' | 'custom';
export type ImageTextTextAlign = 'left' | 'center' | 'right';
export type ImageTextContentWidth = 'narrow' | 'medium' | 'wide';
export type ImageTextSpacing = 'compact' | 'normal' | 'relaxed';
export type ImageTextContentBg = 'none' | 'white' | 'dark' | 'theme' | 'custom';
export type ImageTextBgOpacity = 'transparent' | 'soft' | 'medium' | 'solid';
export type ImageTextSectionBg = 'none' | 'theme' | 'custom' | 'gradient';
export type ImageTextSectionSize = 'compact' | 'normal' | 'large' | 'hero';

/** Free-form 9-grid placement, only meaningful for layout 'background'
 * (text over a full-bleed image) and 'card_overlay' (text panel over the
 * card's image) — identical shape/encoding to PromoBannerContentPosition in
 * promoBanner.types.ts, kept as its own type here since the two sections
 * evolve independently. */
export type ImageTextContentPosition =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'center_left'
  | 'center'
  | 'center_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right';

export const IMAGE_TEXT_LAYOUT_LABELS: Record<ImageTextLayout, string> = {
  side_by_side: 'Imagen a un lado + texto al otro',
  background: 'Imagen de fondo + texto superpuesto',
  stacked: 'Imagen arriba + contenido abajo',
  card_overlay: 'Tarjeta editorial (contenido sobre la imagen)',
};

export const IMAGE_TEXT_LAYOUT_HINTS: Record<ImageTextLayout, string> = {
  side_by_side: 'Composición clásica, ideal para explicar un producto o categoría.',
  background: 'La imagen ocupa toda la sección, el texto va encima.',
  stacked: 'La imagen va arriba (o abajo) y el contenido debajo, a todo el ancho.',
  card_overlay: 'El texto se apoya en un panel que se superpone al borde de la imagen, estilo editorial.',
};

export const IMAGE_TEXT_IMAGE_POSITION_LABELS: Record<ImageTextImagePosition, string> = {
  left: 'Izquierda',
  right: 'Derecha',
  top: 'Arriba',
  bottom: 'Abajo',
};

export const IMAGE_TEXT_ASPECT_LABELS: Record<ImageTextAspect, string> = {
  square: 'Cuadrada (1:1)',
  portrait: 'Vertical (3:4)',
  landscape: 'Horizontal (4:3)',
  wide: 'Panorámica (16:9)',
  auto: 'Automática',
};

export const IMAGE_TEXT_ASPECT_CLASSES: Record<ImageTextAspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
  auto: 'aspect-auto',
};

export const IMAGE_TEXT_ROUNDED_LABELS: Record<ImageTextRounded, string> = {
  none: 'Sin bordes',
  md: 'Suave',
  xl: 'Redondeada',
  full: 'Muy redondeada',
};

export const IMAGE_TEXT_ROUNDED_CLASSES: Record<ImageTextRounded, string> = {
  none: 'rounded-none',
  md: 'rounded-lg',
  xl: 'rounded-2xl',
  full: 'rounded-[2.5rem]',
};

export const IMAGE_TEXT_OVERLAY_LABELS: Record<ImageTextOverlay, string> = {
  none: 'Sin overlay',
  soft: 'Suave',
  medium: 'Medio',
  strong: 'Fuerte',
};

/** Legibility scrim alphas over a background image — same idea as
 * overlayAlphas in PromoBannersSectionRenderer.tsx. `null` skips the scrim
 * entirely. */
export const IMAGE_TEXT_OVERLAY_ALPHAS: Record<ImageTextOverlay, { from: number; to: number } | null> = {
  none: null,
  soft: { from: 0.5, to: 0.05 },
  medium: { from: 0.7, to: 0.15 },
  strong: { from: 0.88, to: 0.3 },
};

export const IMAGE_TEXT_TITLE_SIZE_LABELS: Record<ImageTextTitleSize, string> = {
  sm: 'Pequeño',
  md: 'Normal',
  lg: 'Grande',
  xl: 'Muy grande',
};

export const IMAGE_TEXT_TITLE_SIZE_CLASSES: Record<ImageTextTitleSize, string> = {
  sm: 'text-lg sm:text-xl',
  md: 'text-2xl sm:text-3xl',
  lg: 'text-3xl sm:text-4xl',
  xl: 'text-4xl sm:text-5xl',
};

export const IMAGE_TEXT_SUBTITLE_SIZE_LABELS: Record<ImageTextSubtitleSize, string> = {
  sm: 'Pequeño',
  md: 'Normal',
  lg: 'Grande',
};

export const IMAGE_TEXT_SUBTITLE_SIZE_CLASSES: Record<ImageTextSubtitleSize, string> = {
  sm: 'text-xs sm:text-sm',
  md: 'text-sm sm:text-base',
  lg: 'text-base sm:text-lg',
};

export const IMAGE_TEXT_BUTTON_SIZE_LABELS: Record<ImageTextButtonSize, string> = {
  sm: 'Pequeño',
  md: 'Normal',
  lg: 'Grande',
};

export const IMAGE_TEXT_BUTTON_SIZE_CLASSES: Record<ImageTextButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export const IMAGE_TEXT_BUTTON_STYLE_LABELS: Record<ImageTextButtonStyle, string> = {
  solid: 'Relleno',
  outline: 'Contorno',
  ghost: 'Fantasma (solo texto)',
};

export const IMAGE_TEXT_COLOR_MODE_LABELS: Record<ImageTextColorMode, string> = {
  theme_text: 'Texto del tema',
  theme_muted: 'Texto secundario del tema',
  theme_primary: 'Color principal del tema',
  white: 'Blanco',
  black: 'Negro',
  custom: 'Personalizado',
};

export const IMAGE_TEXT_TEXT_ALIGN_LABELS: Record<ImageTextTextAlign, string> = {
  left: 'Izquierda',
  center: 'Centro',
  right: 'Derecha',
};

export const IMAGE_TEXT_CONTENT_WIDTH_LABELS: Record<ImageTextContentWidth, string> = {
  narrow: 'Estrecho',
  medium: 'Medio',
  wide: 'Ancho',
};

export const IMAGE_TEXT_CONTENT_WIDTH_CLASSES: Record<ImageTextContentWidth, string> = {
  narrow: 'max-w-sm',
  medium: 'max-w-lg',
  wide: 'max-w-2xl',
};

export const IMAGE_TEXT_SPACING_LABELS: Record<ImageTextSpacing, string> = {
  compact: 'Compacto',
  normal: 'Normal',
  relaxed: 'Amplio',
};

export const IMAGE_TEXT_SPACING_CLASSES: Record<ImageTextSpacing, string> = {
  compact: 'gap-2',
  normal: 'gap-3.5',
  relaxed: 'gap-5',
};

export const IMAGE_TEXT_CONTENT_BG_LABELS: Record<ImageTextContentBg, string> = {
  none: 'Transparente',
  white: 'Blanco',
  dark: 'Oscuro',
  theme: 'Color del tema',
  custom: 'Personalizado',
};

export const IMAGE_TEXT_BG_OPACITY_LABELS: Record<ImageTextBgOpacity, string> = {
  transparent: 'Transparente',
  soft: 'Suave',
  medium: 'Medio',
  solid: 'Sólido',
};

export const IMAGE_TEXT_BG_OPACITY_ALPHAS: Record<ImageTextBgOpacity, number> = {
  transparent: 0,
  soft: 0.4,
  medium: 0.7,
  solid: 1,
};

export const IMAGE_TEXT_SECTION_BG_LABELS: Record<ImageTextSectionBg, string> = {
  none: 'Transparente',
  theme: 'Color del tema',
  custom: 'Personalizado',
  gradient: 'Degradado',
};

export const IMAGE_TEXT_SECTION_SIZE_LABELS: Record<ImageTextSectionSize, string> = {
  compact: 'Compacta',
  normal: 'Normal',
  large: 'Grande',
  hero: 'Hero',
};

export const IMAGE_TEXT_SECTION_SIZE_PADDING_CLASSES: Record<ImageTextSectionSize, string> = {
  compact: 'py-6 sm:py-8',
  normal: 'py-10 sm:py-12',
  large: 'py-14 sm:py-16',
  hero: 'py-16 sm:py-24',
};

export const IMAGE_TEXT_CONTENT_POSITION_LABELS: Record<ImageTextContentPosition, string> = {
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

function isImageTextContentPosition(value: unknown): value is ImageTextContentPosition {
  return typeof value === 'string' && value in IMAGE_TEXT_CONTENT_POSITION_LABELS;
}

/** Decodes a position into independent vertical/horizontal axes — same
 * convention as promoBannerContentPositionParts. */
export function imageTextContentPositionParts(
  position: ImageTextContentPosition
): { vertical: 'top' | 'center' | 'bottom'; horizontal: 'left' | 'center' | 'right' } {
  const [vertical, horizontal] = position.split('_') as ['top' | 'center' | 'bottom', ('left' | 'center' | 'right') | undefined];
  return { vertical, horizontal: horizontal ?? 'center' };
}

/** Flex classes that place the content block at the chosen position inside
 * an `absolute inset-0 flex flex-col` overlay. */
export function imageTextContentPositionClasses(position: ImageTextContentPosition): string {
  const { vertical, horizontal } = imageTextContentPositionParts(position);
  const justify = vertical === 'top' ? 'justify-start' : vertical === 'bottom' ? 'justify-end' : 'justify-center';
  const items =
    horizontal === 'left' ? 'items-start text-left' : horizontal === 'right' ? 'items-end text-right' : 'items-center text-center';
  return `${justify} ${items}`;
}

// ── Resolvers — every one falls back to the value that reproduces today's
// fixed look, so a section saved before these fields existed renders
// identically the first time it's loaded after this ships. ──

export function resolveImageTextLayout(value: unknown): ImageTextLayout {
  return value === 'background' || value === 'stacked' || value === 'card_overlay' ? value : 'side_by_side';
}

export function resolveImageTextImagePosition(value: unknown): ImageTextImagePosition {
  return value === 'right' || value === 'top' || value === 'bottom' ? value : 'left';
}

export function resolveImageTextAspect(value: unknown): ImageTextAspect {
  return value === 'square' || value === 'portrait' || value === 'wide' || value === 'auto' ? value : 'landscape';
}

export function resolveImageTextRounded(value: unknown): ImageTextRounded {
  return value === 'none' || value === 'md' || value === 'full' ? value : 'xl';
}

export function resolveImageTextOverlay(value: unknown): ImageTextOverlay {
  return value === 'none' || value === 'soft' || value === 'strong' ? value : 'medium';
}

export function resolveImageTextContentPosition(value: unknown): ImageTextContentPosition {
  return isImageTextContentPosition(value) ? value : 'center';
}

export function resolveImageTextTitleSize(value: unknown): ImageTextTitleSize {
  return value === 'sm' || value === 'lg' || value === 'xl' ? value : 'md';
}

export function resolveImageTextSubtitleSize(value: unknown): ImageTextSubtitleSize {
  return value === 'sm' || value === 'lg' ? value : 'md';
}

export function resolveImageTextButtonSize(value: unknown): ImageTextButtonSize {
  return value === 'sm' || value === 'lg' ? value : 'md';
}

export function resolveImageTextButtonStyle(value: unknown): ImageTextButtonStyle {
  return value === 'outline' || value === 'ghost' ? value : 'solid';
}

export function resolveImageTextTitleColorMode(value: unknown): ImageTextColorMode {
  return value === 'theme_muted' || value === 'theme_primary' || value === 'white' || value === 'black' || value === 'custom'
    ? value
    : 'theme_text';
}

export function resolveImageTextSubtitleColorMode(value: unknown): ImageTextColorMode {
  return value === 'theme_text' || value === 'theme_primary' || value === 'white' || value === 'black' || value === 'custom'
    ? value
    : 'theme_muted';
}

export function resolveImageTextButtonColorMode(value: unknown): ImageTextColorMode {
  return value === 'theme_text' || value === 'theme_muted' || value === 'white' || value === 'black' || value === 'custom'
    ? value
    : 'theme_primary';
}

export function resolveImageTextTextAlign(value: unknown): ImageTextTextAlign {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function resolveImageTextContentWidth(value: unknown): ImageTextContentWidth {
  return value === 'narrow' || value === 'wide' ? value : 'medium';
}

export function resolveImageTextSpacing(value: unknown): ImageTextSpacing {
  return value === 'compact' || value === 'relaxed' ? value : 'normal';
}

export function resolveImageTextContentBg(value: unknown): ImageTextContentBg {
  return value === 'white' || value === 'dark' || value === 'theme' || value === 'custom' ? value : 'none';
}

export function resolveImageTextBgOpacity(value: unknown): ImageTextBgOpacity {
  return value === 'transparent' || value === 'soft' || value === 'medium' ? value : 'solid';
}

export function resolveImageTextSectionBg(value: unknown): ImageTextSectionBg {
  return value === 'theme' || value === 'custom' || value === 'gradient' ? value : 'none';
}

export function resolveImageTextSectionSize(value: unknown): ImageTextSectionSize {
  return value === 'compact' || value === 'large' || value === 'hero' ? value : 'normal';
}

function parseOptionalHexColor(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export { parseOptionalHexColor as parseImageTextHexColor };
