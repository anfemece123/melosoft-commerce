import type { PublicProductOptionGroup } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { ProductOptionSelections } from '@/lib/products/productOptions.utils';
import { formatCurrency } from '@/utils/formatCurrency';

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
        const helper = group.selectionType === 'single'
          ? group.isRequired
            ? 'Elige 1 opción obligatoria.'
            : 'Puedes dejarlo sin seleccionar o elegir 1.'
          : group.maxSelect
            ? `Elige hasta ${group.maxSelect}${group.isRequired ? `, mínimo ${Math.max(group.minSelect, 1)}` : ''}.`
            : group.isRequired
              ? `Elige mínimo ${Math.max(group.minSelect, 1)}.`
              : 'Selección múltiple opcional.';

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

            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => {
                const selected = (selections[group.id] ?? []).includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleOption(group, item.id)}
                    aria-disabled={!item.isAvailable}
                    className="rounded-2xl border px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.softPrimary : theme.surface,
                      color: theme.text,
                      cursor: item.isAvailable ? 'pointer' : 'not-allowed',
                      opacity: item.isAvailable ? 1 : 0.58,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.priceDelta > 0 ? (
                        <span className="text-xs font-semibold" style={{ color: theme.primary }}>
                          +{formatCurrency(item.priceDelta, 'es-CO', currency)}
                        </span>
                      ) : null}
                      {!item.isAvailable ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          {item.unavailableReason ?? 'Agotado'}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="mt-0.5 text-xs" style={{ color: theme.mutedText }}>
                        {item.description}
                      </p>
                    ) : null}
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
