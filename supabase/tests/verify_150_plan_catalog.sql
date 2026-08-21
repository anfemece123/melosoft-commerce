-- Manual verification plan for migration 150.
-- Run after applying the migration as a platform admin.

-- 1. Plans are seeded and editable.
SELECT plan_key, name, max_products, max_staff, max_active_offers
FROM public.subscription_plans
ORDER BY sort_order;

-- 2. Editing a plan synchronizes capacity to companies assigned to it.
-- UPDATE public.subscription_plans SET max_products = 25 WHERE plan_key = 'basic';
-- SELECT store_id, plan_key, max_products FROM public.store_limits WHERE plan_key = 'basic';

-- 3. Assign a plan by copying its capacity to a company.
-- UPDATE public.store_limits sl
-- SET max_products = p.max_products,
--     max_staff = p.max_staff,
--     max_active_offers = p.max_active_offers,
--     max_monthly_orders = p.max_monthly_orders,
--     plan_key = p.plan_key
-- FROM public.subscription_plans p
-- WHERE sl.store_id = '<store-id>' AND p.plan_key = 'pro';

-- 4. A non-archived product insert beyond max_products must fail with
--    SQLSTATE 23514. Archiving a product must free one slot.
