import type { FulfillmentMethod } from '@/types/common.types';
import { normalizeFulfillmentMethod } from '@/lib/orders/fulfillment';

export interface ShippingRulesConfig {
  localDeliveryBaseFee: number | null | undefined;
  localDeliveryFreeFrom: number | null | undefined;
  nationalShippingBaseFee: number | null | undefined;
  nationalShippingFreeFrom: number | null | undefined;
}

export interface ShippingCalculation {
  fee: number;
  isFree: boolean;
  threshold: number | null;
}

function normalizeMoney(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function calculateShippingAmount(
  subtotal: number,
  fulfillmentMethod: FulfillmentMethod | null | undefined,
  config: ShippingRulesConfig,
): ShippingCalculation {
  const normalizedMethod = normalizeFulfillmentMethod(fulfillmentMethod);
  const safeSubtotal = normalizeMoney(subtotal);

  if (normalizedMethod === 'pickup') {
    return { fee: 0, isFree: true, threshold: null };
  }

  if (normalizedMethod === 'national_shipping') {
    const threshold = config.nationalShippingFreeFrom != null ? normalizeMoney(config.nationalShippingFreeFrom) : null;
    const baseFee = normalizeMoney(config.nationalShippingBaseFee);
    const isFree = threshold != null && safeSubtotal >= threshold;
    return { fee: isFree ? 0 : baseFee, isFree, threshold };
  }

  const threshold = config.localDeliveryFreeFrom != null ? normalizeMoney(config.localDeliveryFreeFrom) : null;
  const baseFee = normalizeMoney(config.localDeliveryBaseFee);
  const isFree = threshold != null && safeSubtotal >= threshold;
  return { fee: isFree ? 0 : baseFee, isFree, threshold };
}

export function hasShippingRuleConfigured(config: ShippingRulesConfig): boolean {
  return normalizeMoney(config.localDeliveryBaseFee) > 0
    || normalizeMoney(config.nationalShippingBaseFee) > 0
    || normalizeMoney(config.localDeliveryFreeFrom) > 0
    || normalizeMoney(config.nationalShippingFreeFrom) > 0;
}
