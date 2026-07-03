import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { storesService } from './storesService';
import { storeCommerceService } from './storeCommerceService';
import { setCurrentStore, setCurrentLimits, setCurrentCommerceSettings } from './storesSlice';

interface EnsureCurrentStoreResult {
  isLoading: boolean;
  error: string | null;
}

/**
 * Guarantees state.stores.current / currentLimits / currentCommerceSettings are
 * hydrated for the given storeId before store-scoped admin routes render —
 * covers the case where a user deep-links or refreshes directly on a nested
 * route (e.g. /admin/stores/:id/products) without passing through a page that
 * loads the store first. No-ops if already loaded for this storeId.
 */
export function useEnsureCurrentStore(storeId: string | undefined): EnsureCurrentStoreResult {
  const dispatch = useAppDispatch();
  const currentStoreId = useAppSelector((state) => state.stores.current?.id);
  const [isLoading, setIsLoading] = useState(Boolean(storeId) && storeId !== currentStoreId);
  const [error, setError] = useState<string | null>(null);
  const loadedForStoreId = useRef<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }
    if (currentStoreId === storeId || loadedForStoreId.current === storeId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const [storeData, limitsData, commerceData] = await Promise.all([
          storesService.getStoreById(storeId as string),
          storesService.getStoreLimits(storeId as string),
          storeCommerceService.fetchStoreCommerceSettings(storeId as string),
        ]);
        if (cancelled) return;
        dispatch(setCurrentStore(storeData));
        dispatch(setCurrentLimits(limitsData));
        dispatch(setCurrentCommerceSettings(commerceData));
        loadedForStoreId.current = storeId as string;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error cargando la tienda');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [storeId, currentStoreId, dispatch]);

  return { isLoading, error };
}
