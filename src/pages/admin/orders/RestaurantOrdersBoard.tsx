import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  pointerWithin,
} from '@dnd-kit/core';
import { Clock, Home, Store, Users } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Order } from '@/features/orders/orders.types';
import type { OrderStatus } from '@/types/common.types';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderConfirmDialog } from './OrderConfirmDialog';
import { getStatusConfig, PaymentStatusBadge, type OrderViewContext } from './OrderStatusBadge';

// ── Constants ─────────────────────────────────────────────────

const BOARD_COLUMNS = [
  { status: 'pending',    label: 'Pendiente',      headerBg: '#fef9ee' },
  { status: 'confirmed',  label: 'Confirmado',     headerBg: '#eff6ff' },
  { status: 'processing', label: 'En preparación', headerBg: '#f5f3ff' },
  { status: 'delivered',  label: 'Entregado',      headerBg: '#f0fdf4' },
  { status: 'cancelled',  label: 'Cancelado',      headerBg: '#fff5f5' },
] as const;

// 'shipped' was the old "Listo" state. It still exists in the DB for legacy orders
// and is explicitly listed here so those orders are absorbed into the 'processing'
// column instead of falling into the "Otros estados" catch-all.
const KNOWN_STATUSES = new Set<string>([
  ...BOARD_COLUMNS.map(c => c.status),
  'shipped',
]);
const COL_W = 284;

// ── Attention level helpers ───────────────────────────────────

type AttentionLevel = 'none' | 'new' | 'pending' | 'overdue';

function getOrderAttentionLevel(order: Order): AttentionLevel {
  if (order.status !== 'pending') return 'none';
  const ageMs = Date.now() - new Date(order.createdAt).getTime();
  if (ageMs < 90_000)         return 'new';      // < 90 seconds
  if (ageMs < 5 * 60_000)    return 'pending';   // 90s – 5 min
  return 'overdue';                               // > 5 min
}

function getElapsedLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Hace un momento';
  if (mins === 1) return 'Hace 1 min';
  return `Hace ${mins} min`;
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// ── OrderCard ─────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
  locationMap: Record<string, string>;
  ghost?: boolean;
  overlay?: boolean;
}

function OrderCard({ order, locationMap, ghost = false, overlay = false }: OrderCardProps) {
  const attention = getOrderAttentionLevel(order);
  const locationName = order.storeLocationId ? (locationMap[order.storeLocationId] ?? null) : null;
  const shownItems = order.items?.slice(0, 2) ?? [];
  const extraItems = (order.items?.length ?? 0) - 2;

  // Border color per attention level
  const borderClass = ghost
    ? 'border-indigo-200'
    : attention === 'overdue'
      ? 'border-red-300'
      : attention === 'new' || attention === 'pending'
        ? 'border-amber-300'
        : 'border-gray-100';

  // Background tint per attention level
  const bgClass = ghost
    ? 'bg-indigo-50/50 opacity-40'
    : attention === 'overdue'
      ? 'bg-red-50/40'
      : attention === 'new' || attention === 'pending'
        ? 'bg-amber-50/30'
        : 'bg-white';

  return (
    <div
      className={[
        'rounded-xl border p-3 overflow-hidden box-border transition-shadow',
        borderClass,
        bgClass,
        overlay ? 'shadow-2xl cursor-grabbing rotate-[1deg]' : 'w-full shadow-sm cursor-grab',
        !ghost && !overlay ? 'hover:shadow-md' : '',
      ].join(' ')}
      style={overlay ? { width: COL_W } : undefined}
    >
      {/* Row 1 — ref + attention badge + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <span className="font-mono text-xs font-bold text-gray-700 shrink-0">
            #{order.orderNumber ?? order.id.slice(0, 6).toUpperCase()}
          </span>

          {attention === 'new' && !ghost && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shrink-0">
              {/* Animated pulse dot */}
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-900 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-900" />
              </span>
              Nuevo
            </span>
          )}

          {attention === 'overdue' && !ghost && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 shrink-0">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              Urgente
            </span>
          )}
        </div>

        <span className="flex items-center gap-0.5 text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
          <Clock className="w-2.5 h-2.5" />{shortTime(order.createdAt)}
        </span>
      </div>

      {/* Row 2 — customer name */}
      <p className="mt-2 text-sm font-semibold text-gray-800 truncate">{order.customerName}</p>

      {/* Elapsed time for pending orders */}
      {(attention === 'pending' || attention === 'overdue') && !ghost && (
        <p className={`mt-0.5 text-[10px] font-medium ${
          attention === 'overdue' ? 'text-red-500' : 'text-amber-600'
        }`}>
          {getElapsedLabel(order.createdAt)}
        </p>
      )}

      {/* Items — max 2, then "+N más" */}
      {shownItems.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {shownItems.map(item => (
            <p key={item.id} className="flex gap-1 text-xs text-gray-500 overflow-hidden">
              <span className="shrink-0 text-gray-400">{item.quantity}×</span>
              <span className="truncate">{item.productNameSnapshot ?? item.name}</span>
            </p>
          ))}
          {extraItems > 0 && (
            <p className="text-xs text-gray-400">+{extraItems} producto{extraItems > 1 ? 's' : ''} más</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2.5 border-t border-gray-100 pt-2 space-y-1.5">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {order.fulfillmentMethod === 'delivery' ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
              <Home className="w-3 h-3" /> Domicilio
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
              <Store className="w-3 h-3" /> Retiro
            </span>
          )}
          {locationName && (
            <>
              <span className="text-[10px] text-gray-300 shrink-0">·</span>
              <span className="text-[10px] text-gray-400 truncate">{locationName}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-gray-900 shrink-0">
            {formatCurrency(order.totalAmount, 'es-CO', 'COP')}
          </span>
          <PaymentStatusBadge paymentMethod={order.paymentMethod} paymentStatus={order.paymentStatus} />
        </div>
      </div>

      {/* Notes — max 2 lines */}
      {order.notes && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-2 py-1">
          <p className="text-[10px] text-amber-700 line-clamp-2 break-words">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── DraggableCard ─────────────────────────────────────────────

function DraggableCard({
  order,
  locationMap,
  onOpen,
}: {
  order: Order;
  locationMap: Record<string, string>;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className="w-full"
      style={{ touchAction: 'none' }}
    >
      <OrderCard order={order} locationMap={locationMap} ghost={isDragging} />
    </div>
  );
}

// ── DroppableColumn ───────────────────────────────────────────

function DroppableColumn({
  status,
  label,
  headerBg,
  children,
  count,
  context,
}: {
  status: string;
  label: string;
  headerBg: string;
  children: React.ReactNode;
  count: number;
  context: OrderViewContext;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = getStatusConfig(status, context);

  return (
    <div
      ref={setNodeRef}
      className={[
        'flex flex-col rounded-2xl border-2 transition-colors',
        isOver ? 'border-indigo-400 bg-indigo-50/20' : 'border-transparent',
      ].join(' ')}
      style={{ width: COL_W, minWidth: COL_W }}
    >
      {/* Header — never scrolls */}
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2.5 mb-2 shrink-0"
        style={{ backgroundColor: headerBg }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>{label}</span>
        </div>
        {count > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold shrink-0"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {count}
          </span>
        )}
      </div>

      {/* Card list — vertical scroll, no overflow into cards */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-268px)] pb-2">
        {children}
      </div>
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────

interface RestaurantOrdersBoardProps {
  orders: Order[];
  storeName: string;
  dateLabel: string;
  locationMap: Record<string, string>;
  locationOptions: Array<{ id: string; name: string }>;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
}

export function RestaurantOrdersBoard({
  orders,
  storeName,
  dateLabel: _dateLabel,
  locationMap,
  locationOptions,
  onStatusChange,
}: RestaurantOrdersBoardProps) {
  const context: OrderViewContext = 'restaurant';

  const [activeOrder, setActiveOrder]       = useState<Order | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder]   = useState<Order | null>(null);
  const [filterLocationId, setFilterLocationId] = useState('');
  const [search, setSearch]                 = useState('');

  // 60-second tick — forces re-render so attention levels & elapsed labels stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredOrders = orders.filter(o => {
    if (filterLocationId && o.storeLocationId !== filterLocationId) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !o.customerName.toLowerCase().includes(q) &&
        !(o.orderNumber ?? '').toLowerCase().includes(q) &&
        !o.customerPhone.includes(q)
      ) return false;
    }
    return true;
  });

  const unknownOrders  = filteredOrders.filter(o => !KNOWN_STATUSES.has(o.status));
  const pendingCount   = orders.filter(o => o.status === 'pending').length;
  const overdueCount   = orders.filter(o => getOrderAttentionLevel(o) === 'overdue').length;
  const colCount       = BOARD_COLUMNS.length + (unknownOrders.length > 0 ? 1 : 0);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveOrder(orders.find(o => o.id === active.id) ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveOrder(null);
    if (!over) return;

    const orderId      = active.id as string;
    const targetStatus = over.id as string;
    const order        = orders.find(o => o.id === orderId);
    if (!order || order.status === targetStatus) return;

    // pending → confirmed: require WhatsApp confirmation dialog
    if (order.status === 'pending' && targetStatus === 'confirmed') {
      setPendingConfirm(order);
      return;
    }

    void onStatusChange(orderId, targetStatus as OrderStatus);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Filter / alert bar */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar cliente, pedido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-52"
          />
          {locationOptions.length > 1 && (
            <select
              value={filterLocationId}
              onChange={e => setFilterLocationId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las sedes</option>
              {locationOptions.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}

          {/* Overdue alert — red pill, takes priority */}
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-sm text-red-700 font-semibold">
                {overdueCount} pedido{overdueCount > 1 ? 's' : ''} sin atender (+5 min)
              </span>
            </div>
          )}

          {/* Normal pending — amber pill */}
          {pendingCount > 0 && overdueCount === 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700 font-medium">
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {filteredOrders.length} de {orders.length} pedido{orders.length !== 1 ? 's' : ''}
            {(search || filterLocationId) ? ' (filtrado)' : ''}
          </div>
        </div>

        {/* Kanban */}
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              className="flex gap-3 pb-4"
              style={{ minWidth: colCount * (COL_W + 12) }}
            >
              {BOARD_COLUMNS.map(col => {
                // 'shipped' (legacy "Listo") orders are absorbed into 'processing' column.
                const colOrders = filteredOrders.filter(o =>
                  o.status === col.status ||
                  (col.status === 'processing' && o.status === 'shipped')
                );
                return (
                  <DroppableColumn
                    key={col.status}
                    status={col.status}
                    label={col.label}
                    headerBg={col.headerBg}
                    count={colOrders.length}
                    context={context}
                  >
                    {colOrders.length === 0 ? (
                      <div className="flex items-center justify-center py-10 text-xs text-gray-300 border-2 border-dashed border-gray-100 rounded-xl min-h-[100px]">
                        Sin pedidos
                      </div>
                    ) : (
                      colOrders.map(order => (
                        <DraggableCard
                          key={order.id}
                          order={order}
                          locationMap={locationMap}
                          onOpen={() => setSelectedOrder(order)}
                        />
                      ))
                    )}
                  </DroppableColumn>
                );
              })}

              {unknownOrders.length > 0 && (
                <div
                  className="flex flex-col rounded-2xl border-2 border-transparent"
                  style={{ width: COL_W, minWidth: COL_W }}
                >
                  <div className="flex items-center justify-between rounded-xl px-3 py-2.5 mb-2 shrink-0 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-500">Otros estados</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-gray-200 text-gray-600">
                      {unknownOrders.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-268px)] pb-2">
                    {unknownOrders.map(order => (
                      <DraggableCard
                        key={order.id}
                        order={order}
                        locationMap={locationMap}
                        onOpen={() => setSelectedOrder(order)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DragOverlay — React-rendered, fixed width, no browser ghost */}
            <DragOverlay dropAnimation={null}>
              {activeOrder ? (
                <OrderCard order={activeOrder} locationMap={locationMap} overlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {pendingConfirm && (
        <OrderConfirmDialog
          order={pendingConfirm}
          storeName={storeName}
          locationName={
            pendingConfirm.storeLocationId
              ? (locationMap[pendingConfirm.storeLocationId] ?? null)
              : null
          }
          context={context}
          onStatusChange={onStatusChange}
          onClose={() => setPendingConfirm(null)}
        />
      )}

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          context={context}
          storeName={storeName}
          locationMap={locationMap}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={async (id, status) => {
            await onStatusChange(id, status);
            setSelectedOrder(prev => prev?.id === id ? { ...prev, status } : prev);
          }}
        />
      )}
    </>
  );
}
