-- 150 — Editable platform plan catalog and database-level product quota.
-- Plans define capacity. Per-company feature flags remain in store_limits so
-- Super Admin can still enable/disable optional modules independently.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key              text        NOT NULL UNIQUE,
  name                  text        NOT NULL,
  description           text        NOT NULL DEFAULT '',
  max_products          integer     NOT NULL,
  max_staff             integer     NOT NULL,
  max_active_offers     integer     NOT NULL,
  max_monthly_orders    integer,
  is_active             boolean     NOT NULL DEFAULT true,
  sort_order            integer     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscription_plans_key_valid CHECK (plan_key ~ '^[a-z][a-z0-9_]{1,31}$'),
  CONSTRAINT subscription_plans_max_products_ok CHECK (max_products >= 0),
  CONSTRAINT subscription_plans_max_staff_ok CHECK (max_staff >= 0),
  CONSTRAINT subscription_plans_max_offers_ok CHECK (max_active_offers >= 0),
  CONSTRAINT subscription_plans_max_orders_ok CHECK (max_monthly_orders IS NULL OR max_monthly_orders >= 0)
);

COMMENT ON TABLE public.subscription_plans IS
  'Editable capacity plans managed by platform_admin. Feature entitlements remain per store in store_limits.';

-- The API grant migration runs before this table exists, so this table needs
-- its own Data API privileges. RLS below still restricts every operation to
-- platform administrators.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.subscription_plans
  (plan_key, name, description, max_products, max_staff, max_active_offers, max_monthly_orders, sort_order)
VALUES
  ('basic', 'Basic', 'Para comenzar con un catálogo esencial.', 20, 2, 5, NULL, 10),
  ('pro', 'Pro', 'Más capacidad para empresas en crecimiento.', 100, 5, 20, NULL, 20),
  ('premium', 'Premium', 'Capacidad amplia para operaciones consolidadas.', 500, 15, 100, NULL, 30),
  ('custom', 'Personalizado', 'Límites definidos especialmente para esta empresa.', 20, 2, 5, NULL, 40)
ON CONFLICT (plan_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_store_limits_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.store_limits
  SET
    max_products = NEW.max_products,
    max_staff = NEW.max_staff,
    max_active_offers = NEW.max_active_offers,
    max_monthly_orders = NEW.max_monthly_orders
  WHERE plan_key = NEW.plan_key;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_sync_limits ON public.subscription_plans;
CREATE TRIGGER subscription_plans_sync_limits
  AFTER UPDATE OF max_products, max_staff, max_active_offers, max_monthly_orders
  ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.sync_store_limits_from_plan();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_select_platform_admin" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select_platform_admin" ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "subscription_plans_insert_platform_admin" ON public.subscription_plans;
CREATE POLICY "subscription_plans_insert_platform_admin" ON public.subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "subscription_plans_update_platform_admin" ON public.subscription_plans;
CREATE POLICY "subscription_plans_update_platform_admin" ON public.subscription_plans
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "subscription_plans_delete_platform_admin" ON public.subscription_plans;
CREATE POLICY "subscription_plans_delete_platform_admin" ON public.subscription_plans
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

-- Client-side guards are useful feedback, but this trigger makes the quota
-- authoritative for direct API calls and concurrent product creation too.
CREATE OR REPLACE FUNCTION public.enforce_store_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_products integer;
  v_current_products integer;
BEGIN
  IF COALESCE(NEW.status, 'active') = 'archived' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.store_id = NEW.store_id
     AND COALESCE(OLD.status, 'active') <> 'archived' THEN
    RETURN NEW;
  END IF;

  SELECT max_products
    INTO v_max_products
    FROM public.store_limits
   WHERE store_id = NEW.store_id
   FOR UPDATE;

  IF v_max_products IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO v_current_products
    FROM public.products
   WHERE store_id = NEW.store_id
     AND COALESCE(status, 'active') <> 'archived'
     AND id <> NEW.id;

  IF v_current_products >= v_max_products THEN
    RAISE EXCEPTION 'Se alcanzó el límite de productos del plan (%).', v_max_products
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_enforce_store_limit ON public.products;
CREATE TRIGGER products_enforce_store_limit
  BEFORE INSERT OR UPDATE OF store_id, status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_store_product_limit();
