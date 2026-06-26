import type { CartItem } from '@/lib/cart/cartContext';
import type { PublicStoreLocation } from '@/features/locations/locations.types';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';

export interface UnavailableItemInfo {
  productId: string;
  productName: string;
  availableInLocations: PublicStoreLocation[];
}

export interface LocationCompatibilityResult {
  allAvailable: boolean;
  noneAvailable: boolean;
  unavailableItems: UnavailableItemInfo[];
  availableCount: number;
  unavailableCount: number;
}

export async function checkCartLocationCompatibility(
  storeId: string,
  cartItems: CartItem[],
  targetLocation: PublicStoreLocation,
  allLocations: PublicStoreLocation[],
): Promise<LocationCompatibilityResult> {
  if (cartItems.length === 0) {
    return { allAvailable: true, noneAvailable: false, unavailableItems: [], availableCount: 0, unavailableCount: 0 };
  }

  const productIds = cartItems.map(i => i.productId);
  const availabilityInTarget = await productAvailabilityService.getAvailabilityForLocation(
    storeId,
    productIds,
    targetLocation.locationId,
  );

  const unavailableItems: UnavailableItemInfo[] = [];
  let availableCount = 0;

  for (const item of cartItems) {
    if (availabilityInTarget[item.productId] === false) {
      unavailableItems.push({ productId: item.productId, productName: item.productName, availableInLocations: [] });
    } else {
      availableCount++;
    }
  }

  const otherLocations = allLocations.filter(l => l.locationId !== targetLocation.locationId);
  if (unavailableItems.length > 0 && otherLocations.length > 0) {
    const maps = await Promise.all(
      unavailableItems.map(item => productAvailabilityService.getProductAvailability(item.productId)),
    );
    unavailableItems.forEach((item, idx) => {
      const map = maps[idx];
      item.availableInLocations = otherLocations.filter(loc => map[loc.locationId] !== false);
    });
  }

  return {
    allAvailable: unavailableItems.length === 0,
    noneAvailable: availableCount === 0,
    unavailableItems,
    availableCount,
    unavailableCount: unavailableItems.length,
  };
}
