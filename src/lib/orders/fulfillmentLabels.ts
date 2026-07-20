import type { FulfillmentMethod } from '@/types/common.types';
import { normalizeFulfillmentMethod, type CheckoutFulfillmentMethod } from './fulfillment';

export { normalizeFulfillmentMethod };
export type { CheckoutFulfillmentMethod };

/** Everything a label/description call needs to speak in real, human terms
 * instead of rigid "Local"/"Nacional" — all optional, every function falls
 * back to a safe generic phrase when a piece of context isn't available
 * (e.g. a store with no city configured, or an admin view that only has
 * the bare fulfillment method). Never invents a city/sede that wasn't
 * actually passed in. */
export interface FulfillmentLabelContext {
  /** A single, unambiguous local-delivery city — pass this only when
   * there's exactly one clear city (e.g. from the resolved operational
   * location, or the store's only delivery city). Leave undefined/null
   * when the store covers several different cities, so the label falls
   * back to the generic "Domicilio" instead of guessing one. */
  city?: string | null;
  /** True when the store has more than one pickup-enabled location — the
   * pickup label becomes "Recogida en sucursal" so it's clear the
   * customer needs to choose one, instead of a plain "Recogida" that
   * implies a single obvious place. */
  hasMultipleLocations?: boolean;
  /** The single resolved store location for this exact context (an
   * order's chosen sede, or the store's only pickup location) — used only
   * for the richer description text, never required for the short/badge
   * label. */
  storeLocation?: { name: string; city?: string | null; department?: string | null } | null;
}

const EMPTY_CONTEXT: FulfillmentLabelContext = {};

/** Short, public-facing badge text — home/PDP/cart badges, admin table
 * rows. Deliberately terse and consistent regardless of context (a badge
 * has no room for "en Pasto"); use `getFulfillmentMethodLabel` wherever
 * there's room to be more specific (checkout option cards, order detail). */
export function getFulfillmentBadgeLabel(method: FulfillmentMethod | null | undefined): string {
  const normalized = normalizeFulfillmentMethod(method);
  if (normalized === 'pickup') return 'Recogida';
  if (normalized === 'national_shipping') return 'Envío nacional';
  return 'Domicilio';
}

/** Full label — checkout option cards, order detail headers. Adapts to
 * city (local delivery) and multi-sede (pickup) when that context is
 * given; falls back to the same safe generic text as the badge otherwise. */
export function getFulfillmentMethodLabel(
  method: FulfillmentMethod | null | undefined,
  context: FulfillmentLabelContext = EMPTY_CONTEXT,
): string {
  const normalized = normalizeFulfillmentMethod(method);
  if (normalized === 'pickup') {
    return context.hasMultipleLocations ? 'Recogida en sucursal' : 'Recogida';
  }
  if (normalized === 'national_shipping') {
    return 'Envío nacional';
  }
  const city = context.city?.trim();
  return city ? `Domicilio en ${city}` : 'Domicilio';
}

/** Longer helper text shown under a checkout option — the one place worth
 * a full sentence instead of a two-word label. */
export function getFulfillmentMethodDescription(
  method: FulfillmentMethod | null | undefined,
  context: FulfillmentLabelContext = EMPTY_CONTEXT,
): string {
  const normalized = normalizeFulfillmentMethod(method);
  const cityText = context.storeLocation?.city?.trim() || context.city?.trim();

  if (normalized === 'pickup') {
    if (context.storeLocation?.name) {
      return `Recoges tu pedido en ${context.storeLocation.name}${cityText ? ` · ${cityText}` : ''}.`;
    }
    return context.hasMultipleLocations
      ? 'Elige la sucursal donde quieres recoger tu pedido.'
      : 'Recoges tu pedido directamente en la tienda.';
  }

  if (normalized === 'national_shipping') {
    return 'Despacho a cualquier ciudad habilitada en el país.';
  }

  return cityText
    ? `Entrega a domicilio en ${cityText}.`
    : 'Entrega en tu ciudad o zona de cobertura.';
}
