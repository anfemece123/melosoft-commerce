import { createContext, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { OrderRow } from '@/types/database.types';

const OVERDUE_MS = 5 * 60 * 1000;

interface PendingInfo {
  id: string;
  createdAt: string;
}

function upsertPendingRow(current: PendingInfo[], next: PendingInfo): PendingInfo[] {
  const existingIndex = current.findIndex((row) => row.id === next.id);
  if (existingIndex === -1) {
    return [...current, next];
  }

  const updated = [...current];
  updated[existingIndex] = next;
  return updated;
}

export interface PendingOrdersBadgeValue {
  pendingCount: number;
  hasPending: boolean;
  hasOverduePending: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const PendingOrdersBadgeContext = createContext<PendingOrdersBadgeValue>({
  pendingCount: 0,
  hasPending: false,
  hasOverduePending: false,
  loading: false,
  error: null,
  refresh: () => undefined,
});

export function PendingOrdersBadgeProvider({
  storeId,
  children,
}: {
  storeId: string | undefined;
  children: ReactNode;
}) {
  const [rows, setRows] = useState<PendingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch from DB (not increment/decrement) — safe to call multiple times,
  // prevents double-count when both optimistic refresh and realtime event fire.
  const load = useCallback(async () => {
    if (!storeId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('store_id', storeId)
        .eq('status', 'pending');
      if (err) throw err;
      setRows((data ?? []).map(r => ({ id: r.id, createdAt: r.created_at })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar conteo');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setRows([]);
      return;
    }
    void load();
    const channel = supabase
      .channel(`pending-badge:${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          const nextRow = payload.new as OrderRow | undefined;
          const previousRow = payload.old as OrderRow | undefined;

          setRows((current) => {
            if (payload.eventType === 'INSERT') {
              if (!nextRow || nextRow.status !== 'pending') return current;
              return upsertPendingRow(current, {
                id: nextRow.id,
                createdAt: nextRow.created_at,
              });
            }

            if (payload.eventType === 'UPDATE') {
              const wasPending = previousRow?.status === 'pending';
              const isPending = nextRow?.status === 'pending';

              if (wasPending && !isPending) {
                return current.filter((row) => row.id !== previousRow?.id);
              }

              if (!wasPending && isPending && nextRow) {
                return upsertPendingRow(current, {
                  id: nextRow.id,
                  createdAt: nextRow.created_at,
                });
              }

              if (isPending && nextRow) {
                return upsertPendingRow(current, {
                  id: nextRow.id,
                  createdAt: nextRow.created_at,
                });
              }

              return current;
            }

            if (payload.eventType === 'DELETE') {
              if (!previousRow || previousRow.status !== 'pending') return current;
              return current.filter((row) => row.id !== previousRow.id);
            }

            return current;
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [storeId, load]);

  const now = Date.now();
  const hasOverduePending = rows.some(r => now - new Date(r.createdAt).getTime() > OVERDUE_MS);

  return (
    <PendingOrdersBadgeContext.Provider
      value={{
        pendingCount: rows.length,
        hasPending: rows.length > 0,
        hasOverduePending,
        loading,
        error,
        refresh: () => { void load(); },
      }}
    >
      {children}
    </PendingOrdersBadgeContext.Provider>
  );
}
