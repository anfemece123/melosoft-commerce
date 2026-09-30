import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceHeadingFont,
  ThemeMode,
} from '@/types/common.types';
import { buildStorefrontTheme, withAlpha } from '@/components/public/storefront/storefrontTheme';
import {
  buildExperienceBackdropStyle,
  EXPERIENCE_HEADING_FONTS,
  useExperienceHeadingFont,
} from '@/lib/storefront/experienceAmbience';

export interface ExperiencePreviewValues {
  displayName: string;
  tagline: string;
  description: string;
  logoUrl: string | null;
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
  backgroundStyle: ExperienceBackgroundStyle;
  backgroundPattern: ExperienceBackgroundPattern;
  backgroundImageUrl: string | null;
  backgroundIntensity: number;
  headingFont: ExperienceHeadingFont;
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Miniature storefront rendered with the same ambience builder the public
 * pages use, so what the owner sees here is what customers will get. */
export function ExperiencePreview({ values }: { values: ExperiencePreviewValues }) {
  useExperienceHeadingFont(values.headingFont);
  const safe = (color: string, fallback: string) => (isHexColor(color) ? color : fallback);
  const primary = safe(values.primaryColor, '#4f46e5');
  const secondary = safe(values.secondaryColor, '#eef2ff');
  const accent = safe(values.accentColor, '#7c3aed');
  const background = safe(values.backgroundColor, '#ffffff');
  const text = safe(values.textColor, '#111827');
  const theme = buildStorefrontTheme({
    mode: values.themeMode,
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    backgroundColor: background,
    textColor: text,
    buttonRadius: values.buttonRadius,
  });
  const fontFamily = EXPERIENCE_HEADING_FONTS[values.headingFont].family ?? undefined;
  const backdrop = buildExperienceBackdropStyle({
    backgroundStyle: values.backgroundStyle,
    backgroundPattern: values.backgroundPattern,
    backgroundImageUrl: values.backgroundImageUrl,
    backgroundIntensity: values.backgroundIntensity,
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent,
    backgroundColor: background,
    themeMode: values.themeMode,
  });
  const name = values.displayName.trim() || 'Nombre del restaurante';

  return (
    <div
      data-testid="experience-preview"
      className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm"
      style={{ ...backdrop, color: text }}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: theme.border, backgroundColor: withAlpha(background, 0.85) }}>
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white" style={{ backgroundColor: primary }}>
          {values.logoUrl ? <img src={values.logoUrl} alt="" className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="ml-auto h-2 w-10 rounded-full" style={{ backgroundColor: theme.border }} />
      </div>

      <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
        {values.tagline.trim() && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>{values.tagline}</p>
        )}
        <p className="mt-1 text-2xl font-bold leading-tight" style={{ fontFamily }}>{name}</p>
        <div aria-hidden="true" className="mt-2 flex items-center gap-2">
          <span className="h-px w-6" style={{ backgroundColor: withAlpha(primary, 0.45) }} />
          <span className="h-1 w-1 rotate-45" style={{ backgroundColor: primary }} />
          <span className="h-px w-6" style={{ backgroundColor: withAlpha(primary, 0.45) }} />
        </div>
        {values.description.trim() && (
          <p className="mt-2 line-clamp-2 max-w-xs text-xs" style={{ color: theme.mutedText }}>{values.description}</p>
        )}

        <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
          {['Plato de la casa', 'Especial del chef'].map((dish) => (
            <div
              key={dish}
              className="overflow-hidden rounded-xl border text-left"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <div className="h-14" style={{ background: `linear-gradient(135deg, ${withAlpha(primary, 0.22)}, ${withAlpha(accent, 0.22)})` }} />
              <div className="p-2">
                <p className="truncate text-[11px] font-semibold">{dish}</p>
                <p className="text-[11px]" style={{ color: theme.mutedText }}>$ 32.000</p>
              </div>
            </div>
          ))}
        </div>

        <span
          className="mt-4 inline-flex px-5 py-2 text-xs font-semibold text-white shadow"
          style={{ backgroundColor: primary, borderRadius: values.buttonRadius }}
        >
          Agregar al pedido
        </span>
      </div>
    </div>
  );
}
