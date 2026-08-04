-- Persist the merchant-defined order for a product's general gallery in one
-- transaction. Variant and option-value media are deliberately excluded.
create or replace function public.reorder_product_images(
  p_product_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_store_id uuid;
  v_image_count integer;
  v_input_count integer := coalesce(array_length(p_image_ids, 1), 0);
begin
  select store_id
  into v_store_id
  from public.products
  where id = p_product_id
  for update;

  if v_store_id is null then
    raise exception 'product_not_found';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_store_role(v_store_id, array['owner', 'admin', 'staff'])
  ) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if v_input_count <> (
    select count(distinct requested.image_id)
    from unnest(coalesce(p_image_ids, '{}'::uuid[])) as requested(image_id)
  ) then
    raise exception 'duplicate_image_ids';
  end if;

  select count(*)
  into v_image_count
  from public.product_images
  where product_id = p_product_id
    and variant_id is null
    and option_value_id is null;

  if v_input_count <> v_image_count or exists (
    select 1
    from unnest(coalesce(p_image_ids, '{}'::uuid[])) as requested(image_id)
    where not exists (
      select 1
      from public.product_images image
      where image.id = requested.image_id
        and image.product_id = p_product_id
        and image.variant_id is null
        and image.option_value_id is null
    )
  ) then
    raise exception 'image_set_mismatch';
  end if;

  with requested as (
    select image_id, ordinal - 1 as sort_order
    from unnest(coalesce(p_image_ids, '{}'::uuid[]))
      with ordinality as ordered(image_id, ordinal)
  )
  update public.product_images image
  set
    sort_order = requested.sort_order,
    is_primary = requested.sort_order = 0
  from requested
  where image.id = requested.image_id;

  update public.products product
  set main_image_url = (
    select image.image_url
    from public.product_images image
    where image.product_id = p_product_id
      and image.variant_id is null
      and image.option_value_id is null
    order by image.sort_order asc, image.created_at asc
    limit 1
  )
  where product.id = p_product_id;
end;
$$;

revoke all on function public.reorder_product_images(uuid, uuid[]) from public;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;
