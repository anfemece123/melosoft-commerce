-- ============================================================
-- Migration 144 — expose product videos through a safe public view
--
-- product_videos contains internal ownership and storage metadata.  It must
-- not be queried directly by anon.  The old public RLS policy also evaluated
-- products/stores as anon and could fail with 42501.  Keep the table private
-- and expose only the playback fields through an owner-run view.
-- ============================================================

CREATE OR REPLACE VIEW public.public_product_videos
  WITH (security_invoker = false)
AS
SELECT
  video.product_id,
  video.video_url,
  video.mime_type,
  video.duration_seconds,
  video.width,
  video.height
FROM public.product_videos video
JOIN public.products product ON product.id = video.product_id
JOIN public.stores store ON store.id = video.store_id
WHERE store.status = 'active'
  AND product.status = 'active'
  AND product.is_available = true
  AND product.show_in_ecommerce = true;

GRANT SELECT ON public.public_product_videos TO anon, authenticated;

-- The public boundary is the view above.  Authenticated catalog managers
-- retain their existing table privileges and RLS policies.
REVOKE SELECT ON public.product_videos FROM anon, public;

COMMENT ON VIEW public.public_product_videos IS
  'Safe playback metadata for active ecommerce products; ownership and storage paths are never public.';
