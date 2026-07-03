import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Building2, LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { authService } from '@/features/auth/authService';
import { storesService } from '@/features/stores/storesService';
import { isPlatformAdmin } from '@/utils/permissions';
import { cn } from '@/utils/cn';
import type { Store } from '@/features/stores/stores.types';

interface StoreCard {
  storeId: string;
  role: string;
  store: Store | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  staff: 'Colaborador',
  viewer: 'Lector',
};

export function MyStoresPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.auth.profile);
  const user = useAppSelector((s) => s.auth.user);
  const myMemberships = useAppSelector((s) => s.stores.myMemberships);
  const [cards, setCards] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = isPlatformAdmin(profile);

  useEffect(() => {
    if (isAdmin) {
      void navigate('/admin', { replace: true });
      return;
    }

    const active = myMemberships.filter((m) => m.status === 'active');

    if (active.length === 0) {
      setLoading(false);
      return;
    }

    if (active.length === 1) {
      void navigate(`/admin/stores/${active[0].storeId}`, { replace: true });
      return;
    }

    // Seed cards immediately with placeholder so UI renders fast
    setCards(active.map((m) => ({ storeId: m.storeId, role: m.role, store: null })));

    // Load store details in parallel
    Promise.all(active.map((m) => storesService.getStoreById(m.storeId)))
      .then((stores) => {
        setCards(
          active.map((m, idx) => ({
            storeId: m.storeId,
            role: m.role,
            store: stores[idx],
          }))
        );
      })
      .catch(() => { /* keep null placeholders */ })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myMemberships, isAdmin]);

  async function handleLogout() {
    try { await authService.logout(); } catch { /* continue */ }
    dispatch(logout());
    void navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ArrowLeftRight className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Selecciona la empresa</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            Tu cuenta tiene acceso a varias empresas. Elige con cuál quieres trabajar.
          </p>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-[76px] bg-white rounded-xl border border-gray-200 animate-pulse"
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-200 px-6">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">
              No tienes acceso a ninguna empresa activa.
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <button
                key={card.storeId}
                type="button"
                onClick={() => void navigate(`/admin/stores/${card.storeId}`)}
                className="w-full flex items-center gap-4 px-4 py-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
              >
                {/* Logo or icon placeholder */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden',
                    card.store?.logoUrl ? 'bg-gray-100' : 'bg-indigo-50'
                  )}
                >
                  {card.store?.logoUrl ? (
                    <img
                      src={card.store.logoUrl}
                      alt={card.store.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-indigo-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {card.store?.name ?? `Empresa (${card.storeId.substring(0, 8)}…)`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ROLE_LABELS[card.role] ?? card.role}
                    {card.store?.city ? ` · ${card.store.city}` : ''}
                  </p>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between text-xs text-gray-400">
          <span className="truncate max-w-[200px]">{user?.email}</span>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 hover:text-red-500 transition-colors shrink-0 ml-4"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
