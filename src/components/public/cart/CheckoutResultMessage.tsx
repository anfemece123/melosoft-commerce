import { CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import type { WebOrderResult } from '@/features/orders/orders.types';

interface CheckoutResultMessageProps {
  theme: StorefrontTheme;
  currency: string;
  orderResult: WebOrderResult;
  storeName: string;
  whatsappNumber: string | null;
  onClose: () => void;
}

export function CheckoutResultMessage({
  theme,
  currency,
  orderResult,
  storeName,
  whatsappNumber,
  onClose,
}: CheckoutResultMessageProps) {
  function handleSendWhatsApp() {
    if (!whatsappNumber) return;
    const phone = whatsappNumber.replace(/\D/g, '');
    const lines: string[] = [
      `Hola ${storeName}, acabo de confirmar el pedido ${orderResult.orderNumber}.`,
      `Total: ${formatCurrency(orderResult.totalAmount, 'es-CO', currency)}`,
      'Pago: Contraentrega',
    ];
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${theme.primary}18` }}
        >
          <CheckCircle className="h-10 w-10" style={{ color: theme.primary }} />
        </div>

        <div className="space-y-1">
          <p className="text-sm opacity-60">Número de pedido</p>
          <p className="text-2xl font-bold tracking-wider" style={{ color: theme.primary }}>
            {orderResult.orderNumber}
          </p>
        </div>

        <div
          className="w-full rounded-2xl border px-4 py-3 text-sm space-y-2"
          style={{ borderColor: theme.border, backgroundColor: theme.surface }}
        >
          <div className="flex justify-between">
            <span className="opacity-60">Total</span>
            <span className="font-semibold">{formatCurrency(orderResult.totalAmount, 'es-CO', currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Pago</span>
            <span className="font-semibold">
              {orderResult.paymentMethod === 'online' ? 'Pago online' : 'Contraentrega'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-60">Estado</span>
            <span className="font-semibold text-amber-600">Pendiente</span>
          </div>
        </div>

        <p className="text-sm opacity-50 leading-relaxed">
          El negocio recibirá tu pedido y te contactará para confirmar la entrega.
        </p>
      </div>

      <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: theme.border }}>
        {whatsappNumber && (
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#25D366' }}
          >
            Compartir por WhatsApp
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl border py-3 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ borderColor: theme.border, color: theme.mutedText }}
        >
          Cerrar
        </button>
      </div>
    </>
  );
}
