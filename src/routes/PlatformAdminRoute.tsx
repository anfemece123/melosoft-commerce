import { Outlet, Navigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { isPlatformAdmin } from '@/utils/permissions';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export function PlatformAdminRoute() {
  const isBootstrapping = useAppSelector((state) => state.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const profile = useAppSelector((state) => state.auth.profile);
  const myMemberships = useAppSelector((state) => state.stores.myMemberships);

  if (isBootstrapping) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isPlatformAdmin(profile)) return <Outlet />;

  // Not a platform_admin — redirect to their store if they have one
  const activeMembership = myMemberships.find((m) => m.status === 'active');
  if (activeMembership) {
    return <Navigate to={`/admin/stores/${activeMembership.storeId}`} replace />;
  }

  return <Navigate to="/access-denied" replace />;
}
