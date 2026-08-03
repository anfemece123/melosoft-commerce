export const WHATSAPP_FULFILLMENT_MILESTONE_EVENTS = [
  'order_ready_for_pickup',
  'order_out_for_delivery',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
] as const;

export type WhatsappFulfillmentMilestoneEvent =
  typeof WHATSAPP_FULFILLMENT_MILESTONE_EVENTS[number];

export function isWhatsappFulfillmentMilestoneEvent(
  eventType: string,
): eventType is WhatsappFulfillmentMilestoneEvent {
  return (WHATSAPP_FULFILLMENT_MILESTONE_EVENTS as readonly string[]).includes(eventType);
}

/**
 * A queued fulfillment message is valid only while the order still represents
 * that exact customer-facing milestone. This prevents a worker from sending a
 * stale "en camino", "entregado" or "cancelado" message after staff corrected
 * the card in the operations board.
 */
export function isWhatsappFulfillmentMilestoneCurrent(
  eventType: WhatsappFulfillmentMilestoneEvent,
  orderStatus: string,
  fulfillmentMethod: string | null | undefined,
): boolean {
  switch (eventType) {
    case 'order_ready_for_pickup':
      return orderStatus === 'shipped' && fulfillmentMethod === 'pickup';
    case 'order_out_for_delivery':
      return orderStatus === 'shipped' && fulfillmentMethod !== 'pickup' &&
        fulfillmentMethod !== 'national_shipping';
    case 'order_shipped':
      return orderStatus === 'shipped' && fulfillmentMethod === 'national_shipping';
    case 'order_delivered':
      return orderStatus === 'delivered';
    case 'order_cancelled':
      return orderStatus === 'cancelled';
  }
}
