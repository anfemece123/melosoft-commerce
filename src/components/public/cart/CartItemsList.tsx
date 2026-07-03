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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {items.length === 0 ? (
        <CartEmptyState />
      ) : (
        items.map((item) => (
          <CartItemRow
            key={item.lineId}
            item={item}
            theme={theme}
            currency={currency}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
          />
        ))
      )}
    </div>
  );
}
