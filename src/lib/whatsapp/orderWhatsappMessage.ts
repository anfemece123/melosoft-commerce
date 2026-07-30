import { formatCurrency } from '@/utils/formatCurrency';
import type { Order } from '@/features/orders/orders.types';
import type { OrderViewContext } from '@/pages/admin/orders/OrderStatusBadge';
import { getFulfillmentMethodLabel } from '@/lib/orders/fulfillmentLabels';
import { buildWhatsAppContactUrl } from './whatsappUrl';

export { normalizePhoneForWhatsApp } from './whatsappUrl';

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  return buildWhatsAppContactUrl(phone, message);
}

function buildItemsSummary(order: Order): string {
  if (!order.items || order.items.length === 0) return '';
  const shown = order.items.slice(0, 3);
  const rest = order.items.length - 3;
  const lines = shown.flatMap(i => {
    const name = i.productNameSnapshot ?? i.name;
    const variant = i.variantLabelSnapshot ? ` (${i.variantLabelSnapshot})` : '';
    const itemLine = `• ${i.quantity}× ${name}${variant}`;
    const customizationLines = i.customizations.map(
      c => `   + ${c.optionItemLabel} (+${formatCurrency(c.priceDelta)})`,
    );
    return [itemLine, ...customizationLines];
  });
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
  const delivery = getFulfillmentMethodLabel(order.fulfillmentMethod, { city: order.city });
  const payment = order.paymentMethod === 'cash_on_delivery' ? 'Pago contraentrega' : 'Pago en línea';

  const lines: string[] = [
    `Hola ${order.customerName} 👋, tu pedido *#${orderRef}* fue confirmado ✅`,
    '',
    context === 'restaurant'
      ? `Lo estamos preparando en *${storeLabel}*.`
      : `Ya estamos procesando tu compra en *${storeLabel}*.`,
  ];

  if (itemsSummary) lines.push('', 'Resumen:', itemsSummary);

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
