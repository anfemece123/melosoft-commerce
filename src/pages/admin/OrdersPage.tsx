import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, RefreshCw, Utensils, Package, AlertCircle, Calendar, LayoutGrid, List } from 'lucide-react';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setOrders, setOrdersStatus, setOrdersError, updateOrder } from '@/features/orders/ordersSlice';
import { ordersService, type OrdersDateParams } from '@/features/orders/ordersService';
import { useOrdersRealtime } from '@/features/orders/useOrdersRealtime';
import { usePendingOrdersBadge } from '@/features/orders/usePendingOrdersBadge';
import { storeCommerceService } from '@/features/stores/storeCommerceService';
import { getOrderFlowType } from '@/features/stores/storeCommerceProfiles';
import { locationsService } from '@/features/locations/locationsService';
import { whatsappService } from '@/features/whatsapp/whatsappService';
import { notify } from '@/lib/notifications';
import type { OrderStatus } from '@/types/common.types';
import type { StoreCommerceSettings } from '@/features/stores/storeCommerce.types';
import type { StoreLocation } from '@/features/locations/locations.types';
import type { StoreWhatsappConnection, StoreWhatsappSettings } from '@/features/whatsapp/whatsapp.types';
import type {
  AmendOrderItemsPayload,
  DispatchOrderPayload,
  Order,
  UpdateOrderDetailsPayload,
} from '@/features/orders/orders.types';
import { RestaurantOrdersBoard } from './orders/RestaurantOrdersBoard';
import { RetailOrdersTable } from './orders/RetailOrdersTable';
import { scrollToFirstError } from '@/hooks/useScrollToFirstFormikError';

// ── Types ─────────────────────────────────────────────────────

type DateRangeKey = 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom';
type ViewMode = 'board' | 'table';

// ── Date range helpers ────────────────────────────────────────

const DATE_RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'today',      label: 'Hoy' },
  { key: 'yesterday',  label: 'Ayer' },
  { key: 'last7',      label: 'Últ. 7 días' },
  { key: 'this_month', label: 'Este mes' },
  { key: 'custom',     label: 'Personalizado' },
];

const DAY_MS = 86_400_000;

function buildDateParams(
  key: DateRangeKey,
  customFrom: string,
  customTo: string,
): OrdersDateParams | null {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (key) {
    case 'today':
      return {
        dateFrom: todayStart.toISOString(),
        dateTo: new Date(todayStart.getTime() + DAY_MS).toISOString(),
      };
    case 'yesterday': {
      const yd = new Date(todayStart.getTime() - DAY_MS);
      return { dateFrom: yd.toISOString(), dateTo: todayStart.toISOString() };
    }
    case 'last7': {
      const start = new Date(todayStart.getTime() - 6 * DAY_MS);
      return {
        dateFrom: start.toISOString(),
        dateTo: new Date(todayStart.getTime() + DAY_MS).toISOString(),
      };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        dateFrom: start.toISOString(),
        dateTo: new Date(todayStart.getTime() + DAY_MS).toISOString(),
      };
    }
    case 'custom': {
      if (!customFrom || !customTo) return null;
      const from = new Date(customFrom + 'T00:00:00').toISOString();
      const to = new Date(new Date(customTo + 'T00:00:00').getTime() + DAY_MS).toISOString();
      return { dateFrom: from, dateTo: to };
    }
  }
}

function getDateLabel(key: DateRangeKey, customFrom: string, customTo: string): string {
  switch (key) {
    case 'today': return 'hoy';
    case 'yesterday': return 'ayer';
    case 'last7': return 'los últimos 7 días';
    case 'this_month': return 'este mes';
    case 'custom':
      return customFrom && customTo ? `del ${customFrom} al ${customTo}` : 'rango personalizado';
  }
}

function viewStorageKey(storeId: string) {
  return `melosoft_orders_view_${storeId}`;
}

// ── Component ─────────────────────────────────────────────────

export function OrdersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector(s => s.orders);
  const reduxCommerceSettings = useAppSelector(s => s.stores.currentCommerceSettings);

  const [commerceSettings, setCommerceSettings] = useState<StoreCommerceSettings | null>(reduxCommerceSettings);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [whatsappSettings, setWhatsappSettings] = useState<StoreWhatsappSettings | null>(null);
  const [whatsappConnection, setWhatsappConnection] = useState<StoreWhatsappConnection | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Read persisted view immediately so there is no flicker on revisit
  const [viewMode, setViewMode] = useState<ViewMode | null>(() => {
    if (!storeId) return null;
    const saved = localStorage.getItem(viewStorageKey(storeId));
    return saved === 'board' || saved === 'table' ? saved : null;
  });

  // Shared filters — persist across board↔table switches
  const [sharedSearch, setSharedSearch] = useState('');
  const [sharedLocationId, setSharedLocationId] = useState('');

  // Date range state
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>('today');
  const [pendingFrom, setPendingFrom] = useState('');
  const [pendingTo, setPendingTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  // One-time: load commerce settings + locations
  useEffect(() => {
    if (!storeId) return;
    void Promise.all([
      storeCommerceService.fetchStoreCommerceSettings(storeId),
      locationsService.getStoreLocations(storeId),
    ])
      .then(([settings, locs]) => {
        setCommerceSettings(settings);
        setLocations(locs);
      })
      .catch(() => undefined)
      .finally(() => setBootstrapped(true));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    void Promise.all([
      whatsappService.getSettings(storeId),
      whatsappService.getConnection(storeId),
    ]).then(([settings, connection]) => {
      if (!active) return;
      setWhatsappSettings(settings);
      setWhatsappConnection(connection);
    }).catch(() => undefined);

    const unsubscribe = whatsappService.subscribeToConnection(storeId, connection => {
      if (active) setWhatsappConnection(connection);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [storeId]);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    if (storeId) localStorage.setItem(viewStorageKey(storeId), mode);
  }

  // Orders fetch — re-runs when date range or storeId changes
  const fetchOrders = useCallback(() => {
    if (!storeId) return;
    if (dateRangeKey === 'custom' && (!appliedFrom || !appliedTo)) return;

    const params = buildDateParams(dateRangeKey, appliedFrom, appliedTo);
    if (!params) return;

    dispatch(setOrdersStatus('loading'));
    void ordersService.getOrdersWithItems(storeId, params)
      .then(orders => dispatch(setOrders(orders)))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Error cargando pedidos';
        dispatch(setOrdersError(msg));
        notify.error('No se pudieron cargar los pedidos. Intenta de nuevo.');
      });
  }, [storeId, dispatch, dateRangeKey, appliedFrom, appliedTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Memoized date params for the realtime hook
  const currentDateParams = useMemo(
    () => buildDateParams(dateRangeKey, appliedFrom, appliedTo),
    [dateRangeKey, appliedFrom, appliedTo]
  );

  useOrdersRealtime({
    storeId,
    dateFrom: currentDateParams?.dateFrom,
    dateTo: currentDateParams?.dateTo,
    currentOrders: items,
  });

  // Browser tab title — shows pending count while on this page
  useEffect(() => {
    const pendingCount = items.filter(o => o.status === 'pending').length;
    document.title = pendingCount > 0
      ? `(${pendingCount}) Pedidos pendientes — Melosoft`
      : 'Melosoft Commerce';
    return () => { document.title = 'Melosoft Commerce'; };
  }, [items]);

  const { refresh: refreshPendingBadge } = usePendingOrdersBadge();

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    try {
      if (newStatus === 'cancelled') {
        // Goes through cancel_store_order so any stock the order
        // decremented gets reversed atomically — never a plain status
        // update for this transition. The RPC doesn't return a full
        // order row, so re-fetch it for the Redux update.
        await ordersService.cancelOrder(orderId);
        const refreshed = await ordersService.getOrderById(orderId);
        if (refreshed) dispatch(updateOrder(refreshed));
      } else {
        const updated = await ordersService.updateOrderStatus(orderId, newStatus);
        dispatch(updateOrder(updated));
      }
      notify.success('Pedido actualizado');
      refreshPendingBadge();
    } catch {
      notify.error('No se pudo actualizar el estado del pedido');
      throw new Error('update failed');
    }
  }

  async function handleDispatchOrder(orderId: string, payload: DispatchOrderPayload): Promise<Order> {
    try {
      const updated = await ordersService.dispatchOrder(orderId, payload);
      dispatch(updateOrder(updated));
      const emailSuffix = updated.customerEmail ? '; notificaremos al cliente por correo' : '';
      notify.success(updated.fulfillmentMethod === 'pickup'
        ? `Pedido listo para recoger${emailSuffix}`
        : `Envío registrado${emailSuffix}`);
      return updated;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No se pudo registrar el envío');
      throw error;
    }
  }

  async function handleUpdateOrderDetails(orderId: string, payload: UpdateOrderDetailsPayload): Promise<Order> {
    try {
      const updated = await ordersService.updateOrderDetails(orderId, payload);
      dispatch(updateOrder(updated));
      notify.success('Datos del pedido actualizados');
      return updated;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No se pudieron actualizar los datos del pedido');
      throw error;
    }
  }

  async function handleAmendOrderItems(orderId: string, payload: AmendOrderItemsPayload): Promise<Order> {
    try {
      const updated = await ordersService.amendOrderItems(orderId, payload);
      dispatch(updateOrder(updated));
      notify.success('Productos, total e inventario actualizados');
      return updated;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No se pudo modificar el pedido');
      throw error;
    }
  }

  function applyCustomRange() {
    if (!pendingFrom) {
      setDateRangeError('Selecciona la fecha inicial.');
      scrollToFirstError({ fieldName: 'orders-date-from' });
      return;
    }
    if (!pendingTo) {
      setDateRangeError('Selecciona la fecha final.');
      scrollToFirstError({ fieldName: 'orders-date-to' });
      return;
    }
    if (pendingFrom > pendingTo) {
      setDateRangeError('La fecha inicial no puede ser posterior a la fecha final.');
      scrollToFirstError({ fieldName: 'orders-date-from' });
      return;
    }
    setDateRangeError(null);
    setAppliedFrom(pendingFrom);
    setAppliedTo(pendingTo);
  }

  function selectDateRange(key: DateRangeKey) {
    setDateRangeKey(key);
    if (key !== 'custom') {
      setAppliedFrom('');
      setAppliedTo('');
    }
  }

  const restaurant = getOrderFlowType(commerceSettings) === 'restaurant';
  const context = restaurant ? 'restaurant' as const : 'retail' as const;
  const effectiveViewMode: ViewMode | null = !bootstrapped
    ? viewMode
    : restaurant
      ? (viewMode ?? 'board')
      : 'table';
  const dateLabel = getDateLabel(dateRangeKey, appliedFrom, appliedTo);
  const isLoading = status === 'loading';
  const isFailed = status === 'failed';

  const locationMap: Record<string, string> = {};
  const locationOptions: Array<{ id: string; name: string }> = [];
  for (const loc of locations) {
    locationMap[loc.id] = loc.name;
    locationOptions.push({ id: loc.id, name: loc.name });
  }

  const sharedProps = {
    orders: items,
    automaticWhatsappReady: Boolean(
      whatsappSettings?.enabled &&
      whatsappSettings.customerOrderConfirmationEnabled &&
      whatsappConnection?.connectionStatus === 'connected' &&
      whatsappConnection.registrationStatus === 'registered' &&
      whatsappConnection.templateStatus === 'approved'
    ),
    dateLabel,
    locationMap,
    locationOptions,
    onStatusChange: handleStatusChange,
    onDispatchOrder: handleDispatchOrder,
    onUpdateDetails: handleUpdateOrderDetails,
    onAmendItems: handleAmendOrderItems,
    context,
    search: sharedSearch,
    locationId: sharedLocationId,
    onSearchChange: setSharedSearch,
    onLocationChange: setSharedLocationId,
  };

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="Pedidos"
          description={restaurant ? 'Tablero de pedidos en tiempo real' : 'Gestión de pedidos de tu tienda'}
          action={
            <div className="flex items-center gap-2">
              {commerceSettings && (
                <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500">
                  {restaurant
                    ? <><Utensils className="w-3.5 h-3.5" /> Restaurante</>
                    : <><Package className="w-3.5 h-3.5" /> Ecommerce</>}
                </span>
              )}
              <button
                type="button"
                onClick={fetchOrders}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          }
          sticky={false}
          className="mb-4"
        />
      )}
    >
      <div className="flex flex-col gap-4 pb-6">

      {/* Date range filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {DATE_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => selectDateRange(opt.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                dateRangeKey === opt.key
                  ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {dateRangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                id="orders-date-from"
                name="orders-date-from"
                type="date"
                value={pendingFrom}
                onChange={e => { setPendingFrom(e.target.value); setDateRangeError(null); }}
                aria-invalid={Boolean(dateRangeError)}
                className="text-xs text-gray-700 outline-none"
              />
            </div>
            <span className="text-xs text-gray-400">—</span>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                id="orders-date-to"
                name="orders-date-to"
                type="date"
                value={pendingTo}
                onChange={e => { setPendingTo(e.target.value); setDateRangeError(null); }}
                aria-invalid={Boolean(dateRangeError)}
                className="text-xs text-gray-700 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={applyCustomRange}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              Buscar
            </button>
          </div>
        )}

        {dateRangeKey === 'custom' && dateRangeError && (
          <p data-error-for={dateRangeError.includes('final') ? 'orders-date-to' : 'orders-date-from'} role="alert" className="text-xs text-red-600">
            {dateRangeError}
          </p>
        )}

        {!isLoading && !isFailed && (
          <span className="text-xs text-gray-500 ml-1">
            <span className="font-semibold text-gray-700">{items.length}</span> pedido{items.length !== 1 ? 's' : ''} de{' '}
            <span className="text-indigo-600 font-medium">{dateLabel}</span>
          </span>
        )}

        {/* View mode toggle — right-aligned */}
        {effectiveViewMode && restaurant && (
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => changeViewMode('board')}
              title="Vista tablero"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                effectiveViewMode === 'board'
                  ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Tablero
            </button>
            <button
              type="button"
              onClick={() => changeViewMode('table')}
              title="Vista lista"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                effectiveViewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {isFailed && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">No se pudieron cargar los pedidos</p>
            {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
            <button
              type="button"
              onClick={fetchOrders}
              className="mt-2 text-xs font-semibold text-red-700 hover:text-red-800 underline"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!isFailed && bootstrapped && effectiveViewMode && (
        isLoading && items.length === 0 ? (
          <PanelLoadingState label="Cargando pedidos…" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="w-10 h-10 text-gray-300" />}
            title="Sin pedidos"
            description={`No hay pedidos de ${dateLabel}. Prueba cambiando el rango de fechas.`}
          />
        ) : effectiveViewMode === 'board' && restaurant ? (
          <RestaurantOrdersBoard {...sharedProps} />
        ) : (
          <RetailOrdersTable {...sharedProps} />
        )
      )}
      </div>
    </AdminPanelShell>
  );
}
