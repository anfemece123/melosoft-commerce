import { Check } from 'lucide-react';
import type { PublicProductPage } from '@/types/common.types';
import { isOptionValueSelectable } from '@/lib/products/productVariants.utils';
import type { StorefrontTheme } from './storefrontTheme';

interface StorefrontVariantSelectorProps {
  theme: StorefrontTheme;
  product: PublicProductPage;
  selectedValueIds: Record<string, string>;
  onSelect: (optionId: string, valueId: string) => void;
}

export function StorefrontVariantSelector({
  theme,
  product,
  selectedValueIds,
  onSelect,
}: StorefrontVariantSelectorProps) {
  const options = [...product.variantOptions].sort((a, b) => a.sortOrder - b.sortOrder);
  if (options.length === 0) return null;

  return (
    <div className="space-y-4">
      {options.map((option) => {
        const otherSelections = Object.fromEntries(
          Object.entries(selectedValueIds).filter(([optionId]) => optionId !== option.id)
        );
        return (
          <div key={option.id}>
            <p className="mb-1.5 text-sm font-medium" style={{ color: theme.text }}>
              {option.name}
            </p>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const selected = selectedValueIds[option.id] === value.id;
                const selectable = isOptionValueSelectable(product, option.id, value.id, otherSelections);
                return (
                  <button
                    key={value.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => onSelect(option.id, value.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? `${theme.primary}12` : 'transparent',
                      color: selected ? theme.primary : theme.text,
                    }}
                  >
                    {option.controlsMedia && value.images.length > 0 ? (
                      <img
                        src={value.images[0].imageUrl}
                        alt=""
                        className="h-5 w-5 rounded-full border object-cover"
                        style={{ borderColor: theme.border }}
                      />
                    ) : option.type === 'color' && value.colorHex ? (
                      <span
                        className="h-3.5 w-3.5 rounded-full border"
                        style={{ backgroundColor: value.colorHex, borderColor: theme.border }}
                      />
                    ) : null}
                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
