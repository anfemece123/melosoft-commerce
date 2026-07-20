-- ============================================================
-- Migration 074 — cleanup of the Home Builder v2 verification fixture (073)
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
  v_once_store_id  uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';
  SELECT id INTO v_once_store_id FROM public.stores WHERE slug = 'once';

  DELETE FROM public.store_home_sections
  WHERE store_id IN (v_padel_store_id, v_once_store_id)
    AND heading LIKE '[FIXTURE]%';

  DELETE FROM public.store_product_categories
  WHERE store_id = v_padel_store_id AND slug = 'fixture-hombre';

  RAISE NOTICE 'Home Builder v2 fixture cleaned up';
END $$;
