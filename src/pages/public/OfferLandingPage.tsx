import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MessageCircle, Tag, Copy, Package, UtensilsCrossed, AlertCircle, Clock } from 'lucide-react';
import { PublicStoreLogo } from '@/components/public/storefront/PublicStoreLogo';
import { StorefrontBackButton } from '@/components/public/storefront/StorefrontBackButton';
import { StorefrontOfferDetailSkeleton } from '@/components/public/storefront/StorefrontSkeletons';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { usePublicRouteReady } from '@/components/layout/PublicRouteReadyContext';
import { offersService } from '@/features/offers/offersService';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { StorefrontMediaFrame } from '@/components/public/storefront/StorefrontMediaFrame';
import { calculateDiscountPercentage } from '@/lib/pricing/pricing.utils';
import { computeOfferUIStatus } from '@/lib/offers/offerStatus.utils';
import { useCountdown } from '@/lib/offers/countdown.utils';
import { getOrCreateVisitorToken } from '@/lib/offers/visitorToken.utils';
import type { PublicOfferPage, CampaignOfferSession } from '@/types/common.types';
import { readPublicPageCache, writePublicPageCache } from '@/lib/storefront/publicPageCache';
import { writePublicScrollPosition } from '@/lib/storefront/publicScrollRestoration';

interface OfferPageCachePayload {
  offer: PublicOfferPage | null;
}

export function OfferLandingPage() {
  const { storeSlug, offerSlug } = useParams<{ storeSlug: string; offerSlug: string }>();
  const location = useLocation();
  const { branding: storeBranding } = usePublicStoreBranding();
  const { setRouteReady } = usePublicRouteReady();
  const cachedPayload = readPublicPageCache<OfferPageCachePayload>(`offer:${storeSlug}:${offerSlug}`);

  const [offer, setOffer] = useState<PublicOfferPage | null>(cachedPayload?.offer ?? null);
  const [loading, setLoading] = useState(!cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CampaignOfferSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    if (!storeSlug || !offerSlug) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const data = await offersService.getPublicOfferBySlug(storeSlug!, offerSlug!);
        setOffer(data);
        writePublicPageCache(`offer:${storeSlug}:${offerSlug}`, { offer: data } satisfies OfferPageCachePayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando oferta');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [storeSlug, offerSlug]);

  useEffect(() => {
    setRouteReady(!loading);
  }, [loading, setRouteReady]);

  // For per_visitor mode: create/load session
  useEffect(() => {
    if (!offer) return;
    const uiStatus = computeOfferUIStatus({
      status: offer.status,
      countdownMode: offer.countdownMode,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
    });
    if (offer.countdownMode !== 'per_visitor' || uiStatus !== 'active') return;

    setSessionLoading(true);
    const token = getOrCreateVisitorToken();
    offersService
      .getOrCreateVisitorSession(offer.offerId, token)
      .then(setSession)
      .catch(() => {
        // silently fail — landing still works, just without claim code
      })
      .finally(() => setSessionLoading(false));
  }, [offer]);

  // Determine countdown target
  const countdownTarget = offer
    ? offer.countdownMode === 'per_visitor'
      ? session?.expiresAt ?? null
      : offer.endsAt
    : null;

  const countdown = useCountdown(countdownTarget);

  if (loading) {
    return <StorefrontOfferDetailSkeleton branding={storeBranding} storeSlug={storeSlug ?? ''} />;
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-800 mb-2">
            {error ?? 'Oferta no encontrada'}
          </h1>
          <Link
            to={`/s/${storeSlug}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Ver tienda
          </Link>
        </div>
      </div>
    );
  }

  const uiStatus = computeOfferUIStatus({
    status: offer.status,
    countdownMode: offer.countdownMode,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    sessionExpiresAt: session?.expiresAt,
  });

  const bgColor = offer.backgroundColor ?? '#ffffff';
  const textColor = offer.textColor ?? '#0f172a';
  const primaryColor = offer.primaryColor ?? '#6366f1';

  // WhatsApp
  const wa = (offer.offerWhatsappNumber ?? offer.storeWhatsappNumber ?? '').replace(/\D/g, '');
  const baseMsg = offer.whatsappMessage
    ?? `Hola, quiero la oferta: ${offer.title}${offer.productName ? ` — ${offer.productName}` : ''} por ${formatCurrency(offer.offerPrice, 'es-CO', 'COP')}`;
  const fullMsg = session?.claimCode ? `${baseMsg}. Código: ${session.claimCode}` : baseMsg;
  const whatsappHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(fullMsg)}`
    : null;

  const displayImage = offer.heroImageUrl ?? offer.productMainImageUrl;
  const hasDiscount = offer.regularPrice > 0 && offer.offerPrice < offer.regularPrice;

  // Render inactive states
  if (uiStatus === 'archived' || (uiStatus === 'paused' && offer.status === 'archived')) {
    return (
      <InactiveState
        storeSlug={storeSlug!}
        storeName={offer.storeName}
        logoUrl={offer.logoUrl}
        title="Esta oferta ya no está disponible."
        subtitle="El enlace que visitaste ya no está activo."
        productSlug={offer.productSlug}
        productName={offer.productName}
        bgColor={bgColor}
        textColor={textColor}
        primaryColor={primaryColor}
      />
    );
  }

  if (uiStatus === 'scheduled') {
    return (
      <InactiveState
        storeSlug={storeSlug!}
        storeName={offer.storeName}
        logoUrl={offer.logoUrl}
        title="Esta oferta aún no está disponible."
        subtitle={offer.startsAt
          ? `Estará activa a partir del ${new Date(offer.startsAt).toLocaleString('es-CO')}`
          : 'Pronto estará disponible. ¡Vuelve más tarde!'}
        productSlug={offer.productSlug}
        productName={offer.productName}
        bgColor={bgColor}
        textColor={textColor}
        primaryColor={primaryColor}
      />
    );
  }

  if (uiStatus === 'expired') {
    return (
      <InactiveState
        storeSlug={storeSlug!}
        storeName={offer.storeName}
        logoUrl={offer.logoUrl}
        title="Esta oferta ya finalizó."
        subtitle="El tiempo especial de este precio ya no está disponible. Puedes ver el producto a precio normal."
        productSlug={offer.productSlug}
        productName={offer.productName}
        bgColor={bgColor}
        textColor={textColor}
        primaryColor={primaryColor}
      />
    );
  }

  if (uiStatus === 'paused') {
    return (
      <InactiveState
        storeSlug={storeSlug!}
        storeName={offer.storeName}
        logoUrl={offer.logoUrl}
        title="Esta oferta está temporalmente pausada."
        subtitle="Vuelve más tarde para aprovechar este precio especial."
        productSlug={offer.productSlug}
        productName={offer.productName}
        bgColor={bgColor}
        textColor={textColor}
        primaryColor={primaryColor}
      />
    );
  }

  // per_visitor: waiting for session
  const awaitingSession = offer.countdownMode === 'per_visitor' && sessionLoading;

  function persistCurrentScrollPosition() {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    writePublicScrollPosition(routeKey, window.scrollY);
  }

  return (
    <div style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh' }}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <StorefrontBackButton
          storeSlug={storeSlug ?? offer.storeSlug}
          className="mb-6"
          color={textColor}
        />
        {/* Image */}
        {displayImage ? (
          <div className="mb-6">
            <StorefrontMediaFrame
              src={displayImage}
              alt={offer.title}
              aspectClassName="aspect-video"
              roundedClassName="rounded-2xl"
              fallback={<div className="h-full w-full bg-gray-100" />}
            />
          </div>
        ) : (
          <div
            className="rounded-2xl mb-6 flex items-center justify-center aspect-video"
            style={{ backgroundColor: `${primaryColor}11` }}
          >
            <Tag className="w-16 h-16" style={{ color: `${primaryColor}44` }} />
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          {offer.subtitle && (
            <p className="text-sm font-medium mb-1" style={{ color: primaryColor }}>
              {offer.subtitle}
            </p>
          )}
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>
            {offer.title}
          </h1>
          {offer.productName && (
            <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.6 }}>
              {offer.productName}
            </p>
          )}
        </div>

        {/* Countdown */}
        {offer.showCountdown && !awaitingSession && (
          <>
            {!countdown.expired && countdownTarget ? (
              <div className="flex gap-3 justify-center my-6">
                {[
                  { label: 'Días', value: countdown.days },
                  { label: 'Horas', value: countdown.hours },
                  { label: 'Min', value: countdown.minutes },
                  { label: 'Seg', value: countdown.seconds },
                ].filter(({ value, label }) => label !== 'Días' || value > 0)
                  .map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div
                      className="text-3xl font-bold w-16 h-16 flex items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${primaryColor}22`, color: primaryColor }}
                    >
                      {String(value).padStart(2, '0')}
                    </div>
                    <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.55 }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            ) : offer.countdownMode === 'per_visitor' && !session ? (
              <div className="flex justify-center my-6">
                <div className="flex items-center gap-2 text-sm" style={{ color: textColor, opacity: 0.6 }}>
                  <Clock className="w-4 h-4" />
                  Oferta por tiempo limitado
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Price */}
        <div className="mb-6">
          {hasDiscount ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {formatCurrency(offer.offerPrice, 'es-CO', 'COP')}
                </span>
                <DiscountBadge
                  percentage={calculateDiscountPercentage(offer.regularPrice, offer.offerPrice)}
                  size="md"
                />
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 line-through">
                  {formatCurrency(offer.regularPrice, 'es-CO', 'COP')}
                </span>
                <span className="text-green-600 font-medium">
                  Ahorras {formatCurrency(offer.regularPrice - offer.offerPrice, 'es-CO', 'COP')}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-3xl font-bold" style={{ color: primaryColor }}>
              {formatCurrency(offer.offerPrice, 'es-CO', 'COP')}
            </span>
          )}
        </div>

        {/* Claim code */}
        {session?.claimCode && (
          <div
            className="border-2 border-dashed rounded-xl px-4 py-3 text-center mb-6"
            style={{ borderColor: `${primaryColor}55` }}
          >
            <p className="text-xs mb-1" style={{ color: textColor, opacity: 0.5 }}>
              Tu código de oferta
            </p>
            <p
              className="text-2xl font-bold font-mono tracking-widest"
              style={{ color: primaryColor }}
            >
              {session.claimCode}
            </p>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(session.claimCode).then(() => {
                  notify.success('Código copiado');
                });
              }}
              className="text-xs mt-1 underline flex items-center gap-1 mx-auto"
              style={{ color: textColor, opacity: 0.5 }}
            >
              <Copy className="w-3 h-3" />
              Copiar código
            </button>
          </div>
        )}

        {/* Description */}
        {offer.description && (
          <div
            className="text-sm leading-relaxed mb-6"
            style={{ color: textColor, opacity: 0.8 }}
          >
            {offer.description}
          </div>
        )}

        {/* CTA */}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full text-white py-4 rounded-2xl font-semibold text-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#22c55e' }}
          >
            <MessageCircle className="w-6 h-6" />
            {offer.ctaLabel}
          </a>
        ) : (
          <div
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-semibold text-lg border-2 border-dashed"
            style={{ borderColor: `${primaryColor}44`, color: primaryColor }}
          >
            <Tag className="w-6 h-6" />
            {offer.ctaLabel}
          </div>
        )}

        {/* Product link */}
        {offer.productSlug && (
          <div className="text-center mt-4">
            <Link
              to={`/s/${storeSlug}/p/${offer.productSlug}`}
              state={{ fromStorefront: true, fromPath: `${location.pathname}${location.search}${location.hash}` }}
              onClick={persistCurrentScrollPosition}
              className="text-sm underline hover:opacity-70 transition-opacity"
              style={{ color: textColor, opacity: 0.5 }}
            >
              Ver {offer.productName ?? 'producto'} a precio normal
            </Link>
          </div>
        )}

        {/* Terms */}
        {offer.termsAndConditions && (
          <div
            className="mt-8 pt-6 border-t text-xs leading-relaxed"
            style={{ borderColor: `${textColor}11`, color: textColor, opacity: 0.5 }}
          >
            <p className="font-semibold mb-1">Términos y condiciones</p>
            {offer.termsAndConditions}
          </div>
        )}
      </main>

    </div>
  );
}

interface InactiveStateProps {
  storeSlug: string;
  storeName: string;
  logoUrl: string | null;
  title: string;
  subtitle: string;
  productSlug: string | null;
  productName: string | null;
  bgColor: string;
  textColor: string;
  primaryColor: string;
}

function InactiveState({
  storeSlug,
  storeName,
  logoUrl,
  title,
  subtitle,
  productSlug,
  productName,
  bgColor,
  textColor,
  primaryColor,
}: InactiveStateProps) {
  const isMenu = false; // heuristic fallback
  return (
    <div style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh' }}>
      <header className="border-b border-black/5" style={{ backgroundColor: bgColor }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          {logoUrl ? (
            <PublicStoreLogo
              logoUrl={logoUrl}
              storeName={storeName}
              sizeClassName="h-12 w-12"
              fallbackColor={primaryColor}
              outerClassName="border border-black/10 bg-white"
            />
          ) : (
            <span className="font-bold" style={{ color: primaryColor }}>{storeName}</span>
          )}
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${primaryColor}11` }}
        >
          <Tag className="w-8 h-8" style={{ color: primaryColor }} />
        </div>
        <h1 className="text-xl font-bold mb-3" style={{ color: textColor }}>{title}</h1>
        <p className="text-sm mb-8" style={{ color: textColor, opacity: 0.6 }}>{subtitle}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {productSlug && (
            <Link
              to={`/s/${storeSlug}/p/${productSlug}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm border-2 transition-opacity hover:opacity-80"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              {isMenu ? <UtensilsCrossed className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              Ver {productName ?? 'producto'}
            </Link>
          )}
          <Link
            to={`/s/${storeSlug}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: primaryColor, color: '#fff' }}
          >
            Ver tienda completa
          </Link>
        </div>
      </main>
    </div>
  );
}
