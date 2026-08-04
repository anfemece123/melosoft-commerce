import { Clock3, PauseCircle } from 'lucide-react';
import { useSelectedLocation } from '@/lib/locations/locationContext';

export function OrderingStatusNotice() {
  const { orderStatus, scheduleLoading } = useSelectedLocation();

  const isOpen = orderStatus?.isAcceptingOrders === true;
  // A healthy/open state does not need to consume visual space. Keep this
  // component only for actionable states: validation, pause or closure.
  if (!scheduleLoading && isOpen) return null;

  const isPaused = orderStatus?.statusCode === 'paused';
  const Icon = isPaused ? PauseCircle : Clock3;
  const color = '#b45309';
  const backgroundColor = '#f59e0b1a';
  const label = scheduleLoading
    ? 'Validando disponibilidad de pedidos…'
    : isPaused
      ? 'Los pedidos están pausados temporalmente.'
      : 'La tienda no está recibiendo pedidos en este momento.';

  return (
    <div
      role="status"
      aria-busy={scheduleLoading}
      aria-live="polite"
      className="flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium"
      style={{ borderColor: `${color}55`, backgroundColor, color }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </div>
  );
}
