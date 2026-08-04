import { Banknote, CreditCard } from 'lucide-react';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

interface CartPaymentMethodsNoticeProps {
  theme: StorefrontTheme;
  showCashOnDelivery: boolean;
  showOnline: boolean;
}

export function CartPaymentMethodsNotice({
  theme,
  showCashOnDelivery,
  showOnline,
}: CartPaymentMethodsNoticeProps) {
  if (!showCashOnDelivery && !showOnline) return null;

  const label = showCashOnDelivery && showOnline
    ? 'Online y contraentrega'
    : showOnline
      ? 'Pago online con Wompi'
      : 'Pago contraentrega';

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs"
      style={{ backgroundColor: `${theme.primary}0D` }}
    >
      <span className="font-medium" style={{ color: theme.mutedText }}>
        Formas de pago
      </span>
      <span className="flex items-center gap-1.5 text-right font-semibold" style={{ color: theme.text }}>
        {showOnline && <CreditCard aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
        {!showOnline && <Banknote aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </span>
    </div>
  );
}
