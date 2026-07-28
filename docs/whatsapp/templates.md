# Plantillas de WhatsApp — Melosoft Commerce

Plantillas transaccionales para pedidos (migraciones `094`, `096`, `107` y `111`).
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

## 2. `melosoft_order_status_v1`

Una sola plantilla genérica cubre los hitos breves posteriores al pedido. El
despacho usa una plantilla logística separada porque contiene información de
rastreo accionable.

| Campo | Valor |
|---|---|
| Nombre exacto | `melosoft_order_status_v1` |
| Categoría | **Utility** |
| Idioma | `es_CO` |
| Header / Footer / Botones | Ninguno |

### Cuerpo (body)

```
Hola {{1}} 👋

Tenemos una actualización de tu pedido *{{2}}* en *{{3}}*.

Estado: *{{4}}*
{{5}}

Este es un mensaje transaccional sobre tu compra.
```

### Variables

| # | Nombre lógico | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del cliente | `María García` |
| `{{2}}` | Número de pedido | `ORD-20260720-A1B2C3` |
| `{{3}}` | Nombre de la tienda | `Panadería Dulce Hogar` |
| `{{4}}` | Hito visible | `Listo para recoger`, `En camino`, `Entregado` o `Cancelado` |
| `{{5}}` | Indicación breve correspondiente al hito | `Ya puedes acercarte al punto de entrega seleccionado.` |

### Flujo profesional de mensajes

- Pedido normal: recibido → listo/enviado → entregado (máximo 3 mensajes).
- Cancelación: se notifica únicamente cuando realmente ocurre.
- Confirmación interna, pago aprobado y preparación no generan mensajes; así
  se evitan avisos repetidos que no aportan una acción nueva al cliente.
- Para pedidos de restaurante, el flujo puede pasar de preparación a entregado,
  por lo que normalmente se envían solo recibido y entregado.

---

## 3. `melosoft_order_shipment_v1`

Plantilla exclusiva para pedidos con **envío nacional**. El panel exige
transportadora y número de guía antes de permitir el cambio de estado; la URL
de rastreo es opcional. Las recogidas y los domicilios locales —incluidos los
restaurantes— no usan esta plantilla: reciben la actualización `En camino` de
`melosoft_order_status_v1`, complementada con los datos logísticos opcionales
que haya registrado el negocio.

| Campo | Valor |
|---|---|
| Nombre exacto | `melosoft_order_shipment_v1` |
| Categoría | **Utility** |
| Idioma | `es_CO` |
| Header / Footer / Botones | Ninguno; la URL enviada en el cuerpo queda enlazable por WhatsApp. |

### Cuerpo (body)

```
Hola {{1}} 👋

Tu pedido *{{2}}* de *{{3}}* ya fue despachado.

Transportadora: *{{4}}*
Número de guía: *{{5}}*
Entrega estimada: {{6}}
Seguimiento: {{7}}

Conserva este mensaje para hacer seguimiento a tu envío.
```

### Variables

| # | Nombre lógico | Origen / valor alterno | Ejemplo |
|---|---|---|---|
| `{{1}}` | Nombre del cliente | `orders.customer_name` | `María García` |
| `{{2}}` | Número de pedido | `orders.order_number` | `ORD-20260720-A1B2C3` |
| `{{3}}` | Nombre de la tienda | `stores.name` | `Panadería Dulce Hogar` |
| `{{4}}` | Transportadora | `orders.shipping_carrier` | `Servientrega` |
| `{{5}}` | Número de guía | `orders.tracking_number` | `1234567890` |
| `{{6}}` | Entrega estimada | `orders.estimated_delivery_at`; `Por confirmar` si está vacía | `3 de agosto de 2026` |
| `{{7}}` | Seguimiento | `orders.tracking_url`; si está vacío, instrucción para consultar con transportadora y guía | `https://transportadora.example/rastrear/1234567890` |

La transportadora y la guía son obligatorias para un envío nacional. El
enlace de seguimiento es siempre opcional: cuando no existe, el mensaje indica
al cliente que consulte el despacho con la transportadora usando su guía.
En una entrega local todos estos datos son opcionales; si se registra una guía,
transportadora, fecha o enlace, se agregan al mensaje **En camino** y los campos
vacíos simplemente se omiten.

---

## Mensaje de prueba

El botón **Enviar mensaje de prueba** reutiliza
`melosoft_order_confirmation_v1` con nueve valores sintéticos claramente
marcados como prueba. No existe una segunda plantilla que el comercio deba
crear, esperar o administrar. De esta manera la prueba valida exactamente la
misma plantilla y ruta que utilizarán los pedidos reales, y el estado
**Aprobada** de la pantalla siempre corresponde a lo que se intenta enviar.

---

## Cómo se crean ahora (automático por tienda, vía API)

Después de que una tienda completa Embedded Signup
(`/admin/stores/:storeId/whatsapp` → "Conectar WhatsApp Business"), el
owner hace clic en **"Verificar plantilla"**. Eso llama a la Edge
Function `whatsapp-template-sync`, que:

1. Busca `melosoft_order_confirmation_v1` y `melosoft_order_status_v1`; si la
   tienda ofrece envío nacional, también busca `melosoft_order_shipment_v1` en
   su WABA (`GET /{waba_id}/message_templates?name=...`).
2. Crea automáticamente cualquiera que falte (`POST
   /{waba_id}/message_templates`) con los textos de este documento.
3. Guarda los tres estados devueltos por Meta (`pending`/`approved`/
   `rejected`/`paused`/`disabled`) en `store_whatsapp_connections`.

Después, el webhook `message_template_status_update` mantiene ese estado
sincronizado automáticamente cuando Meta termina la revisión. Si el webhook
se habilitó después de que Meta ya había aprobado la plantilla, el botón
**"Verificar plantilla"** recupera el estado actual por Graph API. La
búsqueda selecciona el idioma exacto (`es_CO`), incluso si la WABA conserva
otra variante del mismo nombre (por ejemplo, una versión anterior `es_MX`).

La confirmación inicial y las pruebas usan la primera plantilla; la recogida,
el domicilio local, la entrega y la cancelación usan la segunda; solamente el
envío nacional usa la tercera. El sistema **no envía nada** con una plantilla
hasta que su estado sea `approved` — un
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
template_name` y el nombre guardado en `store_whatsapp_connections` deben
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
