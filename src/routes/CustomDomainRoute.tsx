import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Globe2, Loader2 } from 'lucide-react';
import {
  isStorefrontHostnameMode,
  useStorefrontDomain,
} from '@/lib/storefront/storefrontDomainContext';

// Never let a "site not found" response get indexed — it has no store
// identity to canonicalize and isn't meaningful search content.
function useNoIndex(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const existed = Boolean(meta);
    const previousContent = meta?.getAttribute('content') ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (!meta) return;
      if (existed && previousContent) meta.setAttribute('content', previousContent);
      else meta.remove();
    };
  }, [active]);
}

export function CustomDomainRoute() {
  const { mode, hostname } = useStorefrontDomain();
  const notFound = mode !== 'loading' && !isStorefrontHostnameMode(mode);
  useNoIndex(notFound);

  if (mode === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-label="Resolviendo dominio" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <Globe2 className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-gray-950">Sitio no encontrado</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {hostname || 'Esta dirección'} todavía no está asociada a una empresa activa.
            Revisa la dirección o contacta al administrador de la tienda.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
