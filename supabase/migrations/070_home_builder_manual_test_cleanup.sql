-- ============================================================
-- Migration 070 — cleanup of a manual Home Builder QA test
--
-- The user manually created + edited one "promo_banners" section on
-- padel-shop through the real admin UI while validating the feature
-- (confirmed with the user before deleting). Removing it so no test
-- data is left behind in a real store.
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';

  -- store_home_section_items cascades on section delete.
  DELETE FROM public.store_home_sections
  WHERE store_id = v_padel_store_id
    AND section_type = 'promo_banners'
    AND heading = 'Promociones';

  RAISE NOTICE 'Manual Home Builder QA test section removed from padel-shop';
END $$;
