-- ============================================================
-- Migration 071 — TEMPORARY verification fixture
--
-- Purpose: prove anon reads active Home Builder sections but NOT inactive
-- ones through the public views (RLS + view WHERE clause). One active +
-- one inactive row on padel-shop. Followed by 072, which deletes both.
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';
  IF v_padel_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store padel-shop not found — aborting';
  END IF;

  INSERT INTO public.store_home_sections (store_id, section_type, sort_order, is_active, heading, content)
  VALUES
    (v_padel_store_id, 'testimonials', 0, true,  '[FIXTURE] Sección activa', '{}'::jsonb),
    (v_padel_store_id, 'testimonials', 1, false, '[FIXTURE] Sección inactiva', '{}'::jsonb);
END $$;
