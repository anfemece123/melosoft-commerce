import { useState, useMemo } from 'react';
import {
  Search, SlidersHorizontal, Home, Store, ArrowUpDown,
  Package, TrendingUp, XCircle, CheckCircle,
  ChevronLeft, ChevronRight as ChevronRightIcon, Hash,
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Order } from '@/features/orders/orders.types';
import type { OrderStatus } from '@/types/common.types';
import { getFulfillmentBadgeLabel, normalizeFulfillmentMethod } from '@/lib/orders/fulfillmentLabels';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderStatusBadge, PaymentStatusBadge, getAllStatuses, type OrderViewContext } from './OrderStatusBadge';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

interface TableFilters {
  status: string;
  fulfillment: string;
  paymentMethod: string;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="mt-0.5 rounded-lg bg-gray-50 p-2">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

interface RetailOrdersTableProps {
  orders: Order[];
  storeName: string;
  dateLabel: string;
  locationMap: Record<string, string>;
  locationOptions: Array<{ id: string; name: string }>;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  context: OrderViewContext;
  // Shared with parent — persist across board↔table switches
  search: string;
  locationId: string;
  onSearchChange: (v: string) => void;
  onLocationChange: (v: string) => void;
}

export function RetailOrdersTable({
  orders,
  storeName,
  dateLabel,
  locationMap,
  locationOptions,
  onStatusChange,
  context,
  search,
  locationId,
  onSearchChange,
  onLocationChange,
}: RetailOrdersTableProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [filters, setFilters] = useState<TableFilters>({
    status: '',
    fulfillment: '',
    paymentMethod: '',
  });

  const allStatuses = getAllStatuses(context);

  function setFilter<K extends keyof TableFilters>(key: K, value: TableFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleSearchChange(v: string) {
    onSearchChange(v);
    setPage(1);
  }

  function handleLocationChange(v: string) {
    onLocationChange(v);
    setPage(1);
  }

  function handlePageSizeChange(size: PageSize) {
    setPageSize(size);
    setPage(1);
  }

  const filtered = useMemo(() => {
    let result = orders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        (o.orderNumber ?? '').toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        (o.city ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.status) result = result.filter(o => o.status === filters.status);
    if (filters.fulfillment) result = result.filter(o => normalizeFulfillmentMethod(o.fulfillmentMethod) === filters.fulfillment);
    if (filters.paymentMethod) result = result.filter(o => o.paymentMethod === filters.paymentMethod);
    if (locationId) result = result.filter(o => o.storeLocationId === locationId);

    return [...result].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? diff : -diff;
    });
  }, [orders, search, filters, locationId, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageOrders = filtered.slice(pageStart, pageEnd);

  // Stats — always from all orders, not filtered
  const pendingCount   = orders.filter(o => o.status === 'pending').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
  const totalRevenue   = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);

  const activeFilterCount = [
    filters.status,
    filters.fulfillment,
    filters.paymentMethod,
    search,
    locationId,
  ].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0;

  function clearFilters() {
    setFilters({ status: '', fulfillment: '', paymentMethod: '' });
    onSearchChange('');
    onLocationChange('');
    setPage(1);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Package className="w-4 h-4 text-amber-500" />} label="Pendientes" value={pendingCount} />
        <StatCard icon={<CheckCircle className="w-4 h-4 text-green-500" />} label="Entregados" value={deliveredCount} />
        <StatCard icon={<XCircle className="w-4 h-4 text-red-400" />} label="Cancelados" value={cancelledCount} />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
          label="Ventas totales"
          value={formatCurrency(totalRevenue, 'es-CO', 'COP')}
          sub={`${orders.filter(o => o.status !== 'cancelled').length} pedido${orders.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Pedido, cliente, teléfono, ciudad..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="rounded-lg border border-gray-200 pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
        </div>
        <SlidersHorizontal className="w-4 h-4 text-gray-300" />
        <select
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          {allStatuses.map(s => <option key={s.status} value={s.status}>{s.label}</option>)}
        </select>
        <select
          value={filters.fulfillment}
          onChange={e => setFilter('fulfillment', e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tipo de entrega</option>
          <option value="local_delivery">{getFulfillmentBadgeLabel('local_delivery')}</option>
          <option value="pickup">{getFulfillmentBadgeLabel('pickup')}</option>
          <option value="national_shipping">{getFulfillmentBadgeLabel('national_shipping')}</option>
        </select>
        <select
          value={filters.paymentMethod}
          onChange={e => setFilter('paymentMethod', e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Método de pago</option>
          <option value="cash_on_delivery">Contraentrega</option>
          <option value="online">Pago online</option>
        </select>
        {locationOptions.length > 1 && (
          <select
            value={locationId}
            onChange={e => handleLocationChange(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las sedes</option>
            {locationOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Limpiar filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        )}
        <span className="ml-auto text-xs text-gray-500">
          <span className="font-semibold text-gray-700">{filtered.length}</span> de{' '}
          <span className="font-semibold text-gray-700">{orders.length}</span> pedido{orders.length !== 1 ? 's' : ''} de{' '}
          <span className="text-indigo-600 font-medium">{dateLabel}</span>
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedido</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => { setSortAsc(v => !v); setPage(1); }}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Fecha <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sede / Ciudad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entrega</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <Hash className="w-3 h-3 mx-auto" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">
                    No hay pedidos con estos filtros
                  </td>
                </tr>
              ) : (
                pageOrders.map(order => {
                  const locationName = order.storeLocationId ? (locationMap[order.storeLocationId] ?? '—') : '—';
                  const itemCount = order.items?.length ?? 0;
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`cursor-pointer transition-colors ${
                        order.status === 'pending'
                          ? 'bg-amber-50/50 hover:bg-amber-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-700">
                          #{order.orderNumber ?? order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 truncate max-w-[140px]">{order.customerName}</p>
                        <p className="text-xs text-gray-400">{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px]">
                        <p className="truncate">{locationName}</p>
                        {order.city && <p className="text-gray-400 truncate">{order.city}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {normalizeFulfillmentMethod(order.fulfillmentMethod) !== 'pickup' ? (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Home className="w-3.5 h-3.5" /> {getFulfillmentBadgeLabel(order.fulfillmentMethod)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Store className="w-3.5 h-3.5" /> {getFulfillmentBadgeLabel(order.fulfillmentMethod)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge paymentMethod={order.paymentMethod} paymentStatus={order.paymentStatus} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {itemCount > 0 ? (
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                            {itemCount}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                        {formatCurrency(order.totalAmount, 'es-CO', 'COP')}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} context={context} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setSelectedOrder(order); }}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination + page size */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {filtered.length === 0
                ? 'Sin resultados'
                : `Mostrando ${pageStart + 1}–${Math.min(pageEnd, filtered.length)} de ${filtered.length} pedido${filtered.length !== 1 ? 's' : ''}`
              }
            </span>
            <div className="flex items-center gap-1">
              {PAGE_SIZE_OPTIONS.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handlePageSizeChange(size)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    pageSize === size
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {size}
                </button>
              ))}
              <span className="text-xs text-gray-400 ml-0.5">por página</span>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="px-3 text-xs font-medium text-gray-700">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}
