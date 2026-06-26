import { Outlet, Navigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { canAccessStore } from '@/utils/permissions';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export function StoreAccessRoute() {
  const { storeId } = useParams<{ storeId: string }>();
  const isBootstrapping = useAppSelector((state) => state.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const profile = useAppSelector((state) => state.auth.profile);
  const myMemberships = useAppSelector((state) => state.stores.myMemberships);

  if (isBootstrapping) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!storeId) return <Navigate to="/admin" replace />;

  if (canAccessStore(profile, myMemberships, storeId)) return <Outlet />;

  // No access to this store — redirect to their actual store if they have one
  const activeMembership = myMemberships.find((m) => m.status === 'active');
  if (activeMembership) {
    return <Navigate to={`/admin/stores/${activeMembership.storeId}`} replace />;
  }

  return <Navigate to="/access-denied" replace />;
}
