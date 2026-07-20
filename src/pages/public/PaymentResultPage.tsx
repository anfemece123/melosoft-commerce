import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, ShoppingBag, Loader2 } from 'lucide-react';
import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';
import { buildStorefrontTheme, withAlpha } from '@/components/public/storefront/storefrontTheme';
import { paymentsService } from '@/features/payments/paymentsService';
import { CartProvider, useCart } from '@/lib/cart/cartContext';
import { useResolvedStoreSlug } from '@/lib/storefront/storefrontDomainContext';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

type PaymentOutcome = 'loading' | 'approved' | 'pending' | 'declined' | 'error';

function resolveOutcomeFromUrl(wompiStatus: string | null): PaymentOutcome {
  switch ((wompiStatus ?? '').toUpperCase()) {
    case 'APPROVED': return 'approved';
    case 'PENDING':  return 'pending';
    case 'DECLINED': return 'declined';
    case 'ERROR':    return 'error';
    case 'VOIDED':   return 'declined';
    default:         return 'pending';
  }
}

// This page intentionally stays outside PublicLayout's storefront shell (no
// header/footer/theme, no catalog fetching) — it's a lightweight, standalone
// confirmation screen. It still needs the same cart as checkout (keyed by
// storeSlug) so it can clear it once payment is actually confirmed, so it
// wraps itself in its own CartProvider instead of relying on PublicLayout.
export function PaymentResultPage() {
  const { storeSlug: routeStoreSlug } = useParams<{ storeSlug: string }>();
  const storeSlug = useResolvedStoreSlug(routeStoreSlug);
  if (!storeSlug) return null;
  return (
    <CartProvider storeSlug={storeSlug}>
      <PaymentResultContent storeSlug={storeSlug} />
    </CartProvider>
  );
}

function PaymentResultContent({ storeSlug }: { storeSlug: string }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { branding } = usePublicStoreBranding();

  const transactionId = searchParams.get('id');
  const wompiStatus   = searchParams.get('status');
  const reference     = searchParams.get('reference');

  const [outcome, setOutcome] = useState<PaymentOutcome>('loading');
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const { clearCart } = useCart();
  const cartClearedRef = useRef(false);

  // Polling state — use ref so the recursive callback always reads current values.
  const activeRef      = useRef(true);
  const pollCountRef   = useRef(0);
  const MAX_POLL       = 12; // 12 × 3s = 36 seconds max wait for order creation

  useEffect(() => {
    activeRef.current    = true;
    pollCountRef.current = 0;

    async function fetchResult() {
      if (!activeRef.current) return;

      if (!reference) {
        setOutcome(resolveOutcomeFromUrl(wompiStatus));
        return;
      }

      try {
        const result = await paymentsService.getPaymentResult(reference);

        if (!activeRef.current) return;

        if (!result) {
          // Reference not found in checkout_sessions — trust URL param.
          setOutcome(resolveOutcomeFromUrl(wompiStatus));
          return;
        }

        const s = result.sessionStatus;

        if (s === 'approved') {
          setOutcome('approved');
          if (result.orderNumber) {
            setOrderNumber(result.orderNumber);
            return; // order exists, stop polling
          }
          // Order not yet created (webhook delayed) — keep polling.
        } else if (s === 'declined') {
          setOutcome('declined');
          return;
        } else if (s === 'error') {
          setOutcome('error');
          return;
        } else {
          // 'created' / 'pending' — session not yet updated by webhook.
          // Trust URL param for visual state; continue polling.
          const urlOutcome = resolveOutcomeFromUrl(wompiStatus);
          setOutcome(urlOutcome === 'loading' ? 'pending' : urlOutcome);
          if (urlOutcome !== 'approved' && urlOutcome !== 'pending') return;
        }

        // Continue polling (approved-but-no-order, or still pending)
        if (pollCountRef.current < MAX_POLL) {
          pollCountRef.current += 1;
          setTimeout(() => { void fetchResult(); }, 3000);
        } else {
          // Max polls reached — show approved without order number.
          // The order may appear later; user can refresh.
          setOutcome('approved');
        }
      } catch {
        if (!activeRef.current) return;
        setOutcome(resolveOutcomeFromUrl(wompiStatus));
      }
    }

    void fetchResult();

    return () => {
      activeRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only clear the cart once the payment is actually confirmed approved —
  // this is the one place in the online-payment flow where clearing is safe.
  useEffect(() => {
    if (outcome === 'approved' && !cartClearedRef.current) {
      cartClearedRef.current = true;
      clearCart();
    }
  }, [outcome, clearCart]);

  const isApproved  = outcome === 'approved';
  const isDeclined  = outcome === 'declined';
  const isError     = outcome === 'error';
  const isPending   = outcome === 'pending';
  const isLoading   = outcome === 'loading';
  const waitingOrder = isApproved && !orderNumber;
  const theme = buildStorefrontTheme({
    mode: branding?.themeMode,
    primaryColor: branding?.primaryColor,
    secondaryColor: branding?.secondaryColor,
    accentColor: branding?.accentColor,
    backgroundColor: branding?.backgroundColor,
    textColor: branding?.textColor,
    buttonRadius: branding?.buttonRadius,
  });
  const successColor = theme.primary;
  const pendingColor = withAlpha(theme.text, 0.72);
  const dangerColor = '#dc2626';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ backgroundColor: theme.background, color: theme.text, ...theme.cssVars }}
    >
      <div className="w-full max-w-md space-y-6">

        {/* Status card */}
        <div
          className="space-y-4 rounded-3xl border px-6 py-10 text-center shadow-lg"
          style={{ backgroundColor: theme.surface, borderColor: theme.border, boxShadow: `0 18px 40px ${theme.shadow}` }}
        >

          {/* Icon */}
          <div className="flex justify-center">
            {isLoading && (
              <div
                className="h-14 w-14 rounded-full border-4 animate-spin"
                style={{ borderColor: withAlpha(theme.primary, 0.18), borderTopColor: theme.primary }}
              />
            )}
            {isApproved  && <CheckCircle className="h-14 w-14" style={{ color: successColor }} />}
            {isPending   && <Clock className="h-14 w-14" style={{ color: pendingColor }} />}
            {isDeclined  && <XCircle className="h-14 w-14" style={{ color: dangerColor }} />}
            {isError     && <AlertCircle className="h-14 w-14" style={{ color: dangerColor }} />}
          </div>

          {/* Title */}
          <h1
            className="text-2xl font-bold"
            style={{
              color: isLoading ? theme.mutedText : isApproved ? successColor : isPending ? pendingColor : dangerColor,
            }}
          >
            {isLoading  && 'Verificando pago...'}
            {isApproved && '¡Pago aprobado!'}
            {isPending  && 'Pago pendiente'}
            {isDeclined && 'Pago rechazado'}
            {isError    && 'Error en el pago'}
          </h1>

          {/* Description */}
          <p className="text-sm leading-relaxed" style={{ color: theme.mutedText }}>
            {isLoading  && 'Estamos confirmando el estado de tu transacción.'}
            {isApproved && 'Tu pago fue procesado exitosamente.'}
            {isPending  && 'Tu pago está siendo procesado. Esto puede tomar unos minutos.'}
            {isDeclined && 'Tu pago no pudo ser procesado. Intenta con otro método de pago o comunícate con tu banco.'}
            {isError    && 'Ocurrió un error al procesar tu pago. Si el monto fue debitado, comunícate con el negocio.'}
          </p>

          {/* Order number (approved) */}
          {isApproved && (
            <div
              className="space-y-2 rounded-xl border px-4 py-4 text-center"
              style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt }}
            >
              {waitingOrder ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.primary }} />
                  <p className="text-xs" style={{ color: theme.mutedText }}>Registrando tu pedido...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs" style={{ color: theme.mutedText }}>Número de pedido</p>
                  <p className="text-2xl font-bold tracking-widest" style={{ color: theme.text }}>{orderNumber}</p>
                  <p className="text-xs" style={{ color: theme.mutedText }}>
                    El negocio recibirá tu pedido y te contactará para confirmar la entrega.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Reference / transaction ID — only for non-approved states */}
          {!isApproved && !isLoading && (transactionId || reference) && (
            <div
              className="space-y-1.5 rounded-xl border px-4 py-3 text-left"
              style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt }}
            >
              {reference && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: theme.mutedText }}>Referencia</span>
                  <span className="font-mono" style={{ color: theme.text }}>{reference}</span>
                </div>
              )}
              {transactionId && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: theme.mutedText }}>ID transacción</span>
                  <span className="ml-4 max-w-[160px] truncate font-mono" style={{ color: theme.text }}>{transactionId}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {storeSlug && (
            <Link
              to={buildStorefrontPath(storeSlug)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme.primary }}
            >
              <ShoppingBag className="h-4 w-4" />
              Volver a la tienda
            </Link>
          )}

          {(isDeclined || isError) && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }}
            >
              Intentar de nuevo
            </button>
          )}
        </div>

        {/* Footer notes */}
        {isPending && (
          <div
            className="flex items-center gap-2 rounded-xl border px-4 py-3"
            style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt }}
          >
            <Clock className="h-4 w-4 shrink-0" style={{ color: theme.primary }} />
            <p className="text-xs" style={{ color: theme.mutedText }}>
              Los pagos PSE y algunos métodos pueden tardar hasta 10 minutos en confirmarse. No es necesario volver a pagar.
            </p>
          </div>
        )}

        <p className="text-center text-xs" style={{ color: theme.mutedText }}>
          Si tienes dudas sobre tu pago, comunícate con el negocio directamente.
        </p>
      </div>
    </div>
  );
}
