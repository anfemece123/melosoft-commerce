import type { ReactNode } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { CartItem } from '@/lib/cart/cartContext';
import { formatCurrency } from '@/utils/formatCurrency';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

interface CartSummaryProps {
  theme: StorefrontTheme;
  currency: string;
  totalPrice: number;
  unavailableItems: CartItem[];
  onRemoveUnavailable: () => void;
  paymentSelector: ReactNode;
  hasAnyPaymentMethod: boolean;
  onViewCart?: () => void;
  onContinue: () => void;
}

export function CartSummary({
  theme,
  currency,
  totalPrice,
  unavailableItems,
  onRemoveUnavailable,
  paymentSelector,
  hasAnyPaymentMethod,
  onViewCart,
  onContinue,
}: CartSummaryProps) {
  const hasUnavailable = unavailableItems.length > 0;

  return (
    <div className="border-t px-5 py-5 space-y-3" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
      {!hasAnyPaymentMethod && (
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium"
          style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b1a', color: '#b45309' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          Esta tienda no tiene métodos de pago configurados por ahora. Contacta al negocio directamente.
        </div>
      )}
      {hasUnavailable && (
        <div
          className="rounded-xl border px-3 py-3 space-y-2"
          style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b1a' }}
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <p className="text-xs font-semibold text-amber-700">
              No disponibles en esta sede:
            </p>
          </div>
          <ul className="space-y-1">
            {unavailableItems.map((i) => (
              <li key={i.lineId} className="flex items-center gap-1.5 text-xs text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {i.productName}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onRemoveUnavailable}
            className="w-full rounded-xl border border-amber-300 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Quitar productos no disponibles
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm opacity-60">Total del pedido</span>
        <span className="text-xl font-bold" style={{ color: theme.primary }}>
          {formatCurrency(totalPrice, 'es-CO', currency)}
        </span>
      </div>
      {paymentSelector}
      <div className="grid gap-2">
        {onViewCart && (
          <button
            type="button"
            onClick={onViewCart}
            className="w-full rounded-2xl border py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.background }}
          >
            Ver carrito
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={hasUnavailable || !hasAnyPaymentMethod}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: theme.primary }}
        >
          Continuar con el pedido
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
