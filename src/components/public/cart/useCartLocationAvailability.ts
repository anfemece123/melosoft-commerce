import { useEffect, useState } from 'react';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import type { CartItem } from '@/lib/cart/cartContext';
import type { PublicStoreLocation } from '@/features/locations/locations.types';

/**
 * Fetches which of the current cart's products are unavailable at the
 * selected location, re-fetching whenever the drawer opens, the location
 * changes, or the set of product ids in the cart changes.
 */
export function useCartLocationAvailability(
  items: CartItem[],
  locations: PublicStoreLocation[],
  selectedLocation: PublicStoreLocation | null,
  open: boolean,
): { unavailableIds: Set<string> } {
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());

  const storeId = selectedLocation?.storeId ?? locations[0]?.storeId ?? null;
  const cartProductIds = Array.from(new Set(items.map((i) => i.productId))).sort().join(',');

  useEffect(() => {
    if (!storeId || !selectedLocation || items.length === 0) {
      return;
    }
    let cancelled = false;
    productAvailabilityService
      .getAvailabilityForLocation(
        storeId,
        Array.from(new Set(items.map((i) => i.productId))),
        selectedLocation.locationId,
      )
      .then((avail) => {
        if (cancelled) return;
        setUnavailableIds(
          new Set(Object.entries(avail).filter(([, v]) => v === false).map(([k]) => k)),
        );
      })
      .catch(() => { if (!cancelled) setUnavailableIds(new Set()); });
    return () => { cancelled = true; };
  }, [open, storeId, selectedLocation?.locationId, cartProductIds]); // eslint-disable-line react-hooks/exhaustive-deps

  return { unavailableIds };
}
