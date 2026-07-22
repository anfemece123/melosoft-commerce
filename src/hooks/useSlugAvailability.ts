import { useEffect, useMemo, useState } from 'react';
import { storesService } from '@/features/stores/storesService';
import type { SlugAvailabilityReason } from '@/features/stores/stores.types';
import {
  RESERVED_STOREFRONT_SUBDOMAINS,
  STOREFRONT_SUBDOMAIN_MAX_LENGTH,
  STOREFRONT_SUBDOMAIN_MIN_LENGTH,
  STOREFRONT_SUBDOMAIN_PATTERN,
  isAllNumericStorefrontSubdomain,
  normalizeStorefrontSubdomain,
} from '@/lib/storefront/storefrontSubdomains';

export type SlugAvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export interface SlugAvailabilityState {
  status: SlugAvailabilityStatus;
  reason: SlugAvailabilityReason | null;
  message: string | null;
  suggestions: string[];
}

const REASON_MESSAGES: Record<SlugAvailabilityReason, string> = {
  ok: 'Disponible.',
  too_short: `Debe tener al menos ${STOREFRONT_SUBDOMAIN_MIN_LENGTH} caracteres.`,
  too_long: `No puede superar los ${STOREFRONT_SUBDOMAIN_MAX_LENGTH} caracteres.`,
  invalid_format: 'El formato no es válido. Usa minúsculas, números y guiones.',
  all_numeric: 'No puede ser solo números.',
  reserved: 'Este nombre está reservado por la plataforma.',
  taken: 'Este nombre ya está siendo utilizado.',
};

const IDLE_STATE: SlugAvailabilityState = { status: 'idle', reason: null, message: null, suggestions: [] };
const CHECKING_STATE: SlugAvailabilityState = {
  status: 'checking',
  reason: null,
  message: 'Comprobando disponibilidad…',
  suggestions: [],
};
const ERROR_STATE: SlugAvailabilityState = {
  status: 'error',
  reason: null,
  message: 'No fue posible verificar la disponibilidad.',
  suggestions: [],
};

function buildSuggestions(base: string): string[] {
  if (!base) return [];
  const trimmedBase = base.slice(0, STOREFRONT_SUBDOMAIN_MAX_LENGTH - 10);
  const candidates = [`${trimmedBase}-co`, `${trimmedBase}-oficial`, `${trimmedBase}-2`, `${trimmedBase}-3`];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeStorefrontSubdomain(candidate);
    if (
      normalized
      && normalized !== base
      && !seen.has(normalized)
      && STOREFRONT_SUBDOMAIN_PATTERN.test(normalized)
      && !isAllNumericStorefrontSubdomain(normalized)
      && !RESERVED_STOREFRONT_SUBDOMAINS.has(normalized)
    ) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

// Every branch a human's keystrokes can resolve instantly (empty,
// too short/long, bad format, all-numeric, reserved) is a pure function
// of the input — computed here during render, never via setState in an
// effect. Only a structurally valid, non-reserved candidate needs the
// network round trip, so this returns null in that one case to signal
// "ask the RPC".
function computeSyntheticState(normalized: string, trimmedRaw: string): SlugAvailabilityState | null {
  if (!trimmedRaw) return IDLE_STATE;
  if (!normalized || normalized.length < STOREFRONT_SUBDOMAIN_MIN_LENGTH) {
    return { status: 'unavailable', reason: 'too_short', message: REASON_MESSAGES.too_short, suggestions: [] };
  }
  if (normalized.length > STOREFRONT_SUBDOMAIN_MAX_LENGTH) {
    return { status: 'unavailable', reason: 'too_long', message: REASON_MESSAGES.too_long, suggestions: [] };
  }
  if (!STOREFRONT_SUBDOMAIN_PATTERN.test(normalized)) {
    return { status: 'unavailable', reason: 'invalid_format', message: REASON_MESSAGES.invalid_format, suggestions: [] };
  }
  if (isAllNumericStorefrontSubdomain(normalized)) {
    return {
      status: 'unavailable',
      reason: 'all_numeric',
      message: REASON_MESSAGES.all_numeric,
      suggestions: buildSuggestions(normalized),
    };
  }
  if (RESERVED_STOREFRONT_SUBDOMAINS.has(normalized)) {
    return {
      status: 'unavailable',
      reason: 'reserved',
      message: REASON_MESSAGES.reserved,
      suggestions: buildSuggestions(normalized),
    };
  }
  return null;
}

type AsyncCheckResult =
  | { kind: 'result'; normalizedSlug: string; available: boolean; reason: SlugAvailabilityReason }
  | { kind: 'error'; normalizedSlug: string };

// Debounced, race-safe slug availability check for the superadmin store
// form. Client-side reasons resolve with zero network calls (see
// computeSyntheticState above); only a structurally valid candidate
// reaches check_store_slug_availability, which is the actual authority.
//
// "checking" is never set via setState — it's whatever the render
// derives when there is no asyncResult yet for the CURRENT normalized
// value. A slow response for an older keystroke lands with a
// normalizedSlug that no longer matches the latest `normalized`, so it
// is simply ignored by that same comparison — no manual request-id
// bookkeeping needed. Every actual setState call lives inside the
// .then()/.catch() below (a genuine async external callback), not
// synchronously in the effect body.
export function useSlugAvailability(rawSlug: string, debounceMs = 400): SlugAvailabilityState {
  const trimmedRaw = rawSlug.trim();
  const normalized = trimmedRaw ? normalizeStorefrontSubdomain(trimmedRaw) : '';
  const syntheticState = computeSyntheticState(normalized, trimmedRaw);
  const needsAsyncCheck = syntheticState === null;

  const [asyncResult, setAsyncResult] = useState<AsyncCheckResult | null>(null);

  useEffect(() => {
    if (!needsAsyncCheck) return;

    // React calls this run's cleanup automatically before the next effect
    // run (dependencies changed) and on unmount — that alone is enough to
    // discard a stale in-flight request, no manual ref bookkeeping needed.
    let cancelled = false;

    const timer = setTimeout(() => {
      storesService.checkSlugAvailability(normalized)
        .then((result) => {
          if (cancelled) return;
          setAsyncResult({
            kind: 'result',
            normalizedSlug: result.normalizedSlug,
            available: result.available,
            reason: result.reason,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setAsyncResult({ kind: 'error', normalizedSlug: normalized });
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsAsyncCheck, normalized, debounceMs]);

  const asyncState = useMemo<SlugAvailabilityState>(() => {
    if (!asyncResult || asyncResult.normalizedSlug !== normalized) return CHECKING_STATE;
    if (asyncResult.kind === 'error') return ERROR_STATE;
    return {
      status: asyncResult.available ? 'available' : 'unavailable',
      reason: asyncResult.reason,
      message: REASON_MESSAGES[asyncResult.reason] ?? null,
      suggestions: asyncResult.available ? [] : buildSuggestions(asyncResult.normalizedSlug),
    };
  }, [asyncResult, normalized]);

  return syntheticState ?? asyncState;
}
