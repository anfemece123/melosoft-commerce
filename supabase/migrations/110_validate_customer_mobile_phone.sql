-- Enforce the same Colombian mobile rules used by the public checkout at the
-- database boundary. UI validation improves the experience; these triggers
-- prevent a modified client from bypassing it through the public RPC or the
-- online-payment Edge Function.

create or replace function public.normalize_colombian_mobile_phone(p_phone text)
returns text
language plpgsql
immutable
returns null on null input
set search_path = public, pg_temp
as $$
declare
  v_phone text := btrim(p_phone);
begin
  -- Deliberately reject, rather than strip, letters, spaces and punctuation.
  if v_phone ~ '^3[0-9]{9}$' then
    return v_phone;
  end if;

  if v_phone ~ '^573[0-9]{9}$' then
    return substring(v_phone from 3);
  end if;

  return null;
end;
$$;

comment on function public.normalize_colombian_mobile_phone(text) is
  'Returns a canonical 10-digit Colombian mobile. Rejects incomplete or formatted free text instead of guessing.';

create or replace function public.validate_customer_mobile_phone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized text;
begin
  v_normalized := public.normalize_colombian_mobile_phone(new.customer_phone);
  if v_normalized is null then
    raise exception using
      message = 'INVALID_CUSTOMER_PHONE',
      detail = 'customer_phone must be a Colombian mobile with 10 digits.',
      hint = 'Use 3001234567 or the 57-prefixed equivalent.';
  end if;

  new.customer_phone := v_normalized;
  return new;
end;
$$;

drop trigger if exists orders_validate_customer_mobile_phone on public.orders;
create trigger orders_validate_customer_mobile_phone
  before insert or update of customer_phone on public.orders
  for each row execute function public.validate_customer_mobile_phone();

drop trigger if exists checkout_sessions_validate_customer_mobile_phone on public.checkout_sessions;
create trigger checkout_sessions_validate_customer_mobile_phone
  before insert or update of customer_phone on public.checkout_sessions
  for each row execute function public.validate_customer_mobile_phone();

-- NOT VALID preserves historical rows that may contain old formatting while
-- still enforcing the canonical representation for every new/updated row.
alter table public.orders
  drop constraint if exists orders_customer_phone_valid,
  add constraint orders_customer_phone_valid
    check (customer_phone ~ '^3[0-9]{9}$') not valid;

alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_customer_phone_valid,
  add constraint checkout_sessions_customer_phone_valid
    check (customer_phone ~ '^3[0-9]{9}$') not valid;

revoke all on function public.normalize_colombian_mobile_phone(text) from public, anon, authenticated;
revoke all on function public.validate_customer_mobile_phone() from public, anon, authenticated;
grant execute on function public.normalize_colombian_mobile_phone(text) to service_role;
