# Compras, cuentas por pagar, inventario y estados financieros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin registre facturas de compra y gastos fijos, proveedores, cuentas bancarias, pagos a proveedores, lleve inventario con kardex y costo promedio ponderado (con uso informativo de productos por servicio), y visualice un estado de pérdidas y ganancias mensual (servicios del mes vs gastos del mes).

**Architecture:** Nuevas tablas `suppliers`, `expense_categories`, `bank_accounts`, `bills`, `bill_items`, `inventory_items`, `inventory_movements`, `supplier_payments` y `service_products` (migración Drizzle). La lógica de inventario (entradas, salidas, ajustes, promedio ponderado, reversión de facturas) vive en `src/lib/inventory.ts`; el estado de la factura (pending/partial/paid) se recalcula en `src/lib/bills.ts`; el P&L mensual en `src/lib/financials.ts`. APIs y páginas admin nuevas. Todos los endpoints nuevos exigen `isAdmin`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, Drizzle ORM + better-sqlite3 (sincrónico), NextAuth v5 (`auth()`), paths `@/`, timezone `America/Caracas`.

## Global Constraints

- Timezone local: TODAS las fechas se convierten con `America/Caracas` (patrón `dateTimeToTs(date, "HH:MM")` de `src/lib/time.ts`).
- Drizzle con queries SQL puras; `db` es síncrono (better-sqlite3).
- Auth en cada endpoint: `const session = await auth(); if (!(await isAdmin(session))) return 401`.
- NO agregar comentarios al código.
- UI: paleta rosa (`bg-pink-main`, `bg-pink-light`, `bg-gray-soft`), `rounded-xl`, sombras suaves, mobile-first.
- Multi-moneda: pagos y gastos fijos en USD o VES (`totalUsd = round(amountVes / rate, 2)`). Facturas de inventario SIEMPRE en USD (los costos unitarios alimentan el promedio ponderado en USD).
- Las facturas de inventario alimentan el stock; las de gasto fijo (`type='fixed'`) no tocan inventario.
- `GET /api/purchases` existente NO se modifica (sirve `service_purchases`). Las rutas nuevas de compras usan `/api/bills`.
- Verificación por tarea: `npx tsc --noEmit` y `npm run lint`. `npm run build` al final (Task 16).
- Cada commit de funcionalidad debe incluir la actualización de `AGENTS.md` (si aplica), `CHANGELOG.md` y `README.md` en el MISMO commit (regla del repo). La documentación completa va en la Task 16, pero si un task añade ruta/componente nuevo de UI visible, debe reflejarlo ahí.
- Seeds: `npm run db:seed` (base, ahora con categorías) y `npm run db:seed:finance` (demo nuevo).

---

### Task 1: Schema — 9 tablas nuevas

**Files:**
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces: `schema.suppliers`, `schema.expenseCategories`, `schema.bankAccounts`, `schema.inventoryItems`, `schema.inventoryMovements`, `schema.bills`, `schema.billItems`, `schema.supplierPayments`, `schema.serviceProducts`. Usadas por todas las tasks siguientes.

- [ ] **Step 1: Añadir `uniqueIndex` al import de drizzle**

En la línea 1 de `src/db/schema.ts`:
```ts
import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
```

- [ ] **Step 2: Añadir las 9 tablas**

Al final de `src/db/schema.ts`, después de `exchangeRates`, añadir exactamente:

```ts
export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: integer("created_at"),
});

export const expenseCategories = sqliteTable("expense_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: integer("created_at"),
});

export const bankAccounts = sqliteTable("bank_accounts", {
  id: text("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountType: text("account_type").$type<"savings" | "checking" | "cash">().notNull().default("savings"),
  accountNumber: text("account_number"),
  currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
  isActive: integer("is_active").notNull().default(1),
  notes: text("notes"),
  createdAt: integer("created_at"),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("unidad"),
  stock: real("stock").notNull().default(0),
  avgCost: real("avg_cost").notNull().default(0),
  minStock: real("min_stock").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  notes: text("notes"),
  createdAt: integer("created_at"),
});

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
    kind: text("kind").$type<"in" | "out" | "adjust">().notNull(),
    quantity: real("quantity").notNull(),
    unitCostUsd: real("unit_cost_usd"),
    refType: text("ref_type").$type<"bill" | "manual">().notNull().default("manual"),
    refId: text("ref_id"),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [index("inventory_movements_item_idx").on(t.inventoryItemId)]
);

export const bills = sqliteTable(
  "bills",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").references(() => suppliers.id),
    categoryId: text("category_id").references(() => expenseCategories.id),
    invoiceNumber: text("invoice_number"),
    type: text("type").$type<"inventory" | "fixed">().notNull().default("inventory"),
    billDate: integer("bill_date"),
    dueDate: integer("due_date"),
    currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
    amountVes: real("amount_ves"),
    rate: real("rate"),
    totalUsd: real("total_usd").notNull(),
    status: text("status").$type<"pending" | "partial" | "paid">().notNull().default("pending"),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("bills_bill_date_idx").on(t.billDate),
    index("bills_status_idx").on(t.status),
    index("bills_supplier_idx").on(t.supplierId),
  ]
);

export const billItems = sqliteTable(
  "bill_items",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").references(() => inventoryItems.id),
    description: text("description"),
    quantity: real("quantity").notNull(),
    unitCostUsd: real("unit_cost_usd").notNull(),
    totalUsd: real("total_usd").notNull(),
  },
  (t) => [index("bill_items_bill_idx").on(t.billId)]
);

export const supplierPayments = sqliteTable(
  "supplier_payments",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").notNull().references(() => bills.id),
    bankAccountId: text("bank_account_id").references(() => bankAccounts.id),
    amountUsd: real("amount_usd").notNull(),
    currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
    amountVes: real("amount_ves"),
    rate: real("rate"),
    paymentDate: integer("payment_date"),
    reference: text("reference").notNull(),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [index("supplier_payments_bill_idx").on(t.billId)]
);

export const serviceProducts = sqliteTable(
  "service_products",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id").notNull().references(() => inventoryItems.id),
    quantityPerService: real("quantity_per_service").notNull(),
  },
  (t) => [uniqueIndex("service_products_unique_idx").on(t.serviceId, t.inventoryItemId)]
);
```

- [ ] **Step 3: Generar y aplicar migración**

Run: `npx drizzle-kit generate --name=purchases-inventory-financials`
Expected: nuevo archivo `drizzle/0007_*.sql` (u orden siguiente) con las 9 tablas.

Run: `npx drizzle-kit migrate`
Expected: aplica sin errores.

- [ ] **Step 4: Verificar**

Run:
```
npx tsc --noEmit
node -e "const D=require('better-sqlite3');const db=new D('dev.db');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('suppliers','expense_categories','bank_accounts','bills','bill_items','inventory_items','inventory_movements','supplier_payments','service_products')\").all())"
```
Expected: tsc PASS; las 9 tablas existen.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "feat(db): tablas de compras, inventario, pagos a proveedores y mapeo de servicios"
```

---

### Task 2: Libs de inventario, estado de facturas y P&L

**Files:**
- Create: `src/lib/inventory.ts`
- Create: `src/lib/bills.ts`
- Create: `src/lib/financials.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `eq`, `sql`, `and`, `gte`, `lt`, `dateTimeToTs`.
- Produces:
  - `createInventoryIn(itemId: string, qty: number, unitCostUsd: number, refType: "bill" | "manual", refId: string | null, notes: string | null, createdBy: string): { stock: number; avgCost: number }` — entradas con promedio ponderado.
  - `applyManualMovement(itemId: string, kind: "out" | "adjust", param: number, notes: string, createdBy: string): { stock: number; delta: number }` — salidas y ajustes.
  - `reverseBillMovements(billId: string, createdBy: string): void` — revierte el stock de una factura `inventory`.
  - `recomputeBillStatus(billId: string): void` — recalcula `pending | partial | paid`.
  - `getPnL(month: string): PnLResult` — P&L mensual (tipo `PnLResult` definido abajo).
  - `monthRange(month: string): { start: number; end: number }` — rango unix del mes (helper exportado, reutilizado por `GET /api/bills`).

- [ ] **Step 1: `src/lib/inventory.ts`**

```ts
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export function createInventoryIn(
  itemId: string,
  qty: number,
  unitCostUsd: number,
  refType: "bill" | "manual",
  refId: string | null,
  notes: string | null,
  createdBy: string
): { stock: number; avgCost: number } {
  const item = db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, itemId))
    .get();
  if (!item) throw new Error("Item de inventario no encontrado");
  const newStock = item.stock + qty;
  const newAvg =
    newStock > 0
      ? Math.round(((item.stock * item.avgCost + qty * unitCostUsd) / newStock) * 10000) / 10000
      : unitCostUsd;
  db.update(schema.inventoryItems)
    .set({ stock: newStock, avgCost: newAvg })
    .where(eq(schema.inventoryItems.id, itemId))
    .run();
  db.insert(schema.inventoryMovements)
    .values({
      id: crypto.randomUUID(),
      inventoryItemId: itemId,
      kind: "in",
      quantity: qty,
      unitCostUsd,
      refType,
      refId,
      notes,
      createdBy,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
  return { stock: newStock, avgCost: newAvg };
}

export function applyManualMovement(
  itemId: string,
  kind: "out" | "adjust",
  param: number,
  notes: string,
  createdBy: string
): { stock: number; delta: number } {
  const item = db
    .select()
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.id, itemId))
    .get();
  if (!item) throw new Error("Item de inventario no encontrado");
  let delta = 0;
  let newStock = item.stock;
  if (kind === "out") {
    if (param <= 0) throw new Error("La cantidad debe ser mayor a 0");
    if (item.stock - param < 0) throw new Error("Stock insuficiente");
    delta = -param;
    newStock = item.stock - param;
  } else {
    if (param < 0) throw new Error("El stock objetivo no puede ser negativo");
    delta = Math.round((param - item.stock) * 100) / 100;
    newStock = param;
  }
  db.update(schema.inventoryItems)
    .set({ stock: newStock })
    .where(eq(schema.inventoryItems.id, itemId))
    .run();
  db.insert(schema.inventoryMovements)
    .values({
      id: crypto.randomUUID(),
      inventoryItemId: itemId,
      kind,
      quantity: delta,
      unitCostUsd: null,
      refType: "manual",
      refId: null,
      notes,
      createdBy,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .run();
  return { stock: newStock, delta };
}

export function reverseBillMovements(billId: string, createdBy: string): void {
  const items = db
    .select()
    .from(schema.billItems)
    .where(eq(schema.billItems.billId, billId))
    .all();
  const now = Math.floor(Date.now() / 1000);
  for (const it of items) {
    if (!it.inventoryItemId) continue;
    const item = db
      .select()
      .from(schema.inventoryItems)
      .where(eq(schema.inventoryItems.id, it.inventoryItemId))
      .get();
    if (!item) continue;
    const newStock = Math.max(0, item.stock - it.quantity);
    db.update(schema.inventoryItems)
      .set({ stock: newStock })
      .where(eq(schema.inventoryItems.id, it.inventoryItemId))
      .run();
    db.insert(schema.inventoryMovements)
      .values({
        id: crypto.randomUUID(),
        inventoryItemId: it.inventoryItemId,
        kind: "out",
        quantity: -it.quantity,
        unitCostUsd: null,
        refType: "bill",
        refId: billId,
        notes: "Reversión de factura",
        createdBy,
        createdAt: now,
      })
      .run();
  }
}
```

- [ ] **Step 2: `src/lib/bills.ts`**

```ts
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";

export function recomputeBillStatus(billId: string): void {
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, billId)).get();
  if (!bill) return;
  const paid =
    db
      .select({ s: sql<number>`coalesce(sum(${schema.supplierPayments.amountUsd}), 0)` })
      .from(schema.supplierPayments)
      .where(eq(schema.supplierPayments.billId, billId))
      .get()?.s ?? 0;
  const status: "pending" | "partial" | "paid" =
    paid >= bill.totalUsd - 0.004 ? "paid" : paid > 0.004 ? "partial" : "pending";
  db.update(schema.bills).set({ status }).where(eq(schema.bills.id, billId)).run();
}
```

- [ ] **Step 3: `src/lib/financials.ts`**

```ts
import { db, schema } from "@/db/index";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { dateTimeToTs } from "@/lib/time";

export type PnLResult = {
  month: string;
  income: number;
  expenses: number;
  profit: number;
  servicesCount: number;
  invoicesCount: number;
  incomeByService: { serviceName: string; amount: number; count: number }[];
  expensesByCategory: { categoryName: string; amount: number }[];
};

export function monthRange(month: string): { start: number; end: number } {
  const [y, m] = month.split("-").map((n) => parseInt(n, 10));
  const start = dateTimeToTs(`${month}-01`, "00:00");
  const next = new Date(Date.UTC(y, m - 1, 1));
  next.setUTCMonth(next.getUTCMonth() + 1);
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end: dateTimeToTs(`${nextMonth}-01`, "00:00") };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function getPnL(month: string): PnLResult {
  const { start, end } = monthRange(month);
  const inMonth = and(gte(schema.appointments.startTime, start), lt(schema.appointments.startTime, end));

  const incomeRow = db
    .select({
      total: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
    .where(and(eq(schema.appointments.status, "completed"), inMonth))
    .get();

  const incomeByService = db
    .select({
      serviceName: schema.servicePurchases.serviceName,
      amount: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      count: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
    .where(and(eq(schema.appointments.status, "completed"), inMonth))
    .groupBy(schema.servicePurchases.serviceName)
    .all();

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

  const income = round2(incomeRow?.total ?? 0);
  const expenses = round2(expensesRow?.total ?? 0);
  return {
    month,
    income,
    expenses,
    profit: round2(income - expenses),
    servicesCount: incomeRow?.count ?? 0,
    invoicesCount: expensesRow?.count ?? 0,
    incomeByService: incomeByService.map((r) => ({
      serviceName: r.serviceName,
      amount: round2(r.amount ?? 0),
      count: r.count ?? 0,
    })),
    expensesByCategory,
  };
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventory.ts src/lib/bills.ts src/lib/financials.ts
git commit -m "feat(lib): lógica de inventario, estado de facturas y P&L mensual"
```

---

### Task 3: API proveedores

**Files:**
- Create: `src/app/api/suppliers/route.ts`
- Create: `src/app/api/suppliers/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `isAdmin`, `eq`, `like`, `or`.
- Produces: `GET /api/suppliers` (opcional `?q=`), `POST /api/suppliers`, `PATCH /api/suppliers/[id]`, `DELETE /api/suppliers/[id]` (solo si no tiene `bills`). Usado por Task 6 y Task 12.

- [ ] **Step 1: `src/app/api/suppliers/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { like, or } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rows = q
    ? db
        .select()
        .from(schema.suppliers)
        .where(or(like(schema.suppliers.name, `%${q}%`), like(schema.suppliers.phone, `%${q}%`)))
        .orderBy(schema.suppliers.name)
        .all()
    : db.select().from(schema.suppliers).orderBy(schema.suppliers.name).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const row = {
    id: crypto.randomUUID(),
    name,
    phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
    email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
    address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.suppliers).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/suppliers/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const patch: Record<string, string | null> = {};
  for (const field of ["name", "phone", "email", "address", "notes"] as const) {
    if (body[field] !== undefined) {
      const v = typeof body[field] === "string" ? body[field].trim() : "";
      patch[field] = v || null;
    }
  }
  if (patch.name === null || patch.name === "") {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  db.update(schema.suppliers).set(patch).where(eq(schema.suppliers.id, id)).run();
  return NextResponse.json({ ...existing, ...patch });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const count =
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.bills)
      .where(eq(schema.bills.supplierId, id))
      .get()?.c ?? 0;
  if (count > 0) {
    return NextResponse.json(
      { error: "El proveedor tiene facturas asociadas; no se puede eliminar" },
      { status: 400 }
    );
  }
  db.delete(schema.suppliers).where(eq(schema.suppliers.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/suppliers
git commit -m "feat(api): CRUD de proveedores"
```

---

### Task 4: API categorías de gasto

**Files:**
- Create: `src/app/api/expense-categories/route.ts`
- Create: `src/app/api/expense-categories/[id]/route.ts`

**Interfaces:**
- Produces: `GET /api/expense-categories` (`?includeInactive=1`), `POST`, `PATCH`, `DELETE`. Usado por Task 6 y Task 12.

- [ ] **Step 1: `src/app/api/expense-categories/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const rows = includeInactive
    ? db.select().from(schema.expenseCategories).orderBy(schema.expenseCategories.name).all()
    : db
        .select()
        .from(schema.expenseCategories)
        .where(eq(schema.expenseCategories.isActive, 1))
        .orderBy(schema.expenseCategories.name)
        .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const row = {
    id: crypto.randomUUID(),
    name,
    isActive: 1,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.expenseCategories).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/expense-categories/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db
    .select()
    .from(schema.expenseCategories)
    .where(eq(schema.expenseCategories.id, id))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const name =
    body.name !== undefined && typeof body.name === "string"
      ? body.name.trim()
      : existing.name;
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const isActive =
    body.isActive !== undefined
      ? body.isActive
        ? 1
        : 0
      : existing.isActive;
  db.update(schema.expenseCategories)
    .set({ name, isActive })
    .where(eq(schema.expenseCategories.id, id))
    .run();
  return NextResponse.json({ ...existing, name, isActive });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const count =
    db.select({ c: sql<number>`count(*)` }).from(schema.bills).where(eq(schema.bills.categoryId, id)).get()?.c ?? 0;
  if (count > 0) {
    return NextResponse.json(
      { error: "La categoría tiene facturas asociadas; desactívala en su lugar" },
      { status: 400 }
    );
  }
  db.delete(schema.expenseCategories).where(eq(schema.expenseCategories.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar + commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add src/app/api/expense-categories
git commit -m "feat(api): CRUD de categorías de gasto"
```

---

### Task 5: API cuentas bancarias

**Files:**
- Create: `src/app/api/bank-accounts/route.ts`
- Create: `src/app/api/bank-accounts/[id]/route.ts`

**Interfaces:**
- Produces: `GET /api/bank-accounts` (`?includeInactive=1`), `POST`, `PATCH`, `DELETE` (solo si no tiene `supplier_payments`). Usado por Task 8 y Task 13.

- [ ] **Step 1: `src/app/api/bank-accounts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const rows = includeInactive
    ? db.select().from(schema.bankAccounts).orderBy(schema.bankAccounts.bankName).all()
    : db
        .select()
        .from(schema.bankAccounts)
        .where(eq(schema.bankAccounts.isActive, 1))
        .orderBy(schema.bankAccounts.bankName)
        .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
  if (!bankName) {
    return NextResponse.json({ error: "El nombre del banco es requerido" }, { status: 400 });
  }
  const currency: "USD" | "VES" = body.currency === "VES" ? "VES" : "USD";
  const accountType: "savings" | "checking" | "cash" =
    body.accountType === "checking" ? "checking" : body.accountType === "cash" ? "cash" : "savings";
  const row = {
    id: crypto.randomUUID(),
    bankName,
    accountType,
    accountNumber: typeof body.accountNumber === "string" && body.accountNumber.trim() ? body.accountNumber.trim() : null,
    currency,
    isActive: 1,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.bankAccounts).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/bank-accounts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const bankName =
    body.bankName !== undefined && typeof body.bankName === "string"
      ? body.bankName.trim()
      : existing.bankName;
  if (!bankName) {
    return NextResponse.json({ error: "El nombre del banco es requerido" }, { status: 400 });
  }
  const currency: "USD" | "VES" = body.currency !== undefined ? (body.currency === "VES" ? "VES" : "USD") : existing.currency;
  const accountType: "savings" | "checking" | "cash" =
    body.accountType !== undefined
      ? body.accountType === "checking"
        ? "checking"
        : body.accountType === "cash"
          ? "cash"
          : "savings"
      : existing.accountType;
  const accountNumber =
    body.accountNumber !== undefined
      ? typeof body.accountNumber === "string" && body.accountNumber.trim()
        ? body.accountNumber.trim()
        : null
      : existing.accountNumber;
  const isActive =
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive;
  const notes =
    body.notes !== undefined
      ? typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null
      : existing.notes;
  db.update(schema.bankAccounts)
    .set({ bankName, accountType, accountNumber, currency, isActive, notes })
    .where(eq(schema.bankAccounts.id, id))
    .run();
  return NextResponse.json({ ...existing, bankName, accountType, accountNumber, currency, isActive, notes });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const count =
    db.select({ c: sql<number>`count(*)` }).from(schema.supplierPayments).where(eq(schema.supplierPayments.bankAccountId, id)).get()?.c ?? 0;
  if (count > 0) {
    return NextResponse.json(
      { error: "La cuenta tiene pagos asociados; desactívala en su lugar" },
      { status: 400 }
    );
  }
  db.delete(schema.bankAccounts).where(eq(schema.bankAccounts.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar + commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add src/app/api/bank-accounts
git commit -m "feat(api): CRUD de cuentas bancarias"
```

---

### Task 6: API facturas (GET y POST con integración de inventario)

**Files:**
- Create: `src/app/api/bills/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `isAdmin`, `eq`, `and`, `or`, `sql`, `inArray`, `desc`, `dateTimeToTs`/`monthRange`, `createInventoryIn`.
- Produces: `GET /api/bills` con `?status=`, `?supplierId=`, `?type=`, `?month=YYYY-MM`; cada factura incluye `supplierName`, `categoryName`, `paidUsd`, `items`. `POST /api/bills` crea factura + `bill_items` + movimientos de inventario (si `type='inventory'`). Usado por Task 7, Task 11 (UI) y Task 13.

- [ ] **Step 1: `src/app/api/bills/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { createInventoryIn } from "@/lib/inventory";
import { monthRange } from "@/lib/financials";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const conditions = [];
  const status = sp.get("status");
  if (status === "pending" || status === "partial" || status === "paid") {
    conditions.push(eq(schema.bills.status, status));
  }
  const supplierId = sp.get("supplierId");
  if (supplierId) conditions.push(eq(schema.bills.supplierId, supplierId));
  const type = sp.get("type");
  if (type === "inventory" || type === "fixed") conditions.push(eq(schema.bills.type, type));
  const month = sp.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { start, end } = monthRange(month);
    conditions.push(and(sql`${schema.bills.billDate} >= ${start}`, sql`${schema.bills.billDate} < ${end}`));
  }

  const rows = db
    .select({
      id: schema.bills.id,
      supplierId: schema.bills.supplierId,
      supplierName: schema.suppliers.name,
      categoryId: schema.bills.categoryId,
      categoryName: schema.expenseCategories.name,
      invoiceNumber: schema.bills.invoiceNumber,
      type: schema.bills.type,
      billDate: schema.bills.billDate,
      dueDate: schema.bills.dueDate,
      currency: schema.bills.currency,
      amountVes: schema.bills.amountVes,
      rate: schema.bills.rate,
      totalUsd: schema.bills.totalUsd,
      status: schema.bills.status,
      notes: schema.bills.notes,
      createdAt: schema.bills.createdAt,
    })
    .from(schema.bills)
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.bills.supplierId))
    .leftJoin(schema.expenseCategories, eq(schema.expenseCategories.id, schema.bills.categoryId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.bills.billDate))
    .all();

  const ids = rows.map((r) => r.id);
  const paidMap = new Map<string, number>();
  const itemsByBill = new Map<string, typeof allItems>();
  let allItems: { billId: string; id: string; inventoryItemId: string | null; description: string | null; quantity: number; unitCostUsd: number; totalUsd: number }[] = [];
  if (ids.length > 0) {
    const paidRows = db
      .select({
        billId: schema.supplierPayments.billId,
        s: sql<number>`coalesce(sum(${schema.supplierPayments.amountUsd}), 0)`,
      })
      .from(schema.supplierPayments)
      .where(inArray(schema.supplierPayments.billId, ids))
      .groupBy(schema.supplierPayments.billId)
      .all();
    for (const p of paidRows) paidMap.set(p.billId, p.s ?? 0);
    allItems = db.select().from(schema.billItems).where(inArray(schema.billItems.billId, ids)).all();
    for (const it of allItems) {
      const arr = itemsByBill.get(it.billId) ?? [];
      arr.push(it);
      itemsByBill.set(it.billId, arr);
    }
  }

  return NextResponse.json(
    rows.map((r) => ({ ...r, paidUsd: paidMap.get(r.id) ?? 0, items: itemsByBill.get(r.id) ?? [] }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const type: "inventory" | "fixed" = body.type === "fixed" ? "fixed" : "inventory";
  const currency: "USD" | "VES" = body.currency === "VES" ? "VES" : "USD";

  if (type === "inventory" && currency !== "USD") {
    return NextResponse.json(
      { error: "Las facturas de inventario se registran en USD" },
      { status: 400 }
    );
  }

  let totalUsd = 0;
  if (currency === "VES") {
    if (typeof body.amountVes !== "number" || typeof body.rate !== "number" || body.rate <= 0 || body.amountVes <= 0) {
      return NextResponse.json({ error: "amountVes y rate son requeridos para facturas en Bs" }, { status: 400 });
    }
    totalUsd = Math.round((body.amountVes / body.rate) * 100) / 100;
  } else {
    if (type === "inventory") {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "La factura de inventario requiere al menos un item" }, { status: 400 });
      }
      totalUsd = 0;
      for (const it of body.items) {
        const qty = Number(it.quantity);
        const unit = Number(it.unitCostUsd);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) {
          return NextResponse.json({ error: "Cada item requiere cantidad > 0 y costo unitario >= 0" }, { status: 400 });
        }
        totalUsd += Math.round(qty * unit * 100) / 100;
      }
      totalUsd = Math.round(totalUsd * 100) / 100;
    } else {
      const t = Number(body.totalUsd);
      if (!Number.isFinite(t) || t <= 0) {
        return NextResponse.json({ error: "totalUsd es requerido" }, { status: 400 });
      }
      totalUsd = Math.round(t * 100) / 100;
    }
  }

  const billDate = typeof body.billDate === "number" ? body.billDate : Math.floor(Date.now() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const bill = {
    id: crypto.randomUUID(),
    supplierId: body.supplierId ?? null,
    categoryId: body.categoryId ?? null,
    invoiceNumber: typeof body.invoiceNumber === "string" && body.invoiceNumber.trim() ? body.invoiceNumber.trim() : null,
    type,
    billDate,
    dueDate: typeof body.dueDate === "number" ? body.dueDate : null,
    currency,
    amountVes: currency === "VES" ? body.amountVes : null,
    rate: currency === "VES" ? body.rate : null,
    totalUsd,
    status: "pending",
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdBy: adminId,
    createdAt: now,
  };
  db.insert(schema.bills).values(bill).run();

  if (type === "inventory") {
    for (const it of body.items) {
      const qty = Number(it.quantity);
      const unit = Math.round(Number(it.unitCostUsd) * 100) / 100;
      db.insert(schema.billItems)
        .values({
          id: crypto.randomUUID(),
          billId: bill.id,
          inventoryItemId: it.inventoryItemId ?? null,
          description: typeof it.description === "string" && it.description.trim() ? it.description.trim() : null,
          quantity: qty,
          unitCostUsd: unit,
          totalUsd: Math.round(qty * unit * 100) / 100,
        })
        .run();
      if (it.inventoryItemId) {
        createInventoryIn(it.inventoryItemId, qty, unit, "bill", bill.id, bill.notes, adminId);
      }
    }
  }

  return NextResponse.json(bill, { status: 201 });
}
```

Nota: la línea `let allItems: {...}[]` en GET es la "declaración de tipo" que alimenta el `Map`; en TypeScript el `typeof allItems` referido antes de asignar funciona porque `itemsByBill` usa el tipo inline. Si `tsc` se queja del orden, mueve la declaración de `allItems` (con su tipo inline) antes de `itemsByBill`. El código de Task 7 asume que `items` tiene los campos `id`, `inventoryItemId`, `description`, `quantity`, `unitCostUsd`, `totalUsd`.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS. (Si el tipado del Map falla, declarar el tipo del Map explícitamente: `const itemsByBill = new Map<string, { id: string; inventoryItemId: string | null; description: string | null; quantity: number; unitCostUsd: number; totalUsd: number }[]>();`)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bills/route.ts
git commit -m "feat(api): listado y creación de facturas con integración de inventario"
```

---

### Task 7: API factura individual (GET, PATCH, DELETE)

**Files:**
- Create: `src/app/api/bills/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `eq`, `sql`, `isAdmin`, `reverseBillMovements`, `createInventoryIn`.
- Produces: `GET /api/bills/[id]` (factura + `items` + `payments` con `bankName`), `PATCH /api/bills/[id]` (campos maestros siempre; items/total solo sin pagos), `DELETE /api/bills/[id]` (solo sin pagos; revierte inventario). Usado por Task 12 (edición).

- [ ] **Step 1: `src/app/api/bills/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { reverseBillMovements, createInventoryIn } from "@/lib/inventory";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const items = db.select().from(schema.billItems).where(eq(schema.billItems.billId, id)).orderBy(schema.billItems.id).all();
  const payments = db
    .select({
      id: schema.supplierPayments.id,
      billId: schema.supplierPayments.billId,
      bankAccountId: schema.supplierPayments.bankAccountId,
      bankName: schema.bankAccounts.bankName,
      amountUsd: schema.supplierPayments.amountUsd,
      currency: schema.supplierPayments.currency,
      amountVes: schema.supplierPayments.amountVes,
      rate: schema.supplierPayments.rate,
      paymentDate: schema.supplierPayments.paymentDate,
      reference: schema.supplierPayments.reference,
      notes: schema.supplierPayments.notes,
      createdAt: schema.supplierPayments.createdAt,
    })
    .from(schema.supplierPayments)
    .leftJoin(schema.bankAccounts, eq(schema.bankAccounts.id, schema.supplierPayments.bankAccountId))
    .where(eq(schema.supplierPayments.billId, id))
    .orderBy(desc(schema.supplierPayments.paymentDate))
    .all();
  const paidUsd = payments.reduce((s, p) => s + p.amountUsd, 0);
  return NextResponse.json({ ...bill, items, payments, paidUsd });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const hasPayments =
    db.select({ c: sql<number>`count(*)` }).from(schema.supplierPayments).where(eq(schema.supplierPayments.billId, id)).get()?.c ?? 0 > 0;

  if (hasPayments) {
    const locked = body.type !== undefined && body.type !== bill.type;
    const lockedCur = body.currency !== undefined && body.currency !== bill.currency;
    const lockedTotal = body.totalUsd !== undefined && Number(body.totalUsd) !== bill.totalUsd;
    const lockedItems = body.items !== undefined;
    if (locked || lockedCur || lockedTotal || lockedItems) {
      return NextResponse.json(
        { error: "Con pagos asociados solo se pueden editar proveedor, categoría, número, fechas y notas" },
        { status: 400 }
      );
    }
  }

  const supplierId = body.supplierId !== undefined ? body.supplierId ?? null : bill.supplierId;
  const categoryId = body.categoryId !== undefined ? body.categoryId ?? null : bill.categoryId;
  const invoiceNumber =
    body.invoiceNumber !== undefined
      ? typeof body.invoiceNumber === "string" && body.invoiceNumber.trim()
        ? body.invoiceNumber.trim()
        : null
      : bill.invoiceNumber;
  const billDate = body.billDate !== undefined && typeof body.billDate === "number" ? body.billDate : bill.billDate;
  const dueDate = body.dueDate !== undefined ? (typeof body.dueDate === "number" ? body.dueDate : null) : bill.dueDate;
  const notes =
    body.notes !== undefined
      ? typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null
      : bill.notes;

  const type: "inventory" | "fixed" =
    body.type !== undefined && !hasPayments ? (body.type === "fixed" ? "fixed" : "inventory") : bill.type;

  db.update(schema.bills)
    .set({ supplierId, categoryId, invoiceNumber, billDate, dueDate, notes, type })
    .where(eq(schema.bills.id, id))
    .run();

  if (!hasPayments && body.items !== undefined) {
    reverseBillMovements(id, adminId);
    db.delete(schema.billItems).where(eq(schema.billItems.billId, id)).run();
    if (type === "inventory") {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: "La factura de inventario requiere al menos un item" }, { status: 400 });
      }
      let totalUsd = 0;
      for (const it of body.items) {
        const qty = Number(it.quantity);
        const unit = Math.round(Number(it.unitCostUsd) * 100) / 100;
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unit) || unit < 0) {
          return NextResponse.json({ error: "Cada item requiere cantidad > 0 y costo unitario >= 0" }, { status: 400 });
        }
        const lineTotal = Math.round(qty * unit * 100) / 100;
        totalUsd += lineTotal;
        db.insert(schema.billItems)
          .values({
            id: crypto.randomUUID(),
            billId: id,
            inventoryItemId: it.inventoryItemId ?? null,
            description: typeof it.description === "string" && it.description.trim() ? it.description.trim() : null,
            quantity: qty,
            unitCostUsd: unit,
            totalUsd: lineTotal,
          })
          .run();
        if (it.inventoryItemId) {
          createInventoryIn(it.inventoryItemId, qty, unit, "bill", id, notes ?? bill.notes, adminId);
        }
      }
      totalUsd = Math.round(totalUsd * 100) / 100;
      db.update(schema.bills).set({ totalUsd }).where(eq(schema.bills.id, id)).run();
    }
  }

  const updated = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const paymentsCount =
    db.select({ c: sql<number>`count(*)` }).from(schema.supplierPayments).where(eq(schema.supplierPayments.billId, id)).get()?.c ?? 0;
  if (paymentsCount > 0) {
    return NextResponse.json(
      { error: "La factura tiene pagos asociados; elimina primero los pagos" },
      { status: 400 }
    );
  }
  if (bill.type === "inventory") {
    reverseBillMovements(id, adminId);
  }
  db.delete(schema.bills).where(eq(schema.bills.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bills/[id]/route.ts
git commit -m "feat(api): obtener, editar y eliminar factura con reversión de inventario"
```

---

### Task 8: API pagos a proveedores

**Files:**
- Create: `src/app/api/supplier-payments/route.ts`
- Create: `src/app/api/supplier-payments/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `eq`, `sql`, `desc`, `isAdmin`, `recomputeBillStatus`.
- Produces: `GET /api/supplier-payments` (`?billId=`), `POST /api/supplier-payments` (recalcula estado), `DELETE /api/supplier-payments/[id]` (recalcula estado). Usado por Task 13.

- [ ] **Step 1: `src/app/api/supplier-payments/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { recomputeBillStatus } from "@/lib/bills";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const billId = req.nextUrl.searchParams.get("billId");
  const q = db
    .select({
      id: schema.supplierPayments.id,
      billId: schema.supplierPayments.billId,
      supplierName: schema.suppliers.name,
      invoiceNumber: schema.bills.invoiceNumber,
      bankAccountId: schema.supplierPayments.bankAccountId,
      bankName: schema.bankAccounts.bankName,
      amountUsd: schema.supplierPayments.amountUsd,
      currency: schema.supplierPayments.currency,
      amountVes: schema.supplierPayments.amountVes,
      rate: schema.supplierPayments.rate,
      paymentDate: schema.supplierPayments.paymentDate,
      reference: schema.supplierPayments.reference,
      notes: schema.supplierPayments.notes,
      createdAt: schema.supplierPayments.createdAt,
    })
    .from(schema.supplierPayments)
    .innerJoin(schema.bills, eq(schema.bills.id, schema.supplierPayments.billId))
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.bills.supplierId))
    .leftJoin(schema.bankAccounts, eq(schema.bankAccounts.id, schema.supplierPayments.bankAccountId));
  const rows = billId
    ? q.where(eq(schema.supplierPayments.billId, billId)).orderBy(desc(schema.supplierPayments.paymentDate)).all()
    : q.orderBy(desc(schema.supplierPayments.paymentDate)).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const bill = db.select().from(schema.bills).where(eq(schema.bills.id, body.billId)).get();
  if (!bill) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  const currency: "USD" | "VES" = body.currency === "VES" ? "VES" : "USD";
  let usd = 0;
  if (currency === "VES") {
    if (typeof body.amountVes !== "number" || typeof body.rate !== "number" || body.rate <= 0 || body.amountVes <= 0) {
      return NextResponse.json({ error: "amountVes y rate son requeridos para pagos en Bs" }, { status: 400 });
    }
    usd = Math.round((body.amountVes / body.rate) * 100) / 100;
  } else {
    if (typeof body.amountUsd !== "number" || body.amountUsd <= 0) {
      return NextResponse.json({ error: "amountUsd es requerido" }, { status: 400 });
    }
    usd = Math.round(body.amountUsd * 100) / 100;
  }
  if (typeof body.reference !== "string" || !body.reference.trim()) {
    return NextResponse.json({ error: "La referencia es requerida" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  const payment = {
    id: crypto.randomUUID(),
    billId: body.billId,
    bankAccountId: body.bankAccountId ?? null,
    amountUsd: usd,
    currency,
    amountVes: currency === "VES" ? body.amountVes : null,
    rate: currency === "VES" ? body.rate : null,
    paymentDate: typeof body.paymentDate === "number" ? body.paymentDate : now,
    reference: body.reference.trim(),
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdBy: adminId,
    createdAt: now,
  };
  db.insert(schema.supplierPayments).values(payment).run();
  recomputeBillStatus(body.billId);
  return NextResponse.json(payment, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/supplier-payments/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { recomputeBillStatus } from "@/lib/bills";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const p = db.select({ billId: schema.supplierPayments.billId }).from(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).get();
  if (!p) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }
  db.delete(schema.supplierPayments).where(eq(schema.supplierPayments.id, id)).run();
  recomputeBillStatus(p.billId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar + commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add src/app/api/supplier-payments
git commit -m "feat(api): pagos a proveedores con recálculo del estado de la factura"
```

---

### Task 9: API inventario (items y movimientos)

**Files:**
- Create: `src/app/api/inventory/items/route.ts`
- Create: `src/app/api/inventory/items/[id]/route.ts`
- Create: `src/app/api/inventory/items/[id]/movements/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `eq`, `and`, `sql`, `desc`, `isAdmin`, `applyManualMovement`.
- Produces:
  - `GET /api/inventory/items` (con `stockValue` y `estUsos`), `POST /api/inventory/items`.
  - `PATCH /api/inventory/items/[id]`, `DELETE /api/inventory/items/[id]` (solo si stock 0 y sin bill_items/movimientos/service_products).
  - `GET /api/inventory/items/[id]/movements` (kardex), `POST /api/inventory/items/[id]/movements` (out/adjust).
- Usado por Task 6 (select de items en `BillFormDialog`), Task 14 (UI).

- [ ] **Step 1: `src/app/api/inventory/items/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const rows = includeInactive
    ? db.select().from(schema.inventoryItems).orderBy(schema.inventoryItems.name).all()
    : db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.isActive, 1)).orderBy(schema.inventoryItems.name).all();

  const usageRows = db
    .select({
      inventoryItemId: schema.serviceProducts.inventoryItemId,
      qty: sql<number>`sum(${schema.serviceProducts.quantityPerService})`,
    })
    .from(schema.serviceProducts)
    .groupBy(schema.serviceProducts.inventoryItemId)
    .all();
  const usageMap = new Map<string, number>();
  for (const u of usageRows) usageMap.set(u.inventoryItemId, u.qty ?? 0);

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      stockValue: Math.round(r.stock * r.avgCost * 100) / 100,
      estUsos: (() => {
        const total = usageMap.get(r.id) ?? 0;
        return total > 0 ? Math.round((r.stock / total) * 10) / 10 : null;
      })(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const row = {
    id: crypto.randomUUID(),
    name,
    unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "unidad",
    stock: 0,
    avgCost: 0,
    minStock: typeof body.minStock === "number" && body.minStock >= 0 ? body.minStock : 0,
    isActive: 1,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.inventoryItems).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/inventory/items/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const name = body.name !== undefined && typeof body.name === "string" ? body.name.trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const unit = body.unit !== undefined && typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : existing.unit;
  const minStock = body.minStock !== undefined && typeof body.minStock === "number" && body.minStock >= 0 ? body.minStock : existing.minStock;
  const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive;
  const notes = body.notes !== undefined ? (typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null) : existing.notes;
  db.update(schema.inventoryItems)
    .set({ name, unit, minStock, isActive, notes })
    .where(eq(schema.inventoryItems.id, id))
    .run();
  return NextResponse.json({ ...existing, name, unit, minStock, isActive, notes });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, id)).get();
  if (!item) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  if (item.stock > 0.004) {
    return NextResponse.json({ error: "El producto tiene stock; no se puede eliminar" }, { status: 400 });
  }
  const billItems =
    db.select({ c: sql<number>`count(*)` }).from(schema.billItems).where(eq(schema.billItems.inventoryItemId, id)).get()?.c ?? 0;
  const movements =
    db.select({ c: sql<number>`count(*)` }).from(schema.inventoryMovements).where(eq(schema.inventoryMovements.inventoryItemId, id)).get()?.c ?? 0;
  const serviceUses =
    db.select({ c: sql<number>`count(*)` }).from(schema.serviceProducts).where(eq(schema.serviceProducts.inventoryItemId, id)).get()?.c ?? 0;
  if (billItems > 0 || movements > 0 || serviceUses > 0) {
    return NextResponse.json(
      { error: "El producto tiene facturas, movimientos o usos en servicios; desactívalo en su lugar" },
      { status: 400 }
    );
  }
  db.delete(schema.inventoryItems).where(eq(schema.inventoryItems.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: `src/app/api/inventory/items/[id]/movements/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { applyManualMovement } from "@/lib/inventory";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const rows = db
    .select()
    .from(schema.inventoryMovements)
    .where(eq(schema.inventoryMovements.inventoryItemId, id))
    .orderBy(desc(schema.inventoryMovements.createdAt))
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : "";
  const kind: "out" | "adjust" = body.kind === "adjust" ? "adjust" : "out";
  if (kind === "adjust" && !notes) {
    return NextResponse.json({ error: "El motivo es obligatorio en ajustes" }, { status: 400 });
  }
  const param = Number(body.quantity);
  if (!Number.isFinite(param)) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }
  try {
    const result = applyManualMovement(id, kind, param, notes, adminId);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error inesperado" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 4: Verificar + commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add src/app/api/inventory
git commit -m "feat(api): inventario con kardex y movimientos manuales"
```

---

### Task 10: API uso de productos por servicio

**Files:**
- Create: `src/app/api/service-products/route.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `eq`, `isAdmin`.
- Produces: `GET /api/service-products` (`?serviceId=`), `PUT /api/service-products` (reemplaza el mapeo del servicio). Usado por Task 9 (estUsos) y Task 14.

- [ ] **Step 1: `src/app/api/service-products/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  const q = db
    .select({
      id: schema.serviceProducts.id,
      serviceId: schema.serviceProducts.serviceId,
      inventoryItemId: schema.serviceProducts.inventoryItemId,
      itemName: schema.inventoryItems.name,
      unit: schema.inventoryItems.unit,
      quantityPerService: schema.serviceProducts.quantityPerService,
    })
    .from(schema.serviceProducts)
    .innerJoin(schema.inventoryItems, eq(schema.inventoryItems.id, schema.serviceProducts.inventoryItemId));
  const rows = serviceId
    ? q.where(eq(schema.serviceProducts.serviceId, serviceId)).all()
    : q.all();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const service = db.select({ id: schema.services.id }).from(schema.services).where(eq(schema.services.id, serviceId)).get();
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items es requerido" }, { status: 400 });
  }
  const clean: { inventoryItemId: string; quantityPerService: number }[] = [];
  for (const it of body.items) {
    const qty = Number(it.quantityPerService);
    if (typeof it.inventoryItemId !== "string" || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Cada uso requiere inventoryItemId y cantidad > 0" }, { status: 400 });
    }
    clean.push({ inventoryItemId: it.inventoryItemId, quantityPerService: qty });
  }
  db.delete(schema.serviceProducts).where(eq(schema.serviceProducts.serviceId, serviceId)).run();
  for (const it of clean) {
    db.insert(schema.serviceProducts)
      .values({
        id: crypto.randomUUID(),
        serviceId,
        inventoryItemId: it.inventoryItemId,
        quantityPerService: it.quantityPerService,
      })
      .run();
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verificar + commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add src/app/api/service-products
git commit -m "feat(api): mapeo de productos usados por servicio"
```

---

### Task 11: API P&L mensual

**Files:**
- Create: `src/app/api/financials/pnl/route.ts`

**Interfaces:**
- Consumes: `getPnL`.
- Produces: `GET /api/financials/pnl?month=YYYY-MM`. Usado por Task 15.

- [ ] **Step 1: `src/app/api/financials/pnl/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { getPnL } from "@/lib/financials";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month (YYYY-MM) es requerido" }, { status: 400 });
  }
  return NextResponse.json(getPnL(month));
}
```

- [ ] **Step 2: Verificar + commit**

Run: `npx tsc --noEmit` → PASS.

```bash
git add src/app/api/financials
git commit -m "feat(api): estado de pérdidas y ganancias mensual"
```

---

### Task 12: UI — página de Compras

**Files:**
- Create: `src/app/(admin)/dashboard/purchases/page.tsx`
- Create: `src/app/(admin)/dashboard/purchases/PurchasesContent.tsx`
- Create: `src/components/BillFormDialog.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /api/suppliers`, `GET/POST/PATCH/DELETE /api/expense-categories`, `GET/POST /api/bills`, `GET/PATCH/DELETE /api/bills/[id]`, `GET/POST /api/inventory/items`, `GET /api/exchange-rate`, `ConfirmDialog`.
- Produces: la página `/dashboard/purchases` visible en la sidebar (Task 16).

- [ ] **Step 1: `src/app/(admin)/dashboard/purchases/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { PurchasesContent } from "./PurchasesContent";

export default async function PurchasesPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <PurchasesContent />;
}
```

- [ ] **Step 2: `src/components/BillFormDialog.tsx`**

Código completo (modal que crea/edita facturas, con líneas de inventario y alta rápida de proveedor/producto):

```tsx
"use client";

import { useState, useEffect } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";

type ItemLine = {
  key: string;
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitCostUsd: string;
};

type BillPayload = {
  id: string;
  type: "inventory" | "fixed";
  supplierId: string | null;
  categoryId: string | null;
  invoiceNumber: string | null;
  billDate: number;
  dueDate: number | null;
  currency: "USD" | "VES";
  amountVes: number | null;
  rate: number | null;
  totalUsd: number;
  notes: string | null;
  paidUsd: number;
  items: { id: string; inventoryItemId: string | null; description: string | null; quantity: number; unitCostUsd: number; totalUsd: number }[];
};

type Props = {
  bill: BillPayload | null;
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

function fmtDateInput(ts: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts * 1000));
}

export function BillFormDialog({ bill, onClose, onSaved }: Props) {
  const isEdit = Boolean(bill);
  const hasPayments = (bill?.paidUsd ?? 0) > 0;

  const [type, setType] = useState<"inventory" | "fixed">(bill?.type ?? "inventory");
  const [supplierId, setSupplierId] = useState(bill?.supplierId ?? "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(bill?.invoiceNumber ?? "");
  const [billDate, setBillDate] = useState(bill ? fmtDateInput(bill.billDate) : todayStr());
  const [dueDate, setDueDate] = useState(bill?.dueDate ? fmtDateInput(bill.dueDate) : "");
  const [currency, setCurrency] = useState<"USD" | "VES">(bill?.currency ?? "USD");
  const [amountUsd, setAmountUsd] = useState(bill && bill.currency === "USD" && bill.type === "fixed" ? String(bill.totalUsd) : "");
  const [amountVes, setAmountVes] = useState(bill?.amountVes ? String(bill.amountVes) : "");
  const [rate, setRate] = useState<{ rate: number | null; source: string | null }>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState(bill?.rate ? String(bill.rate) : "");
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [lines, setLines] = useState<ItemLine[]>(
    bill?.items?.length
      ? bill.items.map((it) => ({
          key: crypto.randomUUID(),
          inventoryItemId: it.inventoryItemId ?? "",
          description: it.description ?? "",
          quantity: String(it.quantity),
          unitCostUsd: String(it.unitCostUsd),
        }))
      : []
  );
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [newSupplier, setNewSupplier] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("unidad");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/expense-categories").then((r) => r.json()),
      fetch("/api/inventory/items").then((r) => r.json()),
    ]).then(([s, c, inv]) => {
      setSuppliers(Array.isArray(s) ? s : []);
      setCategories(Array.isArray(c) ? c : []);
      setInventoryItems(Array.isArray(inv) ? inv : []);
    });
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => setRate(data))
      .catch(() => {});
  }, []);

  async function addSupplier() {
    const name = newSupplier.trim();
    if (!name) return;
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const created = await res.json();
      setSuppliers((prev) => [...prev, created]);
      setSupplierId(created.id);
      setNewSupplier("");
    }
  }

  async function addItem() {
    const name = newItemName.trim();
    if (!name) return;
    const res = await fetch("/api/inventory/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unit: newItemUnit }),
    });
    if (res.ok) {
      const created = await res.json();
      setInventoryItems((prev) => [...prev, created]);
      setLines((prev) => [
        ...prev,
        { key: crypto.randomUUID(), inventoryItemId: created.id, description: "", quantity: "1", unitCostUsd: "" },
      ]);
      setNewItemName("");
      setNewItemUnit("unidad");
    }
  }

  const lineTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCostUsd) || 0), 0);

  function updateLine(key: string, patch: Partial<ItemLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!billDate) {
      setError("La fecha de la factura es requerida");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const effectiveRate = currency === "VES" ? parseFloat(manualRate || String(rate.rate || "")) : null;
      if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
        throw new Error("Escribe la tasa del día");
      }
      const body: Record<string, unknown> = {
        supplierId: supplierId || null,
        categoryId: categoryId || null,
        invoiceNumber: invoiceNumber.trim(),
        billDate: dateTimeToTs(billDate, "00:00"),
        dueDate: dueDate ? dateTimeToTs(dueDate, "00:00") : null,
        notes: notes.trim(),
      };
      if (type === "inventory") {
        if (lines.length === 0) throw new Error("Añade al menos un producto");
        body.type = "inventory";
        body.currency = "USD";
        body.items = lines.map((l) => ({
          inventoryItemId: l.inventoryItemId || null,
          description: l.description.trim(),
          quantity: Number(l.quantity) || 0,
          unitCostUsd: Number(l.unitCostUsd) || 0,
        }));
      } else {
        body.type = "fixed";
        body.currency = currency;
        if (currency === "VES") {
          body.amountVes = parseFloat(amountVes) || 0;
          body.rate = effectiveRate;
        } else {
          body.totalUsd = parseFloat(amountUsd) || 0;
        }
      }
      const url = isEdit ? `/api/bills/${bill!.id}` : "/api/bills";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar la factura");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEdit ? "Editar factura" : "Nueva factura"}
        </h3>
        {hasPayments && (
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Esta factura tiene pagos: solo puedes editar proveedor, categoría, número, fechas y notas.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setType("inventory")}
            disabled={hasPayments}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              type === "inventory" ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            Inventario
          </button>
          <button
            onClick={() => setType("fixed")}
            disabled={hasPayments}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              type === "fixed" ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            Gasto fijo
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Proveedor</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Sin proveedor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Nuevo proveedor..."
                className={inputCls}
              />
              <button
                onClick={addSupplier}
                disabled={!newSupplier.trim()}
                className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                + Nuevo
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">— Sin categoría —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nº factura</label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: F-1001"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fecha</label>
              <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vence</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {type === "fixed" && (
          <div className="mt-4 flex gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "USD" | "VES")}
              disabled={hasPayments}
              className={inputCls}
            >
              <option value="USD">$</option>
              <option value="VES">Bs</option>
            </select>
            {currency === "USD" ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="Total en $"
                className={inputCls}
              />
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountVes}
                  onChange={(e) => setAmountVes(e.target.value)}
                  placeholder="Total en Bs"
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualRate || (rate.rate ? String(rate.rate) : "")}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder="Tasa Bs/US$"
                  className={inputCls}
                />
              </>
            )}
          </div>
        )}

        {type === "inventory" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Productos</p>
              <div className="flex gap-2">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nuevo producto..."
                  className="w-40 rounded-xl border border-gray-200 px-3 py-1.5 text-xs"
                />
                <input
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-xs"
                />
                <button
                  onClick={addItem}
                  disabled={!newItemName.trim()}
                  className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  + Producto
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <select
                    value={l.inventoryItemId}
                    onChange={(e) => updateLine(l.key, { inventoryItemId: e.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">— Sin producto —</option>
                    {inventoryItems.map((it) => (
                      <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                    placeholder="Cant."
                    className="w-20 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.unitCostUsd}
                    onChange={(e) => updateLine(l.key, { unitCostUsd: e.target.value })}
                    placeholder="$/un"
                    className="w-24 rounded-xl border border-gray-200 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                  >
                    ×
                  </button>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-sm text-gray-400">Sin productos. Añade líneas con el botón de abajo.</p>
              )}
              <button
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { key: crypto.randomUUID(), inventoryItemId: "", description: "", quantity: "1", unitCostUsd: "" },
                  ])
                }
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                + Añadir línea
              </button>
            </div>
            <p className="mt-3 text-right text-sm font-semibold text-gray-900">
              Total: ${lineTotal.toFixed(2)}
            </p>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar factura"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(admin)/dashboard/purchases/PurchasesContent.tsx`**

`"use client"`. Pestañas: `"facturas" | "proveedores" | "categorias"` (segmented inline como el toggle Día/Semana de `DashboardContent`).

Estado:
- `bills`, `suppliers`, `categories`, `activeTab`, `statusFilter` (`"all" | "pending" | "partial" | "paid"`), `monthFilter` (`""`), `showForm`, `editingBill`, `deleting` (bill/supplier/category a confirmar), `busy`, `error`, `success`.
- `loadBills()`: `fetch(/api/bills?status=&month=)` → `setBills`.
- `loadSuppliers()`, `loadCategories()` análogos.
- Render facturas: cada fila con `supplierName ?? "—"`, `invoiceNumber`, tipo (pill), `fmtDate(billDate)`, `$ totalUsd.toFixed(2)`, estado (pill de color: pending ámbar, partial azul, paid verde), y si `paidUsd > 0` mostrar "Pagado $X / Pendiente $Y". Botones: "Editar" (abre `BillFormDialog` con la factura completa via `GET /api/bills/[id]`), "Eliminar" (si `paidUsd === 0`, `ConfirmDialog` → `DELETE /api/bills/[id]`).
- Render proveedores: lista + formulario inline (nombre/teléfono/email) + "Eliminar" (confirmación).
- Render categorías: lista + formulario inline (nombre) + activar/desactivar + "Eliminar".
- Filtros de estado y mes (input `type="month"`) sobre el listado de facturas.

Helpers locales: `fmtDate(ts)` con `new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" })` (patrón de `BalancesContent`).

- [ ] **Step 4: Verificar + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS (sin errores nuevos).

```bash
git add src/app/\(admin\)/dashboard/purchases src/components/BillFormDialog.tsx
git commit -m "feat(ui): módulo de compras con facturas, proveedores y categorías"
```

---

### Task 13: UI — página de Cuentas por pagar

**Files:**
- Create: `src/app/(admin)/dashboard/accounts-payable/page.tsx`
- Create: `src/app/(admin)/dashboard/accounts-payable/AccountsPayableContent.tsx`
- Create: `src/components/SupplierPaymentDialog.tsx`

**Interfaces:**
- Consumes: `GET /api/bills` (lista con `paidUsd`), `GET/POST/DELETE /api/supplier-payments`, `GET/POST/PATCH/DELETE /api/bank-accounts`, `GET /api/exchange-rate`, `ConfirmDialog`.
- Produces: la página `/dashboard/accounts-payable`.

- [ ] **Step 1: `src/app/(admin)/dashboard/accounts-payable/page.tsx`**

Igual patrón que Task 12 (Step 1) pero importando `AccountsPayableContent`.

- [ ] **Step 2: `src/components/SupplierPaymentDialog.tsx`**

Props: `{ bill: { id: string; supplierName?: string | null; invoiceNumber?: string | null; totalUsd: number; paidUsd: number; currency: "USD" | "VES" }, onClose, onSaved }`.

Estado: `bankAccounts` (fetch `/api/bank-accounts`), `currency`, `amountUsd`, `amountVes`, `rate` (auto `/api/exchange-rate` editable), `bankAccountId`, `reference`, `paymentDate` (default `todayStr()`), `notes`, `saving`, `error`.

`submit()`:
- `pending = round2(bill.totalUsd - bill.paidUsd)`.
- USD: `amountUsd` (default `pending`). VES: `amountVes` + `rate`.
- Body: `{ billId, bankAccountId, currency, amountUsd/amountVes/rate, paymentDate: dateTimeToTs(paymentDate, "00:00"), reference, notes }`.
- `POST /api/supplier-payments`. `onSaved()`.

Render modal estándar.

- [ ] **Step 3: `src/app/(admin)/dashboard/accounts-payable/AccountsPayableContent.tsx`**

`"use client"`. Pestañas: `"porPagar" | "pagos" | "bancos"`.

- **Por pagar**: `loadBills()` con `GET /api/bills` (todas) y en cliente filtra `status !== "paid"`. Ordena por `dueDate` asc (nulls al final). Para cada factura: `pending = max(0, totalUsd - paidUsd)`. Badge "Vencida" (rojo) si `dueDate < hoy`; badge "Por vencer" (ámbar) si `dueDate - hoy <= 7 días`. Botón "Registrar pago" abre `SupplierPaymentDialog`.
- **Pagos realizados**: `loadPayments()` con `GET /api/supplier-payments`. Cada fila: proveedor, nº factura, `$ amountUsd`, `{currency === "VES" && Bs amountVes}`, banco, fecha, ref. Botón "Eliminar" (confirmación → `DELETE /api/supplier-payments/[id]` y recarga pagos + facturas).
- **Bancos**: `loadBanks()` con `GET /api/bank-accounts?includeInactive=1`. Formulario inline (banco, tipo, nº, moneda, activo, notas) para crear (`POST`) y editar (`PATCH`). "Eliminar" (confirmación → `DELETE /api/bank-accounts/[id]`).

Helpers: `fmtDate` (patrón existente), `round2`.

- [ ] **Step 4: Verificar + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/\(admin\)/dashboard/accounts-payable src/components/SupplierPaymentDialog.tsx
git commit -m "feat(ui): cuentas por pagar con registro de pagos y bancos"
```

---

### Task 14: UI — página de Inventario

**Files:**
- Create: `src/app/(admin)/dashboard/inventory/page.tsx`
- Create: `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`
- Create: `src/components/MovementDialog.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH/DELETE /api/inventory/items`, `GET/POST /api/inventory/items/[id]/movements`, `GET/PUT /api/service-products`, `GET /api/services`, `ConfirmDialog`.
- Produces: la página `/dashboard/inventory`.

- [ ] **Step 1: `src/app/(admin)/dashboard/inventory/page.tsx`**

Igual patrón (importando `InventoryContent`).

- [ ] **Step 2: `src/components/MovementDialog.tsx`**

Props: `{ item: { id: string; name: string; stock: number; unit: string }, onClose, onSaved }`.

Estado: `kind` (`"out" | "adjust"`), `quantity` (string), `notes`, `saving`, `error`.

`submit()`:
- `body = { kind, quantity: Number(quantity), notes }` (para `adjust`, `quantity` es el stock objetivo).
- `POST /api/inventory/items/[item.id]/movements`. Si `!res.ok` muestra el error del servidor (p.ej. "Stock insuficiente"). `onSaved()` al éxito.

- [ ] **Step 3: `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`**

`"use client"`. Pestañas: `"items" | "movimientos" | "servicios"`.

- **Items**: `loadItems()` con `GET /api/inventory/items?includeInactive=1`. Cards: nombre, `stock unit`, `avgCost $/unidad`, `stockValue $`, `estUsos` (si no null: "≈ N usos"), badge "Stock bajo" (rojo) si `stock <= minStock`. Botones: "+ Producto" (form inline nombre/unidad/stock mínimo → `POST /api/inventory/items`), "Salida"/"Ajuste" (abren `MovementDialog`), "Editar" (PATCH), "Eliminar" (`ConfirmDialog` → DELETE; muestra el error 400 del servidor si aplica).
- **Movimientos**: select de producto (`GET /api/inventory/items`) → al elegir, `GET /api/inventory/items/[id]/movements`. Tabla: fecha (`fmtDate`), tipo (pill: in verde, out rojo, adjust ámbar), cantidad (con signo), costo unitario, ref (`bill` → "Factura", `manual` → "Manual"), notas.
- **Servicios**: carga `GET /api/services` y `GET /api/inventory/items` y `GET /api/service-products`. Para cada servicio: lista de usos `{ inventoryItemId, quantityPerService }` con select de producto + input de cantidad + botón "×"; botón "+ Añadir producto"; botón "Guardar" → `PUT /api/service-products { serviceId, items }`.

- [ ] **Step 4: Verificar + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/\(admin\)/dashboard/inventory src/components/MovementDialog.tsx
git commit -m "feat(ui): inventario con existencias, kardex y uso por servicio"
```

---

### Task 15: UI — página de Estados financieros

**Files:**
- Create: `src/app/(admin)/dashboard/financials/page.tsx`
- Create: `src/app/(admin)/dashboard/financials/FinancialsContent.tsx`

**Interfaces:**
- Consumes: `GET /api/financials/pnl?month=YYYY-MM`.
- Produces: la página `/dashboard/financials`.

- [ ] **Step 1: `src/app/(admin)/dashboard/financials/page.tsx`**

Igual patrón (importando `FinancialsContent`).

- [ ] **Step 2: `src/app/(admin)/dashboard/financials/FinancialsContent.tsx`**

`"use client"`.

Estado:
- `const defaultMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit" }).format(new Date());` (da `"2026-08"`).
- `month`, `data` (tipado con el PnLResult), `loading`, `error`.

`load()`: `fetch(/api/financials/pnl?month=${month})` → `setData`.

Render:
- Header: título + `<input type="month" value={month} onChange={...} />`.
- 5 tarjetas: **Ingresos** ($), **Gastos** ($), **Utilidad/Pérdida** ($, clase `text-green-600` si `profit >= 0`, `text-red-600` si no), **Servicios** (count), **Facturas** (count).
- Tabla **Ingresos por servicio**: `serviceName`, `count`, `amount`.
- Tabla **Gastos por categoría**: `categoryName`, `amount`.
- Estados de carga/vacío como en `BalancesContent`.

- [ ] **Step 3: Verificar + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/\(admin\)/dashboard/financials
git commit -m "feat(ui): estado de pérdidas y ganancias mensual"
```

---

### Task 16: Navegación, seeds y documentación

**Files:**
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/db/seed.ts`
- Create: `src/db/seed-finance-demo.ts`
- Modify: `package.json`
- Modify: `AGENTS.md`, `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: las 4 páginas nuevas, `createInventoryIn` (del seed).
- Produces: demo de finanzas re-ejecutable (`npm run db:seed:finance`) y docs actualizadas.

- [ ] **Step 1: Navegación**

En `src/app/(admin)/layout.tsx`, en `NAV_ITEMS`, después de `{ href: "/dashboard/balances", label: "Cuentas por cobrar", icon: "💰" }` añadir:
```ts
{ href: "/dashboard/purchases", label: "Compras", icon: "🛒" },
{ href: "/dashboard/accounts-payable", label: "Cuentas por pagar", icon: "💳" },
{ href: "/dashboard/inventory", label: "Inventario", icon: "📦" },
{ href: "/dashboard/financials", label: "Estados financieros", icon: "📊" },
```

- [ ] **Step 2: Categorías por defecto en `src/db/seed.ts`**

Añadir al final (antes del `console.log("✨ Seed complete!")`):

```ts
const categoryNames = [
  "Insumos y materiales",
  "Alquiler",
  "Servicios básicos",
  "Nómina",
  "Marketing y publicidad",
  "Otros",
];
const existingCategories = db.select().from(schema.expenseCategories).all();
if (existingCategories.length === 0) {
  db.insert(schema.expenseCategories)
    .values(
      categoryNames.map((name) => ({
        id: crypto.randomUUID(),
        name,
        isActive: 1,
        createdAt: Math.floor(Date.now() / 1000),
      }))
    )
    .run();
  console.log(`✅ Inserted ${categoryNames.length} expense categories`);
}
```

- [ ] **Step 3: Script demo `src/db/seed-finance-demo.ts`**

Re-ejecutable (borra los datos demo de finanzas y los regenera). Importar `createInventoryIn` de `@/lib/inventory`. Pseudo-estructura completa:

```ts
import bcrypt from "bcryptjs";
import { db, schema } from "./index";
import { eq } from "drizzle-orm";
import { createInventoryIn } from "@/lib/inventory";

const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

const ADMIN_ID = (() => {
  const existing = db.select().from(schema.users).where(eq(schema.users.role, "admin")).all();
  return existing[0]?.id ?? (() => { throw new Error("Crea un admin antes de sembrar finanzas") })();
})();

function serviceId(name: string): string | undefined {
  return db.select({ id: schema.services.id }).from(schema.services).where(eq(schema.services.name, name)).get()?.id;
}

function categoryId(name: string): string | undefined {
  return db.select({ id: schema.expenseCategories.id }).from(schema.expenseCategories).where(eq(schema.expenseCategories.name, name)).get()?.id;
}

function wipe() {
  db.delete(schema.supplierPayments).run();
  db.delete(schema.billItems).run();
  db.delete(schema.bills).run();
  db.delete(schema.inventoryMovements).run();
  db.delete(schema.inventoryItems).run();
  db.delete(schema.serviceProducts).run();
  db.delete(schema.suppliers).run();
  db.delete(schema.bankAccounts).run();
}

wipe();

const supplier1 = { id: crypto.randomUUID(), name: "Distribuidora BellaUnas", phone: "+582123456789", email: "ventas@bellaunas.com", address: "CC Los Mejores, Local 15", notes: null, createdAt: now - 30 * DAY };
const supplier2 = { id: crypto.randomUUID(), name: "Insumos Pro Nails", phone: "+582121234567", email: null, address: null, notes: "Pagos a 30 días", createdAt: now - 20 * DAY };
db.insert(schema.suppliers).values([supplier1, supplier2]).run();

const bankUsd = { id: crypto.randomUUID(), bankName: "Banesco USD", accountType: "savings" as const, accountNumber: "01340000000000001234", currency: "USD" as const, isActive: 1, notes: null, createdAt: now };
const bankVes = { id: crypto.randomUUID(), bankName: "Banesco VES", accountType: "checking" as const, accountNumber: "01340000000000005678", currency: "VES" as const, isActive: 1, notes: null, createdAt: now };
db.insert(schema.bankAccounts).values([bankUsd, bankVes]).run();

const itemMon = { id: crypto.randomUUID(), name: "Monómero acrílico", unit: "ml", stock: 0, avgCost: 0, minStock: 200, isActive: 1, notes: null, createdAt: now };
const itemPow = { id: crypto.randomUUID(), name: "Polvo acrílico", unit: "g", stock: 0, avgCost: 0, minStock: 150, isActive: 1, notes: null, createdAt: now };
const itemGel = { id: crypto.randomUUID(), name: "Esmalte semipermanente", unit: "ml", stock: 0, avgCost: 0, minStock: 100, isActive: 1, notes: null, createdAt: now };
const itemTips = { id: crypto.randomUUID(), name: "Tips pack", unit: "pack", stock: 0, avgCost: 0, minStock: 10, isActive: 1, notes: null, createdAt: now };
db.insert(schema.inventoryItems).values([itemMon, itemPow, itemGel, itemTips]).run();

const invCat = categoryId("Insumos y materiales");
const rentCat = categoryId("Alquiler");

const bill1 = {
  id: crypto.randomUUID(),
  supplierId: supplier1.id,
  categoryId: invCat,
  invoiceNumber: "F-1001",
  type: "inventory" as const,
  billDate: now - 10 * DAY,
  dueDate: now + 20 * DAY,
  currency: "USD" as const,
  amountVes: null,
  rate: null,
  totalUsd: 0,
  status: "partial" as const,
  notes: "Compra mensual de insumos",
  createdBy: ADMIN_ID,
  createdAt: now - 10 * DAY,
};
const bill1Items = [
  { item: itemMon, qty: 500, unit: 2.2 },
  { item: itemPow, qty: 400, unit: 3.1 },
  { item: itemGel, qty: 300, unit: 4.0 },
  { item: itemTips, qty: 20, unit: 5.0 },
];
const bill1Total = bill1Items.reduce((s, it) => s + it.qty * it.unit, 0);
bill1.totalUsd = Math.round(bill1Total * 100) / 100;
db.insert(schema.bills).values(bill1).run();
for (const it of bill1Items) {
  db.insert(schema.billItems).values({
    id: crypto.randomUUID(),
    billId: bill1.id,
    inventoryItemId: it.item.id,
    description: null,
    quantity: it.qty,
    unitCostUsd: it.unit,
    totalUsd: Math.round(it.qty * it.unit * 100) / 100,
  }).run();
  createInventoryIn(it.item.id, it.qty, it.unit, "bill", bill1.id, bill1.notes, ADMIN_ID);
}

const bill2 = {
  id: crypto.randomUUID(),
  supplierId: supplier2.id,
  categoryId: rentCat,
  invoiceNumber: "ALQ-08",
  type: "fixed" as const,
  billDate: now - 3 * DAY,
  dueDate: now + 2 * DAY,
  currency: "VES" as const,
  amountVes: 180000,
  rate: 60,
  totalUsd: 3000,
  status: "pending" as const,
  notes: "Alquiler del local",
  createdBy: ADMIN_ID,
  createdAt: now - 3 * DAY,
};
db.insert(schema.bills).values(bill2).run();

db.insert(schema.supplierPayments).values({
  id: crypto.randomUUID(),
  billId: bill1.id,
  bankAccountId: bankUsd.id,
  amountUsd: 200,
  currency: "USD",
  amountVes: null,
  rate: null,
  paymentDate: now - 8 * DAY,
  reference: "TRF-0001",
  notes: "Abono",
  createdBy: ADMIN_ID,
  createdAt: now - 8 * DAY,
}).run();
db.update(schema.bills).set({ status: "partial" }).where(eq(schema.bills.id, bill1.id)).run();

const acrylicId = serviceId("Acrílicas Full");
const gelId = serviceId("Gel Semipermanente");
if (acrylicId && gelId) {
  db.insert(schema.serviceProducts).values([
    { id: crypto.randomUUID(), serviceId: acrylicId, inventoryItemId: itemMon.id, quantityPerService: 10 },
    { id: crypto.randomUUID(), serviceId: acrylicId, inventoryItemId: itemPow.id, quantityPerService: 10 },
    { id: crypto.randomUUID(), serviceId: gelId, inventoryItemId: itemGel.id, quantityPerService: 5 },
  ]).run();
}

console.log("✨ Finance demo seed complete!");
```

- [ ] **Step 4: Script npm**

En `package.json`, en `scripts`, después de `"db:seed:client"`:
```json
"db:seed:finance": "tsx src/db/seed-finance-demo.ts",
```

- [ ] **Step 5: Documentación**

- `AGENTS.md`: añadir las 9 tablas nuevas al Modelo de Datos, las 4 rutas nuevas a la Estructura de Rutas (protegidas), los componentes clave nuevos (`BillFormDialog`, `SupplierPaymentDialog`, `MovementDialog`, y las páginas `PurchasesContent`, `AccountsPayableContent`, `InventoryContent`, `FinancialsContent`), las reglas de borrado nuevas (proveedor/categoría/banco/factura/item de inventario) y el comando `db:seed:finance`.
- `CHANGELOG.md`: bajo `## [Sin publicar]` → `### Añadido`, entradas para: módulo de compras (facturas + proveedores + categorías), cuentas por pagar (pagos a proveedores + bancos), inventario (kardex, costo promedio ponderado, uso por servicio), estados financieros (P&L mensual), y `npm run db:seed:finance`.
- `README.md`: reflejar los 4 módulos nuevos y el comando del seed.

- [ ] **Step 6: Verificación final**

Run: `npm run db:seed` (si es necesario aplicar categorías en dev.db), luego `npm run db:seed:finance`, luego:
```
npx tsc --noEmit
npm run lint
npm run build
```
Expected: todo PASS/sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(admin\)/layout.tsx src/db/seed.ts src/db/seed-finance-demo.ts package.json AGENTS.md CHANGELOG.md README.md
git commit -m "feat: navegación, seed de finanzas y documentación"
```
