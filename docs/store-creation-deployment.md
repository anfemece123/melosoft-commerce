# Despliegue del alta segura de empresas

Este cambio debe publicarse en este orden porque la Edge Function utiliza la
función SQL creada por la migración `140`:

```bash
supabase db push
supabase functions deploy create-store-with-owner
```

Después se despliega el frontend de la forma habitual.

En el proyecto remoto de Supabase también se debe abrir **Authentication →
Sign In / Password security** y configurar:

- Longitud mínima: `12`.
- Requisitos: minúscula, mayúscula, número y símbolo.

No ejecutes `supabase config push` sin revisar primero el resto de
`supabase/config.toml`, porque ese comando sincroniza más ajustes de Auth que
la política de contraseñas.

## Prueba mínima de producción

1. Crear una empresa con un correo nuevo usando **Enviar invitación**.
2. Abrir el correo, establecer una contraseña fuerte y confirmar que el owner
   entra al panel de su empresa.
3. Crear otra empresa con el mismo correo y confirmar que aparece en
   **Cambiar empresa**, sin cambiar los datos ni el rol global del perfil.
4. Crear un restaurante y comprobar que la sede principal permite recogida y
   domicilio local.
5. Confirmar que país y moneda quedan en Colombia/COP, que la ciudad de la
   empresa coincide con la sede principal y que las políticas vacías no se
   publican como textos genéricos.

La empresa continúa creándose con estado `active`; el estado inicial de
publicación queda fuera de este cambio por decisión de producto.
