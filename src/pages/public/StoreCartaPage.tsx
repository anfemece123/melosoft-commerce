import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { cartaService } from '@/features/carta/cartaService';
import type { PublicCartaPage } from '@/features/carta/carta.types';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { CartaMenu } from '@/components/public/carta/CartaMenu';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
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
  const theme = buildStorefrontTheme({
    mode: branding?.themeMode ?? null,
    primaryColor: branding?.primaryColor ?? null,
    secondaryColor: branding?.secondaryColor ?? null,
    accentColor: branding?.accentColor ?? null,
    backgroundColor: branding?.backgroundColor ?? null,
    textColor: branding?.textColor ?? null,
    buttonRadius: branding?.buttonRadius ?? null,
  });
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
    return (
      <LoadingScreen
        label=""
        brandName={branding?.storeName ?? ''}
        brandLogoUrl={branding?.logoUrl}
        backgroundColor={theme.background}
        textColor={theme.text}
        accentColor={theme.primary}
        markBackgroundColor={theme.surface}
      />
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
