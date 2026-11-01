# Vinculación de pagos a servicios (principal + complementarios) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el Enfoque C (híbrido) del spec `2026-10-31-register-payment-complementary-design.md`: agregar columna `covered_purchase_ids` a `payments`, actualizar APIs, modificar `RegisterPaymentDialog` con selector de servicios internos y checkboxes, y actualizar `BalancesContent`/`ProfileContent` para mostrar los servicios cubiertos.

**Architecture:** Columna JSON `TEXT` (`covered_purchase_ids`) en `payments`. El reparto FIFO (`allocateToPurchases`) respeta esta columna como restricción opcional. `RegisterPaymentDialog` muestra un selector de cita + sub-selector de compras con checkboxes.

**Tech Stack:** Next.js 14 + TypeScript, SQLite (better-sqlite3), Drizzle ORM, Tailwind CSS, shadcn/ui.

## Global Constraints

- NO usar `npm audit fix` a secas; no modificar `package.json` a menos que sea necesario.
- NO modificar datos existentes en BD sin backfill (`npm run db:backfill:allocations`).
- Todas las fechas en `America/Caracas` (`timeZone: "America/Caracas"`).
- Mobile-first; colores rosa pastel (`#FFC2D1`) y blanco.
- Cada cambio funcional requiere actualización de `CHANGELOG.md`, `README.md` y `AGENTS.md` (si aplica) en el mismo commit.
- Privacidad: `publicFirstName()` en `src/lib/public-name.ts` para nombres en respuestas públicas.
- `npx tsc --noEmit` debe pasar antes de cada commit.

---

## File Structure

- `drizzle/0026_payment_covered_purchase_ids.sql` — migración (nueva).
- `src/app/api/payments/route.ts` — modificar `POST` y `GET`.
- `src/components/RegisterPaymentDialog.tsx` — selector híbrido + checkboxes.
- `src/lib/payment-allocation.ts` — respetar `coveredIds` en reparto.
- `src/lib/payment-split-db.ts` — `recomputeFinancialStatus` con restricción opcional.
- `src/app/(admin)/dashboard/balances/page.tsx` o `BalancesContent.tsx` — mostrar `coveredPurchaseIds` en historial.
- `src/app/(client)/profile/page.tsx` o componente — mostrar servicios cubiertos.
- `tests/` — tests unitarios para reparto y componente.

---

### Task 1: Migración de base de datos

**Files:**
- Create: `drizzle/0026_payment_covered_purchase_ids.sql`
- Modify: `src/lib/db/schema.ts` (si existe definición de `payments` ahí; si no, solo la migración SQL es suficiente para SQLite con Drizzle)

**Interfaces:**
- Consumes: ninguna (primera tarea).
- Produces: `payments.covered_purchase_ids` (columna `TEXT`, `DEFAULT NULL`).

- [ ] **Step 1: Escribir la migración SQL**

```sql
-- drizzle/0026_payment_covered_purchase_ids.sql
ALTER TABLE payments ADD COLUMN covered_purchase_ids TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS payments_covered_purchase_ids_idx ON payments(covered_purchase_ids);
```

- [ ] **Step 2: Aplicar la migración**

Run: `npm run db:setup` (o `npx drizzle-kit push` si se usa ese flujo). Confirmar que `sqlite.schema` o `db` reconoce la columna.

- [ ] **Step 3: Verificar que `payments` sigue funcionando**

Run: `npx tsc --noEmit`
Expected: PASS (la migración SQL no afecta el tipo TypeScript hasta que se actualice el tipo en `route.ts`).

- [ ] **Step 4: Commit**

```bash
git add drizzle/0026_payment_covered_purchase_ids.sql
git commit -m "db: agregar covered_purchase_ids a payments"
```

---

### Task 2: Actualizar `POST /api/payments`

**Files:**
- Modify: `src/app/api/payments/route.ts`

**Interfaces:**
- Consumes: `payments` tabla (ahora con `covered_purchase_ids`).
- Produces: respuesta JSON con `coveredPurchaseIds` incluido.

- [ ] **Step 1: Leer la ruta existente y agregar validación**

En la función `POST` existente, después de parsear el body:

```typescript
// Validación de coveredPurchaseIds (opcional)
let coveredPurchaseIds: string[] | null = null;
if ("coveredPurchaseIds" in body) {
  const val = body.coveredPurchaseIds;
  if (val === null || val === undefined) {
    coveredPurchaseIds = null;
  } else if (Array.isArray(val)) {
    if (!val.every((v) => typeof v === "string")) {
      return Response.json({ error: "coveredPurchaseIds debe ser un array de strings" }, { status: 400 });
    }
    coveredPurchaseIds = val as string[];
  } else {
    return Response.json({ error: "coveredPurchaseIds debe ser un array o null" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Guardar `coveredPurchaseIds` en la inserción**

En la query `INSERT` o en el objeto que se pasa a `db.insert(...)`:

```typescript
await db.insert(schema.payments).values({
  userId: user.id,
  appointmentId: appointmentId || null,
  coveredPurchaseIds: coveredPurchaseIds ? JSON.stringify(coveredPurchaseIds) : null,
  amountUsd: amountUsd,
  currency: "VES",
  amountVes: amountVes,
  rate: rate,
  reference: reference || null,
  paidAt: paidAt,
  notes: notes || null,
  photoUrl: photoUrl || null,
  createdBy: user.id,
});
```

Nota: como SQLite usa `TEXT` para JSON, se guarda como `JSON.stringify(...)` y se lee con `JSON.parse(...)`.

- [ ] **Step 3: Devolver el campo en la respuesta**

Después de insertar, hacer `SELECT` de la fila creada (o incluir `coveredPurchaseIds` en la respuesta del `POST`).

```typescript
return Response.json({
  id: newPayment.id,
  coveredPurchaseIds: coveredPurchaseIds,
  ...
});
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/payments/route.ts
git commit -m "feat: POST /api/payments acepta coveredPurchaseIds"
```

---

### Task 3: Actualizar `GET /api/payments`

**Files:**
- Modify: `src/app/api/payments/route.ts`

- [ ] **Step 1: Leer `covered_purchase_ids` y devolverlo**

En el `SELECT` existente, agregar la columna. En la transformación de los resultados:

```typescript
const payments = rows.map((r) => ({
  id: r.id,
  userId: r.user_id,
  appointmentId: r.appointment_id,
  coveredPurchaseIds: r.covered_purchase_ids ? JSON.parse(r.covered_purchase_ids as string) : null,
  amountUsd: r.amount_usd,
  // ... resto
}));
```

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: GET /api/payments devuelve coveredPurchaseIds"
```

---

### Task 4: Actualizar reparto (`allocateToPurchases`) para respetar `coveredIds`

**Files:**
- Modify: `src/lib/payment-allocation.ts`

**Interfaces:**
- Consumes: `service_purchases` (compras no-void), `payments` (ahora con `coveredPurchaseIds`).
- Produces: `allocations` filtradas por `coveredIds`.

- [ ] **Step 1: Leer la función existente `allocateToPurchases`**

Verificar que recibe `purchases` (compras no-void) y `payments`. Si no recibe `coveredIds`, agregar un parámetro opcional.

- [ ] **Step 2: Aplicar el filtro**

Antes del reparto FIFO, si `payment.coveredPurchaseIds` existe y no es `null` ni vacío:

```typescript
const coveredIds = new Set(payment.coveredPurchaseIds || []);
const eligiblePurchases = coveredIds.size > 0
  ? purchases.filter((p) => coveredIds.has(p.id))
  : purchases;
```

Nota: si `coveredIds` está vacío (`[]`), `eligiblePurchases` debe ser `[]` (el pago no cubre ninguna compra específica, solo es crédito general). El reparto debe manejar `eligiblePurchases.length === 0` devolviendo `[]` para ese pago.

- [ ] **Step 3: Continuar con FIFO sobre `eligiblePurchases`**

El resto de la lógica (`sort` por `completionDate`, luego por `createdAt`, luego `id`) se aplica sobre `eligiblePurchases`.

- [ ] **Step 4: Escribir test unitario**

Crear o modificar `src/lib/payment-allocation.test.ts`:

```typescript
describe("allocateToPurchases con coveredIds", () => {
  it("solo asigna compras dentro de coveredPurchaseIds", () => {
    const purchases = [
      { id: "sp1", servicePrice: 20, financialStatus: "pending", completionDate: null },
      { id: "sp2", servicePrice: 30, financialStatus: "pending", completionDate: null },
    ];
    const payments = [{ id: "p1", amountUsd: 20, coveredPurchaseIds: ["sp1"] }];
    const result = allocateToPurchases(purchases, payments);
    const allocationsForP1 = result.find((r) => r.paymentId === "p1")?.allocations || [];
    expect(allocationsForP1.map((a) => a.purchaseId)).toEqual(["sp1"]);
  });
});
```

- [ ] **Step 5: Correr test**

Run: `npm test -- src/lib/payment-allocation.test.ts`
Expected: PASS.

- [ ] **Step 6: Compilar y commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git commit -am "feat: allocateToPurchases respeta coveredPurchaseIds"
```

---

### Task 5: Actualizar `recomputeFinancialStatus`

**Files:**
- Modify: `src/lib/payment-split-db.ts`

- [ ] **Step 1: Leer la función existente**

Verificar que `recomputeFinancialStatus(userId)` usa `getPurchases` y `getPayments`.

- [ ] **Step 2: Ajustar la reconstrucción de `payment_allocations`**

Si `payments.covered_purchase_ids` existe, la reconstrucción debe limitarse a esos `purchase_id` (como en Task 4). Si `covered_purchase_ids` es `null` o vacío (`[]`), el comportamiento es el actual (reparto FIFO global o sin asignación, según el caso).

Nota: la columna `covered_purchase_ids` es una restricción, no un cálculo derivado. La reconstrucción debe usar `allocateToPurchases` con la restricción, no ignorarla.

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: recomputeFinancialStatus respeta coveredPurchaseIds"
```

---

### Task 6: Actualizar `RegisterPaymentDialog` (UI híbrida)

**Files:**
- Modify: `src/components/RegisterPaymentDialog.tsx`

**Interfaces:**
- Consumes: `/api/balances` (items con compras), `appointmentId` (cita seleccionada).
- Produces: `coveredPurchaseIds` (array) enviado en `submit()`.

- [ ] **Step 1: Agregar estados nuevos**

Después de `const [appointments, setAppointments] = useState<{ id: string; label: string }[]>([]);`:

```typescript
const [purchaseOptions, setPurchaseOptions] = useState<{ id: string; label: string; isPrimary: boolean }[]>([]);
const [coveredPurchaseIds, setCoveredPurchaseIds] = useState<string[]>([]);
```

- [ ] **Step 2: Cargar `purchaseOptions` al cambiar `appointmentId`**

En el `useEffect` que hoy carga `appointments`, agregar una segunda parte (o un nuevo `useEffect` con `[appointmentId]`):

```typescript
useEffect(() => {
  if (!appointmentId) {
    setPurchaseOptions([]);
    setCoveredPurchaseIds([]);
    return;
  }
  // Usar los datos de `row.items` (ya cargados en el efecto anterior) o hacer fetch a `/api/purchases?appointmentId=${appointmentId}`
  // Para mantener consistencia con `BalancesContent`, usar `row.items` del cliente actual.
  fetch("/api/balances")
    .then((r) => r.json())
    .then((data) => {
      const row = data.clients.find((c: { clientId: string }) => c.clientId === clientId);
      if (!row || !Array.isArray(row.items)) return;
      const items = row.items.filter(
        (item: { appointmentId?: string; appointment_id?: string }) =>
          (item.appointmentId || item.appointment_id) === appointmentId
      );
      const options = items.map((item: { id?: string; serviceName?: string; service_name?: string; isPrimary?: boolean; is_primary?: boolean }) => ({
        id: item.id || item.service_purchase_id || item.servicePurchaseId || "",
        label: (item.serviceName || item.service_name || "Servicio") +
               (item.isPrimary || item.is_primary ? " (principal)" : " (complementario)"),
        isPrimary: !!(item.isPrimary || item.is_primary),
      }));
      setPurchaseOptions(options);
      // Por defecto, seleccionar todos los servicios de la cita
      setCoveredPurchaseIds(options.map((o) => o.id).filter(Boolean));
    });
}, [appointmentId, clientId]);
```

Nota: el `filter` debe incluir servicios complementarios. El `items` de `/api/balances` proviene de `service_purchases` y debe incluir todas las compras (`is_primary` 0 o 1).

- [ ] **Step 3: Renderizar checkboxes**

Después del bloque del selector de cita (`appointmentId`), agregar:

```tsx
{purchaseOptions.length > 0 && (
  <div className="mt-3 rounded-xl border border-gray-200 p-3 bg-gray-50/50">
    <p className="mb-2 text-xs font-semibold text-gray-700">Servicios cubiertos por este pago</p>
    <div className="space-y-1.5">
      {purchaseOptions.map((p) => (
        <label key={p.id} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
          <input
            type="checkbox"
            checked={coveredPurchaseIds.includes(p.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setCoveredPurchaseIds([...coveredPurchaseIds, p.id]);
              } else {
                setCoveredPurchaseIds(coveredPurchaseIds.filter((id) => id !== p.id));
              }
            }}
            className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main/20"
          />
          <span className="font-medium">{p.label}</span>
        </label>
      ))}
    </div>
  </div>
)}
```

Nota: `p.id` debe ser el `service_purchase.id`, no el `service.id`. Si `items` no trae `service_purchase.id`, usar el `id` de la fila (`row.items` debe incluirlo). Si no está disponible, usar `service_id` + `appointment_id` como clave compuesta temporal (aunque lo ideal es usar `service_purchase.id`).

- [ ] **Step 4: Enviar `coveredPurchaseIds` en `submit()`**

En `submit()`, agregar al `body`:

```typescript
body.coveredPurchaseIds = coveredPurchaseIds.length > 0 ? coveredPurchaseIds : null;
```

Nota: `null` mantiene el comportamiento legado. `[]` (array vacío) indica explícitamente "sin servicios vinculados" (pago general). El endpoint debe distinguir `[]` de `null`.

- [ ] **Step 5: Compilar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: RegisterPaymentDialog con selector híbrido y coveredPurchaseIds"
```

---

### Task 7: Actualizar `BalancesContent` y `ProfileContent` (mostrar servicios cubiertos)

**Files:**
- Modify: `src/app/(admin)/dashboard/balances/page.tsx` (o componente que renderiza el historial de pagos)
- Modify: `src/app/(client)/profile/page.tsx` (o componente que renderiza "Mis pagos")

- [ ] **Step 1: Leer `BalancesContent`**

Verificar que el historial de pagos muestra `amountUsd`, `kind` (abono/anticipo/completo) y `allocations`. Agregar una línea que muestre los servicios cubiertos si `coveredPurchaseIds` existe.

Ejemplo (en la fila del pago):

```tsx
{payment.coveredPurchaseIds && payment.coveredPurchaseIds.length > 0 ? (
  <p className="text-xs text-gray-500 mt-0.5">
    Cubre: {payment.coveredPurchaseIds.map((id) => {
      const name = getServiceNameByPurchaseId(id); // o usar una función auxiliar
      return name || id;
    }).join(", ")}
  </p>
) : (
  <p className="text-xs text-gray-400 mt-0.5">Pago general (sin servicios específicos)</p>
)}
```

Nota: si `coveredPurchaseIds` es `null`, no mostrar nada (comportamiento legado). Si es `[]`, mostrar "Pago general".

- [ ] **Step 2: Aplicar el mismo cambio en `ProfileContent`**

En la sección "Mis pagos" del perfil del cliente.

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: mostrar coveredPurchaseIds en balances y profile"
```

---

### Task 8: Actualizar `ClientCRMPanel` (opcional — mostrar compras cubiertas)

**Files:**
- Modify: `src/components/ClientCRMPanel.tsx`

- [ ] **Step 1: Mostrar los pagos vinculados a la cita con sus compras cubiertas**

Si `ClientCRMPanel` recibe datos de pagos (`payments` o `allocations`), agregar una sección que liste los pagos con `coveredPurchaseIds` vinculados a la cita actual (`appointmentId`). Esto es opcional según el alcance del usuario.

Nota: si no es requerido por el usuario, esta tarea se puede omitir o marcar como `optional`.

- [ ] **Step 2: Compilar y commit (si aplica)**

---

### Task 9: Actualizar `activity_logs` (opcional)

**Files:**
- Modify: `src/lib/audit.ts` (o `src/app/api/payments/route.ts` si se registra allí)

- [ ] **Step 1: Incluir `coveredPurchaseIds` en `metadata`**

Cuando se llame `logActivity` por un pago, agregar:

```typescript
metadata: JSON.stringify({
  ...existingMetadata,
  coveredPurchaseIds: coveredPurchaseIds || null,
}),
```

- [ ] **Step 2: Compilar y commit**

---

### Task 10: Tests de integración y verificación final

- [ ] **Step 1: Correr todos los tests existentes**

Run: `npm test`
Expected: PASS (o los mismos fallos que antes del cambio, sin regresiones nuevas).

- [ ] **Step 2: Correr `npm run build`**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Actualizar docs (`CHANGELOG.md`, `README.md`, `AGENTS.md`)**

En `CHANGELOG.md`, agregar:

```
## [Fecha] — Vinculación de pagos a servicios (principal + complementarios)
- `payments.covered_purchase_ids` permite vincular un pago a servicios específicos.
- `RegisterPaymentDialog` agrega selector híbrido (cita + servicios internos).
```

En `AGENTS.md` (sección de datos o pagos): actualizar la descripción de `payments` con la nueva columna.

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "feat: vinculación de pagos a servicios (Enfoque C)"
```

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-10-31-register-payment-complementary-plan.md`.

**Dos opciones de ejecución:**

1. **Subagent-Driven (recomendado)** — Despacho un subagente por tarea, reviso entre tareas.
2. **Inline Execution** — Ejecuto tareas en esta sesión con checkpoints.

¿Cuál preferís?
