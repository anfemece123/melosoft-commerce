import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceHeadingFont,
} from '@/types/common.types';
import {
  buildExperienceBackdropStyle,
  EXPERIENCE_BACKGROUND_PATTERNS,
  EXPERIENCE_BACKGROUND_STYLES,
  EXPERIENCE_HEADING_FONTS,
  useExperienceHeadingFont,
} from '@/lib/storefront/experienceAmbience';
import { EXPERIENCE_STYLE_PRESETS, type ExperienceStylePreset } from '@/lib/storefront/experiencePresets';

interface ExperienceAmbienceFieldsProps {
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  themeMode: 'light' | 'dark';
  backgroundStyle: ExperienceBackgroundStyle;
  backgroundPattern: ExperienceBackgroundPattern;
  backgroundIntensity: number;
  headingFont: ExperienceHeadingFont;
  onPresetApply: (preset: ExperienceStylePreset) => void;
  onBackgroundStyleChange: (value: ExperienceBackgroundStyle) => void;
  onBackgroundPatternChange: (value: ExperienceBackgroundPattern) => void;
  onBackgroundIntensityChange: (value: number) => void;
  onHeadingFontChange: (value: ExperienceHeadingFont) => void;
  /** Rendered under the style picker when "Imagen" is selected. */
  imageField: React.ReactNode;
}

const FONT_KEYS = Object.keys(EXPERIENCE_HEADING_FONTS) as ExperienceHeadingFont[];
const STYLE_KEYS = Object.keys(EXPERIENCE_BACKGROUND_STYLES) as ExperienceBackgroundStyle[];
const PATTERN_KEYS = Object.keys(EXPERIENCE_BACKGROUND_PATTERNS) as ExperienceBackgroundPattern[];

export function ExperienceAmbienceFields(props: ExperienceAmbienceFieldsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Estilos listos</h3>
        <p className="mt-1 text-xs text-gray-500">Un punto de partida con colores, fondo y tipografía. Luego puedes ajustar todo.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EXPERIENCE_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => props.onPresetApply(preset)}
              className="group overflow-hidden rounded-xl border border-gray-200 text-left transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="h-12" style={buildExperienceBackdropStyle({ ...preset, backgroundImageUrl: null, backgroundIntensity: Math.max(preset.backgroundIntensity, 55) })}>
                <div className="flex h-full items-end gap-1 p-2">
                  {[preset.primaryColor, preset.accentColor, preset.secondaryColor].map((color) => (
                    <span key={color} className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <p className="truncate px-2 py-1.5 text-xs font-semibold text-gray-800">{preset.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Fondo de la página</h3>
        <p className="mt-1 text-xs text-gray-500">Cubre toda la tienda mientras el cliente está dentro de esta experiencia.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estilo de fondo">
          {STYLE_KEYS.map((style) => {
            const selected = props.backgroundStyle === style;
            return (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => props.onBackgroundStyleChange(style)}
                className={clsx(
                  'relative overflow-hidden rounded-xl border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  selected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div
                  className="h-14"
                  style={buildExperienceBackdropStyle({
                    backgroundStyle: style === 'image' ? 'solid' : style,
                    backgroundPattern: props.backgroundPattern,
                    backgroundImageUrl: null,
                    backgroundIntensity: Math.max(props.backgroundIntensity, 60),
                    primaryColor: props.primaryColor,
                    secondaryColor: props.secondaryColor,
                    accentColor: props.accentColor,
                    backgroundColor: props.backgroundColor,
                    themeMode: props.themeMode,
                  })}
                />
                <div className="px-2.5 py-2">
                  <p className="text-xs font-semibold text-gray-900">{EXPERIENCE_BACKGROUND_STYLES[style].label}</p>
                  <p className="truncate text-[11px] text-gray-500">{EXPERIENCE_BACKGROUND_STYLES[style].hint}</p>
                </div>
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {props.backgroundStyle === 'pattern' && (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Patrón">
            {PATTERN_KEYS.map((pattern) => {
              const selected = props.backgroundPattern === pattern;
              return (
                <button
                  key={pattern}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => props.onBackgroundPatternChange(pattern)}
                  className={clsx(
                    'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition',
                    selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:border-gray-300',
                  )}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-black/5"
                    style={buildExperienceBackdropStyle({
                      backgroundStyle: 'pattern',
                      backgroundPattern: pattern,
                      backgroundImageUrl: null,
                      backgroundIntensity: 90,
                      primaryColor: props.primaryColor,
                      secondaryColor: props.secondaryColor,
                      accentColor: props.accentColor,
                      backgroundColor: props.backgroundColor,
                      themeMode: props.themeMode,
                    })}
                  />
                  {EXPERIENCE_BACKGROUND_PATTERNS[pattern].label}
                </button>
              );
            })}
          </div>
        )}

        {props.backgroundStyle === 'image' && <div className="mt-3">{props.imageField}</div>}

        {props.backgroundStyle !== 'solid' && (
          <label className="mt-4 block">
            <span className="flex items-center justify-between text-xs font-medium text-gray-700">
              Intensidad
              <span className="tabular-nums text-gray-500">{props.backgroundIntensity}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={props.backgroundIntensity}
              onChange={(event) => props.onBackgroundIntensityChange(Number(event.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
            <span className="mt-1 flex justify-between text-[11px] text-gray-400">
              <span>Sutil</span>
              <span>Protagonista</span>
            </span>
          </label>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Tipografía de títulos</h3>
        <p className="mt-1 text-xs text-gray-500">Se aplica al nombre y a los títulos de las secciones. El texto de los platos se mantiene legible.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tipografía">
          {FONT_KEYS.map((font) => (
            <FontOption
              key={font}
              font={font}
              selected={props.headingFont === font}
              onSelect={() => props.onHeadingFontChange(font)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FontOption({ font, selected, onSelect }: { font: ExperienceHeadingFont; selected: boolean; onSelect: () => void }) {
  useExperienceHeadingFont(font);
  const preset = EXPERIENCE_HEADING_FONTS[font];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={clsx(
        'rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        selected ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <span className="block truncate text-lg leading-tight text-gray-900" style={{ fontFamily: preset.family ?? undefined }}>
        Aa {preset.label}
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-gray-500">{preset.hint}</span>
    </button>
  );
}
