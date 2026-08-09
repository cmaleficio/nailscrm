# Spec — Cancelar citas en agenda, eliminar clientes y eliminar servicios

**Fecha:** 2026-08-09
**Estado:** aprobado por el usuario
**Alcance:** Dashboard admin (agenda), CRM de clientes y gestión de servicios.

## Objetivo

1. Botón **Cancelar cita** en la vista **semana** de la agenda (con confirmación).
2. Botón **Eliminar cliente**, solo para clientes **sin movimientos** (citas, pagos/cuentas por cobrar, lista de espera), en la lista de `/dashboard/clients` y dentro del `ClientCRMPanel`.
3. Botón **Eliminar servicio**, en adición al "Desactivar" existente, bloqueado si el servicio tiene citas o compras asociadas.

Todas las acciones piden **confirmación** en un diálogo.

## Decisiones tomadas (con el usuario)

- Eliminar cliente: botón en **cada fila** de la lista **y** dentro del panel CRM.
- Servicio en uso: **bloquear** el DELETE y sugerir desactivar (integridad del historial y balances).
- Confirmación: **sí**, diálogo de confirmación para cancelar cita, eliminar cliente y eliminar servicio.
- Los usuarios con rol `admin` (incluido `ADMIN_EMAIL`) **no se pueden eliminar**.

## Backend / API

### `PATCH /api/appointments/[id]` (modificar)
- Guarda nueva: si `body.status === "cancelled"` y la cita ya está `completed` o `cancelled` → 400 "Esta cita ya no se puede cancelar". (Ya borra los eventos de Google Calendar al cancelar.)

### Nuevo `DELETE /api/clients/[id]` (en `src/app/api/clients/[id]/route.ts`)
- Requiere `isAdmin`.
- 404 si el usuario no existe.
- 403 si `role === "admin"`.
- Cuenta **movimientos**; si alguno > 0 → 400 con mensaje claro:
  - `appointments` donde `client_id = id`
  - `payments` donde `user_id = id`
  - `waitlist` donde `client_id = id`
- Si no hay movimientos → `db.delete(schema.users).where(...)`. Las filas `account`/`session` de Auth.js se borran solas por `ON DELETE CASCADE` (`foreign_keys = ON` en `src/db/index.ts`).
- Respuesta `{ success: true }`.

### Nuevo `DELETE /api/services/[id]` (en `src/app/api/services/[id]/route.ts`)
- Requiere `isAdmin`.
- 404 si el servicio no existe.
- Si hay citas (`appointments.service_id`) o compras (`service_purchases.service_id`) → 400 "El servicio tiene citas o compras asociadas; desactívalo en su lugar".
- Si no tiene uso → `db.delete(schema.services)`; las fotos (`service_photos`) se borran por `ON DELETE CASCADE`.
- Respuesta `{ success: true }`.

## UI / Componentes

### Nuevo componente `src/components/ConfirmDialog.tsx`
- Modal centrado, patrón de los diálogos existentes: `fixed inset-0 z-50 flex items-center justify-center p-4`, overlay `bg-black/30` clicable, panel `max-w-md rounded-2xl bg-white p-6 shadow-xl`.
- Props:
  - `title: string`
  - `message: string`
  - `confirmLabel: string` (default `"Confirmar"`)
  - `danger?: boolean` (botón rojo vs. gris)
  - `onConfirm: () => void | Promise<void>` (con estado "guardando...")
  - `onClose: () => void`
- Sin anidar formularios; solo botones.

### `src/app/(admin)/dashboard/DashboardContent.tsx` — cancelar cita
- Estado nuevo `cancelling: Appointment | null`.
- Vista **semana**: en cada celda de cita (solo si `status` es `pending`/`confirmed`), botón rojo "Cancelar" junto a "Reprogramar"/"Ver" → `setCancelling(appt)`.
- `ConfirmDialog` con `confirmLabel="Cancelar cita"`, `danger`, mensaje `¿Cancelar la cita de <cliente>? Se eliminará también del calendario.`. Al confirmar → `handleCancel(id)` (el `PATCH` existente a `status: cancelled`) + `refreshAll()`.
- Vista **día**: el `onCancel` de `AppointmentCard` también pasa por el mismo `ConfirmDialog` (consistencia).

### `src/app/(admin)/dashboard/clients/ClientsContent.tsx` — eliminar cliente
- Cada fila pasa de `<button>` a `<div>` con:
  - Área clicable (abre el `ClientCRMPanel`, mismo aspecto).
  - Botón "Eliminar" (rojo, `danger`) a la derecha → `ConfirmDialog`.
- Al confirmar → `DELETE /api/clients/{id}`; si 400/403, muestra el error del servidor en el diálogo; si OK → cierra diálogo y refresca la lista (`fetchClients(q)`).
- `ClientCRMPanel` recibe `onDeleted` para cerrarse y refrescar la lista.

### `src/components/ClientCRMPanel.tsx` — eliminar cliente
- Nueva prop opcional `onDeleted?: () => void`.
- Botón "Eliminar cliente" (rojo) al pie del panel (bajo WhatsApp) → `ConfirmDialog`.
- Al confirmar → `DELETE /api/clients/{id}`; error inline en el panel si falla; si OK → `onDeleted()` y `onClose()`.
- En `ClientsContent`: `onDeleted` cierra el panel y recarga la lista.
- En `DashboardContent`: `onDeleted` cierra el panel y llama `refreshAll()` (cliente con citas no se podrá borrar; el mensaje de error lo explica).

### `src/app/(admin)/dashboard/services/ServicesContent.tsx` — eliminar servicio
- Botón "Eliminar" (rojo) junto a "Editar"/"Desactivar" → `ConfirmDialog` (`danger`, mensaje `¿Eliminar el servicio "<nombre>"? Esta acción no se puede deshacer.`).
- Al confirmar → `DELETE /api/services/{id}`; si 400 (servicio en uso) muestra el error; si OK → `fetchServices()` + mensaje "Servicio eliminado".

## Datos de prueba / verificación

- `npx tsc --noEmit` y `npm run lint` (sin errores nuevos).
- Manual (dev server):
  - Vista semana: cancelar una cita `pending`/`confirmed` con confirmación; la cita queda `cancelled` y desaparece de la semana (los eventos de Google se borran).
  - Cancelar una cita `completed` → error 400.
  - Cliente sin movimientos: se elimina desde la fila y desde el panel CRM.
  - Cliente con citas o pagos: DELETE → 400 y mensaje.
  - Cliente admin: DELETE → 403.
  - Servicio sin uso: se elimina (y sus fotos).
  - Servicio con citas/compras: DELETE → 400 y mensaje sugiriendo desactivar.

## Documentación

Al implementar, actualizar en el mismo commit (regla de mantenimiento del repo):
- `agents.md`: rutas `DELETE /api/clients/[id]` y `DELETE /api/services/[id]`, componente `ConfirmDialog`, comportamiento de eliminación.
- `CHANGELOG.md`: entradas en "[Sin publicar] Añadido".
- `README.md`: mención de eliminar clientes sin movimientos y eliminar servicios en las funcionalidades del dashboard.
