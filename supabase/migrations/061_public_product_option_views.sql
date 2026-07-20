-- ============================================================
-- Migration 061 — real public views for product option groups/items
--
-- Migration 060's plain GRANT was necessary but not sufficient:
-- "Public can view active product option groups/items" RLS checks
-- `EXISTS (SELECT 1 FROM products ...)`, and `products` itself has
-- never been anon-readable (by design — the storefront always reads
-- product data through security-definer views like
-- public_product_pages/public_product_images, never the raw table).
-- A direct anon SELECT on product_option_groups therefore still
-- fails one level deeper, on `products`.
--
-- Fix: same pattern as public_product_images (security_invoker =
-- false) — a view that runs with elevated rights internally, doing
-- the active-product/active-store check itself, so anon never needs
-- direct access to `products`/`stores`.
--
-- public_product_option_items denormalizes product_id (not just
-- group_id) so the client can query it directly by product without
-- relying on PostgREST's embedded-relationship syntax, which needs
-- real foreign keys and doesn't reliably work through views.
-- ============================================================

CREATE VIEW public.public_product_option_groups
  WITH (security_invoker = false)
AS
SELECT
  g.id,
  g.product_id,
  g.name,
  g.description,
  g.selection_type,
  g.min_select,
  g.max_select,
  g.is_required,
  g.sort_order
FROM public.product_option_groups g
JOIN public.products p ON p.id = g.product_id
JOIN public.stores s ON s.id = p.store_id
WHERE g.is_active = true
  AND p.status = 'active'
  AND p.is_available = true
  AND s.status = 'active';

GRANT SELECT ON public.public_product_option_groups TO anon, authenticated;

CREATE VIEW public.public_product_option_items
  WITH (security_invoker = false)
AS
SELECT
  i.id,
  i.group_id,
  g.product_id,
  i.label,
  i.description,
  i.price_delta,
  i.is_default,
  i.sort_order
FROM public.product_option_items i
JOIN public.product_option_groups g ON g.id = i.group_id
JOIN public.products p ON p.id = g.product_id
JOIN public.stores s ON s.id = p.store_id
WHERE i.is_active = true
  AND g.is_active = true
  AND p.status = 'active'
  AND p.is_available = true
  AND s.status = 'active';

GRANT SELECT ON public.public_product_option_items TO anon, authenticated;
