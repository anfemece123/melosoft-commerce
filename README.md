# Melosoft Commerce

Plataforma generadora de ecommerce multiempresa. Desde un panel administrativo centralizado puedes crear tiendas/empresas mediante formularios simples y el sistema genera automáticamente su ecommerce público completo.

## Concepto

```
Plataforma (Melosoft Commerce)
  └── Tiendas / Empresas         →  /s/:storeSlug
        └── Productos            →  /s/:storeSlug/p/:productSlug
        └── Ofertas              →  /s/:storeSlug/o/:offerSlug
        └── Pedidos
        └── Pagos (Wompi)
        └── Políticas            →  /s/:storeSlug/policies
```

Cada tienda creada desde el panel genera su propio ecommerce público con logo, colores, productos, ofertas con contador regresivo, WhatsApp y políticas configurables.

---

## Stack

- **React 19** + **TypeScript** (strict)
- **Vite** — build tool
- **TailwindCSS** — estilos
- **Supabase** — backend, auth, storage
- **Redux Toolkit** — estado global
- **React Router DOM v7** — enrutamiento
- **Formik** + **Yup** — formularios y validación
- **lucide-react** — iconos

---

## Setup inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local`:
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

### 3. Crear proyecto Supabase y aplicar migraciones

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Linkear con tu proyecto
supabase link --project-ref TU_PROJECT_REF

# Aplicar todas las migraciones
supabase db push
```

Las migraciones en orden:
1. `001_initial_schema.sql` — Tablas completas, RLS, vistas públicas, índices, triggers
2. `002_storage_policies.sql` — Bucket `store-assets` y políticas de Storage
3. `003_seed_payment_providers.sql` — Seed de Wompi como proveedor de pagos
4. `004_roles_memberships_and_limits.sql` — Profiles, store_members, store_limits, RLS basado en roles
5. `005_seed_platform_admin.sql` — Promueve `andresfelipemelo18@gmail.com` a platform_admin

> **Nota:** Para que la migración 005 surta efecto, el usuario debe haberse registrado primero en `/login`. Si el usuario no existe aún en `auth.users`, la migración es un no-op y debe ejecutarse de nuevo después del registro.

### 4. (Opcional) Cargar datos de ejemplo

En el SQL Editor de Supabase:
1. Crea tu cuenta en `/login`
2. Copia tu UUID desde: Dashboard > Authentication > Users
3. Reemplaza `OWNER_ID_HERE` en `supabase/seed/001_seed_dev_data.sql`
4. Ejecuta el SQL

### 5. Iniciar el proyecto

```bash
npm run dev
```

Ve a `http://localhost:5173/login`.

---

## Rutas

### Admin (protegidas)
| Ruta | Descripción |
|---|---|
| `/login` | Login con Supabase Auth |
| `/admin` | Dashboard con accesos rápidos |
| `/admin/stores` | Lista de tiendas — centro del sistema |
| `/admin/stores/new` | Crear nueva tienda/empresa |
| `/admin/stores/:storeId` | Detalle de una tienda |
| `/admin/stores/:storeId/settings` | Configuración (tema, políticas, pagos) |
| `/admin/stores/:storeId/products` | Productos de la tienda |
| `/admin/stores/:storeId/products/new` | Crear producto |
| `/admin/stores/:storeId/products/:productId/edit` | Editar producto |
| `/admin/stores/:storeId/offers` | Ofertas de la tienda |
| `/admin/stores/:storeId/offers/new` | Crear oferta |
| `/admin/stores/:storeId/offers/:offerId/edit` | Editar oferta |
| `/admin/stores/:storeId/orders` | Pedidos de la tienda |
| `/admin/stores/:storeId/payments` | Configuración de pagos |

### Públicas
| Ruta | Descripción |
|---|---|
| `/s/:storeSlug` | Home del ecommerce de una tienda |
| `/s/:storeSlug/p/:productSlug` | Landing de producto |
| `/s/:storeSlug/o/:offerSlug` | Landing de oferta con contador |
| `/s/:storeSlug/policies` | Políticas de la tienda |

---

## Roles y permisos

| Rol | Alcance | Descripción |
|---|---|---|
| `platform_admin` | Plataforma | Acceso total. Crea tiendas, gestiona miembros, ajusta límites. |
| `platform_member` | Plataforma | Solo accede a tiendas donde tiene membresía activa. |
| `owner` | Por tienda | Todos los permisos de la tienda. |
| `admin` | Por tienda | Configuración, productos, ofertas, pedidos, pagos. |
| `staff` | Por tienda | Productos, ofertas, pedidos. |
| `viewer` | Por tienda | Solo lectura. |

La seguridad real está en RLS de Supabase (migración 004). Los helpers del frontend (`src/utils/permissions.ts`) son solo para UX.

---

## Estructura del proyecto

```
supabase/
  migrations/
    001_initial_schema.sql          # Tablas, RLS, vistas, índices, triggers
    002_storage_policies.sql        # Bucket store-assets y políticas
    003_seed_payment_providers.sql  # Seed inicial de Wompi
    004_roles_memberships_and_limits.sql  # Profiles, store_members, store_limits, RLS por roles
    005_seed_platform_admin.sql     # Designa platform_admin inicial
  functions/
    create-wompi-payment/index.ts   # Edge Function — crear pago Wompi
    wompi-webhook/index.ts          # Edge Function — webhook de Wompi
  seed/
    001_seed_dev_data.sql           # Datos de ejemplo

src/
  app/              # Redux store y hooks tipados
  components/
    layout/         # AdminLayout, PublicLayout
    ui/             # Button, Input, Textarea, Select, Card, Badge...
  features/
    auth/           # authSlice, authService, useAuthBootstrap
    stores/         # storesSlice, storesService, mapper, types
    products/       # productsSlice, productsService, mapper, types
    offers/         # offersSlice, offersService, mapper, types
    orders/         # ordersSlice, ordersService, mapper, types
    payments/       # paymentsSlice, paymentsService, mapper, types
  lib/              # supabase.ts, env.ts
  pages/
    auth/           # LoginPage
    admin/          # DashboardPage, StoresPage, StoreFormPage,
                    # StoreDetailPage, StoreSettingsPage,
                    # ProductsPage, ProductFormPage,
                    # OffersPage, OfferFormPage,
                    # OrdersPage, PaymentsPage
    public/         # StoreHomePage, ProductLandingPage,
                    # OfferLandingPage, StorePoliciesPage
  routes/           # AppRouter, ProtectedRoute
  schemas/          # store, storeTheme, storePolicies,
                    # product, offer, order, paymentSettings, login
  types/            # database.types, common.types
  utils/            # cn, slugify, formatCurrency, countdown, whatsapp
```

---

## Arquitectura de datos

### stores
Tabla central. Cada fila representa un ecommerce público generado.

### store_theme_settings
Configuración visual (modo, colores, template) por tienda. `unique(store_id)`.

### store_policies
Políticas públicas por tienda. `unique(store_id)`.

### products / product_images
Catálogo de productos por tienda. Imágenes en `store-assets/{owner_id}/stores/{store_id}/products/{product_id}/`.

### offers / offer_images
Ofertas promocionales con contador. Imágenes en `store-assets/{owner_id}/stores/{store_id}/offers/{offer_id}/`.

### orders / order_items
Pedidos de clientes por tienda.

### payment_providers
Proveedores de pago de la plataforma (seeded: Wompi). Solo lectura para usuarios normales.

### store_payment_settings
Configuración de pago por tienda. `private_key_reference` e `integrity_secret_reference` son referencias a secretos gestionados en Edge Functions — nunca llaves privadas reales.

### payment_transactions
Registro de transacciones de pago por tienda/pedido.

### Vistas públicas
- `public_store_pages` — datos públicos de tienda activa con theme y políticas
- `public_product_pages` — productos activos de tiendas activas (sin cost_price)
- `public_offer_pages` — ofertas activas no vencidas (sin datos internos)

---

## Pagos (Wompi)

Los pagos se manejan con arquitectura segura:
- El frontend **nunca** maneja llaves privadas
- Las Edge Functions leen secretos desde el environment de Supabase:
  ```bash
  supabase secrets set WOMPI_PRIVATE_KEY=...
  supabase secrets set WOMPI_INTEGRITY_SECRET=...
  ```
- `create-wompi-payment`: recibe `order_id`, valida la orden, inicia pago con Wompi
- `wompi-webhook`: recibe eventos de Wompi, valida firma, actualiza transacciones y pedidos

---

## Scripts

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción
npm run preview   # Preview del build
npm run lint      # Linter
```

---

## Guía de desarrollo

Ver `CLAUDE.md` para convenciones de arquitectura, reglas técnicas y roadmap completo.

---

## Fases

| Fase | Estado | Descripción |
|---|---|---|
| 1 | ✅ | Base arquitectural |
| 2 | ✅ | Supabase + Auth real |
| 3 | ✅ | Arquitectura multiempresa completa |
| 4 | ✅ | **Roles, permisos y control de acceso** (profiles, store_members, RLS, route guards) |
| 5 | Siguiente | Supabase link + db push + CRUD visual de tiendas |
| 6 | Pendiente | CRUD de productos por tienda |
| 7 | Pendiente | CRUD de ofertas por tienda |
| 8 | Pendiente | Pedidos y pagos Wompi reales |
| 9 | Pendiente | Página pública completa del ecommerce |
