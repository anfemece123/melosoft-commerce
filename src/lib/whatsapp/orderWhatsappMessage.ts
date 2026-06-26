import { formatCurrency } from '@/utils/formatCurrency';
import type { Order } from '@/features/orders/orders.types';
import type { OrderViewContext } from '@/pages/admin/orders/OrderStatusBadge';

export function normalizePhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Already 12 digits with Colombia prefix
  if (digits.startsWith('57') && digits.length === 12) return digits;
  // 10-digit Colombia mobile (starts with 3)
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  // 11 digits starting with 0 (e.g. 0313...)
  if (digits.length === 11 && digits.startsWith('0')) return `57${digits.slice(1)}`;
  // Assume already has country code if long enough
  if (digits.length >= 11) return digits;
  return null;
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function buildItemsSummary(order: Order): string {
  if (!order.items || order.items.length === 0) return '';
  const shown = order.items.slice(0, 3);
  const rest = order.items.length - 3;
  const lines = shown.map(i => `• ${i.quantity}× ${i.productNameSnapshot ?? i.name}`);
  if (rest > 0) lines.push(`• +${rest} producto${rest > 1 ? 's' : ''} más`);
  return lines.join('\n');
}

export function buildOrderConfirmationMessage(
  order: Order,
  storeName: string,
  locationName: string | null,
  context: OrderViewContext,
): string {
  const orderRef = order.orderNumber ?? order.id.slice(0, 8).toUpperCase();
  const storeLabel = locationName ? `${storeName} — ${locationName}` : storeName;
  const itemsSummary = buildItemsSummary(order);
  const total = formatCurrency(order.totalAmount);
  const delivery = order.fulfillmentMethod === 'delivery' ? 'Domicilio' : 'Recogida en tienda';
  const payment = order.paymentMethod === 'cash_on_delivery' ? 'Pago contraentrega' : 'Pago en línea';

  const lines: string[] = [
    `Hola ${order.customerName} 👋, tu pedido *#${orderRef}* fue confirmado ✅`,
    '',
  ];

  if (context === 'restaurant') {
    lines.push(`Lo estamos preparando en *${storeLabel}*.`);
  } else {
    lines.push(`Ya estamos procesando tu compra en *${storeLabel}*.`);
  }

  if (itemsSummary) {
    lines.push('', 'Resumen:', itemsSummary);
  }

  lines.push(
    '',
    `Total: *${total}*`,
    `Entrega: ${delivery}`,
    `Pago: ${payment}`,
    '',
    context === 'restaurant'
      ? 'Te avisamos cuando esté listo. ¡Gracias!'
      : 'Te avisaremos cuando avance tu pedido. ¡Gracias!',
  );

  return lines.join('\n');
}
