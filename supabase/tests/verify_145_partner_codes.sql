-- ============================================================
-- Manual verification plan for migration 145
-- Partner/influencer codes, discounts, reservations and commissions.
--
-- Run only against a staging project after migration 145 is applied.
-- Replace OWNER_ID_HERE with a real auth.users id from that project.
-- The SQL editor/service role is required for the service-only RPCs.
-- All rows use the 00000145-* prefix and are removed at the end.
-- ============================================================

BEGIN;

INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES (
  '00000145-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
  'Test Partners 145', 'test-partners-145', 'Migration verification store.',
  '+57 300 000 0145', 'CO', 'Bogotá', 'COP', 'active'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.store_limits
SET can_use_partner_codes = true
WHERE store_id = '00000145-1111-1111-1111-111111111111';

INSERT INTO public.store_partners (id, store_id, name, email)
VALUES (
  '00000145-2222-2222-2222-222222222222',
  '00000145-1111-1111-1111-111111111111',
  'Influencer 145', 'partner145@example.com'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_partner_codes (
  id, store_id, partner_id, code,
  discount_type, discount_value,
  commission_type, commission_value
)
VALUES (
  '00000145-3333-3333-3333-333333333333',
  '00000145-1111-1111-1111-111111111111',
  '00000145-2222-2222-2222-222222222222',
  'INFLUENCER145', 'percentage', 10, 'percentage', 10
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- EXPECT: valid=true, code=INFLUENCER145, discount_amount=10000.
SELECT public.preview_partner_code('test-partners-145', ' influencer145 ', 100000);

INSERT INTO public.checkout_sessions (
  id, store_id, store_slug, provider, provider_reference,
  amount_in_cents, status, customer_name, customer_phone,
  subtotal_amount, shipping_amount, total_amount, checkout_url, expires_at
)
VALUES (
  '00000145-4444-4444-4444-444444444444',
  '00000145-1111-1111-1111-111111111111', 'test-partners-145', 'wompi',
  'CS-TEST-145-001', 11000000, 'created', 'Cliente 145', '3000000145',
  100000, 10000, 110000, 'https://example.com/checkout-145', now() + interval '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Service-only RPC. EXPECT: discount=10000, commission_base=90000,
-- commission=9000, and session total/amount=100000 / 10000000.
SELECT public.reserve_partner_code_for_checkout(
  '00000145-4444-4444-4444-444444444444', 'INFLUENCER145', '3000000145', NULL
);
SELECT total_amount, amount_in_cents, partner_discount_amount, partner_commission_amount
FROM public.checkout_sessions
WHERE id = '00000145-4444-4444-4444-444444444444';

-- EXPECT: the reserved redemption is released and no longer consumes usage.
UPDATE public.checkout_sessions
SET status = 'declined'
WHERE id = '00000145-4444-4444-4444-444444444444';
SELECT status
FROM public.partner_code_redemptions
WHERE checkout_session_id = '00000145-4444-4444-4444-444444444444';

-- COD path. The service-only RPC applies the same server-side pricing and
-- writes the order attribution plus the pending commission atomically.
INSERT INTO public.orders (
  id, store_id, customer_name, customer_phone, subtotal, shipping_amount,
  total_amount, currency, status, payment_status, source, payment_method,
  fulfillment_method
)
VALUES (
  '00000145-5555-5555-5555-555555555555',
  '00000145-1111-1111-1111-111111111111', 'Cliente COD 145', '3000000146',
  100000, 10000, 110000, 'COP', 'pending', 'pending', 'web', 'cash_on_delivery', 'pickup'
);

SELECT public.apply_partner_code_to_order(
  '00000145-5555-5555-5555-555555555555', 'INFLUENCER145'
);
SELECT discount_amount, total_amount, partner_code, partner_name
FROM public.orders
WHERE id = '00000145-5555-5555-5555-555555555555';
SELECT status, commission_amount
FROM public.partner_commissions
WHERE order_id = '00000145-5555-5555-5555-555555555555';
-- EXPECT: order discount=10000, total=100000, partner_code=INFLUENCER145,
-- partner_name=Influencer 145, commission status=pending, amount=9000.

-- EXPECT: cancellation reverses the payable commission and redemption.
UPDATE public.orders
SET status = 'cancelled'
WHERE id = '00000145-5555-5555-5555-555555555555';
SELECT status FROM public.partner_commissions
WHERE order_id = '00000145-5555-5555-5555-555555555555';
SELECT status FROM public.partner_code_redemptions
WHERE order_id = '00000145-5555-5555-5555-555555555555';

-- Cleanup.
DELETE FROM public.partner_commissions WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.partner_code_redemptions WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.orders WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.checkout_sessions WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.store_partner_codes WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.store_partners WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.store_limits WHERE store_id = '00000145-1111-1111-1111-111111111111';
DELETE FROM public.stores WHERE id = '00000145-1111-1111-1111-111111111111';

COMMIT;
