import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceHeadingFont,
  PublicCategoryExperience,
} from '@/types/common.types';
import { withAlpha } from '@/components/public/storefront/storefrontTheme';

// ── Heading typefaces ────────────────────────────────────────────────────

interface HeadingFontPreset {
  label: string;
  hint: string;
  /** CSS font-family stack. Null keeps the storefront's default font. */
  family: string | null;
  /** Google Fonts css2 `family=` value. */
  googleFamily: string | null;
}

export const EXPERIENCE_HEADING_FONTS: Record<ExperienceHeadingFont, HeadingFontPreset> = {
  default: { label: 'La de la tienda', hint: 'Sin cambios', family: null, googleFamily: null },
  elegant: {
    label: 'Elegante',
    hint: 'Alta cocina, vinos, bistró',
    family: "'Playfair Display', Georgia, serif",
    googleFamily: 'Playfair+Display:wght@500;600;700;800',
  },
  classic: {
    label: 'Clásica',
    hint: 'Trattoria, panadería, café',
    family: "'Cormorant Garamond', Georgia, serif",
    googleFamily: 'Cormorant+Garamond:wght@500;600;700',
  },
  modern: {
    label: 'Moderna',
    hint: 'Sushi, fusión, saludable',
    family: "'Montserrat', system-ui, sans-serif",
    googleFamily: 'Montserrat:wght@600;700;800',
  },
  bold: {
    label: 'Impactante',
    hint: 'Hamburguesas, parrilla, street food',
    family: "'Oswald', Impact, sans-serif",
    googleFamily: 'Oswald:wght@500;600;700',
  },
  rustic: {
    label: 'Rústica',
    hint: 'Asados, cocina típica, leña',
    family: "'Bitter', Georgia, serif",
    googleFamily: 'Bitter:wght@600;700;800',
  },
  handwritten: {
    label: 'Manuscrita',
    hint: 'Heladería, postres, brunch',
    family: "'Pacifico', cursive",
    googleFamily: 'Pacifico',
  },
};

/** Loads the Google Font for a heading preset once per page. */
export function useExperienceHeadingFont(font: ExperienceHeadingFont | null | undefined): void {
  useEffect(() => {
    const preset = font ? EXPERIENCE_HEADING_FONTS[font] : null;
    if (!preset?.googleFamily) return;
    const id = `melosoft-heading-font-${font}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${preset.googleFamily}&display=swap`;
    document.head.appendChild(link);
  }, [font]);
}

// ── Decorative backgrounds ───────────────────────────────────────────────

export const EXPERIENCE_BACKGROUND_STYLES: Record<ExperienceBackgroundStyle, { label: string; hint: string }> = {
  solid: { label: 'Color plano', hint: 'Solo el color de fondo' },
  gradient: { label: 'Degradado', hint: 'Luces suaves con tus colores' },
  pattern: { label: 'Patrón', hint: 'Textura gráfica sutil' },
  image: { label: 'Imagen', hint: 'Madera, mármol, pizarra…' },
};

export const EXPERIENCE_BACKGROUND_PATTERNS: Record<ExperienceBackgroundPattern, { label: string; size: number }> = {
  dots: { label: 'Puntos', size: 22 },
  grid: { label: 'Cuadrícula', size: 36 },
  tablecloth: { label: 'Mantel', size: 44 },
  diagonal: { label: 'Rayas', size: 16 },
  waves: { label: 'Olas', size: 56 },
  terrazzo: { label: 'Terrazo', size: 140 },
};

function patternSvg(pattern: ExperienceBackgroundPattern, primary: string, accent: string, opacity: number): string {
  const o = opacity.toFixed(3);
  switch (pattern) {
    case 'dots':
      return `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='3' cy='3' r='1.7' fill='${primary}' fill-opacity='${o}'/></svg>`;
    case 'grid':
      return `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><path d='M36 0H0V36' fill='none' stroke='${primary}' stroke-opacity='${o}' stroke-width='1'/></svg>`;
    case 'tablecloth':
      return `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><g fill='${primary}' fill-opacity='${(opacity * 0.55).toFixed(3)}'><rect width='22' height='44'/><rect width='44' height='22'/></g></svg>`;
    case 'diagonal':
      return `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M-4 4l8-8M0 16L16 0M12 20l8-8' stroke='${primary}' stroke-opacity='${o}' stroke-width='1.4'/></svg>`;
    case 'waves':
      return `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='28'><g fill='none' stroke='${primary}' stroke-opacity='${o}' stroke-width='1.3'><path d='M0 28a28 28 0 0 1 56 0'/><path d='M9 28a19 19 0 0 1 38 0'/><path d='M18 28a10 10 0 0 1 20 0'/><path d='M-28 14a28 28 0 0 1 56 0'/><path d='M28 14a28 28 0 0 1 56 0'/></g></svg>`;
    case 'terrazzo':
      return `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><g fill-opacity='${o}'>`
        + `<path d='M12 18l9-4 4 8-8 5z' fill='${primary}'/>`
        + `<path d='M70 10l7 3-2 8-8-2z' fill='${accent}'/>`
        + `<path d='M112 30l10 2-3 9-9-4z' fill='${primary}'/>`
        + `<circle cx='40' cy='62' r='3.5' fill='${accent}'/>`
        + `<path d='M92 70l6-5 6 6-7 5z' fill='${primary}'/>`
        + `<path d='M20 104l11 1-2 9-10-3z' fill='${accent}'/>`
        + `<circle cx='128' cy='104' r='2.6' fill='${primary}'/>`
        + `<path d='M62 118l8-3 3 7-9 3z' fill='${primary}'/>`
        + `<circle cx='100' cy='130' r='2' fill='${accent}'/>`
        + `<circle cx='8' cy='70' r='1.8' fill='${primary}'/>`
        + `</g></svg>`;
  }
}

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function experienceHasDecoratedBackground(experience: PublicCategoryExperience | null | undefined): boolean {
  if (!experience) return false;
  if (experience.backgroundStyle === 'image') return Boolean(experience.backgroundImageUrl);
  return experience.backgroundStyle === 'gradient' || experience.backgroundStyle === 'pattern';
}

type BackdropSource = Pick<
  PublicCategoryExperience,
  | 'backgroundStyle'
  | 'backgroundPattern'
  | 'backgroundImageUrl'
  | 'backgroundIntensity'
  | 'primaryColor'
  | 'secondaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'themeMode'
>;

/** CSS for the fixed decorative layer painted behind the storefront while
 * an experience is active. Pure function so the admin preview and the
 * public page render exactly the same thing. */
export function buildExperienceBackdropStyle(source: BackdropSource): CSSProperties {
  const intensity = Math.min(100, Math.max(0, source.backgroundIntensity)) / 100;
  const dark = source.themeMode === 'dark';
  const base: CSSProperties = { backgroundColor: source.backgroundColor };

  if (source.backgroundStyle === 'gradient') {
    const a = 0.1 + intensity * (dark ? 0.38 : 0.32);
    return {
      ...base,
      backgroundImage: [
        `radial-gradient(60rem 38rem at -8% -12%, ${withAlpha(source.primaryColor, a)}, transparent 68%)`,
        `radial-gradient(48rem 34rem at 108% 18%, ${withAlpha(source.accentColor, a * 0.9)}, transparent 70%)`,
        `radial-gradient(70rem 40rem at 50% 118%, ${withAlpha(dark ? source.primaryColor : source.secondaryColor, a * (dark ? 0.6 : 1.4))}, transparent 72%)`,
      ].join(', '),
    };
  }

  if (source.backgroundStyle === 'pattern') {
    const opacity = 0.05 + intensity * (dark ? 0.3 : 0.22);
    const preset = EXPERIENCE_BACKGROUND_PATTERNS[source.backgroundPattern];
    return {
      ...base,
      backgroundImage: [
        `radial-gradient(ellipse 80% 55% at 50% 0%, ${withAlpha(source.primaryColor, 0.06 + intensity * 0.08)}, transparent 70%)`,
        `radial-gradient(ellipse 90% 70% at 50% 45%, ${withAlpha(source.backgroundColor, 0.55)}, transparent 80%)`,
        svgUrl(patternSvg(source.backgroundPattern, source.primaryColor, source.accentColor, opacity)),
      ].join(', '),
      backgroundSize: `auto, auto, ${preset.size}px ${preset.size}px`,
    };
  }

  if (source.backgroundStyle === 'image' && source.backgroundImageUrl) {
    // Higher intensity = more of the photo shows through the color veil.
    const veil = 0.94 - intensity * 0.66;
    return {
      ...base,
      backgroundImage: [
        `linear-gradient(180deg, ${withAlpha(source.backgroundColor, Math.min(0.97, veil + 0.06))} 0%, ${withAlpha(source.backgroundColor, veil)} 40%, ${withAlpha(source.backgroundColor, Math.min(0.97, veil + 0.1))} 100%)`,
        `url("${source.backgroundImageUrl}")`,
      ].join(', '),
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  return base;
}
