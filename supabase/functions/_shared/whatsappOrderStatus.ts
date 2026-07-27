export const WHATSAPP_ORDER_STATUS_EVENTS = [
  'order_ready_for_pickup',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
] as const;

export type WhatsappOrderStatusEvent = typeof WHATSAPP_ORDER_STATUS_EVENTS[number];

export interface WhatsappOrderStatusContent {
  status: string;
  detail: string;
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
    case 'order_shipped':
      return {
        status: 'Enviado',
        detail: 'Tu pedido ya salió hacia el destino registrado.',
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
