import type { ThemePreset, ThemeMode } from '@/types/common.types';

export interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
}

export interface ThemePresetMeta {
  key: ThemePreset;
  label: string;
  swatch: string;
}

export const THEME_PRESET_LIST: ThemePresetMeta[] = [
  { key: 'blue',    label: 'Azul',    swatch: '#3b82f6' },
  { key: 'violet',  label: 'Violeta', swatch: '#7c3aed' },
  { key: 'emerald', label: 'Verde',   swatch: '#059669' },
  { key: 'rose',    label: 'Rosa',    swatch: '#e11d48' },
  { key: 'amber',   label: 'Ámbar',   swatch: '#d97706' },
  { key: 'slate',   label: 'Gris',    swatch: '#475569' },
  { key: 'red',     label: 'Rojo',    swatch: '#dc2626' },
  { key: 'orange',  label: 'Naranja', swatch: '#ea580c' },
  { key: 'yellow',  label: 'Amarillo', swatch: '#ca8a04' },
  { key: 'lime',    label: 'Lima',    swatch: '#65a30d' },
  { key: 'teal',    label: 'Turquesa', swatch: '#0f766e' },
  { key: 'cyan',    label: 'Cian',    swatch: '#0891b2' },
  { key: 'sky',     label: 'Celeste', swatch: '#0284c7' },
  { key: 'indigo',  label: 'Índigo',  swatch: '#4f46e5' },
  { key: 'fuchsia', label: 'Fucsia',  swatch: '#c026d3' },
  { key: 'pink',    label: 'Pink',    swatch: '#db2777' },
];

const PRESET_SWATCH_MAP: Record<ThemePreset, string> = Object.fromEntries(
  THEME_PRESET_LIST.map((preset) => [preset.key, preset.swatch])
) as Record<ThemePreset, string>;

export function buildThemeColors(primaryColor: string, mode: ThemeMode, buttonRadius = '8px'): ThemeColors {
  const isDark = mode === 'dark';

  return {
    primaryColor,
    secondaryColor: isDark ? '#141414' : '#ffffff',
    accentColor: primaryColor,
    backgroundColor: isDark ? '#141414' : '#ffffff',
    textColor: isDark ? '#ffffff' : '#111111',
    buttonRadius,
  };
}

export function getThemeColors(preset: ThemePreset, mode: ThemeMode): ThemeColors {
  return buildThemeColors(PRESET_SWATCH_MAP[preset], mode);
}
