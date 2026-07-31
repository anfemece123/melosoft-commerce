# SEO y vistas previas sociales

## Qué queda automatizado

- WhatsApp, Facebook, X, LinkedIn, Slack, Telegram, Discord, Pinterest y los buscadores reciben HTML generado en Vercel con Open Graph, Twitter Cards, canonical y JSON-LD.
- Cada empresa, producto y oferta obtiene una imagen social cuadrada de 1200×1200 en `/api/og-card`, sin texto incrustado ni recortes.
- Cada hostname de tienda publica su propio `/robots.txt` y `/sitemap.xml`.
- El sitemap solo incluye empresas activas, productos públicos activos, ofertas visibles vigentes y cartas habilitadas.
- Una empresa nueva se crea con `status = active`, por lo que aparece automáticamente en el sitemap. El caché de Vercel puede tardar hasta cinco minutos en reflejarla.
- Los carritos, checkout, resultados de pago, autenticación, administración, borradores e inactivos no se envían a Google.

Google decide cuándo rastrear e indexar. El sitemap acelera y ordena el descubrimiento, pero no garantiza indexación inmediata.

## Despliegue requerido

1. Aplicar `supabase/migrations/131_storefront_seo_sitemap.sql` al proyecto Supabase de producción.
2. Confirmar en Vercel (Production, Preview y Development según corresponda):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PUBLIC_SITE_URL=https://commerce.melosoftapp.com`
   - `VITE_STOREFRONT_ROOT_DOMAIN=melosoftapp.com`
3. Desplegar la aplicación en Vercel.
4. Abrir y verificar:
   - `https://commerce.melosoftapp.com/sitemap.xml`
   - `https://{empresa}.melosoftapp.com/sitemap.xml`
   - `https://{empresa}.melosoftapp.com/robots.txt`

Las funciones aceptan también `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL` y `STOREFRONT_ROOT_DOMAIN` como alias de runtime. Nunca requieren `SUPABASE_SERVICE_ROLE_KEY`.

## Google Search Console (una sola vez)

1. Crear/verificar una propiedad de dominio para `melosoftapp.com` mediante el registro TXT de DNS. Una propiedad de dominio cubre sus subdominios.
2. En **Sitemaps**, enviar `https://commerce.melosoftapp.com/sitemap.xml`.
3. Para una tienda con dominio personalizado, verificar ese dominio en su propia propiedad de Search Console y enviar `https://dominio-personalizado.com/sitemap.xml`.
4. Usar **Inspección de URLs** solo para comprobaciones puntuales o para solicitar un nuevo rastreo manual de una URL importante.

No se usa Google Indexing API: Google la limita a páginas con `JobPosting` o eventos de transmisión `BroadcastEvent`, por lo que usarla con tiendas o productos sería incorrecto.

## Pruebas después del despliegue

```bash
curl -A 'WhatsApp/2.0' 'https://{empresa}.melosoftapp.com/p/{producto}'
curl 'https://{empresa}.melosoftapp.com/sitemap.xml'
curl -I 'https://{empresa}.melosoftapp.com/api/og-card?storeSlug={empresa}&routePath=/p/{producto}'
```

La primera respuesta debe contener `og:title`, `og:description`, `og:image`, `og:url`, canonical y JSON-LD. La tercera debe responder como imagen PNG de 1200×1200.

Para refrescar tarjetas que una red social haya almacenado previamente, usar el Sharing Debugger de Meta y solicitar **Scrape Again** después del despliegue.
