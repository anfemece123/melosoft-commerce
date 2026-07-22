-- ============================================================
-- Store slug: shared normalization, expanded reserved list, and a
-- privacy-safe availability check for the superadmin store form.
-- ============================================================
-- Context: the platform now serves the admin panel from
-- commerce.melosoftapp.com and each store's storefront from
-- {slug}.melosoftapp.com (migration 083). "commerce" was missing from
-- the reserved list added in 083 — without it, a store could claim the
-- exact subdomain the admin panel itself uses. This migration widens
-- the reserved list, adds a numeric-only guard, and exposes a
-- SECURITY DEFINER RPC so the frontend can check availability while
-- typing without leaking any private store data (name, owner, id).
--
-- The database remains the final authority: this RPC re-implements the
-- same normalization the frontend uses for instant feedback, but the
-- Edge Function create-store-with-owner and the CHECK constraints below
-- are what actually prevent an invalid or duplicate slug from being
-- persisted.

-- ── Canonical reserved-word list, as a function so both the CHECK
--    constraint and the availability RPC read the exact same set ──
create or replace function public.is_reserved_store_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(p_slug) = any (array[
    'admin', 'administrator', 'api', 'app', 'assets', 'auth',
    'beta', 'blog', 'callback', 'callbacks', 'cdn', 'commerce',
    'dashboard', 'demo', 'dev', 'development', 'docs', 'email',
    'files', 'ftp', 'help', 'localhost', 'login', 'logout', 'mail',
    'media', 'panel', 'preview', 'register', 'signup', 'soporte',
    'staging', 'static', 'status', 'store', 'stores', 'supabase',
    'support', 'test', 'testing', 'webhook', 'webhooks', 'www'
  ]);
$$;

comment on function public.is_reserved_store_slug(text) is
  'Canonical reserved-subdomain list for store slugs. Keep in sync with '
  'src/lib/storefront/storefrontSubdomains.ts (frontend) and '
  'RESERVED_STORE_SLUGS in supabase/functions/create-store-with-owner/index.ts '
  '(both are UX-only mirrors; this function is the enforced authority).';

-- ── Deterministic slug normalizer (mirrors src/lib/storefront/ ──
--    storefrontSubdomains.ts normalizeStorefrontSubdomain exactly) ──
create or replace function public.normalize_store_slug(p_input text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          translate(
            lower(trim(coalesce(p_input, ''))),
            'áàâãäéèêëíìîïóòôõöúùûüñç',
            'aaaaaeeeeiiiiooooouuuunc'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '-{2,}', '-', 'g'
      )
    ),
    ''
  );
$$;

comment on function public.normalize_store_slug(text) is
  'Lowercases, strips common Latin diacritics, and collapses anything '
  'else into single hyphens with no leading/trailing hyphen. Mirrors '
  'normalizeStorefrontSubdomain() in src/lib/storefront/storefrontSubdomains.ts.';

-- ── Guard: only add the new, wider reserved constraint if it would not
--    break an existing store (mirrors the defensive style of 083) ──
do $$
begin
  if exists (
    select 1 from public.stores where public.is_reserved_store_slug(slug)
  ) then
    raise exception 'Cannot widen reserved store slugs: an existing store already uses one of the newly reserved names.';
  end if;

  if exists (
    select 1 from public.stores where slug ~ '^[0-9]+$'
  ) then
    raise exception 'Cannot enforce non-numeric store slugs: an existing store has an all-numeric slug.';
  end if;
end;
$$;

alter table public.stores
  drop constraint if exists stores_slug_not_reserved;

alter table public.stores
  add constraint stores_slug_not_reserved check (not public.is_reserved_store_slug(slug)),
  add constraint stores_slug_not_all_numeric check (slug !~ '^[0-9]+$');

comment on constraint stores_slug_not_reserved on public.stores is
  'Delegates to public.is_reserved_store_slug() so the reserved list has one definition.';

-- ── Privacy-safe availability check ──
-- Returns only {available, normalized_slug, reason} — never store_id,
-- name, owner, or any other identifying detail about an existing store.
-- Restricted to platform_admin: store creation is already platform_admin
-- -only (CLAUDE.md), so there is no legitimate anonymous or
-- platform_member caller for this RPC.
create or replace function public.check_store_slug_availability(p_slug text)
returns table (available boolean, normalized_slug text, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_normalized text;
begin
  if not public.is_platform_admin() then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  v_normalized := public.normalize_store_slug(p_slug);

  if v_normalized is null or length(v_normalized) < 2 then
    return query select false, coalesce(v_normalized, ''), 'too_short';
    return;
  end if;

  if length(v_normalized) > 60 then
    return query select false, v_normalized, 'too_long';
    return;
  end if;

  if v_normalized !~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$' then
    return query select false, v_normalized, 'invalid_format';
    return;
  end if;

  if v_normalized ~ '^[0-9]+$' then
    return query select false, v_normalized, 'all_numeric';
    return;
  end if;

  if public.is_reserved_store_slug(v_normalized) then
    return query select false, v_normalized, 'reserved';
    return;
  end if;

  if exists (select 1 from public.stores where lower(slug) = v_normalized) then
    return query select false, v_normalized, 'taken';
    return;
  end if;

  return query select true, v_normalized, 'ok';
end;
$$;

comment on function public.check_store_slug_availability(text) is
  'platform_admin-only. Returns availability + reason only — never store '
  'identity — so the superadmin form can validate a slug while typing.';

revoke all on function public.is_reserved_store_slug(text) from public;
revoke all on function public.normalize_store_slug(text) from public;
revoke all on function public.check_store_slug_availability(text) from public;
grant execute on function public.check_store_slug_availability(text) to authenticated;

-- service_role (used by the create-store-with-owner Edge Function) must be
-- able to execute the helper functions referenced by the CHECK constraints
-- above, since constraint evaluation checks EXECUTE privilege like any
-- other function call — explicit, do not rely on default privileges.
grant execute on function public.is_reserved_store_slug(text) to service_role;
grant execute on function public.normalize_store_slug(text) to service_role;

-- authenticated must ALSO be able to execute is_reserved_store_slug():
-- unlike migration 083's original stores_slug_not_reserved (a plain
-- `lower(slug) <> all(array[...])` expression with no function call, so
-- no ACL requirement at all), this constraint now calls a SQL function —
-- and Postgres re-evaluates every CHECK constraint on every UPDATE to a
-- row, regardless of which columns actually changed. Without this grant,
-- the very first storesService.updateStore() an authenticated owner/admin
-- runs from the panel (theme, policies, hero images, description — none
-- of which touch slug) would fail with "permission denied for function
-- is_reserved_store_slug", because that UPDATE runs under the caller's
-- own `authenticated` role, not service_role.
grant execute on function public.is_reserved_store_slug(text) to authenticated;
