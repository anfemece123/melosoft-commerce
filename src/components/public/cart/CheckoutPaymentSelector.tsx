import { Banknote, CreditCard } from 'lucide-react';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

export type PaymentChoice = 'cash_on_delivery' | 'online';

interface CheckoutPaymentSelectorProps {
  theme: StorefrontTheme;
  showPaymentChoice: boolean;
  showOnline: boolean;
  paymentChoice: PaymentChoice;
  onChange: (choice: PaymentChoice) => void;
}

export function CheckoutPaymentSelector({
  theme,
  showPaymentChoice,
  showOnline,
  paymentChoice,
  onChange,
}: CheckoutPaymentSelectorProps) {
  if (!showPaymentChoice) {
    return (
      <div
        className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium"
        style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}
      >
        {showOnline ? <><CreditCard className="h-3.5 w-3.5" /> Pago online</> : 'Pago contraentrega'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium" style={{ color: theme.mutedText }}>¿Cómo quieres pagar?</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('cash_on_delivery')}
          className="flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors"
          style={{
            borderColor: paymentChoice === 'cash_on_delivery' ? theme.primary : theme.border,
            backgroundColor: paymentChoice === 'cash_on_delivery' ? `${theme.primary}12` : theme.surface,
            color: paymentChoice === 'cash_on_delivery' ? theme.primary : theme.mutedText,
          }}
        >
          <Banknote className="h-5 w-5" />
          Contraentrega
        </button>
        <button
          type="button"
          onClick={() => onChange('online')}
          className="flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors"
          style={{
            borderColor: paymentChoice === 'online' ? theme.primary : theme.border,
            backgroundColor: paymentChoice === 'online' ? `${theme.primary}12` : theme.surface,
            color: paymentChoice === 'online' ? theme.primary : theme.mutedText,
          }}
        >
          <CreditCard className="h-5 w-5" />
          Pagar online
        </button>
      </div>
    </div>
  );
}
