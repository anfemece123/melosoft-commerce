import { Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useStorefrontDomain } from '@/lib/storefront/storefrontDomainContext';

// General host guard for every admin/auth route (login, /auth/callback,
// /set-password, /access-denied, and everything under /admin). A
// storefront (subdomain or verified custom domain) must never be a
// second entry point into the panel — regardless of whether a Supabase
// session happens to exist there.
//
// This is a UI-only gate: it decides what RENDERS on a given hostname,
// nothing more. It grants no data access and skips no RLS check — real
// authorization stays entirely server-side (RLS policies, is_platform_admin(),
// store_members checks in Edge Functions). A user who somehow reached
// this UI on the wrong host still could not read or write anything they
// aren't already allowed to for their own session, on any host.
//
// mode is synchronous and reliable for this decision: StorefrontDomainProvider
// resolves platform hosts (configured platform hostnames, localhost,
// 127.0.0.1) to 'platform' on the very first render, with no async step —
// 'loading' only ever occurs while a NON-platform hostname is still being
// checked against the public domain-resolution RPCs, so it must be denied
// immediately too, never treated as "maybe platform".
export function PlatformHostRoute() {
  const { mode } = useStorefrontDomain();

  if (mode !== 'platform') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-gray-950">Esta sección no está disponible aquí</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            El panel de administración de Melosoft Commerce solo puede abrirse desde su dirección oficial.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
