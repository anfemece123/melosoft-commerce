-- ============================================================
-- Manual verification for migration 095 (per-location schedules).
--
-- Run after replacing OWNER_ID_HERE with an existing auth.users UUID.
-- The whole verification is transactional and ends with ROLLBACK.
-- It covers: regular hours, split shifts, overnight hours, exceptions,
-- manual pause, expired pause, always-open ecommerce, the order trigger,
-- and the trusted online-payment webhook exemption.
-- ============================================================

BEGIN;

INSERT INTO public.stores (
  id, owner_id, name, slug, description, whatsapp_number,
  country, city, currency, status, business_vertical
) VALUES (
  '00000095-1111-1111-1111-111111111111', 'OWNER_ID_HERE',
  'Test Horarios 095', 'test-horarios-095', 'Prueba temporal.',
  '+57 300 000 0095', 'CO', 'Bogotá', 'COP', 'active', 'food_restaurant'
);

INSERT INTO public.store_locations (
  id, store_id, name, is_primary, is_active, timezone, order_schedule_mode
) VALUES (
  '00000095-2222-2222-2222-222222222222',
  '00000095-1111-1111-1111-111111111111',
  'Sede de prueba', true, true, 'America/Bogota', 'same_as_business'
);

-- Monday: 09:00–12:00 and 14:00–17:00 (split shift).
INSERT INTO public.location_schedule_intervals (
  store_id, location_id, schedule_kind, day_of_week,
  starts_at, ends_at, sort_order
) VALUES
  ('00000095-1111-1111-1111-111111111111', '00000095-2222-2222-2222-222222222222', 'business', 1, '09:00', '12:00', 0),
  ('00000095-1111-1111-1111-111111111111', '00000095-2222-2222-2222-222222222222', 'business', 1, '14:00', '17:00', 1);

DO $$
BEGIN
  -- 2026-07-20 is Monday. Bogotá is UTC-5.
  IF NOT (public.get_location_schedule_status(
    '00000095-2222-2222-2222-222222222222', 'business', '2026-07-20 15:00:00+00'
  )->>'is_open')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: Monday 10:00 local should be open';
  END IF;

  IF (public.get_location_schedule_status(
    '00000095-2222-2222-2222-222222222222', 'business', '2026-07-20 17:30:00+00'
  )->>'is_open')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: Monday 12:30 local should be closed for the split';
  END IF;

  IF NOT (public.get_location_schedule_status(
    '00000095-2222-2222-2222-222222222222', 'business', '2026-07-20 20:00:00+00'
  )->>'is_open')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: Monday 15:00 local should be open';
  END IF;
END;
$$;

-- Dedicated ordering schedule: Friday 20:00 through Saturday 02:00.
UPDATE public.store_locations
SET order_schedule_mode = 'custom'
WHERE id = '00000095-2222-2222-2222-222222222222';

INSERT INTO public.location_schedule_intervals (
  store_id, location_id, schedule_kind, day_of_week,
  starts_at, ends_at, ends_next_day, sort_order
) VALUES (
  '00000095-1111-1111-1111-111111111111',
  '00000095-2222-2222-2222-222222222222',
  'ordering', 5, '20:00', '02:00', true, 0
);

DO $$
BEGIN
  IF NOT (public.get_location_order_status(
    '00000095-2222-2222-2222-222222222222', '2026-07-25 06:00:00+00'
  )->>'is_accepting_orders')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: Saturday 01:00 local should inherit Friday overnight hours';
  END IF;

  IF (public.get_location_order_status(
    '00000095-2222-2222-2222-222222222222', '2026-07-25 08:00:00+00'
  )->>'is_accepting_orders')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: Saturday 03:00 local should be closed';
  END IF;
END;
$$;

-- A date exception replaces the weekly business hours for that date.
UPDATE public.store_locations
SET order_schedule_mode = 'same_as_business'
WHERE id = '00000095-2222-2222-2222-222222222222';

INSERT INTO public.location_schedule_exceptions (
  store_id, location_id, schedule_kind, exception_date, is_closed, note
) VALUES (
  '00000095-1111-1111-1111-111111111111',
  '00000095-2222-2222-2222-222222222222',
  'business', '2026-07-20', true, 'Festivo de prueba'
);

DO $$
BEGIN
  IF (public.get_location_order_status(
    '00000095-2222-2222-2222-222222222222', '2026-07-20 15:00:00+00'
  )->>'is_accepting_orders')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: closed exception must override weekly hours';
  END IF;
END;
$$;

-- Manual pause wins even when ecommerce is configured for 24/7.
UPDATE public.store_locations
SET order_schedule_mode = 'always_open',
    orders_paused = true,
    orders_paused_until = '2026-07-21 00:00:00+00'
WHERE id = '00000095-2222-2222-2222-222222222222';

DO $$
BEGIN
  IF (public.get_location_order_status(
    '00000095-2222-2222-2222-222222222222', '2026-07-20 15:00:00+00'
  )->>'status_code') <> 'paused' THEN
    RAISE EXCEPTION 'TEST FAILED: active manual pause should win';
  END IF;

  IF NOT (public.get_location_order_status(
    '00000095-2222-2222-2222-222222222222', '2026-07-22 15:00:00+00'
  )->>'is_accepting_orders')::boolean THEN
    RAISE EXCEPTION 'TEST FAILED: expired pause should fall back to always-open mode';
  END IF;
END;
$$;

-- The orders trigger rejects an untrusted web order while paused.
UPDATE public.store_locations
SET orders_paused = true, orders_paused_until = NULL
WHERE id = '00000095-2222-2222-2222-222222222222';

DO $$
BEGIN
  BEGIN
    INSERT INTO public.orders (
      store_id, store_location_id, customer_name, customer_phone,
      source, payment_method, fulfillment_method
    ) VALUES (
      '00000095-1111-1111-1111-111111111111',
      '00000095-2222-2222-2222-222222222222',
      'Pedido bloqueado', '3000000095', 'web', 'cash_on_delivery', 'pickup'
    );
    RAISE EXCEPTION 'TEST FAILED: paused COD order was not blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ORDERING_PAUSED%' THEN RAISE; END IF;
  END;
END;
$$;

-- A trusted service-role online insert represents a payment already
-- approved by the webhook and must still be honored after hours.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.orders (
  store_id, store_location_id, customer_name, customer_phone,
  source, payment_method, fulfillment_method
) VALUES (
  '00000095-1111-1111-1111-111111111111',
  '00000095-2222-2222-2222-222222222222',
  'Pago ya aprobado', '3000000096', 'web', 'online', 'pickup'
);

SELECT set_config('request.jwt.claim.role', '', true);

-- EXPECT: one row, belonging only to the trusted online insert.
SELECT customer_name, payment_method
FROM public.orders
WHERE store_id = '00000095-1111-1111-1111-111111111111';

ROLLBACK;
