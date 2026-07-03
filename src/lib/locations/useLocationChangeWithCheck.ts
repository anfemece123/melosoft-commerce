import { useState } from 'react';
import { useSelectedLocation } from './locationContext';
import { useCart } from '@/lib/cart/cartContext';
import { checkCartLocationCompatibility, type LocationCompatibilityResult } from './locationCompatibility';
import type { PublicStoreLocation } from '@/features/locations/locations.types';

export interface PendingLocationChange {
  location: PublicStoreLocation;
  result: LocationCompatibilityResult;
}

export function useLocationChangeWithCheck() {
  const { locations, selectedLocation, setSelectedLocation } = useSelectedLocation();
  const { items, removeItemsByProductIds } = useCart();
  const [pendingChange, setPendingChange] = useState<PendingLocationChange | null>(null);
  const [checking, setChecking] = useState(false);

  const storeId = selectedLocation?.storeId ?? locations[0]?.storeId ?? null;

  async function requestLocationChange(newLoc: PublicStoreLocation): Promise<void> {
    if (!newLoc || newLoc.locationId === selectedLocation?.locationId) return;

    if (items.length === 0 || !storeId) {
      setSelectedLocation(newLoc);
      return;
    }

    setChecking(true);
    try {
      const result = await checkCartLocationCompatibility(storeId, items, newLoc, locations);
      if (result.allAvailable) {
        setSelectedLocation(newLoc);
      } else {
        setPendingChange({ location: newLoc, result });
      }
    } catch {
      setSelectedLocation(newLoc);
    } finally {
      setChecking(false);
    }
  }

  function confirmLocationChange(): void {
    if (!pendingChange) return;
    removeItemsByProductIds(pendingChange.result.unavailableItems.map((item) => item.productId));
    setSelectedLocation(pendingChange.location);
    setPendingChange(null);
  }

  function cancelLocationChange(): void {
    setPendingChange(null);
  }

  return { requestLocationChange, confirmLocationChange, cancelLocationChange, pendingChange, checking };
}
