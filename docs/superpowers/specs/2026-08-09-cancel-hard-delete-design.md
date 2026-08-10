# Spec — Hard delete de citas al cancelar + archivo de canceladas

**Fecha:** 2026-08-09
**Estado:** aprobado por el usuario
**Alcance:** Cancelación de citas (dashboard admin y perfil de cliente). Sustituye el soft delete (`status = 'cancelled'`) del spec `2026-08-09-dashboard-cancel-delete-design.md`.

## Objetivo

Al cancelar una cita, en lugar de marcarla `cancelled` (soft delete), se **borra la fila permanentemente** (hard delete) y se **archiva un snapshot** en una tabla de auditoría para poder observarla después. Aplica tanto a la cancelación desde el dashboard admin como desde el perfil del cliente.

## Decisiones tomadas (con el usuario)

- **Hard delete también para el cliente**: cancelar desde `/profile` borra la fila igual que desde el admin.
- **Tabla de archivo**: snapshot completo de la cita cancelada, visible en una pestaña "Canceladas" del dashboard.
- **Pagos huérfanos permitidos**: si una cita tiene pagos, el borrado es válido; `payments.appointment_id` queda `NULL` (ON DELETE SET NULL). El saldo no se afecta (solo cuenta citas `completed`).
- Las citas `completed` **no** se pueden borrar (400).

## Schema (nueva tabla `cancelled_appointments`)

En `src/db/schema.ts`:

- `id` text PK (uuid)
- `appointmentId` text (id original de la cita)
- `clientId` text → users.id
- `serviceId` text → services.id
- `serviceName` text (snapshot de `service_purchases.service_name`)
- `servicePrice` real (snapshot de `service_purchases.service_price`)
- `startTime` integer
- `endTime` integer
- `referencePhotoUrls` text (JSON array de las urls de `appointment_photos`)
- `cancelledBy` text → users.id (actor: cliente o admin)
- `cancelledAt` integer (unix seconds)
- `reason` text (opcional, null por ahora)

Índice en `clientId` y `cancelledAt` para consultas futuras.

## Backend / API

### `DELETE /api/appointments/[id]` (nuevo método en `src/app/api/appointments/[id]/route.ts`)
- Auth: **admin** o **propietario** de la cita (`appointment.clientId === session.user.id`).
- 404 si no existe.
- 400 si `status === 'completed'` ("No se puede cancelar una cita completada").
- Antes de borrar:
  1. Leer `service_purchases` de la cita (para `serviceName`/`servicePrice`) y `appointment_photos` (urls).
  2. Insertar fila en `cancelled_appointments` con el snapshot + `cancelledBy` + `cancelledAt`.
- Borrar eventos de Google Calendar si `google_event_id_client`/`google_event_id_admin` (`deleteEventOnPrimaryCalendar` / `getAdminUserId`, patrón existente).
- `db.delete(schema.appointments)` → cascade quita `service_purchases` y `appointment_photos`; `payments.appointment_id` queda NULL.
- Respuesta `{ success: true, deleted: true }`.

### `POST /api/appointments/[id]/cancel` (eliminar)
- Se borra `src/app/api/appointments/[id]/cancel/route.ts`.
- `ProfileContent` pasa a llamar a `DELETE /api/appointments/[id]`.

### `PATCH /api/appointments/[id]` (modificar)
- Si `body.status === 'cancelled'` → 400 "Usa el método DELETE para cancelar citas".
- Conserva la reprogramación (`startTime`) y el completado (`status: 'completed'` + fotos finales).
- `DashboardContent.handleCancel` pasa a llamar a `DELETE /api/appointments/[id]`.

### `GET /api/appointments/cancelled` (nuevo en `src/app/api/appointments/cancelled/route.ts`)
- Requiere `isAdmin`.
- Lista `cancelled_appointments` con `clientName` (join users), ordenada por `cancelledAt` DESC.
- Retorna todos los campos del snapshot + `clientName`.

## UI / Componentes

### `src/app/(admin)/dashboard/DashboardContent.tsx`
- Tipo `view` pasa a `"day" | "week" | "cancelled"` y se agrega el botón "Canceladas" al toggle existente.
- Vista `cancelled`: tabla simple (fecha/hora, cliente, servicio, precio, quién canceló, cuándo) alimentada por `GET /api/appointments/cancelled`. Si está vacía, mensaje "No hay citas canceladas".
- `handleCancel`: cambia de `PATCH { status: 'cancelled' }` a `DELETE /api/appointments/{id}`.
- Mensaje del `ConfirmDialog` de cancelar: "Se eliminará la cita y quedará registrada en el historial de canceladas."

### `src/app/(client)/profile/ProfileContent.tsx`
- `handleCancel` usa `DELETE /api/appointments/${id}` en lugar de `POST /cancel`.

## Datos de prueba / verificación

- `npx tsc --noEmit` y `npm run lint` (sin errores nuevos).
- Manual (dev server, después de `npm run db:setup`):
  - Admin cancela cita `pending` → desaparece del día/semana, aparece en pestaña "Canceladas" con snapshot, no hay fila en `appointments`, los eventos de GC se borran.
  - Cliente cancela desde `/profile` → desaparece de próximas citas y aparece en "Canceladas" con `cancelledBy = cliente`.
  - Cancelar cita `completed` → 400.
  - `PATCH` con `status: 'cancelled'` → 400.
  - Si la cita tenía pago, el pago sobrevive con `appointment_id = NULL` y el saldo no cambia.
  - Cita inexistente → 404; cliente ajeno a la cita → 403.

## Documentación

Al implementar, actualizar en el mismo commit (regla de mantenimiento del repo):
- `AGENTS.md`: nueva tabla `cancelled_appointments`, `DELETE /api/appointments/[id]`, `GET /api/appointments/cancelled`, pestaña "Canceladas", regla de borrado actualizada (cancelar = hard delete + archivo).
- `CHANGELOG.md`: entrada en "[Sin publicar] Cambiado" describiendo el hard delete al cancelar y el archivo de canceladas.
- `README.md`: mención de la pestaña "Canceladas" y el comportamiento de cancelación.
