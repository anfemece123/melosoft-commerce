import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { cartaService } from '@/features/carta/cartaService';
import type { PublicCartaPage } from '@/features/carta/carta.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { CartaMenu } from '@/components/public/carta/CartaMenu';
import type { PublicStorePage } from '@/types/common.types';

interface CartaOutletContext {
  storeSlug: string | null;
  branding: PublicStorePage | null;
  theme: StorefrontTheme;
}

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
  const { storeSlug, branding, theme } = useOutletContext<CartaOutletContext>();
  const [page, setPage] = useState<PublicCartaPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    cartaService.getPublicCarta(storeSlug)
      .then((data) => {
        if (cancelled) return;
        setPage(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  useNoIndex(!branding?.cartaListed);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ color: theme.mutedText }}>
        Cargando carta…
      </div>
    );
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
