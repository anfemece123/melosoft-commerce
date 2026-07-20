ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_method_valid;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_method_valid
  CHECK (fulfillment_method IN ('delivery', 'pickup', 'local_delivery', 'national_shipping'));

ALTER TABLE public.orders
  ALTER COLUMN fulfillment_method SET DEFAULT 'local_delivery';

ALTER TABLE public.checkout_sessions
  ALTER COLUMN fulfillment_method SET DEFAULT 'local_delivery';
