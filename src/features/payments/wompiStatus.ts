import type { StorePaymentSettings } from './payments.types';

export type WompiReadiness = 'not_configured' | 'incomplete' | 'disabled' | 'ready';

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
  const hasPrivateKey = Boolean(settings.privateKey?.trim());
  const hasIntegritySecret = Boolean(settings.integritySecret?.trim());

  if (!hasPublicKey || !hasPrivateKey || !hasIntegritySecret) {
    return {
      canUseOnlinePayments: false,
      reason: 'incomplete',
      message: 'La configuración de Wompi está incompleta. Completa las llaves en la pestaña Pagos.',
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
