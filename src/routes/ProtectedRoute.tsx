import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export function ProtectedRoute() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isBootstrapping = useAppSelector((state) => state.auth.isBootstrapping);

  // Wait for the initial session check before evaluating auth state.
  // Prevents flash redirect to /login on page reload.
  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
