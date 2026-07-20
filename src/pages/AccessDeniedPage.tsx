import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { authService } from '@/features/auth/authService';
import { getPostLoginRedirect } from '@/utils/authRedirect';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const profile = useAppSelector((s) => s.auth.profile);
  const myMemberships = useAppSelector((s) => s.stores.myMemberships);

  const panelUrl = isAuthenticated
    ? getPostLoginRedirect(profile, myMemberships)
    : '/login';

  async function handleLogout() {
    try { await authService.logout(); } catch { /* continue */ }
    dispatch(logout());
    void navigate('/login');
  }

  // Authorization data can finish hydrating just after a route evaluation.
  // If the user does have a valid destination, recover without requiring a click.
  if (isAuthenticated && panelUrl !== '/access-denied') {
    return <Navigate to={panelUrl} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldOff className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso denegado</h1>
        <p className="text-gray-500 mb-8">
          No tienes permisos para acceder a esta sección. Si crees que es un error,
          contacta al administrador de la plataforma.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isAuthenticated && panelUrl !== '/access-denied' && (
            <Button variant="primary" onClick={() => void navigate(panelUrl)}>
              Ir a mi panel
            </Button>
          )}
          <Button variant="outline" onClick={() => void handleLogout()}>
            Cambiar cuenta
          </Button>
        </div>
      </div>
    </div>
  );
}
