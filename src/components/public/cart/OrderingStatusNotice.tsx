import { CheckCircle2, Clock3, PauseCircle } from 'lucide-react';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

export function OrderingStatusNotice({
  theme,
  showWhenOpen = true,
}: {
  theme: StorefrontTheme;
  showWhenOpen?: boolean;
}) {
  const { orderStatus, scheduleLoading } = useSelectedLocation();

  if (!scheduleLoading && orderStatus?.isAcceptingOrders && !showWhenOpen) return null;

  const isOpen = orderStatus?.isAcceptingOrders === true;
  const isPaused = orderStatus?.statusCode === 'paused';
  const Icon = isOpen ? CheckCircle2 : isPaused ? PauseCircle : Clock3;
  const color = isOpen ? theme.primary : '#b45309';
  const backgroundColor = isOpen ? `${theme.primary}12` : '#f59e0b1a';
  const label = scheduleLoading
    ? 'Validando disponibilidad de pedidos…'
    : isOpen
      ? 'Pedidos disponibles'
      : isPaused
        ? 'Los pedidos están pausados temporalmente.'
        : 'La tienda no está recibiendo pedidos en este momento.';

  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium" style={{ borderColor: `${color}55`, backgroundColor, color }}>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </div>
  );
}
