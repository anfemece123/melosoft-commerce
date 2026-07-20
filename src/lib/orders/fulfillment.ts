import type { FulfillmentMethod } from '@/types/common.types';
import type { PublicStoreLocation } from '@/features/locations/locations.types';

export type CheckoutFulfillmentMethod = 'pickup' | 'local_delivery' | 'national_shipping';
export interface LocationCityOption {
  city: string;
  department: string | null;
}

export function normalizeFulfillmentMethod(method: FulfillmentMethod | null | undefined): CheckoutFulfillmentMethod {
  if (method === 'pickup') return 'pickup';
  if (method === 'national_shipping') return 'national_shipping';
  return 'local_delivery';
}

export function getAvailableFulfillmentMethods(input: {
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  allowsNationalShipping: boolean | null;
}): CheckoutFulfillmentMethod[] {
  const methods: CheckoutFulfillmentMethod[] = [];

  if (input.allowsLocalDelivery === true) methods.push('local_delivery');
  if (input.allowsNationalShipping === true) methods.push('national_shipping');
  if (input.allowsPickup === true) methods.push('pickup');

  return methods;
}

// Labels/descriptions moved to fulfillmentLabels.ts — that's the single
// source of truth for anything user-facing now (see its own doc comment).
// This file stays focused on normalization/filtering/location-resolution.

export function fulfillmentRequiresAddress(method: FulfillmentMethod | null | undefined): boolean {
  return normalizeFulfillmentMethod(method) !== 'pickup';
}

export function fulfillmentUsesNationalDestination(method: FulfillmentMethod | null | undefined): boolean {
  return normalizeFulfillmentMethod(method) === 'national_shipping';
}

export function getPickupLocations(locations: PublicStoreLocation[]): PublicStoreLocation[] {
  return locations.filter((location) => location.allowsPickup);
}

export function getLocalDeliveryLocations(locations: PublicStoreLocation[]): PublicStoreLocation[] {
  return locations.filter((location) => location.allowsLocalDelivery);
}

export function getUniqueLocationCities(locations: PublicStoreLocation[]): LocationCityOption[] {
  const seen = new Set<string>();
  const result: LocationCityOption[] = [];

  for (const location of locations) {
    const city = location.city?.trim();
    if (!city) continue;
    const department = location.department?.trim() || null;
    const key = `${city.toLowerCase()}::${department?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ city, department });
  }

  return result;
}

function findPrimaryLocation(locations: PublicStoreLocation[]): PublicStoreLocation | null {
  return locations.find((location) => location.isPrimary) ?? locations[0] ?? null;
}

function findLocationByCity(
  locations: PublicStoreLocation[],
  city: string | null | undefined,
): PublicStoreLocation | null {
  const normalizedCity = city?.trim().toLowerCase();
  if (!normalizedCity) return null;
  return locations.find((location) => location.city?.trim().toLowerCase() === normalizedCity) ?? null;
}

export function resolveOperationalLocation(params: {
  fulfillmentMethod: FulfillmentMethod | null | undefined;
  locations: PublicStoreLocation[];
  selectedLocation: PublicStoreLocation | null;
  localDeliveryCity?: string | null;
}): PublicStoreLocation | null {
  const method = normalizeFulfillmentMethod(params.fulfillmentMethod);
  const { locations, selectedLocation, localDeliveryCity } = params;

  if (method === 'pickup') {
    const pickupLocations = getPickupLocations(locations);
    if (selectedLocation && pickupLocations.some((location) => location.locationId === selectedLocation.locationId)) {
      return selectedLocation;
    }
    return findPrimaryLocation(pickupLocations);
  }

  if (method === 'local_delivery') {
    const localLocations = getLocalDeliveryLocations(locations);
    const byChosenCity = findLocationByCity(localLocations, localDeliveryCity);
    if (byChosenCity) return byChosenCity;
    if (selectedLocation && localLocations.some((location) => location.locationId === selectedLocation.locationId)) {
      return selectedLocation;
    }
    return findPrimaryLocation(localLocations);
  }

  if (selectedLocation) return selectedLocation;
  return findPrimaryLocation(locations);
}
