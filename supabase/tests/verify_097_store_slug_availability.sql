-- ============================================================
-- Manual verification plan for migration 097 (store slug: shared
-- normalization, wider reserved list, numeric-only guard, and the
-- privacy-safe check_store_slug_availability RPC).
--
-- Paste into the Supabase Dashboard → SQL Editor for a STAGING project
-- and run top to bottom. Never run against production.
--
-- HOW TO RUN:
--   1. Find-and-replace PLATFORM_ADMIN_USER_ID_HERE / MEMBER_USER_ID_HERE
--      with two real auth.users ids: one profile with
--      platform_role='platform_admin', status='active'; one with
--      platform_role='platform_member'.
--   2. Run each section in order.
--   3. Run CLEANUP at the end.
-- ============================================================


-- ============================================================
-- 1. normalize_store_slug — deterministic normalization.
-- ============================================================
SELECT public.normalize_store_slug('Centriparts Colombia')  AS a, -- EXPECT: centriparts-colombia
       public.normalize_store_slug('  Café Ñoño S.A.  ')     AS b, -- EXPECT: cafe-nono-s-a
       public.normalize_store_slug('---Hola---Mundo---')     AS c, -- EXPECT: hola-mundo
       public.normalize_store_slug('   ')                    AS d, -- EXPECT: NULL
       public.normalize_store_slug('')                       AS e, -- EXPECT: NULL
       public.normalize_store_slug('¡¡¡###!!!')               AS f, -- EXPECT: NULL
       public.normalize_store_slug('São Paulo Store')         AS g; -- EXPECT: sao-paulo-store (unmapped ã falls to '-')


-- ============================================================
-- 2. is_reserved_store_slug — "commerce" and the rest of the wider list.
-- ============================================================
SELECT public.is_reserved_store_slug('commerce')      AS is_commerce_reserved, -- EXPECT: true
       public.is_reserved_store_slug('COMMERCE')      AS is_commerce_upper,   -- EXPECT: true (case-insensitive)
       public.is_reserved_store_slug('login')          AS is_login_reserved,   -- EXPECT: true
       public.is_reserved_store_slug('supabase')       AS is_supabase_reserved,-- EXPECT: true
       public.is_reserved_store_slug('padel-shop')      AS is_padel_shop_reserved, -- EXPECT: false
       public.is_reserved_store_slug('centriparts-co')  AS is_normal_reserved; -- EXPECT: false


-- ============================================================
-- 3. check_store_slug_availability — must reject non-platform_admin.
-- Run this as MEMBER_USER_ID_HERE (e.g. via `set local role` in a
-- session authenticated as that user, or via the Dashboard's
-- "Run as user" if available). If you cannot easily impersonate,
-- inspect the function body instead — it must call is_platform_admin().
-- EXPECT: ERROR insufficient_privilege
-- ============================================================
-- SELECT * FROM public.check_store_slug_availability('nueva-tienda');


-- ============================================================
-- 4. check_store_slug_availability — as platform_admin, all reason codes.
-- Run authenticated as PLATFORM_ADMIN_USER_ID_HERE.
-- ============================================================
SELECT * FROM public.check_store_slug_availability('Centriparts Colombia');
-- EXPECT: available=true, normalized_slug='centriparts-colombia', reason='ok'

SELECT * FROM public.check_store_slug_availability('commerce');
-- EXPECT: available=false, normalized_slug='commerce', reason='reserved'

SELECT * FROM public.check_store_slug_availability('padel-shop');
-- EXPECT: available=false, normalized_slug='padel-shop', reason='taken'
-- (fixture store from migrations 049+ — confirms it was NOT removed)

SELECT * FROM public.check_store_slug_availability('12345');
-- EXPECT: available=false, normalized_slug='12345', reason='all_numeric'

SELECT * FROM public.check_store_slug_availability('a');
-- EXPECT: available=false, normalized_slug='a', reason='too_short'

SELECT * FROM public.check_store_slug_availability(repeat('a', 61));
-- EXPECT: available=false, reason='too_long'

SELECT * FROM public.check_store_slug_availability('Tienda_Con_Guion_Bajo!!');
-- EXPECT: reason is either 'ok'/'taken' after normalization strips the
-- underscore/symbols into hyphens — confirms normalize runs before the
-- format check, never a raw 'invalid_format' for input a human would type.

-- Response never includes store_id, name, or owner — confirm by eye above.


-- ============================================================
-- 5. CHECK constraints reject a direct insert with a reserved or
--    numeric-only slug (defense in depth below the RPC).
-- ============================================================
BEGIN;
INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000097-1111-1111-1111-111111111111', 'PLATFORM_ADMIN_USER_ID_HERE', 'Test 097 reserved', 'commerce',
        'Debe fallar.', '+57 300 000 0000', 'CO', 'Bogotá', 'COP', 'active');
-- EXPECT: ERROR — violates check constraint "stores_slug_not_reserved"
ROLLBACK;

BEGIN;
INSERT INTO public.stores (id, owner_id, name, slug, description, whatsapp_number, country, city, currency, status)
VALUES ('00000097-1111-1111-1111-111111111112', 'PLATFORM_ADMIN_USER_ID_HERE', 'Test 097 numeric', '123456',
        'Debe fallar.', '+57 300 000 0001', 'CO', 'Bogotá', 'COP', 'active');
-- EXPECT: ERROR — violates check constraint "stores_slug_not_all_numeric"
ROLLBACK;


-- ============================================================
-- 6. padel-shop still resolves through the existing public RPCs
--    (confirms this migration touched nothing about live stores).
-- ============================================================
SELECT * FROM public.resolve_store_subdomain('padel-shop');
-- EXPECT: one row — the real padel-shop store id/name.


-- ============================================================
-- CLEANUP — nothing persistent was created (sections 5 used
-- BEGIN/ROLLBACK), so there is nothing to delete.
-- ============================================================
