import type {
  HeaderMenuMode,
  HeaderNavigationItem,
  HeaderNavigationItemType,
  LogoSize,
  MenuTextSize,
  PublicHeaderSettings,
  PublicHeaderStyle,
} from '@/types/common.types';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';

const VALID_LOGO_SIZES: LogoSize[] = ['sm', 'md', 'lg'];
const VALID_TEXT_SIZES: MenuTextSize[] = ['sm', 'md', 'lg'];
const VALID_MENU_MODES: HeaderMenuMode[] = ['catalog_link', 'categories', 'custom'];
const VALID_NAVIGATION_ITEM_TYPES: HeaderNavigationItemType[] = [
  'catalog',
  'category',
  'collection',
  'facet_value',
  'featured',
  'sale',
];

// Maximum items shown inline in desktop nav before the "Más" overflow.
export const MAX_VISIBLE_HEADER_ITEMS = 5;
export const MAX_CUSTOM_HEADER_ITEMS = 10;

function resolveNavigationItems(raw: unknown): HeaderNavigationItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, MAX_CUSTOM_HEADER_ITEMS).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Record<string, unknown>;
    const type = item.type as HeaderNavigationItemType;
    if (!VALID_NAVIGATION_ITEM_TYPES.includes(type)) return [];

    const needsTarget = type === 'category' || type === 'collection' || type === 'facet_value';
    const targetId = typeof item.targetId === 'string' && item.targetId.trim()
      ? item.targetId.trim()
      : null;
    if (needsTarget && !targetId) return [];

    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 40) : '';
    if (!label) return [];

    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim().slice(0, 80)
      : `navigation-item-${index}`;

    return [{ id, type, label, targetId }];
  });
}

function resolveStyle(raw: unknown): PublicHeaderStyle {
  if (raw === 'search') return 'search';
  if (raw === 'split') return 'search'; // migrate split → search
  return 'classic'; // centered, undefined, or anything else → classic
}

export function resolveHeaderSettings(raw: unknown): PublicHeaderSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_HEADER_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    style: resolveStyle(r.style),
    isSticky: typeof r.isSticky === 'boolean' ? r.isSticky : DEFAULT_HEADER_SETTINGS.isSticky,
    transparentOnHero: typeof r.transparentOnHero === 'boolean' ? r.transparentOnHero : DEFAULT_HEADER_SETTINGS.transparentOnHero,
    showLogo: typeof r.showLogo === 'boolean' ? r.showLogo : DEFAULT_HEADER_SETTINGS.showLogo,
    showStoreName: typeof r.showStoreName === 'boolean' ? r.showStoreName : DEFAULT_HEADER_SETTINGS.showStoreName,
    showHomeLink: typeof r.showHomeLink === 'boolean' ? r.showHomeLink : DEFAULT_HEADER_SETTINGS.showHomeLink,
    logoSize: VALID_LOGO_SIZES.includes(r.logoSize as LogoSize) ? (r.logoSize as LogoSize) : DEFAULT_HEADER_SETTINGS.logoSize,
    menuTextSize: VALID_TEXT_SIZES.includes(r.menuTextSize as MenuTextSize) ? (r.menuTextSize as MenuTextSize) : DEFAULT_HEADER_SETTINGS.menuTextSize,
    menuMode: VALID_MENU_MODES.includes(r.menuMode as HeaderMenuMode) ? (r.menuMode as HeaderMenuMode) : DEFAULT_HEADER_SETTINGS.menuMode,
    navigationItems: resolveNavigationItems(r.navigationItems),
  };
}

// sm = original design size (h-[52px] mobile / h-[64px] desktop)
// md = ~15% larger, lg = ~35% larger
export const LOGO_SIZE_MAP: Record<LogoSize, string> = {
  sm: 'h-[52px] w-[52px] md:h-[64px] md:w-[64px]',
  md: 'h-[60px] w-[60px] md:h-[74px] md:w-[74px]',
  lg: 'h-[72px] w-[72px] md:h-[88px] md:w-[88px]',
};

// sm = original design size (12px), md/lg step up
export const MENU_TEXT_SIZE_MAP: Record<MenuTextSize, string> = {
  sm: 'text-[12px]',
  md: 'text-[13px]',
  lg: 'text-[15px]',
};
