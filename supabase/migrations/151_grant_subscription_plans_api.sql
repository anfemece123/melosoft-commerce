-- 151 — Fix Data API privileges for the plan catalog.
-- Migration 150 created the table after the global API grants migration had
-- already run, so existing environments need this explicit grant.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
