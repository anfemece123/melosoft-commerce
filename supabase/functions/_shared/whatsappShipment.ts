export const WHATSAPP_ORDER_SHIPMENT_EVENT = 'order_shipped' as const;

export function isWhatsappOrderShipmentEvent(eventType: string): boolean {
  return eventType === WHATSAPP_ORDER_SHIPMENT_EVENT;
}

/**
 * Formats a Postgres `date` without letting the runtime timezone move it to
 * the previous day. The merchant date is a calendar date, not an instant.
 */
export function formatWhatsappEstimatedDelivery(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return 'Por confirmar';

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return 'Por confirmar';

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function resolveWhatsappShipmentTracking(
  trackingUrl: string | null | undefined,
  fulfillmentMethod: string | null | undefined,
): string {
  const normalizedUrl = trackingUrl?.trim();
  if (normalizedUrl) return normalizedUrl;

  return fulfillmentMethod === 'national_shipping'
    ? 'Consulta el envío con la transportadora usando tu número de guía.'
    : 'La empresa coordinará la entrega directamente contigo.';
}

