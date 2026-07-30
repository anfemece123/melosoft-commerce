import type { LocationOrderStatus } from '@/features/locations/locations.types';
import type { StorefrontTheme } from './storefrontTheme';

interface StoreStatusBadgeProps {
  theme: StorefrontTheme;
  orderStatus: LocationOrderStatus | null;
  scheduleLoading: boolean;
  className?: string;
}

/** Compact status pill shown next to the store name. Only renders when the
 * store is confirmed to be closed/paused — silent while loading or open, so
 * it never competes with the brand for attention. */
export function StoreStatusBadge({ theme, orderStatus, scheduleLoading, className = '' }: StoreStatusBadgeProps) {
  if (scheduleLoading || !orderStatus || orderStatus.isAcceptingOrders) return null;

  const isPaused = orderStatus.statusCode === 'paused';
  const label = isPaused ? 'Pedidos pausados' : 'Cerrado ahora';

  const color = isPaused ? '#b45309' : theme.mutedText;
  const backgroundColor = isPaused ? (theme.mode === 'dark' ? 'rgba(245,158,11,0.16)' : '#fef3c7') : theme.surfaceAlt;
  const borderColor = isPaused ? (theme.mode === 'dark' ? 'rgba(245,158,11,0.35)' : '#fde68a') : theme.border;

  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap ${className}`}
      style={{ color, backgroundColor, borderColor }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
