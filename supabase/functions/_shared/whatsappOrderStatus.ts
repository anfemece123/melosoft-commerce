export const WHATSAPP_ORDER_STATUS_EVENTS = [
  'order_ready_for_pickup',
  'order_out_for_delivery',
  'order_delivered',
  'order_cancelled',
] as const;

export type WhatsappOrderStatusEvent = typeof WHATSAPP_ORDER_STATUS_EVENTS[number];

export interface WhatsappOrderStatusContent {
  status: string;
  detail: string;
}

export interface WhatsappLocalDeliveryDetails {
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDelivery?: string | null;
}

function cleanDeliveryValue(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned || null;
}

/**
 * Local delivery remains a concise status update, but it can carry logistics
 * data when the merchant uses a courier or delivery platform. Empty optional
 * fields are omitted instead of being rendered as "No aplica".
 */
export function getWhatsappLocalDeliveryDetail(
  details: WhatsappLocalDeliveryDetails = {},
): string {
  const carrier = cleanDeliveryValue(details.shippingCarrier);
  const trackingNumber = cleanDeliveryValue(details.trackingNumber);
  const trackingUrl = cleanDeliveryValue(details.trackingUrl);
  const estimatedDelivery = cleanDeliveryValue(details.estimatedDelivery);
  const logistics: string[] = [];

  if (carrier) logistics.push(`Entrega a cargo de ${carrier}.`);
  if (trackingNumber) logistics.push(`Guía: ${trackingNumber}.`);
  if (estimatedDelivery) logistics.push(`Entrega estimada: ${estimatedDelivery}.`);
  if (trackingUrl) logistics.push(`Seguimiento: ${trackingUrl}`);

  return logistics.length > 0
    ? `Tu pedido salió para entrega. ${logistics.join(' ')}`
    : 'Tu pedido salió para entrega y llegará a la dirección registrada.';
}

export function isWhatsappOrderStatusEvent(eventType: string): eventType is WhatsappOrderStatusEvent {
  return (WHATSAPP_ORDER_STATUS_EVENTS as readonly string[]).includes(eventType);
}

export function getWhatsappOrderStatusContent(
  eventType: WhatsappOrderStatusEvent,
): WhatsappOrderStatusContent {
  switch (eventType) {
    case 'order_ready_for_pickup':
      return {
        status: 'Listo para recoger',
        detail: 'Ya puedes acercarte al punto de entrega seleccionado.',
      };
    case 'order_out_for_delivery':
      return {
        status: 'En camino',
        detail: getWhatsappLocalDeliveryDetail(),
      };
    case 'order_delivered':
      return {
        status: 'Entregado',
        detail: 'Gracias por comprar con nosotros.',
      };
    case 'order_cancelled':
      return {
        status: 'Cancelado',
        detail: 'Si necesitas ayuda, comunícate directamente con la empresa.',
      };
  }
}
