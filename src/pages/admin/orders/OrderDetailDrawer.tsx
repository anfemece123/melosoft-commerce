import { useEffect, useState } from 'react';
import {
  X, User, Phone, MapPin, Home, Store, Clock, CreditCard,
  StickyNote, ChevronRight, Loader2, ShoppingBag, Check, Copy,
  ExternalLink, PackageCheck, Truck, Pencil, History, Tag,
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { getFulfillmentMethodLabel, normalizeFulfillmentMethod } from '@/lib/orders/fulfillmentLabels';
import type {
  AmendOrderItemsPayload,
  DispatchOrderPayload,
  Order,
  OrderChangeEvent,
  UpdateOrderDetailsPayload,
} from '@/features/orders/orders.types';
import { ordersService } from '@/features/orders/ordersService';
import type { OrderStatus } from '@/types/common.types';
import { OrderStatusBadge, PaymentStatusBadge, getStatusConfig, type OrderViewContext } from './OrderStatusBadge';
import { OrderConfirmDialog } from './OrderConfirmDialog';
import { OrderShipmentDialog } from './OrderShipmentDialog';
import { OrderDetailsEditDialog } from './OrderDetailsEditDialog';
import { OrderItemsAmendDialog } from './OrderItemsAmendDialog';
import { OrderReviewInvitationCard } from './OrderReviewInvitationCard';

interface NextAction {
  label: string;
  status: OrderStatus;
  destructive?: boolean;
}

function getNextActions(
  status: OrderStatus,
  context: OrderViewContext,
  fulfillmentMethod: Order['fulfillmentMethod'],
): NextAction[] {
  const isPickup = normalizeFulfillmentMethod(fulfillmentMethod) === 'pickup';
  const ADVANCE: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> =
    context === 'restaurant'
      ? {
          pending:    { status: 'confirmed',  label: 'Confirmar pedido' },
          confirmed:  { status: 'processing', label: 'Iniciar preparación' },
          processing: { status: 'delivered',  label: 'Marcar entregado' },
          shipped:    { status: 'delivered',  label: 'Marcar entregado' },
        }
      : {
          pending:    { status: 'confirmed',  label: 'Confirmar pedido' },
          confirmed:  { status: 'processing', label: isPickup ? 'Preparar para recoger' : 'Preparar despacho' },
          processing: {
            status: 'shipped',
            label: isPickup ? 'Marcar listo para recoger' : 'Registrar envío',
          },
          shipped:    { status: 'delivered',  label: isPickup ? 'Marcar como recogido' : 'Marcar entregado' },
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

function FulfillmentTimeline({ order }: { order: Order }) {
  const method = normalizeFulfillmentMethod(order.fulfillmentMethod);
  const currentIndex: Record<OrderStatus, number> = {
    pending: 0,
    confirmed: 1,
    processing: 2,
    shipped: 3,
    delivered: 4,
    cancelled: -1,
  };
  const steps = [
    'Recibido',
    'Confirmado',
    method === 'pickup' ? 'Preparando' : 'Preparando despacho',
    method === 'pickup' ? 'Listo para recoger' : method === 'local_delivery' ? 'En camino' : 'Despachado',
    method === 'pickup' ? 'Recogido' : 'Entregado',
  ];

  if (order.status === 'cancelled') {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
        Este pedido fue cancelado.
      </div>
    );
  }

  const activeIndex = currentIndex[order.status];
  return (
    <ol className="space-y-0" aria-label="Progreso del pedido">
      {steps.map((label, index) => {
        const complete = index <= activeIndex;
        const current = index === activeIndex;
        return (
          <li key={label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                complete ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-transparent'
              }`}>
                {complete && <Check className="h-3 w-3" />}
              </span>
              {index < steps.length - 1 && (
                <span className={`h-5 w-px ${index < activeIndex ? 'bg-indigo-300' : 'bg-gray-200'}`} />
              )}
            </div>
            <span className={`-mt-0.5 text-xs leading-5 ${
              current ? 'font-bold text-indigo-700' : complete ? 'font-medium text-gray-700' : 'text-gray-400'
            }`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface OrderDetailDrawerProps {
  order: Order | null;
  context: OrderViewContext;
  automaticWhatsappReady: boolean;
  locationMap: Record<string, string>;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onDispatchOrder?: (orderId: string, payload: DispatchOrderPayload) => Promise<Order>;
  onUpdateDetails: (orderId: string, payload: UpdateOrderDetailsPayload) => Promise<Order>;
  onAmendItems: (orderId: string, payload: AmendOrderItemsPayload) => Promise<Order>;
}

export function OrderDetailDrawer({
  order,
  context,
  automaticWhatsappReady,
  locationMap,
  onClose,
  onStatusChange,
  onDispatchOrder,
  onUpdateDetails,
  onAmendItems,
}: OrderDetailDrawerProps) {
  const [updating, setUpdating] = useState<OrderStatus | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showShipmentDialog, setShowShipmentDialog] = useState(false);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [showDetailsEdit, setShowDetailsEdit] = useState(false);
  const [showItemsAmend, setShowItemsAmend] = useState(false);
  const [changeEvents, setChangeEvents] = useState<OrderChangeEvent[]>([]);
  const [changeEventsVersion, setChangeEventsVersion] = useState(0);
  const selectedOrderId = order?.id;

  useEffect(() => {
    if (!selectedOrderId) return;
    let active = true;
    void ordersService.getOrderChangeEvents(selectedOrderId)
      .then(events => { if (active) setChangeEvents(events); })
      .catch(() => { if (active) setChangeEvents([]); });
    return () => { active = false; };
  }, [selectedOrderId, changeEventsVersion]);

  if (!order) return null;

  const cfg = getStatusConfig(order.status, context, order.fulfillmentMethod);
  const locationName = order.storeLocationId ? (locationMap[order.storeLocationId] ?? null) : null;
  const actions = getNextActions(
    order.status as OrderStatus,
    context,
    order.fulfillmentMethod,
  );
  const detailsEditable = order.status !== 'delivered' && order.status !== 'cancelled';
  const itemsEditable =
    (order.status === 'pending' || order.status === 'confirmed') &&
    order.paymentMethod === 'cash_on_delivery' &&
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');

  async function handleAction(status: OrderStatus) {
    if (status === 'shipped' && context === 'retail' && onDispatchOrder) {
      setShowShipmentDialog(true);
      return;
    }
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
                <OrderStatusBadge
                  status={order.status}
                  context={context}
                  fulfillmentMethod={order.fulfillmentMethod}
                />
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

            {context === 'retail' && (
              <Section title="Progreso del pedido">
                <FulfillmentTimeline order={order} />
              </Section>
            )}

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
              {detailsEditable && (
                <button type="button" onClick={() => setShowDetailsEdit(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  <Pencil className="h-3.5 w-3.5" /> Corregir cliente y entrega
                </button>
              )}
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

            {context === 'retail' && normalizeFulfillmentMethod(order.fulfillmentMethod) !== 'pickup' && (
              order.shippingCarrier || order.trackingNumber || order.trackingUrl || order.estimatedDeliveryAt || order.status === 'shipped'
            ) && (
              <Section title="Rastreo del envío">
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3">
                  <div className="flex items-start gap-2.5">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                      {order.shippingCarrier && (
                        <p className="text-gray-700"><span className="text-gray-500">Transportadora:</span> <strong>{order.shippingCarrier}</strong></p>
                      )}
                      {order.trackingNumber && (
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 text-gray-700">
                            <span className="text-gray-500">Guía:</span>{' '}
                            <strong className="font-mono break-all">{order.trackingNumber}</strong>
                          </p>
                          <button
                            type="button"
                            title="Copiar número de guía"
                            onClick={() => {
                              void navigator.clipboard.writeText(order.trackingNumber ?? '');
                              setTrackingCopied(true);
                              window.setTimeout(() => setTrackingCopied(false), 1500);
                            }}
                            className="rounded-md p-1 text-sky-700 hover:bg-sky-100"
                          >
                            {trackingCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                      {order.estimatedDeliveryAt && (
                        <p className="text-gray-700">
                          <span className="text-gray-500">Entrega estimada:</span>{' '}
                          <strong>{new Date(`${order.estimatedDeliveryAt}T12:00:00`).toLocaleDateString('es-CO', { dateStyle: 'long' })}</strong>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {order.trackingUrl && (
                          <a
                            href={order.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
                          >
                            Rastrear envío <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {order.status === 'shipped' && onDispatchOrder && (
                          <button
                            type="button"
                            onClick={() => setShowShipmentDialog(true)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Editar datos
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {context === 'retail' && order.status === 'shipped' && normalizeFulfillmentMethod(order.fulfillmentMethod) === 'pickup' && (
              <Section title="Recogida">
                <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  {order.customerEmail
                    ? 'El cliente recibirá por correo la notificación para recoger su pedido.'
                    : 'El pedido está listo para entregar cuando llegue el cliente.'}
                </div>
              </Section>
            )}

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
                {itemsEditable ? (
                  <button type="button" onClick={() => setShowItemsAmend(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    <Pencil className="h-3.5 w-3.5" /> Modificar cantidades o retirar productos
                  </button>
                ) : (
                  <p className="text-xs text-gray-400">
                    {order.paymentMethod === 'online' || order.paymentStatus === 'paid'
                      ? 'Los productos están bloqueados porque el pedido tiene un pago en línea o cerrado.'
                      : 'Los productos se bloquean cuando comienza la preparación.'}
                  </p>
                )}
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

            {order.partnerCode && (
              <Section title="Atribución comercial">
                <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5">
                  <Tag className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <div className="text-sm text-violet-900">
                    <p>Este pedido llegó por <strong>{order.partnerName ?? 'un partner'}</strong>.</p>
                    <p className="mt-0.5 text-xs text-violet-700">Código: <span className="font-mono font-semibold">{order.partnerCode}</span>{order.discountAmount > 0 ? ` · Descuento: ${formatCurrency(order.discountAmount, 'es-CO', order.currency)}` : ''}</p>
                  </div>
                </div>
              </Section>
            )}

            {/* Notes */}
            {order.notes && (
              <Section title="Notas del cliente">
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                  <StickyNote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">{order.notes}</p>
                </div>
              </Section>
            )}

            {changeEvents.length > 0 && (
              <Section title="Historial de modificaciones">
                <div className="space-y-2 rounded-xl border border-gray-100 px-3 py-2.5">
                  {changeEvents.map(event => (
                    <div key={event.id} className="flex items-start gap-2 border-b border-gray-50 py-1.5 last:border-0">
                      <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700">
                          {event.changeType === 'items' ? 'Productos modificados' : 'Cliente o entrega corregidos'}
                        </p>
                        <p className="text-xs text-gray-500">{event.reason}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {event.actorName ?? 'Usuario del panel'} · {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {order.status === 'delivered' && (
              <Section title="Opinión del cliente">
                <OrderReviewInvitationCard key={order.id} order={order} />
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
          automaticWhatsappReady={automaticWhatsappReady}
          onStatusChange={onStatusChange}
          onClose={() => setShowConfirmDialog(false)}
        />
      )}
      {showShipmentDialog && onDispatchOrder && (
        <OrderShipmentDialog
          order={order}
          onConfirm={async payload => {
            await onDispatchOrder(order.id, payload);
          }}
          onClose={() => setShowShipmentDialog(false)}
        />
      )}
      {showDetailsEdit && (
        <OrderDetailsEditDialog
          order={order}
          onConfirm={async payload => {
            await onUpdateDetails(order.id, payload);
            setChangeEventsVersion(version => version + 1);
          }}
          onClose={() => setShowDetailsEdit(false)}
        />
      )}
      {showItemsAmend && (
        <OrderItemsAmendDialog
          order={order}
          onConfirm={async payload => {
            await onAmendItems(order.id, payload);
            setChangeEventsVersion(version => version + 1);
          }}
          onClose={() => setShowItemsAmend(false)}
        />
      )}
    </>
  );
}
