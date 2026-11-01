# Selector de citas sin pagos vinculados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un selector de citas (`appointments`) sin pagos vinculados en `RegisterPaymentDialog`, que aparece solo cuando hay al menos una, con opción "Sin cita" por defecto.

**Architecture:** El componente consulta `fetch("/api/balances")`, extrae `items` del cliente, deduplica `appointmentId`, filtra las que ya tienen `payments.appointment_id`, y renderiza un `<select>`. El valor elegido se envía como `appointmentId` en `POST /api/payments`.

**Tech Stack:** Next.js 14 + TypeScript + React (client component), Drizzle ORM, Tailwind CSS.

## Global Constraints
- Solo modificar `src/components/RegisterPaymentDialog.tsx`.
- Reutilizar `inputCls` para estilos.
- Móvil-first.
- Si no hay citas sin pagos, no renderizar el selector.
- El selector va después de "Fecha del pago" y antes de "Monto en Bs".
---

### Task 1: Estado y efectos

- [ ] Agregar estados `appointmentId`, `appointments` en `RegisterPaymentDialog`.
- [ ] Agregar `useEffect` con `[clientId]` que hace `fetch("/api/balances")`, filtra `clients` por `clientId`, deduplica `items` por `appointmentId`, y guarda `appointments`.
- [ ] Hacer segunda petición `fetch("/api/payments?userId=" + clientId)` para excluir citas con pagos vinculados (`appointmentId` en pagos). Establecer estado final solo con `unlinked`.

### Task 2: Submit y render

- [ ] En `submit()`, agregar `body.appointmentId = appointmentId ? appointmentId : null`.
- [ ] Renderizar `<select>` condicional (`appointments.length > 0`) después del bloque de fecha del pago. Incluir `<option value="">Sin cita</option>` y opciones de `appointments` (label con servicio + fecha).

### Task 3: Verificación y commit

- [ ] `npm run build` sin errores.
- [ ] Prueba manual: cliente con cita pendiente sin pagos → aparece selector; guardar con cita seleccionada → `appointmentId` en body; guardar con "Sin cita" → `appointmentId: null`.
- [ ] `git commit -m "feat: agregar selector de citas sin pagos vinculados en RegisterPaymentDialog"`
