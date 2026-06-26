import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { StorefrontBackButton } from '@/components/public/storefront/StorefrontBackButton';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { StorefrontPoliciesSkeleton } from '@/components/public/storefront/StorefrontSkeletons';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { storesService } from '@/features/stores/storesService';
import type { PublicStorePage } from '@/types/common.types';

export function StorePoliciesPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { branding } = usePublicStoreBranding();
  const { setRouteReady } = usePublicRouteReady();
  const [store, setStore] = useState<PublicStorePage | null>(branding);
  const [loading, setLoading] = useState(!branding);

  useEffect(() => {
    if (!storeSlug) {
      setLoading(false);
      return;
    }

    const resolvedStoreSlug = storeSlug;

    async function loadStore() {
      try {
        const data = await storesService.getPublicStoreBySlug(resolvedStoreSlug);
        setStore(data);
      } finally {
        setLoading(false);
      }
    }

    if (branding) {
      setStore(branding);
      setLoading(false);
      return;
    }

    void loadStore();
  }, [storeSlug, branding]);

  useEffect(() => {
    setRouteReady(!loading);
  }, [loading, setRouteReady]);

  // TODO Fase 5: cargar políticas desde public_store_pages via storesService

  const sections = [
    { title: 'Política de envíos', key: 'shippingPolicy' },
    { title: 'Política de devoluciones', key: 'returnsPolicy' },
    { title: 'Garantía', key: 'warrantyPolicy' },
    { title: 'Privacidad', key: 'privacyPolicy' },
    { title: 'Términos y condiciones', key: 'termsAndConditions' },
  ];

  if (loading) {
    return <StorefrontPoliciesSkeleton branding={store} storeSlug={storeSlug ?? ''} />;
  }

  const theme = buildStorefrontTheme({
    mode: store?.themeMode,
    primaryColor: store?.primaryColor,
    secondaryColor: store?.secondaryColor,
    accentColor: store?.accentColor,
    backgroundColor: store?.backgroundColor,
    textColor: store?.textColor,
    buttonRadius: store?.buttonRadius,
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <header className="border-b" style={{ backgroundColor: theme.background, borderColor: theme.border }}>
        <div className="max-w-3xl mx-auto px-4 py-4">
          <StorefrontBackButton
            storeSlug={storeSlug ?? store?.storeSlug ?? ''}
            color={theme.mutedText}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-6 h-6" style={{ color: theme.primary }} />
          <h1 className="text-2xl font-bold">Políticas de la tienda</h1>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.key}>
              <h2 className="mb-2 font-semibold">{section.title}</h2>
              <div
                className="h-16 rounded-lg border animate-pulse"
                style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border }}
              />
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: theme.mutedText }}>
          /s/{storeSlug}/policies — Políticas configurables por tienda.
        </p>
      </main>
    </div>
  );
}
