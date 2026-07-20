/** Category-tabs navigation for "Catálogo de productos" (Home Builder) —
 * an owner-optional row of category filters shown above the section's
 * grid/carousel, filtering the section's own product list in place (never
 * navigating to /catalog). Modeled the same way promoBanner.types.ts models
 * its own section-level axes: plain literal unions + label maps +
 * `resolveX(value: unknown): X` defensive fallbacks, consumed by both the
 * wizard step and the public renderer. */

export type CatalogNavMode = 'all' | 'root_only' | 'manual';
export type CatalogNavStyle = 'pills' | 'outline' | 'solid' | 'minimal';
export type CatalogNavAlign = 'left' | 'center' | 'scroll';

/** Sentinel id for the always-present "Todo" tab — never a real category
 * id, so it can't collide with one. */
export const CATALOG_ALL_TAB_ID = '__all__';

export const CATALOG_NAV_VISIBLE_OPTIONS = [4, 5, 6, 8] as const;
export type CatalogNavVisibleCount = (typeof CATALOG_NAV_VISIBLE_OPTIONS)[number];

export const CATALOG_NAV_MODE_LABELS: Record<CatalogNavMode, string> = {
  all: 'Todas',
  root_only: 'Solo categorías principales',
  manual: 'Selección manual',
};

export const CATALOG_NAV_STYLE_LABELS: Record<CatalogNavStyle, string> = {
  pills: 'Pills redondeadas',
  outline: 'Botones outline',
  solid: 'Botones sólidos',
  minimal: 'Minimal',
};

export const CATALOG_NAV_ALIGN_LABELS: Record<CatalogNavAlign, string> = {
  left: 'Izquierda',
  center: 'Centro',
  scroll: 'Scroll horizontal',
};

export function resolveCatalogNavMode(value: unknown): CatalogNavMode {
  return value === 'root_only' || value === 'manual' ? value : 'all';
}

export function resolveCatalogNavStyle(value: unknown): CatalogNavStyle {
  return value === 'outline' || value === 'solid' || value === 'minimal' ? value : 'pills';
}

export function resolveCatalogNavAlign(value: unknown): CatalogNavAlign {
  return value === 'center' || value === 'scroll' ? value : 'left';
}

function isCatalogNavVisibleCount(value: unknown): value is CatalogNavVisibleCount {
  return typeof value === 'number' && (CATALOG_NAV_VISIBLE_OPTIONS as readonly number[]).includes(value);
}

export function resolveCatalogNavVisibleCount(value: unknown): CatalogNavVisibleCount {
  return isCatalogNavVisibleCount(value) ? value : 6;
}

export function resolveManualCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}
