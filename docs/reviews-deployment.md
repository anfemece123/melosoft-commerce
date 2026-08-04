# Reseñas verificadas

## Despliegue

```bash
supabase db push
supabase secrets set PUBLIC_SITE_URL=https://commerce.melosoftapp.com
supabase functions deploy upload-review-image
supabase functions deploy send-order-email
```

`PUBLIC_SITE_URL` debe ser el origen público del panel. Los enlaces de reseña
siempre se generan allí para que funcionen igual aunque una empresa no tenga
dominio propio.

## Prueba funcional

1. Abre **Panel → Reseñas** y selecciona **Activas y públicas**.
2. Crea un pedido web que contenga productos y márcalo como entregado.
3. En el detalle del pedido, usa **Vista previa** dentro de **Opinión del cliente**.
4. Califica uno o más productos, agrega comentario y fotos, y envía.
5. Confirma que la reseña aparece en **Panel → Reseñas** y en el producto público.
6. Prueba responder, ocultar y restaurar. Al ocultarla, el comentario desaparece
   pero la estrella continúa en el promedio; al excluirla por incumplimiento,
   deja de contar.

## Modelo de confianza

- Una invitación por pedido entregado, con token no predecible y vencimiento.
- Una reseña por producto de ese pedido.
- El cliente no necesita una cuenta y nunca puede reseñar otro producto.
- Las fotos se comprimen en el navegador, se vuelven a validar en la función y
  quedan limitadas a tres posiciones por reseña.
- Ocultar, restaurar, excluir y responder generan eventos de auditoría.
- Los enlaces o posibles datos de contacto quedan pendientes de revisión.
