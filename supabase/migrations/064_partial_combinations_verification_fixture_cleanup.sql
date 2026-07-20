-- ============================================================
-- Migration 064 — cleanup of the 063 verification fixture.
-- ============================================================

DELETE FROM public.products
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND slug = 'fixture-zapato-combinaciones-reales-test';
