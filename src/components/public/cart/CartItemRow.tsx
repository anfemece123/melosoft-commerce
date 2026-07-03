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
    <div
      className="flex gap-3 rounded-2xl border p-3"
      style={{ borderColor: theme.border, backgroundColor: theme.surface }}
    >
      <div
        className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"
        style={{ backgroundColor: `${theme.primary}15` }}
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
        <p className="text-sm font-medium leading-snug">{item.productName}</p>
        <p className="text-sm font-semibold" style={{ color: theme.primary }}>
          {formatCurrency(item.unitPrice, 'es-CO', currency)}
        </p>
        {item.customizationNotes && (
          <p className="mt-0.5 text-xs opacity-50 line-clamp-1">{item.customizationNotes}</p>
        )}
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
              disabled={atMax}
              className="flex h-7 w-7 items-center justify-center rounded-lg border hover:opacity-70 transition-opacity disabled:opacity-40 disabled:hover:opacity-40"
              style={{ borderColor: theme.border }}
            >
              <Plus className="h-3 w-3" />
            </button>
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
        {(outOfStock || atMax) && (
          <p className="mt-1 text-xs text-amber-600">
            {outOfStock
              ? 'Este producto no tiene stock disponible.'
              : `Solo hay ${max} unidad${max === 1 ? '' : 'es'} disponible${max === 1 ? '' : 's'}.`}
          </p>
        )}
      </div>
    </div>
  );
}
