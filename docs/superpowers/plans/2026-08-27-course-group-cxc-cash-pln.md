# Cursos Grupales + CXC desde el Agendado + P&L Base de Caja — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir servicios de grupo (cursos) con múltiples alumnos por sesión, hacer que la CXC (cuentas por cobrar) nazca al agendar (para todos los servicios), permitir pagos en cualquier momento con estado financiero auto-calculado, y cambiar el P&L a base de caja manteniendo una vista por producción.

**Architecture:** Se desacopla el **Evento** (cita/sesión en `appointments`) de la **Transacción Económica** (`service_purchases` por cliente). `service_purchases` gana `financial_status` (pending/partial/paid/void) y `completion_date` (doble fecha vs. `payments.paid_at`). Un curso es un `appointments` con `services.is_group=1`; los alumnos se registran en una nueva tabla `course_enrollments`, y cada alumno genera su propio `service_purchases` (misma `appointment_id`).

**Tech Stack:** Next.js 16 (App Router, `src/`), TypeScript, Drizzle ORM + better-sqlite3, Tailwind + shadcn/ui. Sin framework de tests (no jest/vitest). Verificación = `npx tsc --noEmit`, `npm run lint`, `npm run build`, y pruebas manuales vía `npm run dev`.

## Global Constraints

- Todas las fechas en timestamp local del salón (epoch sec, timezone `America/Caracas`); usar `dateTimeToTs` / `dateToDayStartTs` de `src/lib/time.ts`.
- Los cálculos monetarios se redondean a 2 decimales en USD (patrón `Math.round(n*100)/100`).
- Detectar alvo de grupo con `services.is_group` (0/1), nunca por nombre del servicio.
- No crear módulo de cursos con temario/certificados (YAGNI). El curso es un tipo de servicio grupal.
- Solo clientes registrados pueden ser alumnos de un curso (no walk-ins).
- Preservar permisos existentes: `course-sessions*` → `hasPermission(session, "appointments")`; balances → `balances`; P&L → `financials`.
- Migraciones con drizzle-kit: `npm run db:generate` y `npm run db:migrate`.
- Actualizar AGENTS.md, CHANGELOG.md y README.md en el commit que cierra la feature (regla de mantenimiento).
- `payment_receipts` (capturas reportadas por el cliente): el flujo de aprobación sigue creando `payments`; tras aprobar se debe recalcular el `financial_status` (usar el mismo helper).

---

## File Structure (a crear/modificar)

**Schema / datos:**
- Modify `src/db/schema.ts` — `service_purchases` (+`financial_status`, `+completion_date`), `services` (+`is_group`), nueva tabla `course_enrollments`.
- New `drizzle/00NN_*.sql` — generado por `npm run db:generate` (no editar a mano).

**Lógica pura (bibliotecas):**
- Create `src/lib/financial-status.ts` — pure functions: `computeFinancialStatus(totalPaid, price)`, `sumClientPaid(userId)`, `setPurchaseFinancialStatus(purchaseId)`, `recomputeFinancialStatus(userId)`.
- Modify `src/lib/financials.ts` — P&L con vistas `recaudacion` y `produccion`.
- Modify `src/lib/inventory.ts` — `recordUsage` ya registra `totalRevenue`; revisar integración (no tocar salvo `totalRevenue`).

**APIs:**
- Create `src/app/api/course-sessions/route.ts` — POST crear sesión grupal, GET listar.
- Create `src/app/api/course-sessions/[id]/enrollments/route.ts` — POST añadir alumno, DELETE quitar alumno (pre-completar).
- Modify `src/app/api/appointments/[id]/route.ts` — completar llena `completion_date`; cancelar marca purchases `void`; totalRevenue pasa a recaudado.
- Modify `src/app/api/payments/route.ts` — POST dispara `recomputeFinancialStatus` + `totalRevenue`.
- Modify `src/app/api/payments/[id]/route.ts` — DELETE dispara `recomputeFinancialStatus` + `totalRevenue`.
- Modify `src/app/api/payment-receipts/[id]/route.ts` — approved dispara `recomputeFinancialStatus`.
- Modify `src/app/api/services/route.ts` y `src/app/api/services/[id]/route.ts` — soportar `is_group`.
- Modify `src/app/api/balances/route.ts` — deuda desde agendado (sin filtrar completadas).
- Modify `src/app/api/appointments/route.ts` — devolver `isGroup`/`studentCount` en el listado del día.
- Modify `src/app/api/financials/pnl/route.ts` — shape `{ recaudacion, produccion }`.

**UI:**
- Modify `src/app/(admin)/dashboard/DashboardContent.tsx` — bloque de grupo, diálogo de sesión de curso, indicador financiero.
- Create `src/components/CourseSessionDialog.tsx` — crear sesión de curso (multi-alumnos).
- Modify `src/components/AppointmentCard.tsx` — badge grupo + indicador financiero.
- Modify `src/components/CompleteAppointmentDialog.tsx` — mostrar estado financiero; al completar llenar `completion_date` (backend); opción "dejar pendiente".
- Modify `src/app/(admin)/dashboard/balances/BalancesContent.tsx` — desglose por ítem + filtro estado financiero.
- Modify `src/app/(admin)/dashboard/financials/FinancialsContent.tsx` — paneles Recaudación y Producción.
- Modify `src/app/(client)/profile/page.tsx` y `ProfileContent.tsx` — estado de cuenta completo (pendientes + completadas + pagos, saldo).
- Modify `src/app/(admin)/dashboard/services/ServicesContent.tsx` — checkbox "es curso/grupo".

---

## Task 1: Schema — `service_purchases`, `services`, `course_enrollments`

**Files:**
- Modify: `src/db/schema.ts`
- Test (migración): `npm run db:generate`, `npm run db:migrate`, `npx tsc --noEmit`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `schema.servicePurchases.financialStatus` — `text` col `financial_status`, default `"pending"`, `$type<"pending" | "partial" | "paid" | "void">()`.
  - `schema.servicePurchases.completionDate` — `integer("completion_date")`, nullable.
  - `schema.services.isGroup` — `integer("is_group").notNull().default(0)`.
  - `schema.courseEnrollments` — tabla con `id` (text PK), `appointmentId` (FK→appointments.id, onDelete cascade), `clientId` (FK→users.id), `createdAt`, y uniqueIndex `(appointmentId, clientId)`.

- [ ] **Step 1: Añadir campos y tabla en `src/db/schema.ts`**

En `service_purchases` (la tabla que empieza en la línea 111), añadir tras `serviceDurationMins`:
```ts
financialStatus: text("financial_status")
  .$type<"pending" | "partial" | "paid" | "void">()
  .notNull()
  .default("pending"),
completionDate: integer("completion_date"),
```

En `services` (tabla de la línea 51), añadir tras `isActive`:
```ts
isGroup: integer("is_group").notNull().default(0),
```

Al final del archivo (tras `appointmentUsage`), añadir la nueva tabla:
```ts
export const courseEnrollments = sqliteTable(
  "course_enrollments",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => users.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("course_enrollments_unique_idx").on(t.appointmentId, t.clientId),
    index("course_enrollments_client_idx").on(t.clientId),
  ]
);
```

- [ ] **Step 2: Generar y aplicar la migración**

Run:
```bash
npm run db:generate
npm run db:migrate
```
Expected: se crea `drizzle/00NN_*.sql` con `ALTER TABLE service_purchases ADD ...`, `ALTER TABLE services ADD ...`, `CREATE TABLE course_enrollments ...`; migración aplicada sin errores.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "feat(schema): financial_status/completion_date en purchases, is_group en services, course_enrollments"
```

---

## Task 2: Librería de estado financiero (pure + recompute)

**Files:**
- Create: `src/lib/financial-status.ts`

**Interfaces:**
- Consumes: `db`, `schema` from `@/db/index`.
- Produces:
  - `computeFinancialStatus(totalPaid: number, price: number): "pending" | "partial" | "paid"`
  - `sumClientPaid(userId: string): number`
  - `getOpenPurchases(userId: string): { id: string; servicePrice: number; financialStatus: string | null }[]`
  - `setPurchaseFinancialStatus(purchaseId: string, status: "pending" | "partial" | "paid" | "void"): void`
  - `voidPurchase(purchaseId: string): void`
  - `recomputeFinancialStatus(userId: string): void` — recalcula todos los purchases abiertos del usuario.
  - `applyPaidToClient(userId: string): void` — recalcula `users.totalRevenue` como suma pagada.

- [ ] **Step 1: Escribir la librería**

```ts
import { db, schema } from "@/db/index";
import { and, eq, ne, sql } from "drizzle-orm";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFinancialStatus(
  totalPaid: number,
  price: number
): "pending" | "partial" | "paid" {
  if (totalPaid >= price - 0.004) return "paid";
  if (totalPaid > 0.004) return "partial";
  return "pending";
}

export function sumClientPaid(userId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, userId))
    .get();
  return round2(row?.total ?? 0);
}

export function getOpenPurchases(userId: string) {
  return db
    .select({
      id: schema.servicePurchases.id,
      servicePrice: schema.servicePurchases.servicePrice,
      financialStatus: schema.servicePurchases.financialStatus,
    })
    .from(schema.servicePurchases)
    .where(
      and(
        eq(schema.servicePurchases.userId, userId),
        ne(schema.servicePurchases.financialStatus, "void")
      )
    )
    .all();
}

export function setPurchaseFinancialStatus(
  purchaseId: string,
  status: "pending" | "partial" | "paid" | "void"
): void {
  db.update(schema.servicePurchases)
    .set({ financialStatus: status })
    .where(eq(schema.servicePurchases.id, purchaseId))
    .run();
}

export function voidPurchase(purchaseId: string): void {
  setPurchaseFinancialStatus(purchaseId, "void");
}

export function recomputeFinancialStatus(userId: string): void {
  const totalPaid = sumClientPaid(userId);
  for (const p of getOpenPurchases(userId)) {
    const status = computeFinancialStatus(totalPaid, p.servicePrice);
    if ((p.financialStatus ?? "pending") !== status) {
      setPurchaseFinancialStatus(p.id, status);
    }
  }
  applyPaidToClient(userId);
}

export function applyPaidToClient(userId: string): void {
  const total = sumClientPaid(userId);
  db.update(schema.users)
    .set({ totalRevenue: total })
    .where(eq(schema.users.id, userId))
    .run();
}
```

- [ ] **Step 3: Typecheck y lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/financial-status.ts
git commit -m "feat(financials): librería de estado financiero (pending/partial/paid/void) y totalRevenue recaudado"
```

---

## Task 3: P&L por caja + producción (backend)

**Files:**
- Modify: `src/lib/financials.ts`
- Modify: `src/app/api/financials/pnl/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `monthRange` (existente), nuevos campos `financialStatus`, `completionDate`.
- Produces: `getPnL(month)` devuelve:
  ```ts
  {
    month: string;
    recaudacion: { income, servicesCount, incomeByService };
    produccion: { income, servicesCount, incomeByService };
    expenses: number;
    profitRecaudacion: number;
    profitProduccion: number;
    invoicesCount: number;
    expensesByCategory: { categoryName, amount }[];
  }
  ```

- [ ] **Step 1: Reescribir `getPnL` en `src/lib/financials.ts`**

Reemplazar el cuerpo de `getPnL` por:
```ts
export function getPnL(month: string) {
  const { start, end } = monthRange(month);
  const notVoID = ne(schema.servicePurchases.financialStatus, "void");

  // Recaudación (caja): pagos de clientes cobrados en el mes
  const recaudRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.payments)
    .where(and(gte(schema.payments.paidAt, start), lt(schema.payments.paidAt, end)))
    .get();

  const recaudByService = db
    .select({
      serviceName: schema.servicePurchases.serviceName,
      amount: sql<number>`sum(${schema.payments.amountUsd})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.payments)
    .innerJoin(
      schema.servicePurchases,
      eq(schema.servicePurchases.appointmentId, schema.payments.appointmentId)
    )
    .where(and(gte(schema.payments.paidAt, start), lt(schema.payments.paidAt, end)))
    .groupBy(schema.servicePurchases.serviceName)
    .all()
    .map((r) => ({
      serviceName: r.serviceName ?? "Sin servicio",
      amount: round2(r.amount ?? 0),
      count: r.count ?? 0,
    }));

  // Producción (devengado): purchases completados en el mes
  const prodRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .where(and(notVoID, gte(schema.servicePurchases.completionDate, start), lt(schema.servicePurchases.completionDate, end)))
    .get();

  const prodByService = db
    .select({
      serviceName: schema.servicePurchases.serviceName,
      amount: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .where(and(notVoID, gte(schema.servicePurchases.completionDate, start), lt(schema.servicePurchases.completionDate, end)))
    .groupBy(schema.servicePurchases.serviceName)
    .all()
    .map((r) => ({
      serviceName: r.serviceName,
      amount: round2(r.amount ?? 0),
      count: r.count ?? 0,
    }));

  // Gastos: igual que hoy (bills por billDate)
  const expensesRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.bills.totalUsd}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.bills)
    .where(and(gte(schema.bills.billDate, start), lt(schema.bills.billDate, end)))
    .get();

  const expensesByCategory = db
    .select({
      categoryName: schema.expenseCategories.name,
      amount: sql<number>`sum(${schema.bills.totalUsd})`,
    })
    .from(schema.bills)
    .leftJoin(schema.expenseCategories, eq(schema.expenseCategories.id, schema.bills.categoryId))
    .where(and(gte(schema.bills.billDate, start), lt(schema.bills.billDate, end)))
    .groupBy(schema.bills.categoryId)
    .all()
    .map((r) => ({ categoryName: r.categoryName ?? "Sin categoría", amount: round2(r.amount ?? 0) }));

  const recaudacion = round2(recaudRow?.total ?? 0);
  const produccion = round2(prodRow?.total ?? 0);
  const expenses = round2(expensesRow?.total ?? 0);

  return {
    month,
    recaudacion: {
      income: recaudacion,
      servicesCount: recaudRow?.count ?? 0,
      incomeByService: recaudByService,
    },
    produccion: {
      income: produccion,
      servicesCount: prodRow?.count ?? 0,
      incomeByService: prodByService,
    },
    expenses,
    profitRecaudacion: round2(recaudacion - expenses),
    profitProduccion: round2(produccion - expenses),
    invoicesCount: expensesRow?.count ?? 0,
    expensesByCategory,
  };
}
```
Añadir `ne` a los imports de `drizzle-orm`.

- [ ] **Step 2: Ajustar el PnL type y la ruta**

En `src/lib/financials.ts`, actualizar `PnLResult` para reflejar la nueva forma (reemplazar los campos `income`/`servicesCount`/`incomeByService` de nivel raíz por `recaudacion`/`produccion` y añadir `profitRecaudacion`/`profitProduccion`).

En `src/app/api/financials/pnl/route.ts` no cambia (solo devuelve `getPnL(month)`).

- [ ] **Step 3: Typecheck y lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/financials.ts src/app/api/financials/pnl/route.ts
git commit -m "feat(financials): P&L base de caja (recaudación) + producción"
```

---

## Task 4: Balances — deuda desde el agendado

**Files:**
- Modify: `src/app/api/balances/route.ts`

**Interfaces:**
- Consumes: nuevos campos `financialStatus`.
- Produces: misma forma de respuesta `{ totalUsd, clients: [{ clientId, name, phone, balanceUsd, unpaidAppointments, items }] }`. `items` es desglose opcional (ver Task 9). Para este task basta cambiar la query de `dueRows` para incluir purchases no-void sin filtrar por `completed`.

- [ ] **Step 1: Cambiar `dueRows` para sumar todas las compras no-void**

Reemplazar la query `dueRows` (líneas 13-26) por una que NO una citas `completed`:
```ts
const dueRows = db
  .select({
    userId: schema.servicePurchases.userId,
    due: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
    unpaid: sql<number>`count(*)`,
  })
  .from(schema.servicePurchases)
  .where(ne(schema.servicePurchases.financialStatus, "void"))
  .groupBy(schema.servicePurchases.userId)
  .all();
```
Añadir `ne` al import de `drizzle-orm`.

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/balances/route.ts
git commit -m "feat(balances): CXC desde el agendado (purchases no-void, sin filtrar por completadas)"
```

---

## Task 5: Pagos — recompute + totalRevenue

**Files:**
- Modify: `src/app/api/payments/route.ts`
- Modify: `src/app/api/payments/[id]/route.ts`

**Interfaces:**
- Consumes: `recomputeFinancialStatus`, `applyPaidToClient` from `@/lib/financial-status`.
- Produces: ninguna nueva; tras crear/borrar un pago se llama `recomputeFinancialStatus(userId)`.

- [ ] **Step 1: POST /api/payments — llamar recompute**

En `src/app/api/payments/route.ts`, añadir import y llamada tras `db.insert(...).run()` (línea 102):
```ts
import { recomputeFinancialStatus } from "@/lib/financial-status";
// ...
db.insert(schema.payments).values(payment).run();
recomputeFinancialStatus(payment.userId);
return NextResponse.json(payment);
```

- [ ] **Step 2: DELETE /api/payments/[id] — llamar recompute**

En `src/app/api/payments/[id]/route.ts`, capturar el pago antes de borrar para conocer `userId`:
```ts
import { recomputeFinancialStatus } from "@/lib/financial-status";
// ...
export async function DELETE(_req, { params }) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const payment = db.select().from(schema.payments).where(eq(schema.payments.id, id)).get();
  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  db.delete(schema.payments).where(eq(schema.payments.id, id)).run();
  recomputeFinancialStatus(payment.userId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Typecheck y lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payments/route.ts "src/app/api/payments/[id]/route.ts"
git commit -m "feat(payments): recompute financial_status y totalRevenue al crear/borrar pago"
```

---

## Task 6: Completar caja — `completion_date` y `totalRevenue`; Cancelar — `void`

**Files:**
- Modify: `src/app/api/appointments/[id]/route.ts`

**Interfaces:**
- Consumes: `recomputeFinancialStatus`, `voidPurchase` (o por batch) from `@/lib/financial-status`.
- Produces: al completar un `appointments` se setea `completion_date` en sus purchases; al cancelar (DELETE) se marcan sus purchases `void`.

- [ ] **Step 1: Al completar — setear financial-status y completion_date**

En el bloque `if (status === "completed" && appointment.status !== "completed")` (línea 86): sustituir la actualización de `totalVisits`/`totalRevenue` de `users` (que hoy suma `service.price`) para que:
- `totalVisits` siga `+1`.
- **No** sumar `service.price` a `totalRevenue` (lo hará `recomputeFinancialStatus`/`applyPaidToClient` vía pagos). En su lugar llamar `recomputeFinancialStatus(client.id)` al final del bloque de completado.

Añadir tras `db.update(schema.users).set({ totalVisits: ... })`:
```ts
const now = Math.floor(Date.now() / 1000);
db.update(schema.servicePurchases)
  .set({ completionDate: now })
  .where(and(eq(schema.servicePurchases.appointmentId, id), isNull(schema.servicePurchases.completionDate)))
  .run();
recomputeFinancialStatus(client.id);
```
Imports añadidos: `and`, `isNull` de `drizzle-orm`; `recomputeFinancialStatus` de `@/lib/financial-status`.

- [ ] **Step 2: Al cancelar (DELETE) — marcar purchases `void`**

En `DELETE`, dentro de la transacción (antes de `tx.delete(schema.appointments)`), marcar los purchases del appointment como void:
```ts
tx.update(schema.servicePurchases)
  .set({ financialStatus: "void" })
  .where(eq(schema.servicePurchases.appointmentId, id))
  .run();
```
Y tras la transacción, para cada cliente afectado llamar `recomputeFinancialStatus`. Recopilar `clientIds` de los purchases del appointment:
```ts
const purchaseRows = db
  .select({ userId: schema.servicePurchases.userId })
  .from(schema.servicePurchases)
  .where(eq(schema.servicePurchases.appointmentId, id))
  .all();
// ... tras borrar:
for (const p of purchaseRows) recomputeFinancialStatus(p.userId);
```
Nota: los purchases ya borrados por cascade? NO — `service_purchases.appointmentId` NO tiene onDelete cascade (solo índice). Como marcamos `void` antes de borrar el appointment, las filas persisten como void (historial). Esto es lo deseado según el spec.

- [ ] **Step 3: Typecheck y lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/appointments/[id]/route.ts"
git commit -m "feat(appointments): completion_date al completar, purchases void al cancelar, totalRevenue recaudado"
```

---

## Task 7: `services.is_group` en API y UI de servicios

**Files:**
- Modify: `src/app/api/services/route.ts`
- Modify: `src/app/api/services/[id]/route.ts`
- Modify: `src/app/(admin)/dashboard/services/ServicesContent.tsx`

**Interfaces:**
- Consumes: campo `isGroup` agregado a `services`.
- Produces: `POST /api/services` acepta `isGroup` booleano; `PATCH` acepta `isGroup`; GET devuelve `isGroup`. La UI permite marcar un servicio como curso/grupo.

- [ ] **Step 1: POST — aceptar `isGroup`**

En `src/app/api/services/route.ts`, en `POST`, añadir al objeto `service`:
```ts
isGroup: body.isGroup ? 1 : 0,
```

- [ ] **Step 2: PATCH — aceptar `isGroup`**

En `src/app/api/services/[id]/route.ts`, en `PATCH`, tras `isActive`:
```ts
const isGroup =
  body.isGroup !== undefined ? (body.isGroup ? 1 : 0) : existing.isGroup;
```
e incluir `isGroup` en `db.update(...).set({ ... })` y en la respuesta JSON.

- [ ] **Step 3: UI — checkbox "Es curso/grupo" en ServicesContent**

Abrir `src/app/(admin)/dashboard/services/ServicesContent.tsx`, localizar el formulario de alta/edición de servicio, y añadir un checkbox que envíe `isGroup` al POST/PATCH. (El componente guarda el servicio mediante fetch a `/api/services`; añadir `isGroup: <checked>` al body.)

- [ ] **Step 4: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/app/api/services/route.ts "src/app/api/services/[id]/route.ts" "src/app/(admin)/dashboard/services/ServicesContent.tsx"
git commit -m "feat(services): flag is_group (servicio grupal/curso)"
```

---

## Task 8: API de sesiones de curso (crear + listar)

**Files:**
- Create: `src/app/api/course-sessions/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `validateSlot` from `@/lib/availability`, `isAdmin`/`hasPermission` from `@/lib/authz`, `dateToDayStartTs` (si necesario).
- Produces:
  - `POST /api/course-sessions` — body `{ serviceId, startTime, clientIds: string[] }`. Crea `appointments` (status `pending`, serviceId, startTime, endTime = startTime + service.durationMins*60), N `course_enrollments` y N `service_purchases` (uno por alumno, `financialStatus 'pending'`). Devuelve `{ id }`.
  - `GET /api/course-sessions` — lista sesiones de grupo con alumnos y saldo por alumno.

- [ ] **Step 1: Escribir `POST`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, inArray } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { validateSlot } from "@/lib/availability";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { serviceId, startTime, clientIds } = body;

  if (!serviceId || typeof startTime !== "number" || !Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json({ error: "serviceId, startTime y clientIds son requeridos" }, { status: 400 });
  }

  const service = db.select().from(schema.services).where(eq(schema.services.id, serviceId)).get();
  if (!service) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  if (service.isGroup !== 1) return NextResponse.json({ error: "El servicio no es de tipo grupo" }, { status: 400 });

  const endTime = startTime + service.durationMins * 60;
  const availError = validateSlot(startTime, endTime);
  if (availError) return NextResponse.json({ error: availError }, { status: 409 });

  const ids = Array.from(new Set<string>(clientIds));
  const clients = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.id, ids))
    .all();
  if (clients.length !== ids.length) {
    return NextResponse.json({ error: "Uno o más clientes no existen" }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const appointmentId = crypto.randomUUID();
  db.insert(schema.appointments).values({
    id: appointmentId,
    clientId: ids[0], // cliente "lider" para la FK notNull (los demás van en enrollments)
    serviceId,
    startTime,
    endTime,
    status: "pending",
    createdAt: now,
  }).run();

  for (const cid of ids) {
    db.insert(schema.courseEnrollments).values({
      id: crypto.randomUUID(),
      appointmentId,
      clientId: cid,
      createdAt: now,
    }).run();
    db.insert(schema.servicePurchases).values({
      id: crypto.randomUUID(),
      userId: cid,
      appointmentId,
      serviceId: service.id,
      serviceName: service.name,
      serviceDescription: service.description,
      servicePrice: service.price,
      serviceDurationMins: service.durationMins,
      financialStatus: "pending",
      createdAt: now,
    }).run();
  }

  return NextResponse.json({ id: appointmentId });
}
```
Nota: `appointments.clientId` es `notNull`; guardamos la FK con el primer alumno como "ancla de la sesión". El verdadero set de alumnos vive en `course_enrollments`. No crear evento de Google Calendar por cada alumno en este task (se puede ampliar; las sesiones de curso presenciales no requieren sync 1:1 en MVP). Se documenta como decisión.

- [ ] **Step 2: Escribir `GET`**

```ts
export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rows = db
    .select({
      id: schema.appointments.id,
      serviceId: schema.appointments.serviceId,
      serviceName: schema.services.name,
      servicePrice: schema.services.price,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
    })
    .from(schema.appointments)
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(eq(schema.services.isGroup, 1))
    .orderBy(schema.appointments.startTime)
    .all();

  // enrollments + saldo por alumno
  const enrollRows = db.select().from(schema.courseEnrollments).all();
  const pupilNames = new Map(
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).all().map((u) => [u.id, u.name])
  );
  const purchaseRows = db
    .select({
      appointmentId: schema.servicePurchases.appointmentId,
      userId: schema.servicePurchases.userId,
      servicePrice: schema.servicePurchases.servicePrice,
      financialStatus: schema.servicePurchases.financialStatus,
    })
    .from(schema.servicePurchases)
    .all();
  const paidVector = db
    .select({ userId: schema.payments.userId, total: sql<number>`sum(${schema.payments.amountUsd})` })
    .from(schema.payments)
    .groupBy(schema.payments.userId)
    .all();
  const paidMap = new Map(paidVector.map((p) => [p.userId, p.total ?? 0]));

  const data = rows.map((s) => {
    const enrolled = enrollRows.filter((e) => e.appointmentId === s.id);
    const pupils = enrolled.map((e) => {
      const pur = purchaseRows.find((p) => p.appointmentId === s.id && p.userId === e.clientId);
      const price = pur?.servicePrice ?? s.servicePrice;
      const paid = paidMap.get(e.clientId) ?? 0;
      return {
        clientId: e.clientId,
        name: pupilNames.get(e.clientId) ?? "Desconocido",
        price,
        paid,
        balance: Math.round((price - Math.min(paid, price)) * 100) / 100,
        financialStatus: pur?.financialStatus ?? "pending",
      };
    });
    return { ...s, pupils, studentCount: pupils.length };
  });

  return NextResponse.json(data);
}
```
Importar `sql` de `drizzle-orm`.

- [ ] **Step 3: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/app/api/course-sessions/route.ts
git commit -m "feat(course-sessions): crear sesión grupal (appointment + enrollments + purchases) y listar"
```

---

## Task 9: API de enrollments (añadir/quitar alumno pre-completar)

**Files:**
- Create: `src/app/api/course-sessions/[id]/enrollments/route.ts`

**Interfaces:**
- Consumes: `schema.courseEnrollments`, `schema.servicePurchases`, `schema.appointments`, `schema.services`, `recomputeFinancialStatus`.
- Produces:
  - `POST /api/course-sessions/[id]/enrollments` — body `{ clientId }`. Valida que la sesión existe, está `pending/confirmed` (no completada) y es grupo; crea enrollment + purchase (`pending`). 409 si ya está inscrito.
  - `DELETE /api/course-sessions/[id]/enrollments?clientId=<id>` — quita el alumno (borra enrollment + su purchase). 400 si la sesión ya está completada.

- [ ] **Step 1: Escribir la ruta**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const appt = db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
  if (!appt) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (appt.status === "completed") return NextResponse.json({ error: "No se puede modificar una sesión completada" }, { status: 400 });

  const service = db.select().from(schema.services).where(eq(schema.services.id, appt.serviceId)).get();
  if (!service || service.isGroup !== 1) return NextResponse.json({ error: "No es una sesión de grupo" }, { status: 400 });

  const exists = db.select().from(schema.courseEnrollments)
    .where(and(eq(schema.courseEnrollments.appointmentId, id), eq(schema.courseEnrollments.clientId, clientId))).get();
  if (exists) return NextResponse.json({ error: "El cliente ya está inscrito" }, { status: 409 });

  const client = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, clientId)).get();
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  db.insert(schema.courseEnrollments).values({ id: crypto.randomUUID(), appointmentId: id, clientId, createdAt: now }).run();
  db.insert(schema.servicePurchases).values({
    id: crypto.randomUUID(),
    userId: clientId,
    appointmentId: id,
    serviceId: service.id,
    serviceName: service.name,
    serviceDescription: service.description,
    servicePrice: service.price,
    serviceDurationMins: service.durationMins,
    financialStatus: "pending",
    createdAt: now,
  }).run();
  recomputeFinancialStatus(clientId);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const appt = db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
  if (!appt) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (appt.status === "completed") return NextResponse.json({ error: "No se puede modificar una sesión completada" }, { status: 400 });

  db.delete(schema.courseEnrollments)
    .where(and(eq(schema.courseEnrollments.appointmentId, id), eq(schema.courseEnrollments.clientId, clientId)))
    .run();
  db.delete(schema.servicePurchases)
    .where(and(eq(schema.servicePurchases.appointmentId, id), eq(schema.servicePurchases.userId, clientId)))
    .run();
  recomputeFinancialStatus(clientId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/app/api/course-sessions/[id]/enrollments/route.ts
git commit -m "feat(course-sessions): añadir/quitar alumnos de una sesión pre-completar"
```

---

## Task 10: Agenda del día — mostrar sesiones de curso y estado financiero

**Files:**
- Modify: `src/app/api/appointments/route.ts`
- Modify: `src/components/AppointmentCard.tsx`
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`
- Create: `src/components/CourseSessionDialog.tsx`

**Interfaces:**
- Consumes: `schema.services.isGroup`, lista de clientes (`/api/clients`), `POST /api/course-sessions`.
- Produces: 
  - `GET /api/appointments?date=` devuelve por fila `isGroup` (del servicio) y `studentCount` (si grupo, nº de enrollments).
  - `DashboardContent` muestra un bloque de grupo (badge "Curso · N alumnos") y un botón "+ Nueva sesión de curso"; `AppointmentCard` recibe `isGroup`.
  - `CourseSessionDialog` crea sesiones.

- [ ] **Step 1: Enriquecer GET /api/appointments**

En `src/app/api/appointments/route.ts`, añadir a la query base `appointments` (la de GET, ~línea 25) el campo:
```ts
servicePrice: schema.servicePurchases.servicePrice,
isGroup: schema.services.isGroup,
```
y añadir `serviceNamePrice`/`isGroup` al select. Además, tras obtener las filas, adjuntar `studentCount` para citas de grupo:
```ts
const enrollCounts = new Map(
  db
    .select({ appointmentId: schema.courseEnrollments.appointmentId, n: sql<number>`count(*)` })
    .from(schema.courseEnrollments)
    .groupBy(schema.courseEnrollments.appointmentId)
    .all()
    .map((r) => [r.appointmentId, r.n] as const)
);
// en el map de retorno:
// ...appt, studentCount: enrollCounts.get(appt.id) ?? (appt.isGroup === 1 ? 1 : 0)
```
Añadir `sql` a los imports (ya está) y usar `Map`.

- [ ] **Step 2: `AppointmentCard` — prop `isGroup`**

Abrir `src/components/AppointmentCard.tsx`, añadir prop `isGroup?: boolean` y `studentCount?: number`, y renderizar un badge "Curso · N alumnos" cuando `isGroup`. Mantener el resto igual.

- [ ] **Step 3: `DashboardContent` — bloque de grupo + botón de sesión**

En `src/app/(admin)/dashboard/DashboardContent.tsx`:
- Añadir al tipo `Appointment` los campos `isGroup: number` y `studentCount: number`.
- Añadir botón "+ Nueva sesión de curso" junto a "Nueva cita" (estado `showCourseSession`).
- Pasar `isGroup`/`studentCount` a `AppointmentCard`.
- Renderizar `<CourseSessionDialog>` cuando `showCourseSession`.

- [ ] **Step 4: `CourseSessionDialog`**

Crear `src/components/CourseSessionDialog.tsx` (basado en `NewAppointmentDialog`): elige servicio (filtrar `isGroup===1` de `/api/services`), fecha, hora (slots), y una **lista multi-select de clientes** (buscador a `/api/clients`). Muestra precio por alumno y total. Al confirmar llama `POST /api/course-sessions`. Plantilla:
```tsx
"use client";
// (esqueleto — completar con la lógica de NewAppointmentDialog)
```
No dejar este archivo incompleto: implementar completamente con los mismos patrones UI de `NewAppointmentDialog` (services fetch, slots fetch, clientes búsqueda multi-select con checkboxes, submit a course-sessions).

- [ ] **Step 5: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/app/api/appointments/route.ts src/components/AppointmentCard.tsx "src/app/(admin)/dashboard/DashboardContent.tsx" src/components/CourseSessionDialog.tsx
git commit -m "feat(dashboard): sesión de curso grupal en agenda + diálogo de creación"
```

---

## Task 11: Completar caja — mostrar estado financiero y opción "dejar pendiente"

**Files:**
- Modify: `src/components/CompleteAppointmentDialog.tsx`

**Interfaces:**
- Consumes: `GET /api/payments?userId=` (existente), `financial_status` de la compra (opcional vía `/api/purchases`).
- Produces: diálogo que muestra el saldo/estado financiero de la caja y permite al admin dejar la cuenta pendiente (no forzar pago). El comportamiento ya es flexible (checkbox opcional "$ pagó"); solo se añade información y se reutiliza el flujo existente.

- [ ] **Step 1: Mostrar estado financiero del cliente en el diálogo**

En `src/components/CompleteAppointmentDialog.tsx`, en el bloque de pago (sección "¿Pagó en el momento?"), añadir texto informativo con el saldo pendiente del cliente: fetch a `GET /api/payments?userId=` y sumar `amountUsd` para mostrar "Pagado: $X". También mostrar si la deuda de esta caja ya estaba abonada.

- [ ] **Step 2: Mantener el comportamiento flexible**

No forzar pago: el checkbox "¿Pagó en el momento?" sigue siendo opcional. Si no se marca, la caja se completa dejando la deuda `pending` (lo calcula el backend en Task 6). Consumir `onCompleted` como hoy.

- [ ] **Step 3: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/components/CompleteAppointmentDialog.tsx
git commit -m "feat(complete-dialog): muestra estado financiero; permite dejar pendiente"
```

---

## Task 12: Balances — desglose por ítem y filtro por estado financiero

**Files:**
- Modify: `src/app/api/balances/route.ts`
- Modify: `src/app/(admin)/dashboard/balances/BalancesContent.tsx`

**Interfaces:**
- Consumes: `servicePurchases.financialStatus`, `servicePurchases.serviceName`, `servicePurchases.completionDate`.
- Produces: `balances` devuelve además `items` por cliente: `[{ purchaseId, serviceName, price, financialStatus, completionDate }]`. UI muestra desglose y badge.

- [ ] **Step 1: Añadir `items` al API**

En `src/app/api/balances/route.ts`, tras calcular `balance`, hacer una query de purchases del usuario ordenando por `createdAt` y adjuntarlos:
```ts
const items = db
  .select({
    id: schema.servicePurchases.id,
    serviceName: schema.servicePurchases.serviceName,
    price: schema.servicePurchases.servicePrice,
    financialStatus: schema.servicePurchases.financialStatus,
    completionDate: schema.servicePurchases.completionDate,
    startTime: schema.appointments.startTime,
  })
  .from(schema.servicePurchases)
  .leftJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
  .where(and(eq(schema.servicePurchases.userId, d.userId), ne(schema.servicePurchases.financialStatus, "void")))
  .orderBy(schema.servicePurchases.createdAt)
  .all();
```
y añadir `items` a cada `clients` objeto. Importar `and`, `ne`.

- [ ] **Step 2: UI — desglose y filtro**

En `BalancesContent.tsx`:
- En la fila del cliente, bajo el saldo, listar `items` con badge de estado financiero (Pendiente/Abonado/Pagado) y si la cita es pendiente o completada.
- Añadir filtro opcional por estado financiero (pendientes/abonadas/pagadas/todas) que filtra el desglose.

- [ ] **Step 3: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/app/api/balances/route.ts "src/app/(admin)/dashboard/balances/BalancesContent.tsx"
git commit -m "feat(balances): desglose por ítem y filter de estado financiero"
```

---

## Task 13: P&L UI — paneles de Recaudación y Producción

**Files:**
- Modify: `src/app/(admin)/dashboard/financials/FinancialsContent.tsx`

**Interfaces:**
- Consumes: nueva forma de `getPnL` (Task 3).
- Produces: UI con dos paneles.

- [ ] **Step 1: Actualizar tipos y render**

En `FinancialsContent.tsx`, reemplazar el tipo `PnLResult` por la nueva forma y renderizar dos grupos de tarjetas: **Recaudación** (ingresos, `data.recaudacion.income`, `data.profitRecaudacion`) y **Producción** (`data.produccion.income`, `data.profitProduccion`), además de Gastos y Facturas globales. Cada panel con su `incomeByService`.

- [ ] **Step 2: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add "src/app/(admin)/dashboard/financials/FinancialsContent.tsx"
git commit -m "feat(financials): UI Recaudación + Producción"
```

---

## Task 14: Perfil — estado de cuenta completo

**Files:**
- Modify: `src/app/(client)/profile/page.tsx`
- Modify: `src/app/(client)/profile/ProfileContent.tsx`

**Interfaces:**
- Consumes: `servicePurchases` (nuevos campos), `payments`.
- Produces: `balanceUsd` calculado con purchases no-void (no solo completadas); sección "Estado de cuenta" con ítems pendientes + pagos + saldo.

- [ ] **Step 1: Server data en `page.tsx`**

Cambiar la query `due` (líneas 83-88) para sumar purchases no-void sin filtrar por `completed`:
```ts
const due = db
  .select({ s: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)` })
  .from(schema.servicePurchases)
  .where(and(eq(schema.servicePurchases.userId, user.id), ne(schema.servicePurchases.financialStatus, "void")))
  .get()?.s ?? 0;
```
Importar `ne`. Además, consultar los purchases del usuario con su estado para mostrar el desglose:
```ts
const statementItems = db
  .select({
    id: schema.servicePurchases.id,
    serviceName: schema.servicePurchases.serviceName,
    price: schema.servicePurchases.servicePrice,
    financialStatus: schema.servicePurchases.financialStatus,
    completionDate: schema.servicePurchases.completionDate,
    startTime: schema.appointments.startTime,
  })
  .from(schema.servicePurchases)
  .leftJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
  .where(and(eq(schema.servicePurchases.userId, user.id), ne(schema.servicePurchases.financialStatus, "void")))
  .orderBy(schema.servicePurchases.createdAt)
  .all();
```
Pasar `statementItems` a `ProfileContent`.

- [ ] **Step 2: UI en `ProfileContent.tsx`**

Añadir sección "Mi estado de cuenta" que liste `statementItems` (servicio, fecha, precio, badge de estado financiero) y los pagos (ya existen "Mis pagos"). Mantener `balanceUsd` mostrado. Actualizar el tipo `Props` con `statementItems`.

- [ ] **Step 3: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add "src/app/(client)/profile/page.tsx" "src/app/(client)/profile/ProfileContent.tsx"
git commit -m "feat(profile): estado de cuenta con pendientes + pagos + saldo"
```

---

## Task 15: payment_receipts — recompute al aprobar

**Files:**
- Modify: `src/app/api/payment-receipts/[id]/route.ts`

**Interfaces:**
- Consumes: `recomputeFinancialStatus`, `applyPaidToClient`.
- Produces: al aprobar una captura (se inserta `payments`), se llama `recomputeFinancialStatus(clientId)`.

- [ ] **Step 1: Añadir recompute en approve**

Leer `src/app/api/payment-receipts/[id]/route.ts`, localizar el bloque `action === "approve"` que inserta el `payment`, y tras insertarlo llamar:
```ts
recomputeFinancialStatus(clientId);
```
con `clientId` del receipt. Añadir el import.

- [ ] **Step 2: Typecheck, lint y commit**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`
```bash
git add src/app/api/payment-receipts/[id]/route.ts
git commit -m "feat(payment-receipts): recompute financial_status al aprobar captura"
```

---

## Task 16: Migración de datos heredados + build verificación

**Files:**
- Modify: `src/db/seed.ts` (backfill opcional para datos demo)
- Modify: `src/db/seed-client-demo.ts`, `src/db/seed-finance-demo.ts` (si se desea alinear datos demo)

**Interfaces:**
- Consumes: `financialStatus`, `completionDate`.
- Produces: datos heredados coherentes.

- [ ] **Step 1: Backfill en seed**

En la migración de datos tipo seed (`src/db/seed.ts` o un script ad-hoc), para purchases de citas `completed` setear `completionDate` a la fecha de la cita y recalcular `financial_status`:
```ts
// pseudo-code de ejemplo ejecutado una vez (o en seed re-ejecutable):
const completed = db
  .select({ appointmentId: schema.appointments.id, startTime: schema.appointments.startTime })
  .from(schema.appointments)
  .where(eq(schema.appointments.status, "completed"))
  .all();
for (const c of completed) {
  db.update(schema.servicePurchases)
    .set({ completionDate: c.startTime })
    .where(and(eq(schema.servicePurchases.appointmentId, c.appointmentId), isNull(schema.servicePurchases.completionDate)))
    .run();
}
// y para cada usuario: recomputeFinancialStatus(userId) recorriendo todos los user_id distintos en purchases/payments
```
No comprometer esto en git como parte de una tarea funcional; documentar en el ejecutor que puede hacerse manualmente una vez con `tsx -e` o en un script `src/db/backfill-financial.ts` ejecutado con `tsx` y no dejar un script de un solo uso en el repo si no se pide. (Preferir: ejecutar inline con `tsx -e`.)

- [ ] **Step 2: Build completo y lint**

Run:
```bash
npm run build
npm run lint
npx tsc --noEmit
```
Expected: compila sin errores.

- [ ] **Step 3: Verificación manual (dev server)**

Run `npm run dev`, iniciar sesión como admin, y verificar:
1. Se puede crear una sesión de curso (servicio grupo) con 2+ alumnos → aparecen en agenda como bloque y cada alumno tiene CXC.
2. Registrar un pago para un alumno antes de completar → su badge pasa a Abonado/Pagado; el saldo del cliente baja.
3. Completar la sesión → `completion_date` se setea; la deuda permanece para los no pagados.
4. P&L muestra Recaudación (por pagos) y Producción (por completadas).
5. Cancelar una cita 1:1 pendiente → su purchase pasa a `void` y desaparece de CXC.
Verificar cliente en `/profile` ve su estado de cuenta.

- [ ] **Step 4: Documentación y commit final**

Actualizar `AGENTS.md`, `CHANGELOG.md` y `README.md` con la nueva funcionalidad (cursos grupales, CXC al agendar, P&L base de caja). Commit:
```bash
git add AGENTS.md CHANGELOG.md README.md
git commit -m "docs: cursos grupales, CXC desde agendado y P&L base de caja"
```

---

## Self-Review (verificador)

**Cobertura del spec:**
- Course = sesión grupal → Tasks 8, 9, 10. ✓
- Precio fijo por alumno → Task 8 (purchase por alumno con `service.price`). ✓
- Solo clientes registrados → Task 8/9 validan en usuarios. ✓
- Alcance global (todo servicio) → Tasks 4, 6, 7. ✓
- Desacoplar evento/transacción, estados independientes → Tasks 1, 2, 6. ✓
- Doble fecha (`completion_date`/`paid_at`) → Tasks 1, 3, 6. ✓
- CXC al agendar → Tasks 4, 8. ✓
- Pagos en cualquier momento → Tasks 5, 9 (recompute). ✓
- `financial_status` auto → Task 2, invocado en 5/6/9/15. ✓
- P&L base caja + producción → Tasks 3, 13. ✓
- `totalRevenue` recaudado → Task 2 (`applyPaidToClient`), Task 6. ✓
- Cobro flexible al completar curso → Tasks 6, 11. ✓
- Perfil estado de cuenta → Task 14. ✓
- Curso no es módulo aparte (`is_group`) → Tasks 1, 7. ✓

**Placeholder scan:** Sin TBD/TODO. Todos los pasos de código tienen el código concreto. El `CourseSessionDialog` indica plantilla pero obliga a completarlo con los patrones de `NewAppointmentDialog` (detallado). La migración de datos usa `tsx -e` con instrucción explícita.

**Type consistency:**
- `financialStatus` valores: `pending|partial|paid|void` en todos los usos. ✓
- `recomputeFinancialStatus(userId)` y `applyPaidToClient(userId)` firmas consistentes. ✓
- `getPnL` nueva forma consumida por Task 13. ✓
- Campo col: `financial_status`, `completion_date`, `is_group`, tabla `course_enrollments`. ✓
