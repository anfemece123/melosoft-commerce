import type { CSSProperties } from 'react';
import type { CatalogNavAlign, CatalogNavStyle } from '@/features/homeSections/catalogNav.types';
import { CATALOG_ALL_TAB_ID } from '@/features/homeSections/catalogNav.types';
import type { StorefrontTheme } from './storefrontTheme';
import { withAlpha } from './storefrontTheme';

export interface StorefrontCategoryTab {
  id: string;
  name: string;
}

interface StorefrontCategoryTabsProps {
  tabs: StorefrontCategoryTab[];
  activeId: string;
  onSelect: (id: string) => void;
  style: CatalogNavStyle;
  align: CatalogNavAlign;
  theme: StorefrontTheme;
  allLabel?: string;
}

/** Category-tabs navigation shown above a "Catálogo de productos" section's
 * grid/carousel. Always horizontally scrollable regardless of `align` — so
 * more tabs than fit on screen (a long manual selection, or a narrow
 * mobile viewport) never breaks layout, they just scroll — `align` only
 * changes how the row is justified when everything already fits. */
export function StorefrontCategoryTabs({ tabs, activeId, onSelect, style, align, theme, allLabel = 'Todo' }: StorefrontCategoryTabsProps) {
  // 'left'/'center' wrap onto multiple lines when there's room (no scroll
  // needed for a short list); 'scroll' forces a single non-wrapping
  // horizontally-scrollable row regardless of how many tabs there are —
  // either way, overflow never breaks the layout.
  const layoutClassName =
    align === 'scroll'
      ? 'flex-nowrap overflow-x-auto no-scrollbar justify-start'
      : align === 'center'
      ? 'flex-wrap justify-center'
      : 'flex-wrap justify-start';

  function tabClassName(isActive: boolean): string {
    switch (style) {
      case 'outline':
        return 'rounded-full border px-4 py-2';
      case 'solid':
        return `rounded-full px-4 py-2 ${isActive ? '' : 'border'}`;
      case 'minimal':
        return 'rounded-none border-b-2 px-1 py-2';
      case 'pills':
      default:
        return 'rounded-full px-4 py-2';
    }
  }

  function tabStyle(isActive: boolean): CSSProperties {
    switch (style) {
      case 'outline':
        return isActive
          ? { borderColor: theme.primary, color: theme.primary, backgroundColor: withAlpha(theme.primary, 0.08) }
          : { borderColor: theme.border, color: theme.mutedText, backgroundColor: 'transparent' };
      case 'solid':
        return isActive
          ? { backgroundColor: theme.primary, color: '#ffffff' }
          : { borderColor: theme.border, color: theme.text, backgroundColor: 'transparent' };
      case 'minimal':
        return isActive
          ? { borderColor: theme.primary, color: theme.primary }
          : { borderColor: 'transparent', color: theme.mutedText };
      case 'pills':
      default:
        return isActive
          ? { backgroundColor: theme.primary, color: '#ffffff' }
          : { backgroundColor: withAlpha(theme.text, 0.05), color: theme.text };
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Categorías"
      className={`mb-6 flex gap-2 pb-1 ${layoutClassName}`}
    >
      <button
        key={CATALOG_ALL_TAB_ID}
        type="button"
        role="tab"
        aria-selected={activeId === CATALOG_ALL_TAB_ID}
        onClick={() => onSelect(CATALOG_ALL_TAB_ID)}
        className={`shrink-0 whitespace-nowrap text-sm font-semibold transition-colors ${tabClassName(activeId === CATALOG_ALL_TAB_ID)}`}
        style={tabStyle(activeId === CATALOG_ALL_TAB_ID)}
      >
        {allLabel}
      </button>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onSelect(tab.id)}
          className={`shrink-0 whitespace-nowrap text-sm font-semibold transition-colors ${tabClassName(activeId === tab.id)}`}
          style={tabStyle(activeId === tab.id)}
        >
          {tab.name}
        </button>
      ))}
    </div>
  );
}
