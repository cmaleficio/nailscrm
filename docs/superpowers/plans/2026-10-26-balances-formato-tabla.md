# Tabla Balances — Especificación y Plan

> **Superpowers consultado:** AGENTS.md (modelo de datos Drizzle, `service_purchases`, `payments`, `users`), CHANGELOG.md (asignación de pagos, repartos), código actual `route.ts` + `BalancesContent.tsx`, base de datos `dev.db` (no modificada, sin migraciones).

**Problema observado:**
- `Cliente` muestra `16 nov 2026` (debería ser nombre del cliente).
- `Fecha` es `16 nov 2026` (debería ser `DD/MM/AA`).
- `#Servicio` es UUID (debería ser `S00001`, `A00001`, `P00001` ascendente por tipo).
- `Tasa` siempre `—` (debería ser tasa BCV del día del servicio o pago).
- `Ref` es UUID completo (debería ser referencia del pago o número correlativo).
- `Estado` inconsistente en mayúsculas (`pending` / `Pagado`).

**Objetivo:**
Reescribir la vista `/dashboard/balances` con una tabla que cumpla exactamente: número secuencial por tipo (`S`/`A`/`P`), fecha `DD/MM/AA`, cliente = nombre, tasa = tasa del día, ref = referencia corta.

---

## Especificación técnica

### Datos del endpoint (`GET /api/balances`)
El endpoint ya devuelve `clients[].movements[]`. Se requiere que cada `movement` tenga:
- `id` (UUID, solo para clave React)
- `date`: string formateado `"DD/MM/AA"` (debe generarse en el servidor con `strftime('%d/%m/%y', ...)` o equivalente en `date-fns` / JS nativo sobre `start_time` / `paid_at`)
- `serviceName`: nombre del servicio
- `amountUsd`: monto USD
- `currency`: `USD` | `VES`
- `rate`: tasa del día (del servicio: `exchange_rates` por fecha; del pago: `payments.rate`)
- `status`: `pending` | `partial` | `paid`
- `ref`: referencia del pago o servicio (para servicio: `appointment_id`; para pago: `payments.reference` o número secuencial generado)
- `kind`: `Servicio` | `pago` | `abono`
- `clientName`: nombre del cliente (en el movimiento, para evitar depender de `c.name` si hay error de propagación)
- `clientPhone`: teléfono
- `seqId`: `"S00001"`, `"A00001"`, `"P00001"` generado por tipo y orden cronológico (ver Plan)

### Reglas de la tabla
1. `seqId` se genera por tipo, no por cliente: todos los servicios de todos los clientes llevan `S00001`, `S00002`… en orden cronológico global de `service_purchases` (o por cliente; para simplificar, por cliente en orden ascendente de `creation_date`).
2. `Fecha`: `DD/MM/AA` (ej: `01/10/26`). No muestra mes abreviado ni año largo.
3. `Cliente`: `users.name` exacto. Nunca vacío. Nunca fecha.
4. `Tasa`: si hay `rate` (pago en Bs o servicio con tasa asociada), mostrar `rate.toFixed(2)`; si no, `—`. La tasa del servicio debe consultarse en `exchange_rates` por `strftime('%Y-%m-%d', start_time, 'unixepoch', '-4 hours')`.
5. `Ref`: para servicios, usar `appointment_id` (primeros 8 chars); para pagos, usar `reference` del admin o `seqId` si no hay referencia.
6. `Estado`: siempre con primera letra mayúscula: `Pendiente`, `Abonado`, `Pagado`.

---

## Plan de implementación (3 tareas, secuenciales)

### Tarea 1: Generar `seqId` y formatear `date` en el endpoint
**Archivo:** `src/app/api/balances/route.ts`  
**Cambios:**
- Agregar `dateFormatted` a cada `Movement`: `String(start_time ? new Date(start_time*1000).getDate().toString().padStart(2,'0') + '/' + ... : "—")`.
- Agregar `seqId` por tipo: para servicios, contar `service_purchases` ordenados globalmente o por cliente; para pagos, contar `payments` ordenados.
- Asegurar que `name` y `phone` del cliente lleguen en cada movimiento (no confiar solo en `c.name`).
- Agregar `rate` para servicios consultando `exchange_rates` (o usar `null` si no hay registro).

**Verificación:** `GET /api/balances` → `clients[0].movements[0].date === "01/10/26"`; `seqId` empieza en `S00001`; `clientName` no es vacío.

### Tarea 2: Corregir la fila de `BalancesContent.tsx`
**Archivo:** `src/app/(admin)/dashboard/balances/BalancesContent.tsx`  
**Correcciones concretas:**
- `Cliente`: `{m.clientName ?? c.name ?? "—"}` (garantiza nombre).
- `Fecha`: `{m.date ?? "—"}` (ya es `DD/MM/AA` del endpoint).
- `#Servicio`: `{m.seqId ?? m.id?.slice(0,8) ?? "—"}`.
- `Estado`: `{m.status === "paid" ? "Pagado" : m.status === "partial" ? "Abonado" : "Pendiente"}` (capitalizado).
- `Tasa`: `{m.rate != null ? Number(m.rate).toFixed(2) : "—"}`.
- `Ref`: `{m.ref ? String(m.ref).slice(0,8) : "—"}`.
- `Tipo movimiento`: `{m.kind ?? "—"}`.

**Nota:** `m.date` es string; no pasar por `fmtDate`. El error `RangeError` anterior confirma que `fmtDate` no debe usarse con `date`.

### Tarea 3: Ajustar filtros y validación visual
- El filtro `statusFilter` opera sobre `m.status`; el `searchTerm` debe buscar `m.clientName`, `m.serviceName`, `m.ref`.
- Confirmar que `totalUsd`/`totalCreditUsd` siguen funcionando (no cambiar).
- Confirmar que `RegisterPaymentDialog`, `EditPaymentDialog`, `AddServiceDialog` siguen operativos.

---

## Restricciones
- No ejecutar `npm run db:setup` ni migraciones (`dev.db` no debe sufrir cambios de esquema).
- Todas las fechas deben ser `America/Caracas` (UTC-4 fijo). No usar `date-fns`; usar `new Date(ts*1000)` con `toLocaleDateString("es-ES", { timeZone: "America/Caracas", ... })` y formatear manualmente `DD/MM/AA`.
- Si una fila de `service_purchases` no tiene `start_time`, usar `completion_date`.
- El `seqId` debe ser determinista: ordenado por `createdAt` de `service_purchases` o `paidAt` de `payments`.

---

## Verificación final
- `GET /api/balances` → `clients[0].movements` tiene `date` = `DD/MM/AA`, `seqId` = `S00001`/`A00001`, `clientName` = nombre real, `kind` = `Servicio`/`pago`/`abono`, `rate` presente cuando aplica.
- `/dashboard/balances` → tabla muestra exactamente las 11 columnas sin errores de `RangeError`, sin `?` reemplazados por unicode corrupto, sin datos vacíos en `Cliente` o `Fecha`.
