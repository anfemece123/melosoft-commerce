/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicStoreLocation } from '@/features/locations/locations.types';
import { locationsService } from '@/features/locations/locationsService';

interface LocationContextValue {
  locations: PublicStoreLocation[];
  selectedLocation: PublicStoreLocation | null;
  setSelectedLocation: (loc: PublicStoreLocation) => void;
  isLoading: boolean;
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

      setSelectedLocationState((current) => {
        if (current?.locationId === nextLocationId) {
          return current;
        }

        return locations.find((loc) => loc.locationId === nextLocationId) ?? current;
      });
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [locations, storeSlug]);

  const setSelectedLocation = useCallback((loc: PublicStoreLocation) => {
    setSelectedLocationState(loc);
    storeLocationId(storeSlug, loc.locationId);
  }, [storeSlug]);

  return (
    <LocationContext.Provider value={{ locations, selectedLocation, setSelectedLocation, isLoading }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useSelectedLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useSelectedLocation must be used inside PublicLocationProvider');
  return ctx;
}
