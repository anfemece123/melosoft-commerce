import { useState } from 'react';
import {
  X, User, Phone, MapPin, Home, Store, Clock, CreditCard,
  StickyNote, ChevronRight, Loader2, MessageCircle, ShoppingBag,
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { getFulfillmentMethodLabel, normalizeFulfillmentMethod } from '@/lib/orders/fulfillmentLabels';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp/orderWhatsappMessage';
import type { Order } from '@/features/orders/orders.types';
import type { OrderStatus } from '@/types/common.types';
import { OrderStatusBadge, PaymentStatusBadge, getStatusConfig, type OrderViewContext } from './OrderStatusBadge';
import { OrderConfirmDialog } from './OrderConfirmDialog';

interface NextAction {
  label: string;
  status: OrderStatus;
  destructive?: boolean;
  whatsapp?: boolean;
}

function getNextActions(status: OrderStatus, context: OrderViewContext, hasPhone: boolean): NextAction[] {
  const confirmLabel = hasPhone ? 'Confirmar y avisar por WhatsApp' : 'Confirmar pedido';

  // Flow: pending → confirmed → processing → delivered
  // 'shipped' is a legacy state (old "Listo"); new orders never reach it.
  // Existing 'shipped' orders can still be advanced to 'delivered' via the drawer.
  const ADVANCE: Partial<Record<OrderStatus, { status: OrderStatus; label: string; whatsapp?: boolean }>> =
    context === 'restaurant'
      ? {
          pending:    { status: 'confirmed',  label: confirmLabel, whatsapp: hasPhone },
          confirmed:  { status: 'processing', label: 'Iniciar preparación' },
          processing: { status: 'delivered',  label: 'Marcar entregado' },
          shipped:    { status: 'delivered',  label: 'Marcar entregado' },
        }
      : {
          pending:    { status: 'confirmed',  label: confirmLabel, whatsapp: hasPhone },
          confirmed:  { status: 'processing', label: 'Procesar pedido' },
          processing: { status: 'delivered',  label: 'Marcar entregado' },
          shipped:    { status: 'delivered',  label: 'Marcar entregado' },
        };

  const actions: NextAction[] = [];
  const next = ADVANCE[status];
  if (next) actions.push(next);
  if (status !== 'cancelled' && status !== 'delivered') {
    actions.push({ label: 'Cancelar pedido', status: 'cancelled', destructive: true });
  }
  return actions;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

interface OrderDetailDrawerProps {
  order: Order | null;
  context: OrderViewContext;
  storeName: string;
  locationMap: Record<string, string>;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
}

export function OrderDetailDrawer({
  order,
  context,
  storeName,
  locationMap,
  onClose,
  onStatusChange,
}: OrderDetailDrawerProps) {
  const [updating, setUpdating] = useState<OrderStatus | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!order) return null;

  const cfg = getStatusConfig(order.status, context);
  const locationName = order.storeLocationId ? (locationMap[order.storeLocationId] ?? null) : null;
  const hasPhone = Boolean(order.customerPhone && normalizePhoneForWhatsApp(order.customerPhone));
  const actions = getNextActions(order.status as OrderStatus, context, hasPhone);

  async function handleAction(status: OrderStatus) {
    setUpdating(status);
    try {
      await onStatusChange(order!.id, status);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <p className="text-xs text-gray-400 font-mono">
                #{order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                <OrderStatusBadge status={order.status} context={context} />
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* Date & location */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatDate(order.createdAt)}
              </span>
              {locationName && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {locationName}
                </span>
              )}
            </div>

            {/* Customer */}
            <Section title="Cliente">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{order.customerName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-sm text-gray-500">{order.customerPhone || '—'}</p>
                  </div>
                  {order.customerEmail && (
                    <p className="text-xs text-gray-400 mt-0.5">{order.customerEmail}</p>
                  )}
                </div>
              </div>
            </Section>

            {/* Fulfillment */}
            <Section title="Entrega">
              {normalizeFulfillmentMethod(order.fulfillmentMethod) !== 'pickup' ? (
                <div className="flex items-start gap-2">
                  <Home className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-gray-700 space-y-0.5">
                    <p className="font-medium">{getFulfillmentMethodLabel(order.fulfillmentMethod, { city: order.city })}</p>
                    {order.shippingAddress && <p>{order.shippingAddress}</p>}
                    {order.deliveryNeighborhood && (
                      <p className="text-gray-500">
                        {order.deliveryNeighborhood}{order.city ? `, ${order.city}` : ''}
                      </p>
                    )}
                    {order.deliveryReference && (
                      <p className="text-xs text-gray-400 italic">{order.deliveryReference}</p>
                    )}
                    {!order.deliveryNeighborhood && order.city && (
                      <p className="text-gray-500">{order.city}{order.department ? `, ${order.department}` : ''}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Store className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{getFulfillmentMethodLabel(order.fulfillmentMethod)}{locationName ? ` — ${locationName}` : ''}</span>
                </div>
              )}
            </Section>

            {/* Items */}
            {order.items && order.items.length > 0 && (
              <Section title="Productos">
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  {order.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 px-3 py-2.5 ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-100">
                        {item.productImageUrlSnapshot ? (
                          <img
                            src={item.productImageUrlSnapshot}
                            alt={item.productNameSnapshot ?? item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {item.productNameSnapshot ?? item.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.quantity}× · {formatCurrency(item.unitPrice, 'es-CO', 'COP')} c/u
                        </p>
                        {item.variantLabelSnapshot && (
                          <p className="text-xs text-gray-500 mt-0.5">Variante: {item.variantLabelSnapshot}</p>
                        )}
                        {item.customizations.length > 0 && (
                          <div className="mt-1">
                            <p className="text-xs font-medium text-gray-500">Adiciones:</p>
                            {item.customizations.map((c) => (
                              <p key={c.id} className="text-xs text-gray-500 pl-2">
                                {c.optionItemLabel} <span className="text-gray-400">+{formatCurrency(c.priceDelta, 'es-CO', 'COP')}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        {item.customerNote && (
                          <p className="text-xs text-amber-600 italic mt-0.5 truncate">{item.customerNote}</p>
                        )}
                      </div>
                      {/* Subtotal */}
                      <span className="text-sm font-semibold text-gray-800 shrink-0">
                        {formatCurrency(item.totalPrice, 'es-CO', 'COP')}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 bg-gray-50">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(order.totalAmount, 'es-CO', 'COP')}
                    </span>
                  </div>
                </div>
              </Section>
            )}

            {/* Payment */}
            <Section title="Pago">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <PaymentStatusBadge paymentMethod={order.paymentMethod} paymentStatus={order.paymentStatus} />
                <span className="text-sm text-gray-500">
                  {order.paymentMethod === 'cash_on_delivery' ? 'Pago al recibir' : 'Pago en línea'}
                </span>
              </div>
            </Section>

            {/* Notes */}
            {order.notes && (
              <Section title="Notas del cliente">
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                  <StickyNote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">{order.notes}</p>
                </div>
              </Section>
            )}
          </div>

          {/* Footer */}
          {actions.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-2">
              {actions.map(action => {
                if (action.destructive) {
                  return (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() => void handleAction(action.status)}
                      disabled={updating !== null}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {updating === action.status && <Loader2 className="w-4 h-4 animate-spin" />}
                      {action.label}
                    </button>
                  );
                }

                if (action.whatsapp) {
                  return (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={updating !== null}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {action.label}
                    </button>
                  );
                }

                // pending → confirmed without phone
                if (action.status === 'confirmed') {
                  return (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={updating !== null}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {updating === action.status ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      {action.label}
                    </button>
                  );
                }

                return (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => void handleAction(action.status)}
                    disabled={updating !== null}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {updating === action.status ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Centralized confirm dialog — z-[60] so it appears above the drawer */}
      {showConfirmDialog && (
        <OrderConfirmDialog
          order={order}
          storeName={storeName}
          locationName={locationName}
          context={context}
          onStatusChange={onStatusChange}
          onClose={() => setShowConfirmDialog(false)}
        />
      )}
    </>
  );
}
