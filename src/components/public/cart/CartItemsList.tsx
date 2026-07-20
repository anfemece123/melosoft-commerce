import type { CartItem } from '@/lib/cart/cartContext';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import { CartEmptyState } from './CartEmptyState';
import { CartItemRow } from './CartItemRow';

interface CartItemsListProps {
  items: CartItem[];
  theme: StorefrontTheme;
  currency: string;
  onUpdateQuantity: (lineId: string, quantity: number) => number;
  onRemove: (lineId: string) => void;
}

export function CartItemsList({ items, theme, currency, onUpdateQuantity, onRemove }: CartItemsListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-2">
      {items.length === 0 ? (
        <CartEmptyState />
      ) : (
        items.map((item, index) => (
          <div
            key={item.lineId}
            className={index > 0 ? 'border-t' : ''}
            style={index > 0 ? { borderColor: theme.border } : undefined}
          >
            <CartItemRow
              item={item}
              theme={theme}
              currency={currency}
              onUpdateQuantity={onUpdateQuantity}
              onRemove={onRemove}
            />
          </div>
        ))
      )}
    </div>
  );
}
