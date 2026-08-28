# Plan de Implementación — Tres features (2026-08-28)

> **Para agentes:** Ejecutar tarea por tarea siguiendo los steps. Usar checkbox (`- [ ]`) para trackear.

**Goal:** Tres features independientes: (1) referencia opcional en cobros/pagos admin, (2) servicio ya realizado sin cita generando CXC, (3) edición manual de avg_cost con auditoría en kardex.

**Architecture:** DB (migraciones vía `npm run db:setup`), API routes (Next.js App Router), componentes React con Tailwind + shadcn/ui.

---

## Feature 1 — Referencia opcional en cobros y pagos (admin)

### Task 1.1: Migración DB — reference opcional en payments y supplier_payments

**Files:**
- Modify: `src/db/schema.ts:168`
- Modify: `src/db/schema.ts:306`
- Run: `npm run db:setup`

**Steps:**
- [ ] Cambiar `src/db/schema.ts:168`: `reference: text("reference").notNull(),` → `reference: text("reference"),`
- [ ] Cambiar `src/db/schema.ts:306`: `reference: text("reference").notNull(),` → `reference: text("reference"),`
- [ ] Ejecutar `npm run db:setup` para generar la migración y aplicarla. Verificar que el archivo `drizzle/00XX_*.sql` contenga `ALTER TABLE payments ALTER COLUMN reference DROP NOT NULL; ALTER TABLE supplier_payments ALTER COLUMN reference DROP NOT NULL;`

---

### Task 1.2: API — POST /api/payments (quitar guard de reference)

**Files:**
- Modify: `src/app/api/payments/route.ts:49,111`

**Steps:**
- [ ] Línea 49: cambiar `if (!userId || typeof reference !== "string" || !reference.trim())` → `if (!userId || typeof userId !== "string" || !userId.trim())`
- [ ] Línea 111: cambiar `reference: reference.trim(),` → `reference: typeof reference === "string" && reference.trim() ? reference.trim() : null,`
- [ ] Verificar que `userId` sigue siendo requerido (la guard actual `!userId` es correcta; solo se quita el check de `reference`)
- [ ] Probar: `curl -X POST http://localhost:3000/api/payments -H "Content-Type: application/json" -H "Cookie: ..." -d '{"userId":"...","amountUsd":10}'` → debe responder 201 y tener `reference: null`

---

### Task 1.3: API — POST /api/supplier-payments (quitar guard de reference)

**Files:**
- Modify: `src/app/api/supplier-payments/route.ts:65-66,81`

**Steps:**
- [ ] Líneas 65-66: eliminar el bloque:
  ```ts
  if (typeof body.reference !== "string" || !body.reference.trim()) {
    return NextResponse.json({ error: "La referencia es requerida" }, { status: 400 });
  }
  ```
- [ ] Línea 81: cambiar `reference: body.reference.trim(),` → `reference: typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null,`
- [ ] Verificar que la guard de `photoUrl` (líneas 68-70) sigue intacta
- [ ] Probar: `curl -X POST http://localhost:3000/api/supplier-payments -H "Content-Type: application/json" -H "Cookie: ..." -d '{"billId":"...","amountUsd":5,"photoUrl":"http://x.com/y.jpg"}'` → 201 con `reference: null`

---

### Task 1.4: Frontend — RegisterPaymentDialog (quitar * del label)

**Files:**
- Modify: `src/components/RegisterPaymentDialog.tsx`

**Steps:**
- [ ] Línea ~166-172: cambiar `"Número de referencia *"` → `"Número de referencia"` (solo el label; el input queda igual)

---

### Task 1.5: Frontend — SupplierPaymentDialog (quitar validación, cambiar placeholder)

**Files:**
- Modify: `src/components/SupplierPaymentDialog.tsx`

**Steps:**
- [ ] Líneas 70-73: eliminar la validación cliente:
  ```ts
  if (!reference.trim()) {
    setError("La referencia es requerida");
    return;
  }
  ```
- [ ] Línea ~179: cambiar placeholder de `"Referencia (ej: TRF-0001)"` → `"Referencia (opcional)"`
- [ ] Verificar que la validación de `photoUrl` (líneas 74-77) sigue intacta

---

### Task 1.6: Frontend — CompleteAppointmentDialog (quitar * del label)

**Files:**
- Modify: `src/components/CompleteAppointmentDialog.tsx`

**Steps:**
- [ ] Línea ~322-330: cambiar `"Número de referencia *"` → `"Número de referencia"`

---

## Feature 2 — Servicio ya realizado sin cita

### Task 2.1: Migración DB — appointment_id opcional en service_purchases

**Files:**
- Modify: `src/db/schema.ts:115`
- Run: `npm run db:setup`

**Steps:**
- [ ] Línea 115: cambiar `appointmentId: text("appointment_id").notNull().references(...)` → `appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "cascade" }),`
- [ ] Ejecutar `npm run db:setup`. Verificar migración `drizzle/00XX_*.sql` con `ALTER TABLE service_purchases ALTER COLUMN appointment_id DROP NOT NULL;`
- [ ] Verificar que el índice `service_purchases_appointment_idx` sigue existiendo en el schema (línea 129). SQLite indexa NULLs sin problema.

---

### Task 2.2: API — Fix INNER JOIN en GET /api/clients/[id] (balanceUsd del CRM)

**Files:**
- Modify: `src/app/api/clients/[id]/route.ts:52-67`

**Steps:**
- [ ] Línea 52-67: cambiar:
  ```ts
  const dueRow = db
    .select({ due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)` })
    .from(schema.servicePurchases)
    .innerJoin(
      schema.appointments,
      eq(schema.appointments.id, schema.servicePurchases.appointmentId)
    )
    .where(
      and(
        eq(schema.appointments.status, "completed"),
        eq(schema.servicePurchases.userId, id)
      )
    )
    .get();
  ```
  Por:
  ```ts
  const dueRow = db
    .select({ due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)` })
    .from(schema.servicePurchases)
    .leftJoin(
      schema.appointments,
      eq(schema.appointments.id, schema.servicePurchases.appointmentId)
    )
    .where(
      and(
        or(
          eq(schema.appointments.status, "completed"),
          isNull(schema.servicePurchases.appointmentId)
        ),
        eq(schema.servicePurchases.userId, id)
      )
    )
    .get();
  ```
- [ ] Agregar `import { isNull, or } from "drizzle-orm"` al import de la línea 4 si no está
- [ ] Probar: crear un servicio sin cita para un cliente y verificar que su `balanceUsd` en `GET /api/clients/[id]` > 0

---

### Task 2.3: API — Extender POST /api/purchases (nuevo endpoint de servicio sin cita)

**Files:**
- Modify: `src/app/api/purchases/route.ts`

**Steps:**
- [ ] Agregar al inicio del archivo (junto a los imports existentes):
  ```ts
  import { recomputeFinancialStatus, applyPaidToClient } from "@/lib/financial-status";
  import { isNull, or } from "drizzle-orm";
  ```
- [ ] Agregar `isNull` a la línea 4 si no existe.
- [ ] Agregar función helper antes del `export async function GET`:
  ```ts
  export async function POST(req: NextRequest) {
    const session = await auth();
    if (!(await hasPermission(session, "balances"))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { userId, serviceId, completionDate, price, notes } = body;
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }
    if (!serviceId || typeof serviceId !== "string" || !serviceId.trim()) {
      return NextResponse.json({ error: "serviceId es requerido" }, { status: 400 });
    }
    if (typeof completionDate !== "number" || completionDate <= 0) {
      return NextResponse.json({ error: "completionDate es requerido y debe ser un timestamp válido" }, { status: 400 });
    }
    const client = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    if (client.role === "admin") {
      return NextResponse.json({ error: "No se puede registrar un servicio para un administrador" }, { status: 400 });
    }
    const service = db.select().from(schema.services).where(eq(schema.services.id, serviceId)).get();
    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Servicio no encontrado o inactivo" }, { status: 404 });
    }
    let finalPrice = service.price;
    if (typeof price === "number" && price > 0 && price <= service.price * 1.5) {
      finalPrice = Math.round(price * 100) / 100;
    }
    const now = Math.floor(Date.now() / 1000);
    const purchaseId = crypto.randomUUID();
    db.insert(schema.servicePurchases).values({
      id: purchaseId,
      userId,
      appointmentId: null,
      serviceId,
      serviceName: service.name,
      serviceDescription: service.description ?? null,
      servicePrice: finalPrice,
      serviceDurationMins: service.durationMins,
      financialStatus: "pending",
      completionDate,
      createdAt: now,
    }).run();
    recomputeFinancialStatus(userId);
    applyPaidToClient(userId);
    db.update(schema.users)
      .set({ totalVisits: (client.totalVisits ?? 0) + 1 })
      .where(eq(schema.users.id, userId))
      .run();
    return NextResponse.json({ success: true, id: purchaseId }, { status: 201 });
  }
  ```
- [ ] Verificar que no hay conflictos con el `GET` existente (diferentes métodos HTTP, no hay conflicto)
- [ ] Probar: `POST /api/purchases` con `{ userId, serviceId, completionDate: unixNow, price: optional }` → 201 + fila en service_purchases con `appointmentId: null`

---

### Task 2.4: Frontend — Crear AddServiceDialog

**Files:**
- Create: `src/components/AddServiceDialog.tsx`

**Steps:**
- [ ] Crear el archivo con la estructura completa:
  - Props: `clientId?: string`, `clientName?: string`, `onClose: () => void`, `onSaved: () => void`
  - Estado: `clientId` (inicializar desde prop), `clientName` (inicializar desde prop), `serviceId`, `completionDate` (datetime-local, default = hoy formatted YYYY-MM-DD), `price` (string vacío), `notes` (string vacío), `clients` (array para el selector), `services` (array), `saving`, `error`
  - `useEffect`: si NO viene `clientId` prop, hacer `GET /api/clients` y filtrar `role !== 'admin'`
  - `useEffect`: hacer `GET /api/services` al montar (filtrar `is_active=1`)
  - `useEffect`: cuando `serviceId` cambia, buscar el servicio y prellenar `price` con `service.price`
  - Función `submit()`: validar que `clientId`, `serviceId` y `completionDate` existen; hacer `POST /api/purchases` con `{ userId: clientId, serviceId, completionDate: unix(completionDate), price: parseFloat(price) || undefined, notes }`
  - Render: overlay fixed + card centrada con título "Registrar servicio realizado"
  - Selector cliente (si no viene prellenado): `<select>` con opción placeholder "Seleccionar cliente…"
  - Selector servicio: `<select>` con opción placeholder "Seleccionar servicio…"
  - Input fecha: `<input type="datetime-local">` con valor inicial hoy
  - Input precio: `<input type="number">` con paso 0.01, placeholder "$0.00"
  - Textarea notas: opcional
  - Botones Cancelar / Guardar
  - Mostrar error inline si falla
  - Seguir el estilo visual de los demás diálogos (colores rosa pastel, rounded-xl, shadows suaves)

---

### Task 2.5: Frontend — Montar AddServiceDialog en DashboardContent

**Files:**
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`

**Steps:**
- [ ] Agregar `import { AddServiceDialog } from "@/components/AddServiceDialog";` en los imports
- [ ] Agregar `const [showAddService, setShowAddService] = useState(false);` junto a los otros estados de diálogos (línea ~80-82)
- [ ] En la fila de acciones (línea ~234-253), agregar un botón después de `Nueva cita`:
  ```tsx
  <button
    onClick={() => setShowAddService(true)}
    className="rounded-xl bg-pink-100 px-3 py-1.5 text-sm font-medium text-pink-700 hover:bg-pink-200"
  >
    + Servicio realizado
  </button>
  ```
- [ ] Agregar el mounting al final del `return` (junto a los otros diálogos, línea ~705-734):
  ```tsx
  {showAddService && (
    <AddServiceDialog
      onClose={() => setShowAddService(false)}
      onSaved={() => { setShowAddService(false); refreshAll(); }}
    />
  )}
  ```

---

### Task 2.6: Frontend — Montar AddServiceDialog en BalancesContent

**Files:**
- Modify: `src/app/(admin)/dashboard/balances/BalancesContent.tsx`

**Steps:**
- [ ] Agregar `import { AddServiceDialog } from "@/components/AddServiceDialog";` en los imports
- [ ] Agregar `const [addingFor, setAddingFor] = useState<BalanceClient | null>(null);` junto al estado de `registering` (línea ~54)
- [ ] En el render de cada cliente (cerca de línea ~204-209), agregar un botón junto a "Registrar pago":
  ```tsx
  <button
    onClick={() => setAddingFor(c)}
    className="rounded-xl bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700 hover:bg-pink-200"
  >
    Servicio realizado
  </button>
  ```
- [ ] Agregar el mounting (junto a RegisterPaymentDialog, línea ~348-357):
  ```tsx
  {addingFor && (
    <AddServiceDialog
      clientId={addingFor.id}
      clientName={addingFor.name}
      onClose={() => setAddingFor(null)}
      onSaved={() => { setAddingFor(null); loadClients(); }}
    />
  )}
  ```
- [ ] Verificar que `loadClients` es la función que recarga los datos tras guardar

---

### Task 2.7: Frontend — Montar AddServiceDialog en ClientCRMPanel

**Files:**
- Modify: `src/components/ClientCRMPanel.tsx`

**Steps:**
- [ ] Agregar `import { AddServiceDialog } from "@/components/AddServiceDialog";` en los imports
- [ ] Agregar `const [showAddService, setShowAddService] = useState(false);` en los estados locales
- [ ] En la sección "Cuenta por cobrar" (cerca de línea ~266-275), agregar un botón junto a "Registrar pago":
  ```tsx
  <button
    onClick={() => setShowAddService(true)}
    className="rounded-xl bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700 hover:bg-pink-200"
  >
    Registrar servicio
  </button>
  ```
- [ ] Agregar el mounting (al final del return, junto a RegisterPaymentDialog):
  ```tsx
  {showAddService && (
    <AddServiceDialog
      clientId={client.id}
      clientName={client.name}
      onClose={() => setShowAddService(false)}
      onSaved={() => { setShowAddService(false); refreshPayments?.(); }}
    />
  )}
  ```

---

## Feature 3 — Edición manual de avg_cost con auditoría

### Task 3.1: DB — Extender kind de inventory_movements con "cost_adjust"

**Files:**
- Modify: `src/db/schema.ts:243`

**Steps:**
- [ ] Línea 243: cambiar `kind: text("kind").$type<"in" | "out" | "adjust">().notNull(),` → `kind: text("kind").$type<"in" | "out" | "adjust" | "cost_adjust">().notNull(),`
- [ ] No se necesita migración (es solo type annotation TS, la columna en SQLite es TEXT sin constraint)

---

### Task 3.2: Helper — applyCostAdjustment en src/lib/inventory.ts

**Files:**
- Modify: `src/lib/inventory.ts`

**Steps:**
- [ ] Agregar al final del archivo, después de `setExhausted` (línea ~139):
  ```ts
  export function applyCostAdjustment(
    itemId: string,
    newAvgCost: number,
    notes: string,
    createdBy: string
  ): { avgCost: number } {
    if (newAvgCost < 0) throw new Error("El costo no puede ser negativo");
    if (!notes.trim()) throw new Error("El motivo es obligatorio");
    db.update(schema.inventoryItems)
      .set({ avgCost: Math.round(newAvgCost * 10000) / 10000 })
      .where(eq(schema.inventoryItems.id, itemId))
      .run();
    db.insert(schema.inventoryMovements)
      .values({
        id: crypto.randomUUID(),
        inventoryItemId: itemId,
        kind: "cost_adjust",
        quantity: 0,
        unitCostUsd: Math.round(newAvgCost * 10000) / 10000,
        refType: "manual",
        refId: null,
        notes: notes.trim(),
        createdBy,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .run();
    return { avgCost: newAvgCost };
  }
  ```

---

### Task 3.3: API — Extender PATCH /api/inventory/items/[id] con avgCost

**Files:**
- Modify: `src/app/api/inventory/items/[id]/route.ts`

**Steps:**
- [ ] Agregar `import { applyCostAdjustment } from "@/lib/inventory";` y `import { canAdjustInventory } from "@/lib/authz";` en los imports
- [ ] Antes del `db.update(schema.inventoryItems)` (línea ~47), agregar:
  ```ts
  if (body.avgCost !== undefined) {
    if (!(await canAdjustInventory(session))) {
      return NextResponse.json({ error: "No tienes permiso para ajustar costos" }, { status: 403 });
    }
    const avgCostNum = typeof body.avgCost === "number" && body.avgCost >= 0 ? body.avgCost : null;
    if (avgCostNum === null) {
      return NextResponse.json({ error: "avgCost debe ser un número >= 0" }, { status: 400 });
    }
    if (!body.costNotes || typeof body.costNotes !== "string" || !body.costNotes.trim()) {
      return NextResponse.json({ error: "El motivo del ajuste de costo es obligatorio" }, { status: 400 });
    }
    applyCostAdjustment(id, avgCostNum, body.costNotes, session!.user!.id);
  }
  ```
- [ ] Modificar el return final (línea ~51) para incluir `avgCost` actualizado:
  - Después del `db.update` existente, hacer un `db.select().from(schema.inventoryItems).where(...).get()` para obtener el valor свежего y retornarlo
  - O más simple: calcular `newAvgCost = body.avgCost >= 0 ? body.avgCost : existing.avgCost` y retornarlo en el JSON

---

### Task 3.4: Frontend — Crear EditCostDialog

**Files:**
- Create: `src/components/EditCostDialog.tsx`

**Steps:**
- [ ] Crear archivo con:
  - Props: `item: { id: string; name: string; avgCost: number; unit: string }`, `onClose`, `onSaved`
  - Estado: `newCost` (inicializar con `item.avgCost.toString()`), `notes` (string vacío), `saving`, `error`
  - Función `submit()`: validar `newCost >= 0`, `notes.length >= 3`; `PATCH /api/inventory/items/${item.id}` con `{ avgCost: parseFloat(newCost), costNotes: notes.trim() }`; error inline si falla
  - Render: overlay fixed + card centrada con título `Editar costo · ${item.name}`
  - Mostrar costo actual: `Costo actual: $${item.avgCost.toFixed(2)} ${item.unit}`
  - Input nuevo costo: `<input type="number">` con paso 0.01, prefijo `$`, min 0
  - Input motivo: `<input type="text">` con placeholder "Motivo del ajuste (obligatorio)"
  - Botones Cancelar / Guardar
  - Seguir estilo visual rosa pastel

---

### Task 3.5: Frontend — Integrar EditCostDialog en InventoryContent

**Files:**
- Modify: `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`

**Steps:**
- [ ] Agregar `import { EditCostDialog } from "@/components/EditCostDialog";` en los imports
- [ ] Agregar `const [costEdit, setCostEdit] = useState<(typeof items)[number] | null>(null);` junto a `editForm` (línea ~65)
- [ ] En la tabla de productos (cerca de línea ~473-489), agregar botón "Editar costo" después del botón "Editar":
  ```tsx
  {canAdjust && (
    <button
      onClick={() => setCostEdit(item)}
      className="rounded-lg bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200"
    >
      Editar costo
    </button>
  )}
  ```
- [ ] Agregar el mounting al final del return:
  ```tsx
  {costEdit && (
    <EditCostDialog
      item={costEdit}
      onClose={() => setCostEdit(null)}
      onSaved={() => { setCostEdit(null); loadItems(); }}
    />
  )}
  ```
- [ ] En la definición del tipo `Movement` (línea ~32), agregar `"cost_adjust"` al union del kind
- [ ] En el switch `kindPill` (líneas ~280-291), agregar rama:
  ```tsx
  case "cost_adjust":
    return <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Costo</span>;
  ```
- [ ] En la columna "Costo un." del kardex (líneas ~576-589), antes del cierre del `<td>`, agregar:
  ```tsx
  {m.kind === "cost_adjust" && (
    <span className="ml-1 text-xs font-semibold text-purple-700">${(m.unitCostUsd ?? 0).toFixed(2)}</span>
  )}
  ```
- [ ] Verificar que `refresh` (o `loadItems`) se llama en `onSaved` para recargar la lista

---

## Docs

### Task 4.1: Actualizar AGENTS.md, CHANGELOG.md, README.md

**Files:**
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Steps:**
- [ ] **AGENTS.md**: Agregar en la sección "Reglas de Desarrollo" o donde corresponda:
  - Nota sobre `reference` opcional en `payments` y `supplier_payments` para admins
  - Nota sobre `appointmentId` opcional en `service_purchases` (servicios sin cita)
  - Nota sobre `kind: "cost_adjust"` en `inventory_movements` y `applyCostAdjustment` helper
- [ ] **CHANGELOG.md**: Agregar entrada bajo la fecha actual (o crear sección para la próxima versión):
  - Feature: Referencia opcional en cobros y pagos para admins
  - Feature: Registro de servicios ya realizados sin cita (genera CXC)
  - Feature: Edición manual de costo promedio en inventario con auditoría en kardex
- [ ] **README.md**: Si tiene sección de features, agregar las 3 nuevas. Si no, opcional (verificar primero si tiene feature list).

---

## Verificación final

**Pasos de smoke test:**
- [ ] `npm run lint` → 0 errores
- [ ] `npx tsc --noEmit` → 0 errores de tipo
- [ ] Admin registra pago sin referencia → `reference = null` en DB
- [ ] Admin registra servicio sin cita → aparece en `GET /api/purchases?userId=...` con `appointmentId = null`
- [ ] Admin edita costo de inventario → fila `kind: "cost_adjust"` aparece en kardex
- [ ] Admin con solo permiso `inventory` (sin `adjustInventory`) intenta editar costo → 403
- [ ] Cliente reporta pago vía captura → sigue funcionando (regresión)
