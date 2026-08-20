import type { PublicProductOptionGroup } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { isSingleProductOptionGroup, type ProductOptionSelections } from '@/lib/products/productOptions.utils';
import { formatCurrency } from '@/utils/formatCurrency';
import { Check, ImageIcon } from 'lucide-react';

interface StorefrontProductCustomizerProps {
  theme: StorefrontTheme;
  currency: string;
  groups: PublicProductOptionGroup[];
  selections: ProductOptionSelections;
  onToggleOption: (group: PublicProductOptionGroup, itemId: string) => void;
}

export function StorefrontProductCustomizer({
  theme,
  currency,
  groups,
  selections,
  onToggleOption,
}: StorefrontProductCustomizerProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const selectedCount = (selections[group.id] ?? []).length;
        const availableCount = group.items.filter((item) => item.isAvailable).length;
        const minimum = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;
        const isSingleSelection = isSingleProductOptionGroup(group);
        const helper = isSingleSelection
          ? group.isRequired
            ? 'Elige 1 opción obligatoria.'
            : 'Puedes dejarlo sin seleccionar o elegir 1.'
          : group.maxSelect
            ? `Elige hasta ${group.maxSelect}${group.isRequired ? `, mínimo ${Math.max(group.minSelect, 1)}` : ''}.`
            : group.isRequired
              ? `Elige mínimo ${Math.max(group.minSelect, 1)}.`
              : 'Selección múltiple opcional.';
        const hasVisualItems = group.items.some((item) => Boolean(item.imageUrl));

        return (
          <div
            key={group.id}
            className="rounded-2xl border p-4"
            style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: theme.text }}>
                  {group.name}
                </h3>
                {group.description ? (
                  <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>
                    {group.description}
                  </p>
                ) : null}
                <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>
                  {helper}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  backgroundColor: group.isRequired ? theme.softPrimary : theme.surface,
                  color: group.isRequired ? theme.primary : theme.mutedText,
                }}
              >
                {selectedCount} seleccionada{selectedCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className={hasVisualItems
              ? `grid grid-cols-1 gap-2 min-[440px]:grid-cols-2 ${group.items.length > 6 ? 'max-h-[22rem] overflow-y-auto overscroll-contain pr-1' : ''}`
              : 'flex flex-wrap gap-2'}>
              {group.items.map((item) => {
                const selected = (selections[group.id] ?? []).includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleOption(group, item.id)}
                    disabled={!item.isAvailable && !selected}
                    aria-pressed={selected}
                    className={`relative overflow-hidden border text-left transition-colors ${hasVisualItems ? 'min-h-[4.5rem] min-w-0 rounded-xl p-2' : 'rounded-2xl px-3 py-2'}`}
                    style={{
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.softPrimary : theme.surface,
                      color: theme.text,
                      cursor: item.isAvailable || selected ? 'pointer' : 'not-allowed',
                      opacity: item.isAvailable ? 1 : 0.58,
                    }}
                  >
                    <div className={hasVisualItems ? 'flex min-w-0 items-center gap-2.5' : ''}>
                      {hasVisualItems ? (
                        <div
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border"
                          style={{ borderColor: theme.border, backgroundColor: theme.surface }}
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-1" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ImageIcon className="h-4 w-4" style={{ color: theme.mutedText }} />
                            </div>
                          )}
                          {selected ? (
                            <span
                              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                              style={{ backgroundColor: theme.primary }}
                            >
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`${hasVisualItems ? 'line-clamp-2 text-xs leading-4 sm:text-sm' : 'truncate text-sm'} min-w-0 font-medium`}>
                            {item.label}
                          </span>
                          {item.priceDelta > 0 ? (
                            <span className="shrink-0 text-xs font-semibold" style={{ color: theme.primary }}>
                              +{formatCurrency(item.priceDelta, 'es-CO', currency)}
                            </span>
                          ) : null}
                          {!item.isAvailable ? (
                            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                              {item.unavailableReason ?? 'Agotado'}
                            </span>
                          ) : null}
                        </div>
                        {item.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[11px]" style={{ color: theme.mutedText }}>
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {minimum > availableCount ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                No hay suficientes opciones disponibles en este grupo. Intenta nuevamente más tarde.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
