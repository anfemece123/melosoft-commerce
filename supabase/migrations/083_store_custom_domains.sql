-- ============================================================
-- Professional storefront hostnames and custom domains
-- ============================================================
-- Domain mutations are intentionally performed by the authenticated
-- manage-store-domain Edge Function. Clients can only read domains for stores
-- they manage; public hostname resolution is exposed through narrow RPCs.

-- A store slug is the first label of its included URL
-- (store-slug.platform-domain.com), so it must be globally unique and safe as
-- a DNS label. Fail explicitly instead of silently assigning an ambiguous URL.
do $$
begin
  if exists (
    select 1
    from public.stores
    group by lower(slug)
    having count(*) > 1
  ) then
    raise exception 'Cannot enable storefront subdomains: duplicate store slugs exist.';
  end if;

  if exists (
    select 1
    from public.stores
    where slug <> lower(slug)
      or length(slug) not between 2 and 60
      or slug !~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'
      or lower(slug) = any (array[
        'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
        'docs', 'help', 'mail', 'static', 'status', 'store', 'stores', 'support', 'www'
      ])
  ) then
    raise exception 'Cannot enable storefront subdomains: one or more store slugs are not DNS-safe or are reserved.';
  end if;
end;
$$;

create unique index stores_slug_global_unique on public.stores ((lower(slug)));

alter table public.stores
  add constraint stores_slug_subdomain_safe check (
    slug = lower(slug)
    and length(slug) between 2 and 60
    and slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'
  ),
  add constraint stores_slug_not_reserved check (
    lower(slug) <> all (array[
      'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard',
      'docs', 'help', 'mail', 'static', 'status', 'store', 'stores', 'support', 'www'
    ])
  );

create table public.store_domains (
  id                          uuid        primary key default gen_random_uuid(),
  store_id                    uuid        not null references public.stores(id) on delete cascade,
  hostname                    text        not null,
  status                      text        not null default 'pending_dns',
  is_primary                  boolean     not null default true,
  dns_record_type             text        not null,
  dns_target                  text        not null,
  provider                    text        not null default 'vercel',
  provider_hostname_id        text,
  ownership_verification_name text,
  ownership_verification_value text,
  ssl_validation_records      jsonb       not null default '[]'::jsonb,
  failure_reason              text,
  last_checked_at             timestamptz,
  verified_at                 timestamptz,
  activated_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint store_domains_hostname_unique unique (hostname),
  constraint store_domains_hostname_normalized check (
    hostname = lower(hostname)
    and hostname = trim(trailing '.' from hostname)
    and length(hostname) between 4 and 253
    and hostname ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  constraint store_domains_status_valid check (
    status in ('pending_dns', 'pending_ssl', 'active', 'error', 'disabled')
  ),
  constraint store_domains_dns_record_type_valid check (dns_record_type in ('A', 'CNAME')),
  constraint store_domains_provider_valid check (provider in ('vercel')),
  constraint store_domains_ssl_records_array check (jsonb_typeof(ssl_validation_records) = 'array')
);

create unique index store_domains_one_primary_per_store
  on public.store_domains (store_id)
  where is_primary;

create index store_domains_store_id_idx on public.store_domains (store_id);
create index store_domains_active_hostname_idx
  on public.store_domains (hostname)
  where status = 'active';

create trigger store_domains_updated_at
  before update on public.store_domains
  for each row execute function public.handle_updated_at();

alter table public.store_domains enable row level security;

create policy "store_domains_select_managers"
  on public.store_domains
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.has_store_role(store_id, array['owner', 'admin'])
  );

-- No INSERT/UPDATE/DELETE policies are granted to browser clients. The Edge
-- Function re-checks role and plan entitlement before using the service role.
revoke all on public.store_domains from anon, authenticated;
grant select on public.store_domains to authenticated;

create or replace function public.resolve_store_domain(p_hostname text)
returns table (
  store_id uuid,
  store_slug text,
  store_name text,
  hostname text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.slug,
    s.name,
    d.hostname
  from public.store_domains d
  join public.stores s on s.id = d.store_id
  where d.hostname = lower(trim(trailing '.' from p_hostname))
    and d.status = 'active'
    and d.is_primary
    and s.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_store_domain(text) from public;
grant execute on function public.resolve_store_domain(text) to anon, authenticated;

create or replace function public.resolve_store_subdomain(p_slug text)
returns table (
  store_id uuid,
  store_slug text,
  store_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.slug, s.name
  from public.stores s
  where s.slug = lower(trim(p_slug))
    and s.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_store_subdomain(text) from public;
grant execute on function public.resolve_store_subdomain(text) to anon, authenticated;

comment on table public.store_domains is
  'Verified custom storefront hostnames. Assignment, DNS checks and TLS readiness are synchronized with Vercel.';

comment on function public.resolve_store_domain(text) is
  'Returns only the active store identity for an exact verified primary hostname.';

comment on function public.resolve_store_subdomain(text) is
  'Returns only the active store identity for an exact globally unique storefront subdomain.';
