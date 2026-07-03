import { Outlet, Navigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { canAccessStore } from '@/utils/permissions';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useEnsureCurrentStore } from '@/features/stores/useEnsureCurrentStore';

export function StoreAccessRoute() {
  const { storeId } = useParams<{ storeId: string }>();
  const isBootstrapping = useAppSelector((state) => state.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const profile = useAppSelector((state) => state.auth.profile);
  const myMemberships = useAppSelector((state) => state.stores.myMemberships);
  const hasAccess = Boolean(storeId) && canAccessStore(profile, myMemberships, storeId as string);

  // Always call the hook (rules of hooks) — it no-ops when access isn't granted
  // yet or storeId is missing, since there's nothing useful to hydrate then.
  const { isLoading: isStoreLoading, error: storeError } = useEnsureCurrentStore(
    hasAccess ? storeId : undefined
  );

  if (isBootstrapping) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!storeId) return <Navigate to="/admin" replace />;

  if (hasAccess) {
    if (isStoreLoading) return <LoadingScreen />;
    if (storeError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center px-4">
          <p className="text-sm font-medium text-gray-900">No se pudo cargar la tienda.</p>
          <p className="text-sm text-gray-500">{storeError}</p>
        </div>
      );
    }
    return <Outlet />;
  }

  // No access to this store — redirect to their actual store if they have one
  const activeMembership = myMemberships.find((m) => m.status === 'active');
  if (activeMembership) {
    return <Navigate to={`/admin/stores/${activeMembership.storeId}`} replace />;
  }

  return <Navigate to="/access-denied" replace />;
}
