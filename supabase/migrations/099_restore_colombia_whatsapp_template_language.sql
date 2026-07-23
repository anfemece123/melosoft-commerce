-- Meta's current supported-language list explicitly includes
-- Spanish (COL) as `es_CO`. Migration 098 temporarily normalized it
-- to es_MX based on an incorrect diagnosis of Meta error subcode
-- 2494160. Restore the Colombia-specific language and remove those
-- temporary normalization triggers.

BEGIN;

DROP TRIGGER IF EXISTS trg_normalize_store_whatsapp_settings_template_language
  ON public.store_whatsapp_settings;
DROP TRIGGER IF EXISTS trg_normalize_whatsapp_notification_template_language
  ON public.whatsapp_notifications;
DROP TRIGGER IF EXISTS trg_normalize_store_whatsapp_connection_template_language
  ON public.store_whatsapp_connections;

DROP FUNCTION IF EXISTS public.normalize_store_whatsapp_settings_template_language();
DROP FUNCTION IF EXISTS public.normalize_whatsapp_notification_template_language();
DROP FUNCTION IF EXISTS public.normalize_store_whatsapp_connection_template_language();

ALTER TABLE public.store_whatsapp_settings
  ALTER COLUMN locale SET DEFAULT 'es_CO';

ALTER TABLE public.whatsapp_notifications
  ALTER COLUMN template_language SET DEFAULT 'es_CO';

ALTER TABLE public.store_whatsapp_connections
  ALTER COLUMN template_language SET DEFAULT 'es_CO';

UPDATE public.store_whatsapp_settings
SET locale = 'es_CO'
WHERE locale = 'es_MX';

UPDATE public.whatsapp_notifications
SET template_language = 'es_CO'
WHERE template_language = 'es_MX';

UPDATE public.store_whatsapp_connections
SET template_language = 'es_CO'
WHERE template_language = 'es_MX';

COMMIT;
