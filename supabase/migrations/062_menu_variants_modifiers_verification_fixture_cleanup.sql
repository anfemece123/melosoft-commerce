-- ============================================================
-- Migration 062 — cleanup of the 059 verification fixture.
-- Deleting the product cascades variant options/values/variants/
-- selected_values and option_groups/items (all ON DELETE CASCADE
-- from product_id).
-- ============================================================

DELETE FROM public.products
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'once')
  AND slug = 'fixture-hamburguesa-clasica-test';
