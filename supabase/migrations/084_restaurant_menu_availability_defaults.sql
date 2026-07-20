-- Restaurant dishes are normally prepared on demand. Historically the
-- admin form created them with track_inventory=true and stock=0 while
-- hiding the inventory controls, which made valid dishes appear sold out.
--
-- Only simple menu items at exactly zero are repaired. Variants are not
-- changed because a zero recorded for one specific size/presentation may
-- be an intentional sold-out state.

UPDATE public.products
SET
  track_inventory = false,
  updated_at = now()
WHERE product_type = 'menu_item'
  AND has_variants = false
  AND track_inventory = true
  AND stock = 0;
