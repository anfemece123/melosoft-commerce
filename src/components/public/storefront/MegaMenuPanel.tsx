import { Link } from 'react-router-dom';
import type { StorefrontTheme } from './storefrontTheme';
import type { PublicStoreCategory, PublicStoreFacet } from '@/types/common.types';

interface MegaMenuPanelProps {
  theme: StorefrontTheme;
  storeSlug: string;
  activeCategoryName: string;
  activeCategorySlug: string;
  subcategories: PublicStoreCategory[];
  megaMenuFacets: PublicStoreFacet[];
  onClose: () => void;
}

export function MegaMenuPanel({
  theme,
  storeSlug,
  activeCategoryName,
  activeCategorySlug,
  subcategories,
  megaMenuFacets,
  onClose,
}: MegaMenuPanelProps) {
  if (subcategories.length === 0 && megaMenuFacets.every((f) => f.values.length === 0)) return null;

  return (
    <div
      className="border-t"
      style={{
        backgroundColor: theme.mode === 'dark'
          ? `${theme.background}f5`
          : `${theme.background}fa`,
        borderColor: theme.border,
        boxShadow: `0 16px 40px ${theme.shadow}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-5">
        <div className="flex gap-8">
          {/* Subcategories column */}
          {subcategories.length > 0 && (
            <div className="flex-1">
              <p
                className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: theme.mutedText }}
              >
                {activeCategoryName}
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4">
                {subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/s/${storeSlug}/catalog?cat=${encodeURIComponent(activeCategorySlug)}&sub=${encodeURIComponent(sub.slug)}`}
                    onClick={onClose}
                    className="block py-1.5 text-sm font-medium transition-opacity hover:opacity-60"
                    style={{ color: theme.text }}
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Facet columns for mega menu */}
          {megaMenuFacets.filter((f) => f.values.length > 0).map((facet) => (
            <div
              key={facet.id}
              className="w-40 shrink-0 border-l pl-8"
              style={{ borderColor: theme.border }}
            >
              <p
                className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: theme.mutedText }}
              >
                {facet.name}
              </p>
              <div className="space-y-0.5">
                {facet.values.slice(0, 8).map((val) => (
                  <Link
                    key={val.id}
                    to={`/s/${storeSlug}/catalog?cat=${encodeURIComponent(activeCategorySlug)}&f_${encodeURIComponent(facet.slug)}=${encodeURIComponent(val.slug)}`}
                    onClick={onClose}
                    className="block py-1.5 text-sm transition-opacity hover:opacity-60"
                    style={{ color: theme.text }}
                  >
                    {val.value}
                  </Link>
                ))}
                {facet.values.length > 8 && (
                  <Link
                    to={`/s/${storeSlug}/catalog?cat=${encodeURIComponent(activeCategorySlug)}`}
                    onClick={onClose}
                    className="block pt-2 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: theme.primary }}
                  >
                    Ver más →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
