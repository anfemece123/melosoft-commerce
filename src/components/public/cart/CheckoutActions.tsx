import { CreditCard, Loader2 } from 'lucide-react';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import type { PaymentChoice } from './CheckoutPaymentSelector';

interface CheckoutActionsProps {
  theme: StorefrontTheme;
  isSubmitting: boolean;
  hasSelectedLocation: boolean;
  paymentChoice: PaymentChoice;
  onSubmit: () => void;
  isAcceptingOrders: boolean;
  orderingStatusLoading?: boolean;
}

export function CheckoutActions({
  theme,
  isSubmitting,
  hasSelectedLocation,
  paymentChoice,
  onSubmit,
  isAcceptingOrders,
  orderingStatusLoading = false,
}: CheckoutActionsProps) {
  return (
    <div className="border-t px-5 py-4" style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
      <button
        type="button"
        disabled={isSubmitting || !hasSelectedLocation || !isAcceptingOrders || orderingStatusLoading}
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
      {!hasSelectedLocation ? (
        <p className="mt-2 text-xs" style={{ color: theme.mutedText }}>
          Selecciona una sede válida para continuar.
        </p>
      ) : !orderingStatusLoading && !isAcceptingOrders ? (
        <p className="mt-2 text-xs text-amber-700">
          La tienda no está recibiendo pedidos en este momento. Tu carrito permanecerá guardado.
        </p>
      ) : null}
    </div>
  );
}
