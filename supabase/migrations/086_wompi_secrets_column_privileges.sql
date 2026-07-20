-- ============================================================
-- Migration 086 — Stop exposing real Wompi secrets to the frontend
--
-- store_payment_settings.private_key_reference, integrity_secret_reference
-- and events_secret hold the REAL Wompi secrets (despite the "_reference"
-- naming — they are read directly by the Edge Functions, never resolved
-- against an env var). Until now, `authenticated` had table-wide SELECT
-- on this table (migration 030), so the store owner's browser received
-- these raw secrets on every load of the Payments settings page, even
-- though the UI only ever displayed a masked version. That violates the
-- "Wompi private keys never reach the frontend" rule.
--
-- This migration:
--   1. Adds generated columns that expose only what the UI actually
--      needs — whether each secret is configured, and a masked preview
--      (last 4 chars) — computed by Postgres, never the raw value.
--   2. Revokes table-wide SELECT from `authenticated` and re-grants it
--      only on the safe + generated columns, so the three raw secret
--      columns can no longer be read by the frontend at all (not just
--      hidden by the UI — actually unreadable via the REST API).
--
-- Unaffected:
--   - INSERT/UPDATE grants (store owners can still SET a new secret,
--     they just can't read an existing one back).
--   - service_role (Edge Functions) — GRANT ALL PRIVILEGES from
--     migration 030 already covers the whole table, including any
--     column added later, so wompi-webhook and create-wompi-payment
--     keep full access with no change needed.
--   - Row-level security — ownership scoping is untouched, this only
--     adds a column-level restriction on top of it.
-- ============================================================

-- ── 1. Masked preview + presence columns (computed, never raw) ──

ALTER TABLE public.store_payment_settings
  ADD COLUMN IF NOT EXISTS has_private_key boolean
    GENERATED ALWAYS AS (private_key_reference IS NOT NULL AND private_key_reference <> '') STORED,
  ADD COLUMN IF NOT EXISTS has_integrity_secret boolean
    GENERATED ALWAYS AS (integrity_secret_reference IS NOT NULL AND integrity_secret_reference <> '') STORED,
  ADD COLUMN IF NOT EXISTS has_events_secret boolean
    GENERATED ALWAYS AS (events_secret IS NOT NULL AND events_secret <> '') STORED,
  ADD COLUMN IF NOT EXISTS private_key_preview text
    GENERATED ALWAYS AS (
      CASE
        WHEN private_key_reference IS NULL OR private_key_reference = '' THEN NULL
        WHEN length(private_key_reference) <= 6 THEN '••••••'
        ELSE '••••••••' || right(private_key_reference, 4)
      END
    ) STORED,
  ADD COLUMN IF NOT EXISTS integrity_secret_preview text
    GENERATED ALWAYS AS (
      CASE
        WHEN integrity_secret_reference IS NULL OR integrity_secret_reference = '' THEN NULL
        WHEN length(integrity_secret_reference) <= 6 THEN '••••••'
        ELSE '••••••••' || right(integrity_secret_reference, 4)
      END
    ) STORED,
  ADD COLUMN IF NOT EXISTS events_secret_preview text
    GENERATED ALWAYS AS (
      CASE
        WHEN events_secret IS NULL OR events_secret = '' THEN NULL
        WHEN length(events_secret) <= 6 THEN '••••••'
        ELSE '••••••••' || right(events_secret, 4)
      END
    ) STORED;

-- ── 2. Restrict SELECT to safe + generated columns only ─────────
-- Table-wide REVOKE first — a column-level REVOKE alone would NOT
-- override the existing table-wide GRANT from migration 030.

REVOKE SELECT ON public.store_payment_settings FROM authenticated;

GRANT SELECT (
  id, store_id, provider_id, public_key, environment, is_active,
  created_at, updated_at,
  has_private_key, has_integrity_secret, has_events_secret,
  private_key_preview, integrity_secret_preview, events_secret_preview
) ON public.store_payment_settings TO authenticated;
