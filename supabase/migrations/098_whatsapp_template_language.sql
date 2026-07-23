-- WhatsApp message templates do not support the Colombia-specific
-- `es_CO` locale. Use Meta's Spanish (Latin America) template language
-- `es_MX` consistently for creation, queueing, and sending.
--
-- The original WhatsApp migrations used store_whatsapp_settings.locale
-- as the queued template language and hard-coded es_CO in two SECURITY
-- DEFINER functions. The normalization triggers below keep those legacy
-- code paths safe without weakening support for any other valid language.

BEGIN;

ALTER TABLE public.store_whatsapp_settings
  ALTER COLUMN locale SET DEFAULT 'es_MX';

ALTER TABLE public.whatsapp_notifications
  ALTER COLUMN template_language SET DEFAULT 'es_MX';

ALTER TABLE public.store_whatsapp_connections
  ALTER COLUMN template_language SET DEFAULT 'es_MX';

UPDATE public.store_whatsapp_settings
SET locale = 'es_MX'
WHERE locale = 'es_CO';

UPDATE public.whatsapp_notifications
SET template_language = 'es_MX'
WHERE template_language = 'es_CO';

UPDATE public.store_whatsapp_connections
SET template_language = 'es_MX'
WHERE template_language = 'es_CO';

CREATE OR REPLACE FUNCTION public.normalize_store_whatsapp_settings_template_language()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.locale = 'es_CO' THEN
    NEW.locale := 'es_MX';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_store_whatsapp_settings_template_language
  ON public.store_whatsapp_settings;
CREATE TRIGGER trg_normalize_store_whatsapp_settings_template_language
  BEFORE INSERT OR UPDATE OF locale ON public.store_whatsapp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_store_whatsapp_settings_template_language();

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_notification_template_language()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.template_language = 'es_CO' THEN
    NEW.template_language := 'es_MX';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_whatsapp_notification_template_language
  ON public.whatsapp_notifications;
CREATE TRIGGER trg_normalize_whatsapp_notification_template_language
  BEFORE INSERT OR UPDATE OF template_language ON public.whatsapp_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_whatsapp_notification_template_language();

CREATE OR REPLACE FUNCTION public.normalize_store_whatsapp_connection_template_language()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.template_language = 'es_CO' THEN
    NEW.template_language := 'es_MX';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_store_whatsapp_connection_template_language
  ON public.store_whatsapp_connections;
CREATE TRIGGER trg_normalize_store_whatsapp_connection_template_language
  BEFORE INSERT OR UPDATE OF template_language ON public.store_whatsapp_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_store_whatsapp_connection_template_language();

COMMIT;
