import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';

// AuthCallbackPage handles the redirect from Supabase invitation/magic-link emails.
//
// The Supabase client (src/lib/supabase.ts) is initialized with detectSessionInUrl: true
// (default), so it automatically processes the hash tokens when the app boots.
// useAuthBootstrap (App.tsx) picks up the resulting SIGNED_IN event, loads the profile
// + memberships, and sets isBootstrapping = false.
//
// This page just waits for that bootstrap to complete, then navigates based on
// the `next` query param or the user's role.

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBootstrapping = useAppSelector((state) => state.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const profile = useAppSelector((state) => state.auth.profile);
  const myMemberships = useAppSelector((state) => state.stores.myMemberships);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Check for error params in the URL hash (Supabase puts them there when link expires)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const errorCode = hashParams.get('error_code') ?? searchParams.get('error_code');

    if (errorCode) {
      const raw =
        hashParams.get('error_description') ??
        searchParams.get('error_description') ??
        'El enlace no es válido.';
      setUrlError(decodeURIComponent(raw.replace(/\+/g, ' ')));
    }
  }, [searchParams]);

  // Once bootstrap is complete, navigate
  useEffect(() => {
    if (urlError) return; // error already shown
    if (isBootstrapping) return; // still loading

    if (!isAuthenticated) {
      // Session could not be restored — link is expired or already used
      setUrlError(
        'El enlace de invitación expiró o ya fue usado. Solicita una nueva invitación al administrador.'
      );
      return;
    }

    const next = searchParams.get('next');
    if (next) {
      navigate(next, { replace: true });
      return;
    }

    // Compute redirect from role
    const isAdmin = profile?.platformRole === 'platform_admin' && profile.status === 'active';
    if (isAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    const active = myMemberships.filter((m) => m.status === 'active');
    if (active.length > 0) {
      const target = active.find((m) => m.role === 'owner') ?? active[0];
      navigate(`/admin/stores/${target.storeId}`, { replace: true });
      return;
    }

    navigate('/access-denied', { replace: true });
  }, [isBootstrapping, isAuthenticated, profile, myMemberships, urlError, searchParams, navigate]);

  if (urlError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-800 mb-2">
            Enlace inválido o expirado
          </h1>
          <p className="text-sm text-gray-500 mb-6">{urlError}</p>
          <a
            href="/login"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline"
          >
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <Loader className="w-7 h-7 text-indigo-600 animate-spin" />
        <p className="text-sm text-gray-400">Verificando sesión…</p>
      </div>
    </div>
  );
}
