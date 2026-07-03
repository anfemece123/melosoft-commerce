import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, ShoppingBag, Loader2 } from 'lucide-react';
import { paymentsService } from '@/features/payments/paymentsService';
import { CartProvider, useCart } from '@/lib/cart/cartContext';

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
  const { storeSlug } = useParams<{ storeSlug: string }>();
  if (!storeSlug) return null;
  return (
    <CartProvider storeSlug={storeSlug}>
      <PaymentResultContent />
    </CartProvider>
  );
}

function PaymentResultContent() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ backgroundColor: '#f9fafb' }}
    >
      <div className="w-full max-w-md space-y-6">

        {/* Status card */}
        <div className="rounded-3xl bg-white shadow-lg border border-gray-100 px-6 py-10 text-center space-y-4">

          {/* Icon */}
          <div className="flex justify-center">
            {isLoading   && <div className="w-14 h-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />}
            {isApproved  && <CheckCircle className="w-14 h-14 text-green-500" />}
            {isPending   && <Clock className="w-14 h-14 text-amber-500" />}
            {isDeclined  && <XCircle className="w-14 h-14 text-red-500" />}
            {isError     && <AlertCircle className="w-14 h-14 text-red-400" />}
          </div>

          {/* Title */}
          <h1 className={`text-2xl font-bold ${
            isLoading  ? 'text-gray-500' :
            isApproved ? 'text-green-600' :
            isPending  ? 'text-amber-600' :
            'text-red-600'
          }`}>
            {isLoading  && 'Verificando pago...'}
            {isApproved && '¡Pago aprobado!'}
            {isPending  && 'Pago pendiente'}
            {isDeclined && 'Pago rechazado'}
            {isError    && 'Error en el pago'}
          </h1>

          {/* Description */}
          <p className="text-sm text-gray-500 leading-relaxed">
            {isLoading  && 'Estamos confirmando el estado de tu transacción.'}
            {isApproved && 'Tu pago fue procesado exitosamente.'}
            {isPending  && 'Tu pago está siendo procesado. Esto puede tomar unos minutos.'}
            {isDeclined && 'Tu pago no pudo ser procesado. Intenta con otro método de pago o comunícate con tu banco.'}
            {isError    && 'Ocurrió un error al procesar tu pago. Si el monto fue debitado, comunícate con el negocio.'}
          </p>

          {/* Order number (approved) */}
          {isApproved && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 text-center space-y-2">
              {waitingOrder ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  <p className="text-xs text-gray-500">Registrando tu pedido...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400">Número de pedido</p>
                  <p className="text-2xl font-bold tracking-widest text-gray-800">{orderNumber}</p>
                  <p className="text-xs text-gray-500">
                    El negocio recibirá tu pedido y te contactará para confirmar la entrega.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Reference / transaction ID — only for non-approved states */}
          {!isApproved && !isLoading && (transactionId || reference) && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left space-y-1.5">
              {reference && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Referencia</span>
                  <span className="font-mono text-gray-700">{reference}</span>
                </div>
              )}
              {transactionId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">ID transacción</span>
                  <span className="font-mono text-gray-700 truncate ml-4 max-w-[160px]">{transactionId}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {storeSlug && (
            <Link
              to={`/s/${storeSlug}`}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Volver a la tienda
            </Link>
          )}

          {(isDeclined || isError) && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 w-full rounded-2xl border border-gray-200 px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Intentar de nuevo
            </button>
          )}
        </div>

        {/* Footer notes */}
        {isPending && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              Los pagos PSE y algunos métodos pueden tardar hasta 10 minutos en confirmarse. No es necesario volver a pagar.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Si tienes dudas sobre tu pago, comunícate con el negocio directamente.
        </p>
      </div>
    </div>
  );
}
