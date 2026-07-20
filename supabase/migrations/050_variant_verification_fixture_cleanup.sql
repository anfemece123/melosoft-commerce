-- ============================================================
-- Migration 050 — cleanup of the 049 verification fixture
--
-- Removes the 3 temporary [FIXTURE] products created in 049 to
-- verify variant filtering end-to-end against real data. Variant
-- options/values/variants/selected_values all cascade from the
-- product delete (ON DELETE CASCADE, see 042-044).
-- ============================================================

DELETE FROM public.products
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND slug IN (
    'fixture-zapato-tono-talla-test-1',
    'fixture-zapato-tono-talla-test-2',
    'fixture-zapato-color-dedup-test'
  );
