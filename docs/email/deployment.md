# Correos transaccionales de pedidos con Brevo

La implementación usa un **outbox persistente** (`email_notifications`). Crear o actualizar un pedido solo inserta una fila en la cola; el worker `send-order-email` la reclama y llama a Brevo después. Por esta razón, una caída o lentitud de Brevo nunca bloquea ni revierte el checkout.

## Destinatarios y eventos

- Empresa: cada pedido nuevo se envía a `stores.support_email`. Si no existe o no es válido, se usa el correo del perfil del propietario de la tienda.
- Cliente: si registró un correo válido, recibe `pedido recibido`, `pedido confirmado`, `despachado/en camino` o `listo para recoger`, `entregado/recogido` y `cancelado`.
- El estado interno `processing` no dispara correo: es demasiado operacional y evita saturar al cliente.
- Para envíos nacionales, el sistema no permite despachar sin transportadora y número de guía. El enlace de rastreo y la fecha estimada son opcionales.

Cada combinación pedido + evento + destinatario es única en base de datos. El UUID de esa fila también se envía a Brevo como `Idempotency-Key` para que los reintentos de corto plazo no dupliquen el correo. Un envío que permanezca ambiguo más de 20 minutos se envía a revisión manual en vez de reintentarse fuera de la ventana segura de idempotencia.

## 1. Preparar Brevo

1. En Brevo, registra el remitente que usará Melosoft.
2. Autentica su dominio con DKIM y configura SPF/DMARC según lo indique el panel de Brevo. No uses una dirección gratuita para producción.
3. Crea una API key exclusiva para producción y guárdala fuera del repositorio.

Documentación oficial:

- https://developers.brevo.com/docs/send-a-transactional-email
- https://developers.brevo.com/reference/send-transac-email

## 2. Configurar secretos de Supabase

Ejecuta desde una terminal autenticada con Supabase CLI:

```bash
supabase secrets set BREVO_API_KEY='xkeysib-REEMPLAZA'
supabase secrets set BREVO_SENDER_EMAIL='pedidos@tu-dominio.com'
supabase secrets set BREVO_SENDER_NAME='Melosoft Commerce'
```

`BREVO_SENDER_EMAIL` debe coincidir con un remitente o dominio verificado en Brevo. `BREVO_SENDER_NAME` es opcional; si falta, se usa `Melosoft Commerce`.

## 3. Migrar y desplegar

```bash
supabase db push
supabase functions deploy send-order-email
```

La función mantiene `verify_jwt = true`. Además del gateway, valida internamente que el bearer token tenga rol `service_role` porque procesa datos personales de todas las tiendas.

## 4. Programar el worker

La migración `109_schedule_order_email_worker.sql` programa automáticamente el worker cada minuto. Para no incluir la credencial `service_role` en git ni en el historial SQL, copia dentro de Vault la credencial que ya utiliza el worker de WhatsApp (`whatsapp_queue_dispatch_key`) y crea una entrada independiente llamada `email_queue_dispatch_key`.

Si se instala el módulo de correos en un proyecto que todavía no tiene configurado WhatsApp, crea primero `email_queue_dispatch_key` desde el SQL Editor con la `service_role` legacy del proyecto y después vuelve a ejecutar `supabase db push`:

```sql
select vault.create_secret(
  '<TU_SERVICE_ROLE_KEY_LEGACY>',
  'email_queue_dispatch_key',
  'Legacy service-role JWT used only by the scheduled order email worker.'
);
```

Nunca incluyas el valor real en una migración, archivo `.env` versionado o captura de pantalla.

Verificación:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'process-order-email-queue';
```

Con un barrido por minuto, la latencia normal es de unos segundos a 60 segundos. Las fallas recuperables usan backoff exponencial; los errores permanentes quedan visibles en `email_notifications` con un diagnóstico sanitizado.

## 5. Prueba de aceptación

1. Confirma que la empresa tenga un `Correo de soporte` válido en la configuración general.
2. Haz un pedido de prueba con un correo de cliente real.
3. Verifica dos filas `sent`: `merchant_new_order` y `customer_order_received`.
4. Confirma el pedido desde administración y verifica `customer_order_confirmed`.
5. Para un envío nacional, avanza a preparación, registra transportadora, guía, URL y fecha estimada, y confirma que el correo de despacho contenga esos cuatro datos.
6. Revisa en Brevo que el mensaje aparezca en los logs transaccionales.

Consulta rápida de operación:

```sql
select event_type, recipient_type, status, attempts,
       provider_message_id, last_error_code, queued_at, sent_at
from public.email_notifications
order by created_at desc
limit 50;
```

## Webhooks de entregabilidad (siguiente capa opcional)

La cola ya conserva `provider_message_id` y una columna `delivered_at`. Si se necesita observabilidad completa de entregado, rebote o queja, se puede añadir un webhook de Brevo protegido con la lista oficial de IPs y aplicar esos eventos a la fila correspondiente. La lista oficial de eventos está en https://developers.brevo.com/docs/transactional-webhooks.

## Desactivar el envío sin perder la cola

```sql
select cron.unschedule('process-order-email-queue');
```

Las filas pendientes permanecen en `queued` y se procesarán cuando el cron vuelva a activarse. No borres la cola para “pausar” el servicio.
