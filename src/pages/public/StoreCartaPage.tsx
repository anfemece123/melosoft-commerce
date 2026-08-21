import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { cartaService } from '@/features/carta/cartaService';
import type { PublicCartaPage } from '@/features/carta/carta.types';
import { usePublicStorefrontTheme } from '@/lib/storefront/usePublicStorefrontTheme';
import { CartaMenu } from '@/components/public/carta/CartaMenu';
import { StorefrontPageLoader } from '@/components/public/storefront/StorefrontPageLoader';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';

/** Sets/restores a robots noindex tag while `active` is true. Only used
 * here (unlisted cartas shouldn't be indexed) — kept local rather than
 * shared since CustomDomainRoute's copy serves an unrelated case. */
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

export function StoreCartaPage() {
  const { storeSlug, branding } = usePublicStoreBranding();
  const theme = usePublicStorefrontTheme(branding);
  const [result, setResult] = useState<{ storeSlug: string; page: PublicCartaPage | null } | null>(null);

  useEffect(() => {
    if (!storeSlug) return;
    let cancelled = false;
    cartaService.getPublicCarta(storeSlug)
      .then((data) => {
        if (cancelled) return;
        setResult({ storeSlug, page: data });
      })
      .catch(() => {
        if (!cancelled) setResult({ storeSlug, page: null });
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  const loading = Boolean(storeSlug && result?.storeSlug !== storeSlug);
  const page = result?.storeSlug === storeSlug ? result.page : null;

  useNoIndex(!branding?.cartaListed);

  if (loading) {
    return <StorefrontPageLoader label="Cargando carta digital…" />;
  }

  if (!page || page.categories.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <UtensilsCrossed className="h-10 w-10" style={{ color: theme.mutedText }} />
        <h1 className="text-lg font-semibold" style={{ color: theme.text }}>
          Esta carta no está disponible
        </h1>
        <p className="text-sm" style={{ color: theme.mutedText }}>
          El local aún no ha activado su carta digital.
        </p>
      </div>
    );
  }

  return <CartaMenu page={page} theme={theme} />;
}
