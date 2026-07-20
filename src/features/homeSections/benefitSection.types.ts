/** Section-level layout/style controls for "Beneficios" — same
 * literal-union + label-map + resolver convention as catalogNav.types.ts /
 * imageTextSection.types.ts. Flat on HomeSectionContent's `benefits`
 * member (a single-instance config, not a per-item list) — per-item
 * overrides live separately in benefitItem.types.ts. */

export type BenefitsLayout = 'grid' | 'carousel' | 'band' | 'logos';
export type BenefitsItemSize = 'compact' | 'normal' | 'large';
export type BenefitsStyle = 'minimal' | 'card' | 'outline' | 'soft' | 'theme';

export const BENEFITS_LAYOUT_LABELS: Record<BenefitsLayout, string> = {
  grid: 'Grid de beneficios',
  carousel: 'Carrusel',
  band: 'Banda de confianza',
  logos: 'Logos / marcas',
};

export const BENEFITS_LAYOUT_HINTS: Record<BenefitsLayout, string> = {
  grid: 'Cards limpias con icono/logo, título y descripción.',
  carousel: 'Cards con flechas y puntos, ideal para varios beneficios destacados.',
  band: 'Franja horizontal compacta, perfecta para varios sellos de confianza.',
  logos: 'Fila de logos (marcas, aliados o métodos de pago) con scroll horizontal.',
};

export const BENEFITS_ITEM_SIZE_LABELS: Record<BenefitsItemSize, string> = {
  compact: 'Compacto',
  normal: 'Normal',
  large: 'Grande',
};

export const BENEFITS_STYLE_LABELS: Record<BenefitsStyle, string> = {
  minimal: 'Minimalista',
  card: 'Card',
  outline: 'Outline',
  soft: 'Fondo suave',
  theme: 'Fondo del tema',
};

export function resolveBenefitsLayout(value: unknown): BenefitsLayout {
  return value === 'carousel' || value === 'band' || value === 'logos' ? value : 'grid';
}

export function resolveBenefitsItemSize(value: unknown): BenefitsItemSize {
  return value === 'compact' || value === 'large' ? value : 'normal';
}

export function resolveBenefitsStyle(value: unknown): BenefitsStyle {
  return value === 'card' || value === 'outline' || value === 'soft' || value === 'theme' ? value : 'minimal';
}
