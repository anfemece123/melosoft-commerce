import { CreditCard, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import type { PaymentChoice } from './CheckoutPaymentSelector';

interface CheckoutActionsProps {
  theme: StorefrontTheme;
  currency: string;
  totalPrice: number;
  isSubmitting: boolean;
  hasSelectedLocation: boolean;
  paymentChoice: PaymentChoice;
  onSubmit: () => void;
}

export function CheckoutActions({
  theme,
  currency,
  totalPrice,
  isSubmitting,
  hasSelectedLocation,
  paymentChoice,
  onSubmit,
}: CheckoutActionsProps) {
  return (
    <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
      <div className="flex items-center justify-between text-sm">
        <span className="opacity-60">Total a pagar</span>
        <span className="font-bold text-lg" style={{ color: theme.primary }}>
          {formatCurrency(totalPrice, 'es-CO', currency)}
        </span>
      </div>
      <button
        type="button"
        disabled={isSubmitting || !hasSelectedLocation}
        onClick={onSubmit}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: theme.primary }}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {paymentChoice === 'online' ? 'Procesando...' : 'Confirmando...'}
          </>
        ) : paymentChoice === 'online' ? (
          <><CreditCard className="h-4 w-4" /> Pagar con Wompi</>
        ) : (
          'Confirmar pedido'
        )}
      </button>
    </div>
  );
}
