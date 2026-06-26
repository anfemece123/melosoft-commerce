import { useContext } from 'react';
import { PendingOrdersBadgeContext } from './PendingOrdersBadgeContext';
import type { PendingOrdersBadgeValue } from './PendingOrdersBadgeContext';

export type { PendingOrdersBadgeValue };

export function usePendingOrdersBadge(): PendingOrdersBadgeValue {
  return useContext(PendingOrdersBadgeContext);
}
