# URLs profesionales y dominios propios en Vercel

La arquitectura recomendada para producción es:

- Panel de la plataforma: `https://app.tu-plataforma.com`
- Sitio institucional opcional: `https://www.tu-plataforma.com`
- URL incluida de cada empresa: `https://nombre-empresa.tu-plataforma.com`
- Dominio propio opcional: `https://www.empresa.com`

La dirección antigua `/s/nombre-empresa` se conserva únicamente como compatibilidad. La aplicación muestra, copia y comparte el subdominio profesional.

## Decisión de infraestructura

Cloudflare no es obligatorio. Como la aplicación vive en Vercel, la opción más simple y mantenible es usar Vercel para tráfico, DNS, dominios comodín, dominios de clientes y certificados TLS.

Namecheap sigue siendo el registrador: allí se compra y renueva el dominio. Solo se delega la administración DNS a Vercel. No es necesario transferir el dominio ni pagarlo nuevamente.

Vercel exige usar sus nameservers para un dominio comodín. Antes de cambiarlos, copia en Vercel todos los registros DNS existentes, especialmente MX, SPF, DKIM, DMARC y cualquier TXT usado por correo. Los nameservers son:

```text
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Documentación oficial: [dominios comodín](https://vercel.com/docs/domains/working-with-domains#wildcard-domain), [nameservers de Vercel](https://vercel.com/docs/domains/working-with-nameservers) y [cambio de DNS en Namecheap](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/).

## 1. Configuración inicial de Vercel y Namecheap

1. Despliega este proyecto en Vercel.
2. En `Project → Settings → Domains`, agrega `app.tu-plataforma.com` y el comodín `*.tu-plataforma.com` al proyecto de esta aplicación.
3. Configura el dominio raíz y `www` como redirección a `app`, o asígnalos a un proyecto institucional separado. Una asignación explícita tiene prioridad sobre el comodín.
4. Registra en Vercel cualquier MX/TXT/CNAME que ya exista y deba conservarse.
5. En Namecheap abre `Domain List → Manage → Nameservers`, selecciona `Custom DNS` y configura los dos nameservers de Vercel.
6. Espera hasta que Vercel muestre el dominio y el comodín como válidos y con certificado.

El comodín se configura una sola vez. No se crea un registro DNS por empresa: Vercel dirige automáticamente todos los hostnames de primer nivel al mismo despliegue y la aplicación resuelve la tienda usando el slug globalmente único.

## 2. Variables del frontend en Vercel

Configura las tres variables para Production, Preview y Development cuando corresponda:

```env
VITE_PUBLIC_SITE_URL=https://app.tu-plataforma.com
VITE_STOREFRONT_ROOT_DOMAIN=tu-plataforma.com
VITE_PLATFORM_HOSTNAMES=app.tu-plataforma.com,www.tu-plataforma.com
```

Después vuelve a desplegar. `VITE_STOREFRONT_ROOT_DOMAIN` no debe incluir protocolo, ruta ni `*.`.

## 3. Base de datos y slugs

La migración `083_store_custom_domains.sql`:

- hace el slug globalmente único;
- exige que sea una etiqueta DNS válida;
- reserva nombres de infraestructura como `app`, `www`, `admin`, `api` y `mail`;
- publica `resolve_store_subdomain(slug)` para resolver únicamente empresas activas;
- crea la tabla y el RPC seguro para dominios propios verificados.

Antes de aplicar la migración, revisa si existen slugs duplicados o no válidos. La migración se detendrá con un error claro para evitar asignar una URL equivocada a una empresa.

```sql
select lower(slug) as slug, count(*)
from public.stores
group by lower(slug)
having count(*) > 1;

select id, name, slug
from public.stores
where slug <> lower(slug)
   or length(slug) not between 2 and 60
   or slug !~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$';
```

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
supabase secrets set STOREFRONT_ROOT_DOMAIN=tu-plataforma.com
supabase secrets set PLATFORM_HOSTNAMES=app.tu-plataforma.com,www.tu-plataforma.com
supabase functions deploy manage-store-domain
```

`VERCEL_TEAM_ID` solo es necesario si el proyecto pertenece a un equipo. Crea el token en la cuenta o equipo propietario del proyecto y guárdalo exclusivamente como secreto de Supabase, nunca con prefijo `VITE_`.

La integración usa las APIs oficiales para [agregar](https://vercel.com/docs/rest-api/projects/add-a-domain-to-a-project), [verificar](https://vercel.com/docs/rest-api/projects/verify-project-domain) y [comprobar la configuración](https://vercel.com/docs/rest-api/reference/endpoints/domains/get-a-domains-configuration) de cada dominio.

## 5. Experiencia de la empresa

Cada empresa recibe inmediatamente `https://su-slug.tu-plataforma.com`. Si su plan habilita `store_limits.can_use_custom_domain`, puede abrir `Configuración → Dominio` y conectar `www.empresa.com`, `empresa.com` o un subdominio.

La pantalla muestra los registros exactos que debe crear:

- `A` para un dominio raíz cuando Vercel lo recomienda;
- `CNAME` para `www` u otro subdominio;
- `TXT` si Vercel necesita comprobar propiedad.

Al verificar, Vercel asigna el dominio al proyecto y administra HTTPS automáticamente. La URL incluida nunca desaparece, así que un error DNS del cliente no deja la tienda sin acceso.

## Costos y límites

- Namecheap continúa cobrando únicamente la renovación normal del dominio de la plataforma.
- No hay que comprar un dominio por empresa para ofrecer `empresa.tu-plataforma.com`; el comodín cubre todos esos subdominios.
- Vercel Hobby es solo para uso personal y no comercial. Para esta plataforma comercial corresponde Vercel Pro.
- Vercel Pro parte de USD 20 al mes por asiento de desarrollador e incluye USD 20 de crédito de uso; el consumo que supere lo incluido se factura según tráfico y recursos.
- Vercel documenta dominios ilimitados en Pro con un límite flexible de 100.000 dominios por proyecto. No publica un cargo fijo mensual por cada dominio agregado al proyecto.
- Supabase, correo y otros proveedores conservan sus propios planes y consumos.

Consulta los valores vigentes antes del lanzamiento: [precios de Vercel](https://vercel.com/pricing) y [límites de dominios](https://vercel.com/docs/limits#domains).

## Pruebas de aceptación

- `empresa.tu-plataforma.com` abre home, catálogo, producto, oferta, carrito, checkout, políticas y retorno de Wompi.
- El nombre de la empresa y su favicon aparecen en la pestaña tanto en el subdominio incluido como en el dominio propio.
- Dos empresas no pueden usar el mismo slug ni reclamar el mismo hostname.
- Los nombres reservados nunca se pueden asignar a una empresa.
- Un hostname no verificado no revela datos de ninguna tienda.
- `staff` y `viewer` no pueden crear, cambiar ni eliminar dominios.
- `/s/:slug` sigue funcionando como ruta heredada, pero no se presenta como URL principal.
- Si el dominio propio falla, el subdominio incluido permanece operativo.
