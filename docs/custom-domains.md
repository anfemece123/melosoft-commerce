# URLs profesionales y dominios propios en Vercel

La arquitectura para producción es:

- Panel de la plataforma: `https://commerce.melosoftapp.com`
- URL incluida de cada empresa: `https://nombre-empresa.melosoftapp.com`
- Dominio propio opcional: `https://www.empresa.com`

**Importante:** `melosoftapp.com` (el dominio raíz y `www`) ya pertenecen a
**otra aplicación**, previa y en producción, que no se toca ni se mueve.
Esta plataforma **solo** agrega el subdominio `commerce` y, cuando el
comodín esté listo, cada subdominio `{slug}` — nunca se toca el registro
del apex ni de `www`.

La dirección antigua `/s/nombre-empresa` se conserva únicamente como compatibilidad. La aplicación muestra, copia y comparte el subdominio profesional.

## Decisión de infraestructura

**No cambies los nameservers de Namecheap por defecto.** `melosoftapp.com`
aloja hoy la app anterior y, posiblemente, el correo de la organización.
Delegar el dominio completo a los nameservers de Vercel mueve la
administración de **todos** los registros (MX, SPF, DKIM, DMARC, TXT de
verificación de otros servicios, cualquier subdominio técnico) a Vercel
de una sola vez — si no se replica primero el 100% de la zona actual,
cualquier registro olvidado deja de resolver en el instante del corte,
sin aviso previo. Es una operación reversible en teoría pero de alto
impacto y difícil de diagnosticar bajo presión si algo queda fuera del
inventario.

La alternativa segura, y la que debe usarse salvo decisión explícita en
contrario: **dejar Namecheap como el DNS autoritativo** y agregar en él,
uno por uno, únicamente los registros puntuales que Vercel pida para
`commerce.melosoftapp.com` y el comodín `*.melosoftapp.com`. Esto no
toca nameservers, no mueve la zona, y dejar todo lo demás (apex, `www`,
correo, cualquier otro subdominio) exactamente donde está.

### Paso 0 (obligatorio, antes de tocar nada): identificar quién administra la zona hoy

Antes de decidir cómo se agregan los registros nuevos, confirma:

1. ¿Namecheap es el DNS actual, o el dominio ya fue delegado a otro
   proveedor (Cloudflare, el propio Vercel, etc.) por la app anterior?
   Verifícalo con `dig NS melosoftapp.com +short` o desde el panel de
   Namecheap (`Domain List → Manage → Nameservers`) — si ahí dice
   "Namecheap BasicDNS"/"Custom DNS" apuntando a Namecheap, la zona vive
   ahí; si apunta a otro proveedor, ese es el lugar donde hay que crear
   los registros nuevos, no Namecheap.
2. Exporta o documenta el estado actual completo de la zona (todos los
   registros A, AAAA, CNAME, MX, TXT, CAA, SRV) **antes** de agregar
   nada — es tu punto de rollback si algo falla.

### Con DNS delegado a Vercel (solo si se decide explícitamente)

Si en el futuro se decide delegar nameservers a Vercel de todas formas,
la condición no negociable es: **inventario completo de la zona actual
replicado en Vercel antes del corte**, incluyendo MX/SPF/DKIM/DMARC y
cualquier TXT de verificación de terceros. Los nameservers de Vercel son:

```text
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Documentación oficial: [dominios comodín](https://vercel.com/docs/domains/working-with-domains#wildcard-domain), [nameservers de Vercel](https://vercel.com/docs/domains/working-with-nameservers) y [cambio de DNS en Namecheap](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/).

## 1. Configuración inicial (DNS permanece en el proveedor actual)

1. Despliega este proyecto en Vercel (verifica primero en qué proyecto/dominio vive hoy la app anterior, para no reutilizar el mismo proyecto sin querer).
2. En `Project → Settings → Domains` del proyecto de **esta** aplicación (Melosoft Commerce, no el de la app anterior), agrega `commerce.melosoftapp.com`. Vercel mostrará el registro exacto a crear (normalmente un `CNAME` a `cname.vercel-dns.com`, pero **usa el valor que Vercel muestre en pantalla en ese momento**, nunca un valor asumido de antemano).
3. Copia ese registro exacto en el proveedor DNS identificado en el Paso 0 (Namecheap u otro) — sin tocar nameservers.
4. Repite para el comodín `*.melosoftapp.com`: agrega el dominio en el mismo proyecto de Vercel, copia el registro que muestre (normalmente un `CNAME` en `*`) al proveedor DNS actual.
5. **No toques** el registro del dominio raíz `melosoftapp.com`, `www`, MX, ni ningún otro subdominio existente — pertenecen a la app anterior (o a correo) y deben seguir apuntando exactamente donde están hoy.
6. Espera hasta que Vercel muestre `commerce.melosoftapp.com` y el comodín `*.melosoftapp.com` como válidos y con certificado.
7. Confirma explícitamente que un hostname específico ya existente (p. ej. el que usa la app anterior, si es un subdominio) sigue resolviendo a su proyecto correcto. **Prioridad de registros:** en DNS, un registro específico para un subdominio exacto (p. ej. un `CNAME` propio para `viejo-servicio.melosoftapp.com`) siempre gana sobre el comodín `*.melosoftapp.com` del mismo dominio — el comodín solo responde por los hostnames que no tengan su propio registro explícito. Por eso cualquier subdominio técnico de la app anterior debe quedar con su registro específico intacto (Paso 0) antes de activar el comodín, y además agregarse a la lista de reservados (ver checklist más abajo) para que nadie pueda crear una tienda con ese mismo nombre.

El comodín se configura una sola vez en Vercel. No se crea un registro DNS por empresa: Vercel dirige automáticamente todos los hostnames de primer nivel al mismo despliegue y la aplicación resuelve la tienda usando el slug globalmente único.

### Checklist: subdominios existentes a inventariar antes de activar el comodín

Completa esta lista (el asistente no puede adivinar estos valores — deben salir de tu panel DNS actual) antes de activar `*.melosoftapp.com`. Cada fila que sea un subdominio real y en uso debe (a) conservar su propio registro DNS explícito, y (b) añadirse a la lista de slugs reservados en **ambos** lugares: `RESERVED_STOREFRONT_SUBDOMAINS` en `src/lib/storefront/storefrontSubdomains.ts` y `is_reserved_store_slug()` en `supabase/migrations/097_store_slug_availability.sql` (además de `RESERVED_STORE_SLUGS` en `create-store-with-owner`) — de lo contrario una empresa podría reclamar ese slug y "robarle" el subdominio al servicio existente.

| Subdominio | ¿En uso hoy? | ¿Qué sirve? | ¿Registro DNS propio? | ¿Agregado a reservados? |
|---|---|---|---|---|
| `www` | | (app anterior — no tocar) | | N/A (apex/www no son slugs de tienda) |
| `mail` / `smtp` / similar | | | | |
| _(completar con cada subdominio real que exista)_ | | | | |

## 2. Variables del frontend en Vercel

Configura estas variables para Production (y Preview/Development si aplica) **del proyecto de Melosoft Commerce**:

```env
VITE_PUBLIC_SITE_URL=https://commerce.melosoftapp.com
VITE_STOREFRONT_ROOT_DOMAIN=melosoftapp.com
VITE_PLATFORM_HOSTNAMES=commerce.melosoftapp.com
```

Despliega `VITE_PUBLIC_SITE_URL` de inmediato — es el origen del panel y la base del redirect de Wompi. **Agrega `VITE_STOREFRONT_ROOT_DOMAIN` únicamente cuando el comodín `*.melosoftapp.com` ya tenga DNS y certificado verificados** (paso 1.6): esa variable es el interruptor que activa los subdominios `{slug}.melosoftapp.com` y la redirección automática de `/s/:slug` hacia el subdominio. Antes de eso, `/s/:slug` sigue funcionando igual — no rompe nada dejarla sin configurar. `VITE_STOREFRONT_ROOT_DOMAIN` no debe incluir protocolo, ruta ni `*.`.

Después de cada cambio, vuelve a desplegar.

## 3. Base de datos y slugs

La migración `083_store_custom_domains.sql` (ya aplicada):

- hace el slug globalmente único;
- exige que sea una etiqueta DNS válida;
- reserva un primer conjunto de nombres de infraestructura;
- publica `resolve_store_subdomain(slug)` para resolver únicamente empresas activas;
- crea la tabla y el RPC seguro para dominios propios verificados.

La migración `097_store_slug_availability.sql` (nueva, pendiente de aplicar):

- amplía la lista de reservados — crucialmente agrega `commerce`, el subdominio del panel, además de `login`, `signup`, `webhook`, `supabase` y el resto del set en `is_reserved_store_slug()`;
- agrega la restricción `stores_slug_not_all_numeric`;
- publica `check_store_slug_availability(slug)`, un RPC `platform_admin`-only que el formulario de alta usa para comprobar disponibilidad mientras se escribe, sin exponer nombre/dueño de ninguna tienda existente.

Antes de aplicar `097`, revisa que ningún slug existente choque con la lista ampliada de reservados o sea puramente numérico — la migración aborta con un error claro si eso ocurre, en vez de dejar datos inconsistentes:

```sql
select id, name, slug from public.stores where slug ~ '^[0-9]+$';
-- combina con la lista de is_reserved_store_slug() en la migración si quieres revisar antes de aplicar
```

**No ejecutes `supabase db push` a ciegas.** Ese comando aplica *todas*
las migraciones locales que el proyecto remoto todavía no tiene
registradas, no solo `097`. Antes de correrlo, revisa exactamente qué
va a aplicar:

```bash
# Compara las migraciones locales (supabase/migrations/) contra las
# que el proyecto remoto ya tiene registradas en supabase_migrations.schema_migrations.
# Requiere estar logueado (`supabase login`) y linkeado (`supabase link --project-ref <ref>`).
supabase migration list
```

La columna `Remote` marca lo ya aplicado; cualquier migración listada
solo en `Local` es lo que `db push` aplicaría. Si en ese momento hay más
migraciones locales pendientes que solo `097` (por ejemplo `094`, `095`
o `096`, si tampoco se habían desplegado todavía), `db push` las
aplicaría **todas juntas, en orden, en la misma operación** — no existe
una bandera de `db push` para aplicar solo una migración puntual dejando
el resto pendiente (verificado con la CLI 2.75.0 instalada en este
equipo: `supabase db push --help` no ofrece ese filtro).

Si de verdad se necesita aplicar solo `097` mientras el resto queda
pendiente, la única vía soportada con esta CLI es: (1) pegar el SQL de
`097_store_slug_availability.sql` a mano en el SQL Editor del dashboard
de Supabase (no hay subcomando `supabase db execute` en esta versión de
la CLI — se verificó con `supabase db --help`, que solo lista `diff,
dump, lint, pull, push, reset, start`), y (2) registrar esa versión como
ya aplicada con `supabase migration repair --status applied <version>`
para que un `db push` posterior no intente reaplicarla. Confirma el
comportamiento exacto con `supabase migration repair --help` antes de
usarlo — mover manualmente la tabla de control de migraciones es una
operación delicada.

```bash
supabase db push
```

## 4. Automatización de dominios propios

Los dominios de clientes se agregan al proyecto mediante la API oficial de Vercel. La Edge Function valida sesión, rol, plan, disponibilidad del hostname y estado DNS antes de marcarlo activo. Los tokens nunca llegan al navegador.

Configura estos secretos en Supabase:

```bash
supabase secrets set VERCEL_ACCESS_TOKEN=token_privado
supabase secrets set VERCEL_PROJECT_ID=prj_xxxxxxxxx
supabase secrets set VERCEL_TEAM_ID=team_xxxxxxxxx
supabase secrets set STOREFRONT_ROOT_DOMAIN=melosoftapp.com
supabase secrets set PLATFORM_HOSTNAMES=commerce.melosoftapp.com
supabase functions deploy manage-store-domain
```

`VERCEL_TEAM_ID` solo es necesario si el proyecto pertenece a un equipo. Crea el token en la cuenta o equipo propietario del proyecto y guárdalo exclusivamente como secreto de Supabase, nunca con prefijo `VITE_`.

También corrige el mismo secreto `PLATFORM_HOSTNAMES` para las Edge Functions que lo leen para CORS/redirects de invitación (`create-store-with-owner` ya lo lee dinámicamente; `resend-owner-invite`, `whatsapp-embedded-signup` y `whatsapp-template-sync` tienen `https://commerce.melosoftapp.com` fijo en el código como origen permitido, así que no necesitan el secreto para funcionar, pero conviene desplegarlas junto con `create-store-with-owner` para que las cuatro reflejen el mismo dominio).

La integración usa las APIs oficiales para [agregar](https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project), [verificar](https://vercel.com/docs/rest-api/projects/verify-project-domain) y [comprobar la configuración](https://vercel.com/docs/rest-api/reference/endpoints/domains/get-a-domains-configuration) de cada dominio.

## 5. Alta de una empresa: slug y disponibilidad

En `Empresas → Nueva empresa`, el campo **URL de la tienda** sugiere un slug a partir del nombre (`Centriparts Colombia` → `centriparts-colombia`) usando `normalizeStorefrontSubdomain()` (`src/lib/storefront/storefrontSubdomains.ts`). Mientras el superadmin no lo edite a mano, la sugerencia se sigue actualizando si cambia el nombre; en cuanto lo edita, deja de auto-generarse (hay un botón "Regenerar" para volver a derivarlo del nombre).

Con debounce de 400 ms, el campo llama a `check_store_slug_availability` (migración 097) y muestra: comprobando / disponible / ya usado / reservado / formato inválido / solo números / error de red. El botón "Crear empresa" permanece deshabilitado hasta que la respuesta sea `available: true`. Si el slug está ocupado o reservado, se ofrecen variantes (`-co`, `-oficial`, `-2`, `-3`) ya validadas en formato.

Esa comprobación es solo UX — `create-store-with-owner` vuelve a normalizar, validar formato/longitud/reservados/numérico y depende en última instancia del índice único `stores_slug_global_unique` (migración 083) para resolver una carrera entre dos altas simultáneas con el mismo slug; el perdedor recibe `"La dirección ... ya está en uso."` (409) en vez de un error genérico, y si ya se había invitado un owner nuevo para ese intento, la invitación se revierte automáticamente.

## 6. Experiencia de la empresa

Cada empresa recibe inmediatamente `https://su-slug.melosoftapp.com`. Si su plan habilita `store_limits.can_use_custom_domain`, puede abrir `Configuración → Dominio` y conectar `www.empresa.com`, `empresa.com` o un subdominio.

La pantalla muestra los registros exactos que debe crear:

- `A` para un dominio raíz cuando Vercel lo recomienda;
- `CNAME` para `www` u otro subdominio;
- `TXT` si Vercel necesita comprobar propiedad.

Al verificar, Vercel asigna el dominio al proyecto y administra HTTPS automáticamente. La URL incluida nunca desaparece, así que un error DNS del cliente no deja la tienda sin acceso.

## Costos y límites

- Namecheap continúa cobrando únicamente la renovación normal del dominio de la plataforma.
- No hay que comprar un dominio por empresa para ofrecer `empresa.melosoftapp.com`; el comodín cubre todos esos subdominios.
- Vercel Hobby es solo para uso personal y no comercial. Para esta plataforma comercial corresponde Vercel Pro.
- Vercel Pro parte de USD 20 al mes por asiento de desarrollador e incluye USD 20 de crédito de uso; el consumo que supere lo incluido se factura según tráfico y recursos.
- Vercel documenta dominios ilimitados en Pro con un límite flexible de 100.000 dominios por proyecto. No publica un cargo fijo mensual por cada dominio agregado al proyecto.
- Supabase, correo y otros proveedores conservan sus propios planes y consumos.

Consulta los valores vigentes antes del lanzamiento: [precios de Vercel](https://vercel.com/pricing) y [límites de dominios](https://vercel.com/docs/limits#domains).

## Pruebas de aceptación

- `empresa.melosoftapp.com` abre home, catálogo, producto, oferta, carrito, checkout, políticas y retorno de Wompi.
- El nombre de la empresa y su favicon aparecen en la pestaña tanto en el subdominio incluido como en el dominio propio.
- Dos empresas no pueden usar el mismo slug ni reclamar el mismo hostname.
- Los nombres reservados nunca se pueden asignar a una empresa (incluye `commerce`: debe ser imposible crear una tienda con ese slug).
- Un hostname no verificado no revela datos de ninguna tienda.
- `staff` y `viewer` no pueden crear, cambiar ni eliminar dominios.
- `/s/:slug` sigue funcionando como ruta heredada, pero no se presenta como URL principal.
- Si el dominio propio falla, el subdominio incluido permanece operativo.
