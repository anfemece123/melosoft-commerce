-- ============================================================
-- Migration 077 — Home Builder: "Catálogo de productos" section
--
-- Adds a new section_type ('catalog_products') so a store can show a
-- limited, ordered sample of its full catalog on the homepage, with a
-- CTA to the full /s/:storeSlug/catalog. Purely additive:
--
-- 1. store_home_sections.section_type check constraint gains
--    'catalog_products' as a valid value. The constraint is located
--    dynamically (by column, not by a guessed name) and re-created
--    with an explicit name so future migrations can target it safely.
-- 2. public_product_pages gains `product_created_at` (appended at the
--    end of the SELECT list — CREATE OR REPLACE VIEW only allows
--    appending columns, never reordering/removing existing ones) so
--    the new section's "recientes" sort order has a real signal to
--    sort by. Every other column/join/filter is byte-for-byte the
--    same as migration 053 (the view's last full definition).
-- ============================================================

-- ── 1. section_type: add 'catalog_products' ────────────────────

do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.store_home_sections'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%section_type%'
  loop
    execute format('alter table public.store_home_sections drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.store_home_sections
  add constraint store_home_sections_section_type_check
  check (section_type in (
    'hero',
    'promo_banners',
    'featured_products',
    'featured_categories',
    'testimonials',
    'image_text',
    'featured_collections',
    'menu_highlights',
    'benefits',
    'gallery',
    'catalog_products'
  ));

-- ── 2. public_product_pages — additive `product_created_at` ────

CREATE OR REPLACE VIEW public.public_product_pages AS
SELECT
  s.slug                                    AS store_slug,
  s.name                                    AS store_name,
  s.whatsapp_number                         AS store_whatsapp_number,
  s.logo_url,
  t.mode                                    AS theme_mode,
  t.primary_color,
  t.secondary_color,
  t.accent_color,
  t.background_color,
  t.text_color,
  t.button_radius,
  t.template_key,
  c.whatsapp_checkout_enabled,
  c.web_order_enabled,
  c.allows_pickup,
  c.allows_local_delivery,
  c.commerce_mode,
  c.catalog_type,
  pr.id                                     AS product_id,
  pr.slug                                   AS product_slug,
  pr.name                                   AS product_name,
  pr.description,
  pr.short_description,
  pr.description_sections,
  pr.product_type,
  pr.regular_price,
  pr.compare_at_price,
  pr.sale_price,
  pr.stock,
  pr.track_inventory,
  pr.is_featured,
  pr.is_available,
  pr.preparation_time_minutes,
  pr.allows_special_instructions,
  pr.special_instructions_label,
  pr.special_instructions_placeholder,
  pr.special_instructions_max_length,
  COALESCE(img.image_url, pr.main_image_url) AS main_image_url,
  pr.category,
  pr.category_id,
  cat.name                                  AS category_name,
  cat.slug                                  AS category_slug,
  cat.parent_id                             AS category_parent_id,
  COALESCE(collections.items, '[]'::jsonb)  AS collections,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'facet_id',    pfv.facet_id,
          'facet_name',  pfv.facet_name,
          'facet_slug',  pfv.facet_slug,
          'input_type',  pfv.input_type,
          'value_id',    pfv.facet_value_id,
          'value',       pfv.value,
          'value_slug',  pfv.value_slug
        )
        ORDER BY pfv.facet_name, pfv.value
      )
      FROM public.public_product_facet_values pfv
      WHERE pfv.product_id = pr.id
    ),
    '[]'::jsonb
  )                                          AS facet_values,
  pr.has_variants,
  pr.show_variants_as_cards,
  sc.size_chart,
  COALESCE(voptions.items, '[]'::jsonb)     AS variant_options,
  COALESCE(variants.items, '[]'::jsonb)     AS variants,
  pr.created_at                             AS product_created_at
FROM public.products pr
JOIN public.stores s
  ON s.id = pr.store_id
LEFT JOIN public.store_theme_settings t
  ON t.store_id = s.id
LEFT JOIN public.store_commerce_settings c
  ON c.store_id = s.id
LEFT JOIN public.store_product_categories cat
  ON cat.id = pr.category_id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM public.product_images pi
  WHERE pi.product_id = pr.id AND pi.variant_id IS NULL AND pi.option_value_id IS NULL
  ORDER BY pi.is_primary DESC, pi.sort_order ASC
  LIMIT 1
) img ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',   col.id,
      'name', col.name,
      'slug', col.slug
    )
    ORDER BY col.sort_order ASC, col.name ASC, col.id ASC
  ) AS items
  FROM public.product_collections pc
  JOIN public.store_product_collections col
    ON col.id = pc.collection_id
  WHERE pc.product_id = pr.id
    AND col.is_active = true
) collections ON true
LEFT JOIN LATERAL (
  SELECT jsonb_build_object(
    'id',        psc.id,
    'name',      psc.name,
    'chartType', psc.chart_type,
    'unit',      psc.unit,
    'content',   psc.content
  ) AS size_chart
  FROM public.product_size_charts psc
  WHERE psc.id = pr.size_chart_id AND psc.is_active = true
) sc ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                vo.id,
      'name',              vo.name,
      'type',              vo.type,
      'useAsPublicFilter', vo.use_as_public_filter,
      'controlsMedia',     vo.controls_media,
      'sortOrder',         vo.sort_order,
      'values', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',              vov.id,
            'value',           vov.value,
            'normalizedValue', vov.normalized_value,
            'colorHex',        vov.color_hex,
            'images', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'imageUrl',  vovi.image_url,
                  'altText',   vovi.alt_text,
                  'sortOrder', vovi.sort_order,
                  'isPrimary', vovi.is_primary
                ) ORDER BY vovi.is_primary DESC, vovi.sort_order ASC
              )
              FROM public.product_images vovi
              WHERE vovi.option_value_id = vov.id
            ), '[]'::jsonb)
          ) ORDER BY vov.sort_order, vov.value
        )
        FROM public.product_variant_option_values vov
        WHERE vov.option_id = vo.id AND vov.is_active = true
      ), '[]'::jsonb)
    ) ORDER BY vo.sort_order, vo.name
  ) AS items
  FROM public.product_variant_options vo
  WHERE vo.product_id = pr.id AND vo.is_active = true
) voptions ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             pv.id,
      'sku',            pv.sku,
      'price',          pv.price,
      'compareAtPrice', pv.compare_at_price,
      'stockQuantity',  pv.stock_quantity,
      'stockPolicy',    pv.stock_policy,
      'isDefault',      pv.is_default,
      'imageUrl', (
        SELECT vi.image_url FROM public.product_images vi
        WHERE vi.variant_id = pv.id
        ORDER BY vi.is_primary DESC, vi.sort_order ASC
        LIMIT 1
      ),
      'optionValues', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'optionId',   psv.option_id,
            'optionName', vo2.name,
            'valueId',    psv.option_value_id,
            'value',      vov2.value
          ) ORDER BY vo2.sort_order
        )
        FROM public.product_variant_selected_values psv
        JOIN public.product_variant_options vo2 ON vo2.id = psv.option_id
        JOIN public.product_variant_option_values vov2 ON vov2.id = psv.option_value_id
        WHERE psv.variant_id = pv.id
      ), '[]'::jsonb)
    ) ORDER BY pv.position, pv.created_at
  ) AS items
  FROM public.product_variants pv
  WHERE pv.product_id = pr.id AND pv.status = 'active'
) variants ON true
WHERE pr.status       = 'active'
  AND pr.is_available = true
  AND s.status        = 'active';

GRANT SELECT ON public.public_product_pages TO anon, authenticated;
