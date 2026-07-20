-- ============================================================
-- Migration 076 — cleanup of the canvas verification fixture (075)
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';

  DELETE FROM public.store_home_sections
  WHERE store_id = v_padel_store_id AND heading LIKE '[FIXTURE]%';

  RAISE NOTICE 'Canvas verification fixture cleaned up';
END $$;
