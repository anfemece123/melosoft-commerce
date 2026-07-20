-- ============================================================
-- Migration 069 — cleanup of the Home Builder verification fixture (068)
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
  v_once_store_id  uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';
  SELECT id INTO v_once_store_id FROM public.stores WHERE slug = 'once';

  -- store_home_section_items cascades on section delete.
  DELETE FROM public.store_home_sections
  WHERE store_id IN (v_padel_store_id, v_once_store_id)
    AND (heading LIKE '[FIXTURE]%' OR section_type = 'hero');

  RAISE NOTICE 'Home Builder fixture cleaned up';
END $$;
