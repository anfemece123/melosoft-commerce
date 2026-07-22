/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  LocationOrderStatus,
  LocationScheduleInterval,
  LocationScheduleStatus,
  PublicStoreLocation,
} from '@/features/locations/locations.types';
import { locationsService } from '@/features/locations/locationsService';

interface LocationContextValue {
  locations: PublicStoreLocation[];
  selectedLocation: PublicStoreLocation | null;
  setSelectedLocation: (loc: PublicStoreLocation) => void;
  isLoading: boolean;
  scheduleLoading: boolean;
  businessHours: LocationScheduleInterval[];
  businessStatus: LocationScheduleStatus | null;
  orderStatus: LocationOrderStatus | null;
  refreshOrderStatus: () => Promise<LocationOrderStatus | null>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'melosoft_location_';

function getStoredLocationId(storeSlug: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${storeSlug}`);
  } catch {
    return null;
  }
}

function storeLocationId(storeSlug: string, locationId: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${storeSlug}`, locationId);
  } catch {
    // localStorage unavailable — silent
  }
}

export function PublicLocationProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const [locations, setLocations] = useState<PublicStoreLocation[]>([]);
  const [selectedLocation, setSelectedLocationState] = useState<PublicStoreLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // scheduleLoading has no setter of its own: it is derived from comparing
  // selectedLocation against the id the schedule effect below last settled
  // (success or failure) — see loadedLocationId. That keeps every
  // businessHours/businessStatus/orderStatus update confined to the
  // .then()/.catch() of an async operation, never a synchronous setState
  // in the effect body itself.
  const [loadedLocationId, setLoadedLocationId] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<LocationScheduleInterval[]>([]);
  const [businessStatus, setBusinessStatus] = useState<LocationScheduleStatus | null>(null);
  const [orderStatus, setOrderStatus] = useState<LocationOrderStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const locs = await locationsService.getPublicStoreLocations(storeSlug);
        if (cancelled) return;
        setLocations(locs);

        const storedId = getStoredLocationId(storeSlug);
        const stored = locs.find(l => l.locationId === storedId) ?? null;
        const primary = locs.find(l => l.isPrimary) ?? locs[0] ?? null;
        setSelectedLocationState(stored ?? primary);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [storeSlug]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== localStorage || event.key !== `${STORAGE_KEY_PREFIX}${storeSlug}`) {
        return;
      }

      const nextLocationId = event.newValue;
      if (!nextLocationId) return;
      if (selectedLocation?.locationId === nextLocationId) return;
      const next = locations.find((loc) => loc.locationId === nextLocationId);
      if (!next) return;
      setBusinessHours([]);
      setBusinessStatus(null);
      setOrderStatus(null);
      setSelectedLocationState(next);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [locations, selectedLocation, storeSlug]);

  const setSelectedLocation = useCallback((loc: PublicStoreLocation) => {
    setBusinessHours([]);
    setBusinessStatus(null);
    setOrderStatus(null);
    setSelectedLocationState(loc);
    storeLocationId(storeSlug, loc.locationId);
  }, [storeSlug]);

  const refreshOrderStatus = useCallback(async () => {
    if (!selectedLocation) return null;
    try {
      const status = await locationsService.getLocationOrderStatus(selectedLocation.locationId);
      setOrderStatus(status);
      return status;
    } catch {
      setOrderStatus(null);
      return null;
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) return;
    let cancelled = false;
    const locationId = selectedLocation.locationId;
    Promise.all([
      locationsService.getLocationSchedule(locationId, 'business'),
      locationsService.getLocationScheduleStatus(locationId, 'business'),
      locationsService.getLocationOrderStatus(locationId),
    ]).then(([hours, physicalStatus, orderingStatus]) => {
      if (cancelled) return;
      setBusinessHours(hours);
      setBusinessStatus(physicalStatus);
      setOrderStatus(orderingStatus);
      setLoadedLocationId(locationId);
    }).catch(() => {
      if (cancelled) return;
      setBusinessHours([]);
      setBusinessStatus(null);
      setOrderStatus(null);
      setLoadedLocationId(locationId);
    });

    return () => { cancelled = true; };
  }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) return;
    const interval = window.setInterval(() => {
      void Promise.all([
        refreshOrderStatus(),
        locationsService.getLocationScheduleStatus(selectedLocation.locationId, 'business')
          .then(setBusinessStatus)
          .catch(() => undefined),
      ]);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshOrderStatus, selectedLocation]);

  return (
    <LocationContext.Provider value={{
      locations,
      selectedLocation,
      setSelectedLocation,
      isLoading,
      scheduleLoading: Boolean(selectedLocation) && loadedLocationId !== selectedLocation?.locationId,
      // Derived, not reset via effect: whenever there is no selected
      // location, businessHours/businessStatus/orderStatus have no
      // subject to describe, regardless of whatever stale value the
      // last fetch left behind.
      businessHours: selectedLocation ? businessHours : [],
      businessStatus: selectedLocation ? businessStatus : null,
      orderStatus: selectedLocation ? orderStatus : null,
      refreshOrderStatus,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useSelectedLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useSelectedLocation must be used inside PublicLocationProvider');
  return ctx;
}
