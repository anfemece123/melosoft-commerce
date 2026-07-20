import type { CSSProperties } from 'react';

/** Shared horizontal ceiling for the public storefront's header, footer,
 * and every Home Builder section — one constant so the whole storefront
 * widens/narrows together instead of each file guessing its own
 * `max-w-*`. Wider than Tailwind's `max-w-7xl` (1280px) on purpose, to
 * read as a more premium/commercial layout on large desktop screens
 * without going edge-to-edge. `StoreCatalogPage.tsx` deliberately does NOT
 * use this — it keeps its own existing `max-w-7xl` per an explicit,
 * repeated instruction to leave that page alone. */
export const STOREFRONT_CONTAINER_CLASS = 'max-w-[1440px]';

interface StorefrontThemeInput {
  mode?: 'light' | 'dark' | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  buttonRadius?: string | null;
}

export interface StorefrontTheme {
  mode: 'light' | 'dark';
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  radius: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  mutedText: string;
  softPrimary: string;
  softAccent: string;
  shadow: string;
  cssVars: CSSProperties;
}

function normalizeHexColor(color: string): string | null {
  const value = color.trim();
  if (!value.startsWith('#')) return null;

  const hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    return `#${hex
      .split('')
      .map((char) => char + char)
      .join('')
      .slice(0, 6)}`;
  }

  if (hex.length === 6 || hex.length === 8) {
    return `#${hex.slice(0, 6)}`;
  }

  return null;
}

export function withAlpha(color: string, alpha: number): string {
  const normalized = normalizeHexColor(color);
  if (!normalized) return color;

  const hex = normalized.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildStorefrontTheme(input: StorefrontThemeInput): StorefrontTheme {
  const mode = input.mode === 'dark' ? 'dark' : 'light';
  const primary = input.primaryColor ?? '#ef4444';
  const secondary = input.secondaryColor ?? '#fff7ed';
  const accent = input.accentColor ?? primary;
  const background = input.backgroundColor ?? '#fffdf8';
  const text = input.textColor ?? '#111827';
  const radius = input.buttonRadius ?? '24px';

  const surface = withAlpha(background, 0.9);
  const surfaceAlt = withAlpha(secondary, 0.75);
  const border = withAlpha(text, 0.1);
  const mutedText = withAlpha(text, 0.62);
  const softPrimary = withAlpha(primary, 0.12);
  const softAccent = withAlpha(accent, 0.15);
  const shadow = withAlpha(text, 0.08);

  return {
    mode,
    primary,
    secondary,
    accent,
    background,
    text,
    radius,
    surface,
    surfaceAlt,
    border,
    mutedText,
    softPrimary,
    softAccent,
    shadow,
    cssVars: {
      '--storefront-primary': primary,
      '--storefront-secondary': secondary,
      '--storefront-accent': accent,
      '--storefront-background': background,
      '--storefront-text': text,
      '--storefront-radius': radius,
      '--storefront-surface': surface,
      '--storefront-surface-alt': surfaceAlt,
      '--storefront-border': border,
      '--storefront-muted': mutedText,
      '--storefront-soft-primary': softPrimary,
      '--storefront-soft-accent': softAccent,
      '--storefront-shadow': shadow,
    } as CSSProperties,
  };
}
