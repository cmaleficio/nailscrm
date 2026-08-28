# Spec — Tres features pequeños (2026-08-28)

## Contexto

El dueño del salón pidió tres cambios pequeños e independientes al MVP:

1. **Quitar la obligatoriedad de la "referencia"** al registrar cobros a clientes y pagos a proveedores. Los admins que manipulan esos módulos pueden omitirla (ej: pago en efectivo sin referencia). Los clientes nunca llegan a esos endpoints (usan `POST /api/payment-receipts`).
2. **Poder registrar un servicio ya realizado sin cita previa** (walk-in retrospectivo, ajuste manual de CXC) que genere una fila en `service_purchases` con CXC igual que una cita.
3. **Editar manualmente el costo promedio (`avg_cost`) de un producto de inventario**, dejando huella en el kardex para auditoría.

---

## Feature 1 — `reference` opcional en cobros y pagos (admin)

### Regla

- Los admins que manipulan cobros y pagos pueden omitir la referencia.
- Los clientes nunca llegan a `POST /api/payments` ni `POST /api/supplier-payments` (ambos requieren permiso de admin); usan `POST /api/payment-receipts` que no tiene campo `reference`.
- La **captura/foto** de `supplier_payments` sigue siendo obligatoria para admins (es evidencia de pago real). La foto del pago del cliente en `payment-receipts` ya era obligatoria y no cambia.

### Diseño

**DB** (`src/db/schema.ts`)
- `payments.reference: text` — quitar `.notNull()` (línea 168).
- `supplier_payments.reference: text` — quitar `.notNull()` (línea 306).
- Migración nueva (`npm run db:setup` genera `drizzle/00XX_*.sql`): `ALTER TABLE payments ALTER COLUMN reference DROP NOT NULL; ALTER TABLE supplier_payments ALTER COLUMN reference DROP NOT NULL;`.

**API** — `src/app/api/payments/route.ts:49`
- Cambiar la condición de `!reference.trim()` por `typeof reference !== "string"` (la guard original `!userId` se mantiene).
- Persistir `reference: typeof reference === "string" && reference.trim() ? reference.trim() : null`.
- No hay rol cliente que llegue aquí (el route ya requiere `hasPermission("balances")`).

**API** — `src/app/api/supplier-payments/route.ts:65-66`
- Mismo cambio: quitar el guard `!body.reference.trim()`.
- Persistir `reference: typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null`.
- La foto (`photoUrl`) sigue siendo 400 si falta (línea 68-70, no cambia).

**No se toca**
- `POST /api/payment-receipts` — el cliente no provee ni necesita `reference`; la aprobación del admin la autollena.
- `PATCH /api/payment-receipts/[id]` — la referencia autollena (`Captura aprobada …`) sigue igual.

**Frontend** (3 diálogos — solo cosmético, ya no hay validación en servidor)
| Dialogo | Archivo | Cambio |
|---|---|---|
| `RegisterPaymentDialog` | `src/components/RegisterPaymentDialog.tsx:166-172` | Quitar el `*` del label `Número de referencia *` |
| `SupplierPaymentDialog` | `src/components/SupplierPaymentDialog.tsx:33,179-184` | Quitar validación cliente de las líneas 70-73. Cambiar placeholder a "Referencia (opcional)" |
| `CompleteAppointmentDialog` | `src/components/CompleteAppointmentDialog.tsx:322-330` | Quitar el `*` del label |

### Pruebas

- Admin crea `payment` sin `reference` → `payments.reference = null`.
- Admin crea `payment` con `reference` → funciona (regresión).
- Admin crea `supplier_payment` sin `reference` → `supplier_payments.reference = null`.
- Admin crea `supplier_payment` sin `photoUrl` → 400 (regresión).
- Cliente reporta pago vía `POST /api/payment-receipts` → funciona igual (regresión).

---

## Feature 2 — Servicio ya realizado (sin cita)

### Objetivo

El admin puede registrar, desde la agenda, desde Balances y desde el CRM, un servicio que ya se hizo (sin cita, sin horario, sin agenda) y que genere la CXC (`service_purchases`) con la misma lógica financiera que una cita `completed`.

### Diseño

**DB** (`src/db/schema.ts:115`)
- Quitar `.notNull()` de `servicePurchases.appointmentId`. El FK con `onDelete: "cascade"` se mantiene; `null` no dispara cascade.
- Migración: `ALTER TABLE service_purchases ALTER COLUMN appointment_id DROP NOT NULL`.

**API nueva** — extender `POST /api/purchases` (`src/app/api/purchases/route.ts`)
- Guard: `hasPermission(session, "balances")`.
- Body: `{ userId: string; serviceId: string; completionDate: number; price?: number; notes?: string }`.
- Pasos:
  1. Validar `userId`, `serviceId`, `completionDate` (número positivo; se permite pasado).
  2. Cargar el `service` (404 si no existe o `is_active = 0`).
  3. Cargar el `user` (404 si no existe; 400 si es admin).
  4. Resolver `price`: `body.price` si es número entre 0.01 y `service.price * 1.5`; si no, `service.price`. (Regla laxa: no más de 150% del precio del servicio para evitar errores.)
  5. Insertar `service_purchases` con: `id = crypto.randomUUID()`, `userId`, `appointmentId = null`, `serviceId`, `serviceName = service.name`, `serviceDescription = service.description`, `servicePrice = finalPrice`, `serviceDurationMins = service.duration_mins`, `financialStatus = "pending"`, `completionDate = body.completionDate`, `createdAt = now`.
  6. Llamar `recomputeFinancialStatus(userId)` + `applyPaidToClient(userId)` desde `@/lib/financial-status`.
  7. Incrementar `users.totalVisits` en 1 (mismo comportamiento que completar una cita).
  8. Responder `{ success: true, id }`.

**Fix crítico** — `src/app/api/clients/[id]/route.ts:52-67`
- INNER JOIN de `appointments` → `LEFT JOIN`.
- Where: `or(eq(schema.appointments.status, "completed"), isNull(schema.servicePurchases.appointmentId))`.
- Sin este fix las compras nuevas no se cuentan en `balanceUsd` del CRM.

**GET /api/purchases** — no requiere cambios (ya devuelve todas las compras del usuario).

**Frontend** — nuevo componente `src/components/AddServiceDialog.tsx`
- Props: `clientId?: string`, `clientName?: string`, `onClose`, `onSaved`.
- Campos: cliente (selector con búsqueda si no viene prellenado, usa `GET /api/clients`), servicio (`<select>`, usa `GET /api/services`), `completionDate` (`datetime-local`, default hoy, permite pasado), precio (default `service.price`, editable), notas.
- Submit → `POST /api/purchases`. Error del servidor se muestra inline.

**Tres puntos de montaje**
| Lugar | Archivo | Acción |
|---|---|---|
| Agenda | `DashboardContent.tsx` (línea ~234-253) | Botón `+ Servicio realizado` junto a `+ Nueva cita`. State `showAddService: boolean`. Montar diálogo. `refreshAll()` en `onSaved`. |
| Balances | `BalancesContent.tsx` (línea ~204-209) | Botón "Servicio realizado" al lado de "Registrar pago". State `addingFor: BalanceClient \| null`. Prellena `clientId`/`clientName`. |
| CRM | `ClientCRMPanel.tsx` (línea ~266-275) | Botón "Registrar servicio" en la sección CXC. State local `showAddService`. |

No toca: reseñas, fotos finales, inventario, Google Calendar.

### Pruebas

- POST crea servicio sin cita → aparece en `GET /api/purchases?userId=...` con `appointmentId = null`.
- El saldo en `/api/clients/[id]` lo incluye (fix INNER JOIN).
- El saldo en `/api/balances` lo incluye (ya era compatible).
- Se registra un pago contra esa compra → `financialStatus` pasa a `paid` o `partial`.
- `users.totalVisits` se incrementa en 1.
- Cancelar una cita existente → su `service_purchases` se borra por CASCADE; la compra huérfana no se ve afectada.

---

## Feature 3 — Edición manual de `avg_cost` con kardex

### Objetivo

El admin con permiso `adjustInventory` puede corregir manualmente el `avg_cost` de un producto. La corrección queda registrada como una fila `kind: "cost_adjust"` en el kardex.

### Diseño

**DB** (`src/db/schema.ts:243`)
- Extender `inventoryMovements.kind` union: `"in" | "out" | "adjust" | "cost_adjust"`.
- Sin cambio de columna (solo type annotation en TS).

**Helper nuevo** en `src/lib/inventory.ts`
```ts
export function applyCostAdjustment(
  itemId: string,
  newAvgCost: number,
  notes: string,
  createdBy: string
): { avgCost: number }
```
- Valida `newAvgCost >= 0` y `notes.trim()` no vacío (throw si falla).
- `UPDATE inventory_items SET avg_cost = ? WHERE id = ?`.
- Inserta `inventory_movements` con `kind: "cost_adjust"`, `quantity: 0`, `unitCostUsd: newAvgCost`, `refType: "manual"`, `notes`, `createdBy`, `createdAt: now`.

**API** — extender `PATCH /api/inventory/items/[id]` (`src/app/api/inventory/items/[id]/route.ts:10-52`)
- Si body trae `avgCost` (number `>= 0`):
  - Gate adicional `canAdjustInventory(session)` → 403 si no tiene `adjustInventory`.
  - `body.costNotes` obligatorio (400 si falta).
  - Llamar `applyCostAdjustment(...)`, devolver item actualizado.
- Si no trae `avgCost` → comportamiento actual sin cambios.

**Frontend** — nuevo `src/components/EditCostDialog.tsx`
- Props: `item: { id, name, avgCost, unit }`, `onClose`, `onSaved`.
- Campos: nuevo costo (number `>= 0`, prefijo `$`), motivo (text, obligatorio, mínimo 3 caracteres).
- Submit → `PATCH /api/inventory/items/[id]` con `{ avgCost, costNotes }`.

**`InventoryContent.tsx`**
- Botón `Editar costo` en la fila de la tabla de productos, visible SOLO si `canAdjust`.
- State local `costEdit: InventoryItem | null`.
- Montar `<EditCostDialog item={costEdit} … />`.
- Kardex: rama `"cost_adjust"` en `kindPill` (color gris/morado, label "Costo") y mostrar `m.unitCostUsd` cuando `kind === "cost_adjust"` y `quantity === 0`.
- Extender `Movement` TS type con `"cost_adjust"`.
- `MovementDialog.tsx` NO se toca (el ajuste de costo vive en su propio mini-diálogo).

### Pruebas

- PATCH con `avgCost` válido + `adjustInventory` → la fila se actualiza y aparece `cost_adjust` en el kardex.
- PATCH con `avgCost` pero SIN `adjustInventory` → 403.
- PATCH con `avgCost` negativo o NaN → 400.
- PATCH sin `costNotes` → 400.
- PATCH sin `avgCost` → comportamiento actual (regresión).
- Factura nueva con `kind: "in"` tras un ajuste manual → el promedio ponderado se calcula correctamente.

---

## Archivos a tocar (resumen)

**DB / migraciones**
- `src/db/schema.ts` (líneas 115, 168, 243, 306)
- `drizzle/00XX_*.sql` — 3 migraciones: `payments.reference` opcional, `supplier_payments.reference` opcional, `service_purchases.appointment_id` opcional

**API**
- `src/app/api/payments/route.ts:49,111`
- `src/app/api/supplier-payments/route.ts:65-66,81`
- `src/app/api/purchases/route.ts` (extender con POST)
- `src/app/api/clients/[id]/route.ts:52-67` (fix LEFT JOIN)
- `src/app/api/inventory/items/[id]/route.ts:10-52` (extender PATCH)
- `src/lib/inventory.ts` (nuevo `applyCostAdjustment`)

**Frontend**
- `src/components/RegisterPaymentDialog.tsx`
- `src/components/SupplierPaymentDialog.tsx`
- `src/components/CompleteAppointmentDialog.tsx`
- `src/components/AddServiceDialog.tsx` (nuevo)
- `src/components/EditCostDialog.tsx` (nuevo)
- `src/app/(admin)/dashboard/DashboardContent.tsx`
- `src/app/(admin)/dashboard/balances/BalancesContent.tsx`
- `src/components/ClientCRMPanel.tsx`
- `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`

**Docs (regla AGENTS.md)**
- `AGENTS.md`, `CHANGELOG.md`, `README.md` actualizados en el mismo commit.

## Notas de implementación

- Feature 2 sin el fix del INNER JOIN queda silenciosamente roto en el CRM. Ambos cambios van en el mismo commit.
- `POST /api/payments` y `POST /api/supplier-payments` son admin-only por `hasPermission`, así que no hay ruta de cliente que pase por esos guards.
