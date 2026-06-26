import type { OfferStatus, CountdownMode } from '@/types/common.types';

export type ComputedOfferUIStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'paused'
  | 'archived';

interface OfferStatusInput {
  status: OfferStatus;
  countdownMode: CountdownMode;
  startsAt: string | null;
  endsAt: string | null;
  sessionExpiresAt?: string | null;
}

export function computeOfferUIStatus(
  offer: OfferStatusInput,
  now: Date = new Date()
): ComputedOfferUIStatus {
  if (offer.status === 'archived') return 'archived';
  if (offer.status === 'paused') return 'paused';
  if (offer.status === 'draft') return 'draft';
  if (offer.status === 'expired' || offer.status === 'sold_out') return 'expired';

  if (offer.countdownMode === 'fixed_window') {
    if (offer.startsAt && now < new Date(offer.startsAt)) return 'scheduled';
    if (offer.endsAt && now > new Date(offer.endsAt)) return 'expired';
    return 'active';
  }

  // per_visitor
  if (offer.sessionExpiresAt && now > new Date(offer.sessionExpiresAt)) return 'expired';
  return 'active';
}

export function isOfferCurrentlyActive(offer: OfferStatusInput, now: Date = new Date()): boolean {
  return computeOfferUIStatus(offer, now) === 'active';
}
