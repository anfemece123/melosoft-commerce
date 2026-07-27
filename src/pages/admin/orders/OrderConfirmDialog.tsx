import { useState } from 'react';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { notify } from '@/lib/notifications';
import {
  buildOrderConfirmationMessage,
  buildWhatsAppUrl,
  normalizePhoneForWhatsApp,
} from '@/lib/whatsapp/orderWhatsappMessage';
import type { Order } from '@/features/orders/orders.types';
import type { OrderStatus } from '@/types/common.types';
import type { OrderViewContext } from './OrderStatusBadge';

interface OrderConfirmDialogProps {
  order: Order;
  storeName: string;
  locationName: string | null;
  context: OrderViewContext;
  automaticWhatsappReady: boolean;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onClose: () => void;
}

export function OrderConfirmDialog({
  order,
  storeName,
  locationName,
  context,
  automaticWhatsappReady,
  onStatusChange,
  onClose,
}: OrderConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const hasPhone = Boolean(order.customerPhone && normalizePhoneForWhatsApp(order.customerPhone));

  function handleConfirm() {
    const shouldOpenManualWhatsapp = !automaticWhatsappReady && hasPhone;
    const message = shouldOpenManualWhatsapp
      ? buildOrderConfirmationMessage(order, storeName, locationName, context)
      : null;
    const url = message ? buildWhatsAppUrl(order.customerPhone, message) : null;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');

    setLoading(true);
    void (async () => {
      try {
        await onStatusChange(order.id, 'confirmed');
        notify.success(url
          ? 'Pedido confirmado. Abrimos WhatsApp como alternativa manual.'
          : 'Pedido confirmado');
        onClose();
      } catch {
        notify.error('No se pudo confirmar el pedido. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    })();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-base font-semibold text-gray-900">Confirmar pedido</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Confirmaremos el pedido de <strong className="text-gray-800">{order.customerName}</strong>.{' '}
            {automaticWhatsappReady
              ? 'Melosoft gestionará los avisos automáticos activados, sin abrir otra ventana de WhatsApp.'
              : hasPhone
                ? 'Como la integración automática no está activa, abriremos WhatsApp como alternativa manual.'
                : 'La integración automática no está activa y el pedido no tiene un teléfono válido para el aviso manual.'}
          </p>

          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Pedido</p>
            <p className="font-mono text-sm font-semibold text-gray-800">
              #{order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{order.customerName}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Confirmar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
