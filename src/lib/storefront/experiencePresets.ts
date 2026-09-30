import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceHeadingFont,
  ThemeMode,
} from '@/types/common.types';

export interface ExperienceStylePreset {
  id: string;
  label: string;
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
  backgroundStyle: ExperienceBackgroundStyle;
  backgroundPattern: ExperienceBackgroundPattern;
  backgroundIntensity: number;
  headingFont: ExperienceHeadingFont;
}

/** Ready-made looks for food & drink concepts. Applying one only fills the
 * form — every value stays editable afterwards. Primary colors keep enough
 * contrast with the white text used on storefront buttons. */
export const EXPERIENCE_STYLE_PRESETS: ExperienceStylePreset[] = [
  {
    id: 'sushi',
    label: 'Sushi nocturno',
    themeMode: 'dark',
    primaryColor: '#e11d48',
    secondaryColor: '#1f2937',
    accentColor: '#f59e0b',
    backgroundColor: '#0b0f14',
    textColor: '#f8fafc',
    buttonRadius: '9999px',
    backgroundStyle: 'pattern',
    backgroundPattern: 'waves',
    backgroundIntensity: 45,
    headingFont: 'modern',
  },
  {
    id: 'trattoria',
    label: 'Trattoria',
    themeMode: 'light',
    primaryColor: '#b91c1c',
    secondaryColor: '#fef3c7',
    accentColor: '#15803d',
    backgroundColor: '#fffbf2',
    textColor: '#3f1d0b',
    buttonRadius: '14px',
    backgroundStyle: 'pattern',
    backgroundPattern: 'tablecloth',
    backgroundIntensity: 28,
    headingFont: 'classic',
  },
  {
    id: 'grill',
    label: 'Parrilla y brasas',
    themeMode: 'dark',
    primaryColor: '#c2410c',
    secondaryColor: '#292524',
    accentColor: '#facc15',
    backgroundColor: '#1c1917',
    textColor: '#fafaf9',
    buttonRadius: '8px',
    backgroundStyle: 'gradient',
    backgroundPattern: 'dots',
    backgroundIntensity: 70,
    headingFont: 'bold',
  },
  {
    id: 'pizza',
    label: 'Pizzería',
    themeMode: 'light',
    primaryColor: '#dc2626',
    secondaryColor: '#fee2e2',
    accentColor: '#16a34a',
    backgroundColor: '#fffaf5',
    textColor: '#292524',
    buttonRadius: '9999px',
    backgroundStyle: 'pattern',
    backgroundPattern: 'terrazzo',
    backgroundIntensity: 50,
    headingFont: 'bold',
  },
  {
    id: 'cafe',
    label: 'Café y brunch',
    themeMode: 'light',
    primaryColor: '#7c4a2d',
    secondaryColor: '#f5ebe0',
    accentColor: '#d97706',
    backgroundColor: '#fbf7f2',
    textColor: '#3b2a20',
    buttonRadius: '24px',
    backgroundStyle: 'pattern',
    backgroundPattern: 'dots',
    backgroundIntensity: 40,
    headingFont: 'handwritten',
  },
  {
    id: 'seafood',
    label: 'Mariscos',
    themeMode: 'light',
    primaryColor: '#0e7490',
    secondaryColor: '#e0f2fe',
    accentColor: '#f97316',
    backgroundColor: '#f6fbfd',
    textColor: '#0c2a36',
    buttonRadius: '24px',
    backgroundStyle: 'pattern',
    backgroundPattern: 'waves',
    backgroundIntensity: 35,
    headingFont: 'elegant',
  },
  {
    id: 'healthy',
    label: 'Saludable',
    themeMode: 'light',
    primaryColor: '#15803d',
    secondaryColor: '#ecfccb',
    accentColor: '#f59e0b',
    backgroundColor: '#fbfdf7',
    textColor: '#14301e',
    buttonRadius: '9999px',
    backgroundStyle: 'gradient',
    backgroundPattern: 'dots',
    backgroundIntensity: 55,
    headingFont: 'modern',
  },
  {
    id: 'bistro',
    label: 'Bistró elegante',
    themeMode: 'dark',
    primaryColor: '#9a7432',
    secondaryColor: '#1e1b16',
    accentColor: '#e7d3a3',
    backgroundColor: '#12100d',
    textColor: '#f5efe3',
    buttonRadius: '8px',
    backgroundStyle: 'pattern',
    backgroundPattern: 'diagonal',
    backgroundIntensity: 25,
    headingFont: 'elegant',
  },
];
