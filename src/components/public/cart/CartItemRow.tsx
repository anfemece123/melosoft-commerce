import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { getMaxQuantity, isOutOfStock, type CartItem } from '@/lib/cart/cartContext';
import { formatCurrency } from '@/utils/formatCurrency';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

interface CartItemRowProps {
  item: CartItem;
  theme: StorefrontTheme;
  currency: string;
  onUpdateQuantity: (lineId: string, quantity: number) => number;
  onRemove: (lineId: string) => void;
}

export function CartItemRow({ item, theme, currency, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const max = getMaxQuantity(item);
  const outOfStock = isOutOfStock(item);
  const atMax = max !== null && item.quantity >= max;

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
            <p className="text-sm font-medium leading-snug">{item.productName}</p>
            {item.variantLabel && (
              <p className="mt-0.5 text-xs opacity-60">{item.variantLabel}</p>
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
          <div className="mt-1.5">
            <p className="text-xs font-medium opacity-60">Adiciones:</p>
            {item.customizations.map((c) => (
              <p key={c.optionItemId} className="text-xs opacity-50 pl-2">
                {c.optionItemLabel} <span className="opacity-70">+{formatCurrency(c.priceDelta, 'es-CO', currency)}</span>
              </p>
            ))}
          </div>
        ) : item.customizationNotes ? (
          // Fallback for cart lines added before structured customizations
          // existed (persisted in localStorage from an earlier session).
          <p className="mt-1.5 text-xs opacity-50 line-clamp-2">{item.customizationNotes}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.lineId, item.quantity - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border hover:opacity-70 transition-opacity"
              style={{ borderColor: theme.border }}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.lineId, item.quantity + 1)}
              disabled={outOfStock || atMax}
              className="flex h-7 w-7 items-center justify-center rounded-lg border hover:opacity-70 transition-opacity disabled:opacity-40 disabled:hover:opacity-40"
              style={{ borderColor: theme.border }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
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
