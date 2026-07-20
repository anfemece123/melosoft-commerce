import type { StorePaymentSettings } from './payments.types';

export type WompiReadiness = 'not_configured' | 'incomplete' | 'missing_events_secret' | 'disabled' | 'ready';

export interface WompiAvailability {
  canUseOnlinePayments: boolean;
  reason: WompiReadiness;
  message: string;
}

export function getWompiAvailability(settings: StorePaymentSettings | null): WompiAvailability {
  if (!settings) {
    return {
      canUseOnlinePayments: false,
      reason: 'not_configured',
      message: 'Configura Wompi en la pestaña Pagos para activar esta opción.',
    };
  }

  const hasPublicKey = Boolean(settings.publicKey?.trim());
  const hasPrivateKey = settings.hasPrivateKey;
  const hasIntegritySecret = settings.hasIntegritySecret;

  if (!hasPublicKey || !hasPrivateKey || !hasIntegritySecret) {
    return {
      canUseOnlinePayments: false,
      reason: 'incomplete',
      message: 'La configuración de Wompi está incompleta. Completa las llaves en la pestaña Pagos.',
    };
  }

  // Checked before `isActive` on purpose: a store that was activated before
  // this rule existed (or had its events_secret cleared afterwards) must
  // stop reporting as ready even though `is_active` is still true in the
  // DB — the webhook fails closed without this secret, so payments would
  // go through on Wompi's side but never confirm an order.
  if (!settings.hasEventsSecret) {
    return {
      canUseOnlinePayments: false,
      reason: 'missing_events_secret',
      message: 'Falta configurar el secreto de eventos/webhook de Wompi para confirmar pagos de forma segura.',
    };
  }

  if (!settings.isActive) {
    return {
      canUseOnlinePayments: false,
      reason: 'disabled',
      message: 'Wompi está configurado pero desactivado. Actívalo en la pestaña Pagos.',
    };
  }

  return {
    canUseOnlinePayments: true,
    reason: 'ready',
    message: `Wompi activo · ${settings.environment === 'production' ? 'Producción' : 'Sandbox'}.`,
  };
}
