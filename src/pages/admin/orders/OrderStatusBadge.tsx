import type { FulfillmentMethod } from '@/types/common.types';
import { normalizeFulfillmentMethod } from '@/lib/orders/fulfillment';

export type OrderViewContext = 'restaurant' | 'retail';

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
}

// Restaurant: 'shipped' is a legacy state that was used as "Listo/Ready".
// It is now absorbed into the 'processing' column visually.
// Existing orders at 'shipped' still live in the DB; we just show them
// with the same label as 'processing' so the kanban stays clean.
const RESTAURANT_STATUS: Record<string, StatusConfig> = {
  pending:    { label: 'Pendiente',      color: '#92400e', bg: '#fef3c7' },
  confirmed:  { label: 'Confirmado',     color: '#1e40af', bg: '#dbeafe' },
  processing: { label: 'En preparación', color: '#5b21b6', bg: '#ede9fe' },
  shipped:    { label: 'En preparación', color: '#5b21b6', bg: '#ede9fe' },
  delivered:  { label: 'Entregado',      color: '#166534', bg: '#dcfce7' },
  cancelled:  { label: 'Cancelado',      color: '#991b1b', bg: '#fee2e2' },
};

// Ecommerce keeps stable DB states but adapts their customer-facing meaning to
// fulfillment below: shipped = dispatched, in local delivery, or ready for pickup.
const RETAIL_STATUS: Record<string, StatusConfig> = {
  pending:    { label: 'Por confirmar',       color: '#92400e', bg: '#fef3c7' },
  confirmed:  { label: 'Pedido confirmado',   color: '#1e40af', bg: '#dbeafe' },
  processing: { label: 'Preparando despacho', color: '#5b21b6', bg: '#ede9fe' },
  shipped:    { label: 'Despachado',           color: '#075985', bg: '#e0f2fe' },
  delivered:  { label: 'Entregado',            color: '#166534', bg: '#dcfce7' },
  cancelled:  { label: 'Cancelado',            color: '#991b1b', bg: '#fee2e2' },
};

const PAYMENT_STATUS: Record<string, StatusConfig> = {
  pending:  { label: 'Contraentrega', color: '#92400e', bg: '#fef3c7' },
  paid:     { label: 'Pagado',        color: '#166534', bg: '#dcfce7' },
  failed:   { label: 'Fallido',       color: '#991b1b', bg: '#fee2e2' },
  expired:  { label: 'Expirado',      color: '#374151', bg: '#f3f4f6' },
  refunded: { label: 'Reembolsado',   color: '#1e40af', bg: '#dbeafe' },
};

export function getStatusConfig(
  status: string,
  context: OrderViewContext,
  fulfillmentMethod?: FulfillmentMethod,
): StatusConfig {
  const map = context === 'restaurant' ? RESTAURANT_STATUS : RETAIL_STATUS;
  const base = map[status] ?? { label: status, color: '#374151', bg: '#f3f4f6' };
  if (context !== 'retail' || !fulfillmentMethod) return base;

  const method = normalizeFulfillmentMethod(fulfillmentMethod);
  if (status === 'processing') {
    if (method === 'pickup') return { ...base, label: 'Preparando para recoger' };
    if (method === 'local_delivery') return { ...base, label: 'Preparando entrega' };
  }
  if (status === 'shipped') {
    if (method === 'pickup') return { ...base, label: 'Listo para recoger', color: '#047857', bg: '#d1fae5' };
    if (method === 'local_delivery') return { ...base, label: 'En camino', color: '#0369a1', bg: '#e0f2fe' };
  }
  if (status === 'delivered' && method === 'pickup') {
    return { ...base, label: 'Recogido' };
  }
  return base;
}

export function getStatusLabel(status: string, context: OrderViewContext): string {
  return getStatusConfig(status, context).label;
}

export function getAllStatuses(context: OrderViewContext): Array<{ status: string; label: string }> {
  const map = context === 'restaurant' ? RESTAURANT_STATUS : RETAIL_STATUS;
  // For restaurant: exclude 'shipped' from the filter list since it is no longer
  // a reachable state in the new flow. For retail it stays visible ("Enviado").
  const excluded = context === 'restaurant' ? new Set(['shipped']) : new Set<string>();
  return Object.entries(map)
    .filter(([s]) => !excluded.has(s))
    .map(([status, cfg]) => ({ status, label: cfg.label }));
}

export function OrderStatusBadge({
  status,
  context,
  fulfillmentMethod,
}: {
  status: string;
  context: OrderViewContext;
  fulfillmentMethod?: FulfillmentMethod;
}) {
  const cfg = getStatusConfig(status, context, fulfillmentMethod);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

export function PaymentStatusBadge({ paymentMethod, paymentStatus }: { paymentMethod: string; paymentStatus: string }) {
  const isPaid = paymentStatus === 'paid';
  const isOnline = paymentMethod === 'online';

  if (isOnline && isPaid) {
    const cfg = PAYMENT_STATUS['paid'];
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
        style={{ color: cfg.color, backgroundColor: cfg.bg }}
      >
        Pagado
      </span>
    );
  }

  const cfg = PAYMENT_STATUS[paymentStatus] ?? PAYMENT_STATUS['pending'];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {paymentMethod === 'cash_on_delivery' ? 'Contraentrega' : cfg.label}
    </span>
  );
}
