-- ============================================================
-- Migration 075 — TEMPORARY verification fixture
--
-- Verifies the public composition (portada + Home Builder sections +
-- ofertas + WhatsApp) still holds after the admin canvas/drag-and-drop
-- rework, and that a sort_order change (what reorderStoreHomeSections
-- would persist from a drag) is reflected in the public render order.
-- Followed by 076, which deletes everything created here.
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
  v_sec_a uuid := gen_random_uuid();
  v_sec_b uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';
  IF v_padel_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store padel-shop not found — aborting';
  END IF;

  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES
    (v_sec_a, v_padel_store_id, 'testimonials', 0, true, '[FIXTURE] A - Testimonios', '{"layout":"grid"}'::jsonb),
    (v_sec_b, v_padel_store_id, 'benefits', 1, true, '[FIXTURE] B - Beneficios', '{}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, rating)
  VALUES (v_sec_a, v_padel_store_id, 0, true, '[FIXTURE] Cliente', 'Muy bien.', 5);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, link_url)
  VALUES (v_sec_b, v_padel_store_id, 0, true, '[FIXTURE] Envíos', 'A todo el país', 'truck');

  RAISE NOTICE 'Fixture sections: A=% (sort 0), B=% (sort 1)', v_sec_a, v_sec_b;
END $$;
