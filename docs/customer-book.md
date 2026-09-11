# Clientes y contactos

El módulo es opcional por empresa y queda apagado por defecto.

## Cómo funciona

- `can_use_customer_book`: habilita la base privada de clientes de la empresa.
- `can_use_customer_capture`: habilita el formulario público de registro.
- Un pedido nuevo se relaciona con una ficha usando correo y/o teléfono. El pedido conserva sus datos originales como histórico.
- Al activar el módulo, el panel vincula los pedidos históricos una sola vez; los datos existentes no se eliminan al desactivarlo.
- El botón **Agregar contacto** permite guardar personas sin pedido y sin suscribirlas a comunicaciones.
- El formulario público solo aparece si la empresa lo activa, tiene política de privacidad publicada y ofrece al menos un canal de comunicación.
- Cada canal (correo y WhatsApp) tiene autorización independiente. El formulario inicia las casillas sin marcar.

## Activación

1. Aplicar la migración con `supabase db push`.
2. Entrar como Super Admin a la empresa y habilitar **Clientes y contactos**.
3. Habilitar **Captación pública** solo si la empresa desea mostrar el formulario.
4. Entrar en **Clientes**, publicar la política de privacidad y configurar el texto, los canales y el teléfono opcional.

La mensajería comercial no se envía automáticamente al guardar un contacto. Para producción debe conectarse a un proveedor transaccional o de suscripciones con dominio autenticado y bajas por canal. La integración existente de pedidos usa Brevo; Gmail no debe utilizarse como motor de envíos masivos.
