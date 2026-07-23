# Plantillas de WhatsApp — Melosoft Commerce

Plantillas transaccionales para pedidos (migraciones `094` y `096`).
**Modelo B**: las plantillas viven dentro de la WABA de cada empresa
(no en una cuenta central), así que cada tienda necesita su propia
copia aprobada. Melosoft no le pide a cada empresa que entre a Meta
Business Manager a crearla a mano — la app "Melosoft" ya tiene permiso
`whatsapp_business_management` sobre cada WABA conectada (otorgado
durante Embedded Signup), así que la Edge Function
`whatsapp-template-sync` la crea y consulta su estado vía
`POST/GET /{waba_id}/message_templates` cuando el owner hace clic en
"Verificar plantilla" desde `/admin/stores/:storeId/whatsapp`. El texto,
categoría e idioma exactos que envía esa función están documentados
abajo — deben coincidir siempre con lo que este archivo describe.

---

## 1. `melosoft_order_confirmation_v1`

| Campo | Valor |
|---|---|
| Nombre exacto | `melosoft_order_confirmation_v1` |
| Categoría | **Utility** (transaccional — no Marketing) |
| Idioma | `es_CO` (Español — Colombia), admitido explícitamente por la lista actual de idiomas de plantillas de Meta. |
| Header | Ninguno |
| Footer | Ninguno |
| Botones | Ninguno (ver nota abajo) |

### Cuerpo (body)

```
Hola {{1}} 👋

Tu pedido en *{{2}}* fue recibido correctamente.

Pedido: *{{3}}*
Resumen: {{4}}
Total: *{{5}}*
Pago: {{6}}
Entrega: {{7}}
Estado: {{8}}

{{9}}

Conserva este mensaje para consultar la información de tu compra.
```

### Variables

| # | Nombre lógico | Origen | Ejemplo | Límite aplicado |
|---|---|---|---|---|
| `{{1}}` | Nombre del cliente | `orders.customer_name` | `María García` | 60 caracteres |
| `{{2}}` | Nombre comercial de la tienda | `stores.name` | `Panadería Dulce Hogar` | 60 caracteres |
| `{{3}}` | Número de pedido | `orders.order_number` | `ORD-20260720-A1B2C3` | 30 caracteres |
| `{{4}}` | Resumen de productos | `order_items` (primeros 3 + "+N más") | `2x Pan francés, 1x Torta chocolate (mediana), +1 más` | 200 caracteres |
| `{{5}}` | Total | `orders.total_amount` + `currency` | `$ 85.000` | 30 caracteres |
| `{{6}}` | Método de pago | `orders.payment_method` | `Pago contraentrega` | 40 caracteres |
| `{{7}}` | Tipo de entrega + dirección/ciudad | `orders.fulfillment_method` + `city`/`shipping_address` | `Domicilio a Bogotá — Calle 10 # 20-30` | 120 caracteres |
| `{{8}}` | Estado inicial | Fijo: `Recibido` | `Recibido` | — |
| `{{9}}` | Mensaje final configurado por la tienda | `store_whatsapp_settings.final_message` (o texto por defecto si está vacío) | `¡Gracias por tu compra!` | 150 caracteres |

Todas las variables se sanean antes de enviarse: sin saltos de línea,
sin más de un espacio consecutivo, truncadas con `…` si exceden el
límite. Esto es obligatorio — Meta rechaza plantillas hidratadas con
variables que contengan saltos de línea o más de 4 espacios seguidos.

### Ejemplo realista para el formulario de aprobación de Meta

```
Hola María García 👋

Tu pedido en *Panadería Dulce Hogar* fue recibido correctamente.

Pedido: *ORD-20260720-A1B2C3*
Resumen: 2x Pan francés, 1x Torta chocolate (mediana), +1 más
Total: *$ 85.000*
Pago: Pago contraentrega
Entrega: Domicilio a Bogotá — Calle 10 # 20-30
Estado: Recibido

¡Gracias por tu compra!

Conserva este mensaje para consultar la información de tu compra.
```

### Sobre el botón de "consultar pedido"

El brief original de esta integración contempla, opcionalmente, un
botón de tipo URL para que el cliente consulte su pedido con un token
público seguro (aleatorio, no secuencial, revocable). **Esa
funcionalidad no existe todavía en el repositorio** — no hay página
pública de seguimiento de pedidos ni columna de token en `orders`. Por
decisión explícita del alcance de esta tarea ("no inventes la
funcionalidad si no existe"), la plantilla se implementa **sin botón**.

Para agregarlo en el futuro:
1. Migración que agregue `orders.public_tracking_token` (uuid aleatorio,
   `unique`, generado en `create_store_order`/`wompi-webhook`).
2. Página pública `/s/:storeSlug/pedido/:token` que muestre solo lo
   necesario (sin exponer `order_number` secuencial en la URL).
3. Nueva versión de la plantilla (`melosoft_order_confirmation_v2`) con
   un botón `URL` dinámico apuntando a esa página — las plantillas de
   Meta no se pueden editar una vez aprobadas, así que esto siempre
   requiere una plantilla nueva, no una edición de esta.

---

## 2. `melosoft_whatsapp_test_v1`

Plantilla separada y deliberadamente genérica para el botón "Enviar
mensaje de prueba" del panel — nunca reutiliza la plantilla real de
pedidos para evitar mostrarle a un dueño de tienda un mensaje que
parezca (pero no sea) una confirmación real.

| Campo | Valor |
|---|---|
| Nombre exacto | `melosoft_whatsapp_test_v1` |
| Categoría | **Utility** |
| Idioma | `es_CO` |
| Header | Ninguno |
| Footer | Ninguno |
| Botones | Ninguno |

### Cuerpo (body)

```
Este es un mensaje de prueba de {{1}} enviado desde Melosoft Commerce. Si lo recibiste, la configuración de WhatsApp está funcionando correctamente.
```

### Variables

| # | Nombre lógico | Ejemplo |
|---|---|---|
| `{{1}}` | Texto fijo `"Melosoft Commerce"` | `Melosoft Commerce` |

---

## Cómo se crean ahora (automático por tienda, vía API)

Después de que una tienda completa Embedded Signup
(`/admin/stores/:storeId/whatsapp` → "Conectar WhatsApp Business"), el
owner hace clic en **"Verificar plantilla"**. Eso llama a la Edge
Function `whatsapp-template-sync`, que:

1. Busca `melosoft_order_confirmation_v1` y `melosoft_whatsapp_test_v1`
   en la WABA de esa tienda (`GET /{waba_id}/message_templates?name=...`).
2. Si no existe, la crea (`POST /{waba_id}/message_templates`) con
   exactamente el texto, categoría e idioma de este documento.
3. Guarda el estado devuelto por Meta (`pending`/`approved`/`rejected`/
   `paused`/`disabled`) en `store_whatsapp_connections.template_status`.

El sistema **no envía nada** hasta que el estado sea `approved` — un
envío contra una plantilla pendiente o rechazada respondería
`132001`/`132000`, así que `send-whatsapp-notification` ni siquiera
llama a Meta en ese caso: marca la notificación como `blocked`
directamente (ver `docs/whatsapp/deployment.md`).

Si por algún motivo la creación automática falla (permisos insuficientes
en la WABA, restricciones regionales, etc.), el owner puede crearla a
mano en **Meta Business Manager → WhatsApp Manager → Plantillas de
mensajes** de su propia WABA, respetando el nombre exacto, categoría e
idioma de este documento — un nombre distinto hará que Meta responda
`132001 Template does not exist`, porque `whatsapp_notifications.
template_name`/`store_whatsapp_connections.template_name` deben
coincidir carácter por carácter con lo aprobado en Meta.

## Configuración de Supabase y Meta

Ver `docs/whatsapp/deployment.md` para la tabla completa de secretos,
la URL del webhook y el paso de Embedded Signup Configuration —
para evitar mantener la misma información en dos archivos que puedan
desincronizarse, no se repite aquí.

## Token de producción

**No uses el token temporal de 24 horas del panel de pruebas de Meta.**
Cada token por tienda se obtiene del intercambio server-side de `code`
en `whatsapp-embedded-signup` durante Embedded Signup — ese token viene
del sistema de negocio del comercio conectado, no de un panel de
pruebas, y su vigencia depende de la configuración de tu app en Meta
(App Review/Business Verification). Verifica en el App Dashboard de
Meta → App Review → Permissions and Features que `whatsapp_business_
messaging` y `whatsapp_business_management` estén aprobados para uso en
producción, no solo en modo de desarrollo — en modo desarrollo, Meta
limita a qué números se puede enviar.
