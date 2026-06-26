# CLAUDE.md — Guía permanente para melosoft-commerce

Este archivo es la guía de referencia obligatoria para Claude en todas las conversaciones sobre este proyecto.

---

## Objetivo del proyecto

`melosoft-commerce` es una **plataforma generadora de ecommerce multiempresa**. Desde un panel administrativo centralizado se pueden crear tiendas/empresas mediante formularios simples, y el sistema genera automáticamente su ecommerce público completo.

**No es** un panel de ofertas solitario, herramienta de marketing, analítica de campañas, ni creador de landing pages.

**Modelo conceptual:**
```
Plataforma (Melosoft Commerce)
  └── Tiendas / Empresas
        └── Productos
        └── Ofertas (funcionalidad dentro del ecommerce)
        └── Pedidos
        └── Pagos (Wompi)
```

---

## Stack obligatorio

| Capa | Tecnología |
|---|---|
| Framework | React 19 |
| Lenguaje | TypeScript (strict) |
| Build | Vite |
| Estilos | TailwindCSS |
| Backend / Auth / Storage | Supabase |
| Estado global | Redux Toolkit + React Redux |
| Enrutamiento | React Router DOM v7 |
| Formularios | Formik + Yup |
| Iconos | lucide-react |
| Utilidades CSS | clsx |

---

## Módulos permitidos

1. Autenticación administrativa (Supabase Auth)
2. Panel administrativo multiempresa
3. CRUD de tiendas/empresas
4. Configuración de tema y apariencia por tienda
5. Configuración de políticas por tienda
6. CRUD de productos por tienda
7. Subida de imágenes (Supabase Storage — bucket `store-assets`)
8. CRUD de ofertas con contador regresivo por tienda
9. Gestión de pedidos por tienda
10. Configuración de pagos Wompi por tienda (arquitectura segura)
11. Página pública de ecommerce por tienda (`/s/:storeSlug`)
12. Página pública de producto (`/s/:storeSlug/p/:productSlug`)
13. Página pública de oferta con contador (`/s/:storeSlug/o/:offerSlug`)
14. Página de políticas (`/s/:storeSlug/policies`)

---

## Módulos estrictamente prohibidos

- Métricas de campañas
- Analítica de campañas
- Meta Pixel / Facebook Pixel
- Eventos de conversiones
- Reportes de marketing
- Dashboard de campañas
- Cualquier integración de tracking externo
- Llaves privadas de pagos en frontend

**Nunca sugieras, implementes ni menciones estos módulos.**

---

## Arquitectura de carpetas

```
src/
  app/          # Redux store y hooks tipados
  assets/       # Imágenes y recursos estáticos
  components/
    layout/     # AdminLayout, PublicLayout
    ui/         # Button, Input, Textarea, Select, Card, Badge, EmptyState, PageHeader, LoadingScreen
  features/
    auth/       # authSlice, authService, auth.mapper, useAuthBootstrap, auth.types
    stores/     # storesSlice, storesService, stores.mapper, stores.types
    products/   # productsSlice, productsService, products.mapper, products.types
    offers/     # offersSlice, offersService, offers.mapper, offers.types
    orders/     # ordersSlice, ordersService, orders.mapper, orders.types
    payments/   # paymentsSlice, paymentsService, payments.mapper, payments.types
  lib/          # supabase.ts, env.ts
  pages/
    auth/       # LoginPage
    admin/      # DashboardPage, StoresPage, StoreFormPage, StoreDetailPage,
                # StoreSettingsPage, ProductsPage, ProductFormPage,
                # OffersPage, OfferFormPage, OrdersPage, PaymentsPage
    public/     # StoreHomePage, ProductLandingPage, OfferLandingPage, StorePoliciesPage
    AccessDeniedPage
  routes/       # AppRouter, ProtectedRoute, PlatformAdminRoute, StoreAccessRoute
  schemas/      # login, store, storeTheme, storePolicies, product, offer, order, paymentSettings
  types/        # common.types, database.types
  utils/        # cn, slugify, formatCurrency, countdown, whatsapp, permissions

supabase/
  migrations/
    001_initial_schema.sql
    002_storage_policies.sql
    003_seed_payment_providers.sql
    004_roles_memberships_and_limits.sql
    005_seed_platform_admin.sql
  functions/
    create-wompi-payment/index.ts
    wompi-webhook/index.ts
  seed/
    001_seed_dev_data.sql
```

---

## Sistema de roles y permisos

### Roles de plataforma (tabla `profiles`)
| Rol | Descripción |
|---|---|
| `platform_admin` | Superadmin — acceso total. Puede crear tiendas, gestionar miembros, ajustar límites de plan. Solo usuarios internos de Melosoft. |
| `platform_member` | Usuario registrado — acceso solo a tiendas donde tiene membresía. |

### Roles por tienda (tabla `store_members`)
| Rol | Permisos |
|---|---|
| `owner` | Todos los permisos en la tienda (asignado automáticamente al creador). |
| `admin` | Configuración, productos, ofertas, pedidos, pagos. |
| `staff` | Productos, ofertas, pedidos. |
| `viewer` | Solo lectura. |

### Reglas críticas
- **Solo `platform_admin` puede crear tiendas.** No hay registro libre de tiendas.
- **Los permisos reales están en RLS de Supabase** (migration 004). El frontend solo los usa para UX.
- **No hardcodear emails ni IDs en el frontend** para decidir permisos. Leer siempre desde `state.auth.profile`.
- La seguridad real está en la base de datos — el frontend es solo UX.

### Helpers del frontend
- `src/utils/permissions.ts` — `isPlatformAdmin()`, `canAccessStore()`, `canManageStore()`, `canManageCatalog()`, etc.
- `src/routes/PlatformAdminRoute.tsx` — guard para rutas de platform_admin.
- `src/routes/StoreAccessRoute.tsx` — guard para rutas por tienda (membresía o platform_admin).

### Guardianes de rutas
```
/admin/stores          → PlatformAdminRoute (solo platform_admin)
/admin/stores/new      → PlatformAdminRoute
/admin/stores/:storeId → StoreAccessRoute (miembro activo O platform_admin)
/admin/stores/:storeId/... → StoreAccessRoute
```

### Bootstrap de auth
`useAuthBootstrap` (en `src/features/auth/useAuthBootstrap.ts`):
1. Restaura sesión con `getSession()`
2. Carga perfil con `authService.getCurrentProfile(userId)` → dispatch `setProfile()`
3. Despacha `setBootstrapping(false)` al terminar
4. Escucha `onAuthStateChange` para mantener perfil actualizado

---

## Rutas del proyecto

### Admin (protegidas)
| Ruta | Componente | Guard |
|---|---|---|
| `/login` | LoginPage | pública |
| `/access-denied` | AccessDeniedPage | pública |
| `/admin` | DashboardPage | ProtectedRoute |
| `/admin/stores` | StoresPage | PlatformAdminRoute |
| `/admin/stores/new` | StoreFormPage | PlatformAdminRoute |
| `/admin/stores/:storeId` | StoreDetailPage | StoreAccessRoute |
| `/admin/stores/:storeId/settings` | StoreSettingsPage | StoreAccessRoute |
| `/admin/stores/:storeId/products` | ProductsPage | StoreAccessRoute |
| `/admin/stores/:storeId/products/new` | ProductFormPage | StoreAccessRoute |
| `/admin/stores/:storeId/products/:productId/edit` | ProductFormPage | StoreAccessRoute |
| `/admin/stores/:storeId/offers` | OffersPage | StoreAccessRoute |
| `/admin/stores/:storeId/offers/new` | OfferFormPage | StoreAccessRoute |
| `/admin/stores/:storeId/offers/:offerId/edit` | OfferFormPage | StoreAccessRoute |
| `/admin/stores/:storeId/orders` | OrdersPage | StoreAccessRoute |
| `/admin/stores/:storeId/payments` | PaymentsPage | StoreAccessRoute |

### Públicas
| Ruta | Componente |
|---|---|
| `/s/:storeSlug` | StoreHomePage |
| `/s/:storeSlug/p/:productSlug` | ProductLandingPage |
| `/s/:storeSlug/o/:offerSlug` | OfferLandingPage |
| `/s/:storeSlug/policies` | StorePoliciesPage |
| `*` | NotFoundPage |

---

## Convenciones de arquitectura

- **La tabla central es `stores`.** Todo producto, oferta, pedido y pago pertenece a una tienda.
- **`profiles`** es la fuente de verdad del rol de plataforma. Nunca hardcodear emails en frontend.
- **`store_members`** es la fuente de verdad del rol por tienda.
- **Separación estricta**: UI, lógica de negocio y acceso a datos en capas distintas.
- La lógica de Supabase **solo** va en los archivos `*Service.ts` dentro de `features/`.
- Los componentes **nunca** importan directamente `supabase` ni llaman a la base de datos.
- Los slices de Redux no llaman a servicios directamente; usan `createAsyncThunk` o despachan acciones síncronas.
- Los layouts usan `<Outlet />` de React Router DOM.
- Los formularios usan Formik con validación Yup definida en `schemas/`.

---

## Reglas de TypeScript

- `strict: true` siempre activo.
- **No usar `any`** bajo ninguna circunstancia.
- Usar `import type` para importaciones que solo son tipos.
- No usar `enum`; usar `type` con unión de strings literales.
- Todos los parámetros de función deben tener tipo explícito.
- Usar `_nombre` para parámetros intencionalmente no utilizados.

---

## Reglas para Supabase

- La inicialización del cliente solo en `src/lib/supabase.ts`.
- Las variables de entorno solo se leen en `src/lib/env.ts`.
- El acceso a tablas solo en los archivos `*Service.ts`.
- Nunca importar `supabase` directamente en componentes o slices.
- Storage bucket: `store-assets`.
- Paths de storage: `{owner_id}/stores/{store_id}/logo/`, `.../products/{product_id}/`, `.../offers/{offer_id}/`.

---

## Reglas de pagos

- Las llaves privadas de Wompi **NUNCA** van en el frontend.
- `private_key_reference` e `integrity_secret_reference` en `store_payment_settings` son referencias de nombre, no llaves reales.
- El pago se inicia desde la Edge Function `create-wompi-payment`.
- El webhook llega a la Edge Function `wompi-webhook`.
- Los secretos se configuran con `supabase secrets set WOMPI_PRIVATE_KEY=...`.

---

## Convenciones de mappers

Los mappers viven en `features/{domain}/{domain}.mapper.ts`:
- `mapXRowToX(row)` — DB → app model
- `mapXInsertToRow(data, ownerId?)` — app → DB insert
- `mapXUpdateToRow(data)` — app → DB update

El `ownerId` siempre proviene de la sesión dentro del service, nunca del formulario.

---

## Convenciones de auth bootstrap

El hook `useAuthBootstrap` en `src/features/auth/useAuthBootstrap.ts`:
- Se llama una sola vez en `App.tsx`.
- Llama a `getSession()` al montar para restaurar sesión existente.
- Suscribe a `onAuthStateChange`.
- Dispatch `setBootstrapping(false)` cuando el check inicial termina.

`ProtectedRoute` muestra `<LoadingScreen />` mientras `isBootstrapping = true`.

---

## Roadmap por fases

### Fase 1 — Base arquitectural ✅
### Fase 2 — Supabase + Auth real ✅
### Fase 3 — Arquitectura multiempresa completa ✅
### Fase 4 — Roles, permisos y control de acceso ✅

- Migraciones 004 y 005: profiles, store_members, store_limits.
- Helpers RLS con SECURITY DEFINER: is_platform_admin, is_store_member, has_store_role, is_store_owner.
- Trigger auto-create profile (on_auth_user_created).
- Trigger auto-create store_members + store_limits (on_store_created).
- Backfill para usuarios y tiendas existentes.
- Stores.status constraint actualizado (añade 'suspended').
- RLS rediseñado: todas las políticas basadas en roles, no en owner_id directo.
- database.types.ts: perfiles, store_members, store_limits añadidos.
- common.types.ts: PlatformRole, UserStatus, StoreMemberRole, StoreMemberStatus, PlanKey, StoreStatus extendido.
- auth.types.ts: Profile interface, AuthState con profile.
- auth.mapper.ts: mapProfileRowToProfile.
- authService: getCurrentProfile() añadido.
- authSlice: setProfile action, profile en estado inicial.
- useAuthBootstrap: carga profile tras restaurar sesión.
- stores.types.ts: StoreMember, StoreLimit, StoresState extendido.
- stores.mapper.ts: mappers para StoreMember y StoreLimit.
- storesService: getMyMemberships, getStoreMembers, addStoreMember, updateStoreMemberRole, deactivateStoreMember, getStoreLimits, updateStoreLimits.
- storesSlice: memberships y limits en estado.
- permissions.ts: helpers frontend para UX.
- PlatformAdminRoute, StoreAccessRoute: route guards.
- AccessDeniedPage: página de acceso denegado.
- AppRouter: rutas envueltas con guards correctos.
- AdminLayout: muestra rol Platform Admin en header.
- DashboardPage: banner Platform Admin, sección Tiendas solo si es admin.
- StoreDetailPage: secciones de miembros y límites según rol.
- Build: 0 errores TypeScript.

### Fase 5 — Creación completa de empresas desde superadmin ✅

- Migraciones 007-010: campos onboarding (slogan, business_type, theme_preset, phone...), store_locations, store_business_hours, vistas públicas actualizadas, grants.
- Edge Function `create-store-with-owner`: crea owner en Auth (invite), profile, store, theme, policies, location, hours.
- `src/utils/themePresets.ts`: 6 paletas (blue/violet/emerald/rose/amber/slate) × 2 modos.
- `src/schemas/storeCreation.schema.ts`: validación Yup de 6 secciones.
- `StoreFormPage`: formulario completo (propietario, empresa, diseño, ubicación, horarios, políticas).
- `StoresPage`: datos reales desde storesService.
- `StoreDetailPage`: carga store/limits/members reales.
- Build: 0 errores TypeScript.

### Fase 5.5 — Sucursales y disponibilidad por sucursal ✅

- Migración 026: multi-location `store_locations` (drop UNIQUE, add name/slug/is_primary/is_active/allows_pickup/allows_local_delivery/phone/whatsapp_number/sort_order/delivery_notes/pickup_notes); trigger `enforce_single_primary_location`; tablas `geo_departments` + `geo_cities` (33 depts + ~155 ciudades Colombia); tabla `product_location_availability` con RLS; `orders.store_location_id`; vista `public_store_locations`; RPC `create_store_order` con `p_store_location_id uuid DEFAULT NULL`.
- Edge Function `create-store-with-owner`: crea sede principal con `name='Sede principal'`, `is_primary=true`, `is_active=true`.
- `src/features/geo/`: `geo.types.ts`, `geoService.ts` — `getDepartments(countryCode)`, `getCities(departmentId)`.
- `src/features/locations/`: `locations.types.ts` (`StoreLocation`, `PublicStoreLocation`), `locations.mapper.ts`, `locationsService.ts` (`getStoreLocations`, `createLocation`, `updateLocation`, `deleteLocation`, `setPrimaryLocation`, `getPublicStoreLocations`).
- `src/features/products/`: `productAvailability.types.ts`, `productAvailabilityService.ts` — modelo "absent row = available".
- `src/lib/locations/locationContext.tsx`: `PublicLocationProvider` + `useSelectedLocation` — persiste en localStorage `melosoft_location_{storeSlug}`.
- `src/components/public/locations/LocationSelector.tsx`: selector de sucursal (oculto si solo 1 sede).
- `src/pages/admin/LocationsPage.tsx`: CRUD de sucursales — crear, editar, activar/desactivar, marcar principal, eliminar.
- `src/components/layout/AdminLayout.tsx`: link Sucursales con MapPin en ownerNav.
- `src/routes/AppRouter.tsx`: ruta `/admin/stores/:storeId/locations` con StoreAccessRoute.
- `src/components/layout/PublicLayout.tsx`: envuelve con `PublicLocationProvider` antes de `CartProvider`.
- `src/pages/public/StoreHomePage.tsx`: muestra `LocationSelector` (>1 sede) o badge ciudad (1 sede); filtra productos no disponibles con opacidad + `pointer-events-none`.
- `src/pages/public/ProductLandingPage.tsx`: banner "No disponible en esta sucursal" + oculta CTA cuando producto no disponible.
- `src/components/public/cart/CartDrawer.tsx`: lee `selectedLocation`, pasa `storeLocationId` a `createWebOrder`.
- `src/features/orders/orders.types.ts`: `CreateWebOrderPayload.storeLocationId?: string | null`.
- `src/features/orders/ordersService.ts`: pasa `p_store_location_id` al RPC.
- `src/types/database.types.ts`: actualizado `store_locations` (nuevas columnas), añadidos `geo_departments`, `geo_cities`, `product_location_availability`, `public_store_locations` view, `orders.store_location_id`, RPC con nuevo parámetro.
- `src/types/common.types.ts`: añadido `PublicStoreLocation`.
- Build: 0 errores TypeScript. `supabase db push` y `functions deploy` ✅.

### Fase 6 — CRUD de productos y ofertas (siguiente)
- ProductsPage y ProductFormPage con Supabase real
- OffersPage y OfferFormPage con Supabase real
- Subida de imágenes a `store-assets`
- Sección "Disponibilidad por sucursal" en ProductFormPage (usa `productAvailabilityService.upsertAvailability`)

### Fase 7 — Página pública completa del ecommerce
- StoreHomePage con datos reales de public_store_pages
- ProductLandingPage con datos reales
- OfferLandingPage con contador regresivo real (`useCountdown`)
- Aplicar tema/colores de la tienda dinámicamente

### Fase 7 — Pedidos y pagos Wompi reales
- Flujo de pedido desde el ecommerce público
- Implementar Edge Functions Wompi (create + webhook)
- OrdersPage con pedidos reales

### Fase 8 — Pulido y producción
- Manejo de errores global (toast notifications)
- SEO meta tags en páginas públicas
- Deploy en Vercel
- StoreFormPage: reemplazar Input libre por Select con geo_departments/geo_cities

---

*Última actualización: 2026-06-24 (Fase 5.5 completada — sucursales y disponibilidad)*
