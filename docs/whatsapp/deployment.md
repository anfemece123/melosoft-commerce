# Despliegue de notificaciones de WhatsApp — pasos manuales

Modelo B (migración `096_store_whatsapp_embedded_signup.sql`): cada
empresa conecta su propio número de WhatsApp Business mediante Meta
Embedded Signup. No existe un número central de Melosoft — Melosoft
actúa como *Tech Provider*: su app de Meta gestiona la conexión y el
envío en nombre de cada empresa, pero el remitente visible es siempre
el número de la empresa.

## 0. Configuración de la app de Meta para Embedded Signup (una sola vez, no por tienda)

1. En el [App Dashboard de Meta](https://developers.facebook.com/apps)
   → app "Melosoft" → **WhatsApp → Embedded Signup Builder** (o
   **WhatsApp → Configuration** según la versión del panel) → crea una
   **Configuration** para Embedded Signup. Esto genera un
   **Configuration ID** (`config_id`) — publícalo como
   `VITE_META_WHATSAPP_CONFIG_ID` (ver más abajo).
2. Dentro de esa configuración, habilita explícitamente la opción de
   **coexistencia** (a veces listada como "WhatsApp Business App
   onboarding" o similar) — es lo que permite que una empresa que ya
   usa la app móvil de WhatsApp Business conserve su número y su app.
   Si tu cuenta de Meta no ofrece esa opción, el flujo de coexistencia
   no está disponible todavía para tu Business — la Fase 1 del
   requisito de producto pide detenerse y mostrar una advertencia en
   ese caso, no forzar el registro como número nuevo.
3. Confirma que la app tiene el permiso `whatsapp_business_management`
   y `whatsapp_business_messaging` disponibles (Business Verification
   de Meta puede ser requisito para producción — ver el estado en
   **App Review → Permissions and Features**).
4. El **App ID** (público) y el **App Secret** (privado) están en
   **App Settings → Basic**.

## 1. Secretos requeridos

| Secreto | Tipo | Dónde se usa | Comando |
|---|---|---|---|
| `META_APP_ID` | Público, pero se lee como secreto de Supabase en el backend | `whatsapp-embedded-signup` (intercambio de code) | `supabase secrets set META_APP_ID=REEMPLAZA` |
| `META_WHATSAPP_APP_SECRET` | **Secreto** | `whatsapp-embedded-signup` (intercambio de code) y `whatsapp-webhook` (firma `X-Hub-Signature-256`) — es el mismo App Secret para ambos, un solo valor | `supabase secrets set META_WHATSAPP_APP_SECRET=REEMPLAZA` |
| `META_WHATSAPP_VERIFY_TOKEN` | Cadena que tú inventas | `whatsapp-webhook` (verificación GET) | `supabase secrets set META_WHATSAPP_VERIFY_TOKEN=REEMPLAZA` |
| `META_GRAPH_API_VERSION` | Opcional | `whatsapp-embedded-signup`, `whatsapp-template-sync`, `send-whatsapp-notification` | `supabase secrets set META_GRAPH_API_VERSION=vXX.0` |

Además, en el **frontend** (build-time, público, nunca secreto):

```
VITE_META_APP_ID=<mismo valor que META_APP_ID>
VITE_META_WHATSAPP_CONFIG_ID=<el Configuration ID del paso 0>
```

**Ya NO existen** `META_WHATSAPP_ACCESS_TOKEN` ni
`META_WHATSAPP_PHONE_NUMBER_ID` como secretos globales — cada tienda
tiene su propio token (en Vault, uno por tienda) y su propio
`phone_number_id` (columna en `store_whatsapp_connections`). Si estos
dos secretos globales quedaron configurados de una versión anterior del
proyecto, ya no los usa ningún código — puedes eliminarlos:

```
supabase secrets unset META_WHATSAPP_ACCESS_TOKEN META_WHATSAPP_PHONE_NUMBER_ID
```

## 2. Webhook — uno solo para todas las tiendas

- **URL:** `https://omgkiynnpaygxulugxmc.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token:** el valor de `META_WHATSAPP_VERIFY_TOKEN`
- **Campo:** `messages` únicamente

Regístralo **una sola vez** en App Dashboard → WhatsApp →
Configuration → Webhook. Cada WABA que se conecta después (una por
tienda) queda automáticamente suscrita a este mismo webhook — lo hace
`whatsapp-embedded-signup` llamando a `POST /{waba_id}/subscribed_apps`
al final de cada conexión exitosa, no requiere repetir este paso a mano
por tienda.

## 3. El worker de la cola (`pg_cron` + Vault) — sin cambios de fondo respecto a Modelo A

**No programa el worker de la cola** — eso requiere un secreto
compartido (la service_role key) que nunca debe vivir en un archivo de
migración versionado en git. Esta sección cubre ese paso manual, que es
el mismo sin importar cuántas tiendas estén conectadas: el worker sigue
siendo una única Edge Function que procesa la cola global y resuelve el
remitente correcto por fila (ver el header de
`send-whatsapp-notification`).

### Por qué es manual

`send-whatsapp-notification` (Edge Function) solo acepta llamadas cuyo
header `Authorization: Bearer <token>` sea exactamente la
`SUPABASE_SERVICE_ROLE_KEY` del proyecto. Para que `pg_cron` la invoque
cada minuto necesita guardar ese secreto en algún lugar de la base de
datos — la forma segura de hacerlo es **Supabase Vault**, configurada a
mano una sola vez desde el SQL Editor del dashboard (nunca desde un
archivo de migración que termina en el historial de git).

### Pasos (ejecutar en el SQL Editor de Supabase, una sola vez)

1. Habilitar las extensiones necesarias (ya vienen preinstaladas en
   proyectos hospedados de Supabase; en desarrollo local con `supabase
   start` puede requerir habilitarlas manualmente vía Dashboard →
   Database → Extensions si el `CREATE EXTENSION` falla):

   ```sql
   create extension if not exists pg_cron with schema extensions;
   create extension if not exists pg_net with schema extensions;
   ```

2. Guardar la service_role key en Vault (reemplaza el valor real — no
   lo compartas ni lo pegues en ningún archivo del repositorio):

   ```sql
   select vault.create_secret(
     '<TU_SERVICE_ROLE_KEY>',
     'whatsapp_queue_dispatch_key'
   );
   ```

3. Programar el barrido cada minuto:

   ```sql
   select cron.schedule(
     'process-whatsapp-queue',
     '* * * * *',
     $$
     select net.http_post(
       url := 'https://omgkiynnpaygxulugxmc.supabase.co/functions/v1/send-whatsapp-notification',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (
           select decrypted_secret from vault.decrypted_secrets
           where name = 'whatsapp_queue_dispatch_key'
         )
       ),
       body := '{"limit": 20}'::jsonb
     );
     $$
   );
   ```

4. Verificar que quedó programado:

   ```sql
   select jobid, jobname, schedule, active from cron.job where jobname = 'process-whatsapp-queue';
   ```

### Alternativa sin SQL (más simple si tu plan de Supabase lo ofrece)

El dashboard de Supabase incluye una sección **Integrations → Cron**
que hace exactamente lo mismo (crear un `cron.schedule` que llama una
Edge Function) sin escribir SQL a mano. Si está disponible en tu
proyecto, es la vía recomendada — solo necesitas la URL de la función y
la service_role key como header `Authorization`.

### Latencia esperada

Con un barrido cada minuto, un mensaje de "pedido recibido" llega al
cliente entre unos segundos y ~60 segundos después de crear el pedido
— nunca instantáneo, pero suficientemente rápido para una confirmación
transaccional. Si se necesita menor latencia en el futuro, la opción es
que el trigger `enqueue_whatsapp_order_notification` dispare también un
`net.http_post` inmediato (fire-and-forget) hacia la misma función, en
lugar de depender solo del barrido — no se implementó en esta primera
versión para evitar la complejidad adicional de leer el secreto de
Vault desde dentro de un trigger disparado en el mismo commit que
inserta `order_items`.

### Desactivar / rollback (worker)

```sql
select cron.unschedule('process-whatsapp-queue');
select vault.delete_secret((select id from vault.secrets where name = 'whatsapp_queue_dispatch_key'));
```

Desactivar el cron job detiene el envío automático sin afectar ninguna
fila ya encolada — quedan en `queued` y se procesarán en cuanto el job
se vuelva a programar. No borra `whatsapp_notifications` ni
`store_whatsapp_settings`.

## 4. Versión de Meta Graph API — verificar antes de cada despliegue

`send-whatsapp-notification` usa `META_GRAPH_API_VERSION` (secreto de
Supabase) si está configurado, y si no, un valor por defecto embebido en
el código (`DEFAULT_GRAPH_API_VERSION`). **Antes de cada despliegue**,
verifica cuál es la versión vigente en las fuentes oficiales de Meta —
no confíes en un valor fijo en este documento ni en el código, ambos
pueden quedar desactualizados:

- https://developers.facebook.com/docs/graph-api/changelog/versions/
  (lista de versiones y fechas de retiro)
- https://developers.facebook.com/docs/graph-api/changelog (novedades
  por versión)

Última verificación registrada (no la des por vigente sin comprobarla
tú mismo): 2026-07-20, versión vigente más reciente v25.0 (lanzada
2026-02-18, sin fecha de retiro asignada aún). Si al desplegar la
versión vigente cambió, configura `META_GRAPH_API_VERSION` como secreto
en vez de editar el código:

```
supabase secrets set META_GRAPH_API_VERSION=vXX.0
```

No cambies el payload del mensaje (estructura `messaging_product`,
`template`, `components`) al actualizar la versión sin antes confirmar
en el changelog oficial que esa versión no introdujo cambios
incompatibles en el formato de plantillas — el código actual no se
modificó para acompañar esta verificación, solo el número de versión.

## 5. Garantías reales de entrega — qué SÍ y qué NO se garantiza

- **Encolado (trigger → `whatsapp_notifications`): at-most-once por
  pedido y tipo de evento.** Garantizado por el índice único parcial
  `whatsapp_notifications_idempotent_uq (store_id, order_id, event_type,
  channel)` — una restricción de base de datos, no solo una
  comprobación en código.
- **Envío externo (`send-whatsapp-notification` → Meta): at-least-once
  en errores recuperables**, con reintentos con backoff exponencial y
  jitter. Existe una probabilidad pequeña y acotada de duplicado ante un
  **resultado ambiguo**: la función agota su propio timeout esperando la
  respuesta de Meta sin saber si el mensaje ya fue aceptado. Ese caso se
  clasifica como `category: 'ambiguous'` (no `'recoverable'`) y **no se
  reintenta automáticamente** — la fila queda en `status='failed'` con
  `is_permanent_failure=false` y `last_error_category='ambiguous'`,
  visible en el panel para revisión manual antes de un reenvío manual.
  Esta es una limitación inherente: Meta Cloud API no documenta una
  clave de idempotencia del lado del envío para plantillas salientes
  (verificado contra developers.facebook.com el 2026-07; ningún header
  tipo `Idempotency-Key` aparece documentado para
  `POST /PHONE_NUMBER_ID/messages`) — si esa documentación cambia en el
  futuro, ahí es donde se debería usar.
- **Webhooks recibidos (`whatsapp-webhook`): procesamiento idempotente**
  por `provider_message_id`, con una máquina de estados explícita
  (`apply_whatsapp_status_event`, migración 094) que nunca permite que
  un evento repetido, atrasado o desconocido degrade o duplique el
  estado de una fila.
- El campo de respuesta `attempts_gt_1` en el JSON que devuelve
  `send-whatsapp-notification` en cada corrida, y la columna `attempts`
  visible por fila en el panel (`/admin/stores/:storeId/whatsapp`), son
  el indicador operativo para detectar reintentos — revísalos
  periódicamente si se sospecha de un proveedor inestable.
