# Selector de citas sin pagos vinculados en RegisterPaymentDialog

**Fecha:** 2026-10-31
**Estado:** Diseño aprobado (Enfoque A)

## Resumen
En `RegisterPaymentDialog`, tras el campo "Fecha del pago", se agrega un selector (`<select>`) con las citas (`appointments`) del cliente que no tengan pagos vinculados (`payments.appointment_id`). Solo aparece cuando haya al menos una. Incluye opción por defecto "Sin cita". El `appointmentId` seleccionado se envía en `POST /api/payments` y se guarda como vinculación del pago.

## Contexto actual
- `POST /api/payments` ya acepta `appointmentId` (ver `src/app/api/payments/route.ts`). Si es `null`, el pago queda como adelanto global.
- `EditPaymentDialog` ya usa `EditableAppointment[]` y muestra un selector de "Cita vinculada" con opción "Sin cita" (`src/components/EditPaymentDialog.tsx:278-294`).
- `BalancesContent` resuelve citas vinculables con `appointmentsFromItems()` (`src/app/(admin)/dashboard/balances/BalancesContent.tsx:82-93`), que deduplica por `appointmentId` desde los `items` de `/api/balances`.

## Diseño (Enfoque A)
1. `RegisterPaymentDialog` consulta `fetch("/api/balances")` al montar (o cuando cambia `clientId`).
2. Filtra los `clients` para encontrar el del `clientId`. De sus `items` (tipo `BalanceItem`) extrae `appointmentId`, `serviceName`, `startTime`.
3. Deduplica por `appointmentId` (como `appointmentsFromItems`).
4. Consulta `fetch("/api/payments?userId=" + clientId)` (o reutiliza datos de balances si ya los trae) para excluir citas que ya tengan `payments` con ese `appointmentId`.
5. Si quedan citas sin pagos (`> 0`), renderiza `<select>` con opción "Sin cita" + las citas restantes, ordenadas por fecha desc.
6. El valor seleccionado se guarda en estado (`appointmentId`), y se envía en el body de `submit()` como `appointmentId` (o `null` si es vacío / "Sin cita").

## Restricciones
- Móvil-first (ya lo es el componente).
- No modificar interfaces de `BalancesContent` ni `ClientCRMPanel`.
- Reutilizar estilos (`inputCls`).
- Si no hay citas sin pagos vinculados, no renderizar el selector (el pago sigue siendo adelanto, como hoy).

## Archivos a modificar
- `src/components/RegisterPaymentDialog.tsx` (único archivo).

## Pruebas / Verificación
- Verificar que con `clientId` que tiene citas sin pagos, aparece el selector.
- Verificar que con `clientId` sin citas o con todas vinculadas, no aparece.
- Verificar que al guardar con una cita seleccionada, `POST /api/payments` recibe `appointmentId` correcto.
- Verificar que al guardar con "Sin cita", `appointmentId` es `null`.

## Notas
- `appointmentsFromItems` en `BalancesContent` usa `fmtDateTs` para el label; aquí se puede usar la misma función (`new Intl.DateTimeFormat("es-ES", ...).format`) para consistencia.
- El selector debe ir después del bloque "Fecha del pago" y antes del bloque "Monto en Bs" (según pedido del usuario: "luego de la fecha del pago").
