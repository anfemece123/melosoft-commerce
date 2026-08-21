import { Minus, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { getMaxQuantity, isOutOfStock, type CartItem, type QuantityUpdate } from '@/lib/cart/cartContext';
import { formatCurrency } from '@/utils/formatCurrency';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

interface CartItemRowProps {
  item: CartItem;
  theme: StorefrontTheme;
  currency: string;
  onUpdateQuantity: (lineId: string, quantity: QuantityUpdate) => number;
  onRemove: (lineId: string) => void;
  onEdit?: (item: CartItem) => void;
}

export function CartItemRow({ item, theme, currency, onUpdateQuantity, onRemove, onEdit }: CartItemRowProps) {
  const max = getMaxQuantity(item);
  const outOfStock = isOutOfStock(item);
  const atMax = max !== null && item.quantity >= max;
  const customizationsByGroup = item.customizations.reduce<Map<string, typeof item.customizations>>((groups, customization) => {
    const current = groups.get(customization.optionGroupName) ?? [];
    current.push(customization);
    groups.set(customization.optionGroupName, current);
    return groups;
  }, new Map());

  return (
    <div className="flex gap-4 py-5">
      <div
        className="h-16 w-16 shrink-0 overflow-hidden rounded-sm"
        style={{ backgroundColor: `${theme.primary}10` }}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-5 w-5 opacity-30" style={{ color: theme.primary }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug" style={{ color: theme.text }}>
              {item.productName}
            </p>
            {item.variantLabel && (
              <p className="mt-0.5 text-xs" style={{ color: theme.mutedText }}>
                {item.variantLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.lineId)}
            className="p-1 hover:opacity-70 transition-opacity"
            aria-label={`Eliminar ${item.productName}`}
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold" style={{ color: theme.primary }}>
            {formatCurrency(item.unitPrice, 'es-CO', currency)}
          </p>
          <p className="text-sm font-semibold" style={{ color: theme.text }}>
            {formatCurrency(item.unitPrice * item.quantity, 'es-CO', currency)}
          </p>
        </div>

        {item.customizations.length > 0 ? (
          <div className="mt-2 space-y-1.5 rounded-lg border px-2.5 py-2" style={{ borderColor: theme.border }}>
            {Array.from(customizationsByGroup.entries()).map(([groupName, customizations]) => (
              <div key={groupName} className="text-xs">
                <span className="font-semibold" style={{ color: theme.text }}>{groupName}: </span>
                <span style={{ color: theme.mutedText }}>
                  {customizations.map((customization) => (
                    `${customization.optionItemLabel}${customization.priceDelta > 0 ? ` (+${formatCurrency(customization.priceDelta, 'es-CO', currency)})` : ''}`
                  )).join(', ')}
                </span>
              </div>
            ))}
          </div>
        ) : item.customizationNotes ? (
          // Fallback for cart lines added before structured customizations
          // existed (persisted in localStorage from an earlier session).
          <p className="mt-1.5 text-xs line-clamp-2" style={{ color: theme.mutedText }}>
            {item.customizationNotes}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div
            className="inline-flex items-center gap-1 rounded-xl border p-1"
            style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            aria-label={`Cantidad de ${item.productName}`}
          >
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.lineId, (currentQuantity) => currentQuantity - 1)}
              disabled={item.quantity <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35"
              style={{ borderColor: theme.border, color: theme.text }}
              aria-label={`Disminuir unidades de ${item.productName}`}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span
              className="min-w-8 px-1 text-center text-sm font-semibold tabular-nums"
              style={{ color: theme.text }}
              aria-live="polite"
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.lineId, (currentQuantity) => currentQuantity + 1)}
              disabled={outOfStock || atMax}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35"
              style={{ borderColor: theme.border, color: theme.text }}
              aria-label={`Aumentar unidades de ${item.productName}`}
              title={atMax ? `Solo hay ${max} unidad${max === 1 ? '' : 'es'} disponible${max === 1 ? '' : 's'}.` : undefined}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1 text-xs font-semibold hover:opacity-70"
              style={{ color: theme.primary }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          ) : null}
        </div>
        {(outOfStock || atMax) && (
          <p className="mt-1 text-xs text-amber-600">
            {outOfStock
              ? (item.productType === 'menu_item'
                  ? 'Agotado por el momento.'
                  : 'Este producto no tiene stock disponible.')
              : `Solo hay ${max} unidad${max === 1 ? '' : 'es'} disponible${max === 1 ? '' : 's'}.`}
          </p>
        )}
      </div>
    </div>
  );
}
