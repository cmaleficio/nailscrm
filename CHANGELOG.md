# Changelog

Todas las cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Login por correo/contraseña (Credentials provider de Auth.js) además de Google: página `/login` con `LoginForm`, registro en `/api/auth/register` y columna `password_hash` en `users`.
- Enlace "Entrar" en el `Header` y "Entrar o crear cuenta con correo" en el wizard de reserva para usuarios sin sesión (además del botón Google).
- Seed regenerable del cliente demo (`npm run db:seed:client`): crea/actualiza `clienta@email.com` (contraseña `Cliente123!`) con dirección, notas técnicas, citas próximas y completadas, fotos de referencia/finales, reseñas y snapshots de compra. Re-ejecutable: borra y regenera las citas del demo.
- Roles de usuario: columna `role` (`client` | `admin`) y promoción automática del propietario (`ADMIN_EMAIL`) como admin al iniciar sesión.
- Gestión de administradores: API `/api/admins` y página `/dashboard/admin-users` (solo superadmin) para añadir/quitar admins por email.
- Subida múltiple de fotos de referencia en el booking wizard; tabla `appointment_photos` (1:N).
- Sincronización con Google Calendar: al crear una cita se crean eventos en el calendario del cliente y del admin (`google_event_id_client` / `google_event_id_admin`) con refresh de token.
- Vista de semana y botón "Reprogramar" (con `ReschedulePicker`) en el dashboard; el PATCH de citas re-sincroniza los eventos en Google Calendar.
- Sección "Próximas citas" en /profile.

### Corregido
- Configuración de Auth.js v5: `.env` usa `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (nombres v5) en lugar de `GOOGLE_CLIENT_ID`. Uso de Google ahora inicia sesión correctamente.
- Sesión que se cerraba y 401 en `POST /api/appointments`: errores de configuración de.env.
- Botón "Reservar" que se quedaba en estado de carga: now `submitting` se resetea en `finally` y se muestran errores inline.
- "Ver mis citas" / próxima citas ahora navegan a `/profile`.
- Lint: regla `react-hooks/set-state-in-effect` desactivada en config (patrón de fetch-en-effect del proyecto).
- `agents.md` migrado de UTF-16 (con caracteres corruptos, git lo veía como binario) a UTF-8.

### Reglas de mantenimiento
- Cada cambio relevante obliga a actualizar `AGENTS.md` (si aplica), `CHANGELOG.md` y `README.md` en el mismo commit.