# Mejoras: Compras/Inventario grid, pagos con capturas y permisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Compras e Inventario a formato grid (tabla), añadir capturas de pago (enviadas/recibidas con aprobación admin) y un sistema de permisos por usuario admin.

**Architecture:** Cambios de schema + migración SQLite manual (0009) que además reescribe los ids de `inventory_items` a códigos de producto; funciones de autorización (`hasPermission`) consultando `users.permissions` (JSON, `null` = todo); rutas API nuevas para capturas de pago (`payment_receipts`); rediseño UI de PurchasesContent/InventoryContent a tablas y nuevo bloque "Mis pagos" en el perfil + pestaña "Pagos recibidos" en balances.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM + better-sqlite3, Tailwind CSS, NextAuth v5 (JWT).

## Global Constraints

- Shell: **PowerShell 5.1** (`;` para encadenar, no `&&`). No `cd` — usar `workdir`.
- Verificación tras cada tarea: `npx tsc --noEmit`, `npm run lint`, y al final `npm run build`.
- Migraciones vía `npm run db:generate` y `npm run db:migrate` (drizzle-kit). La migración generada se edita a mano para el rebuild de inventario.
- Convención de commits: `git add <archivos>` (¡`agents.md` en minúsculas!) + `git commit -m "feat/fix/docs: ..."`. Un commit por tarea.
- Nombres de tablas/columnas en snake_case (Drizzle `sqliteTable`); campos TypeScript en camelCase.
- Toda fecha/moneda: timezone `America/Caracas`, montos en USD equivalentes (patrón `payments`).
- Paleta existente: rosa pastel (`bg-pink-main`, `bg-pink-light`), `rounded-xl`, `shadow-sm`.
- Regla: ajuste de stock requiere `canAdjustInventory`; aprobación de capturas requiere `paymentApproval`; `null` en `users.permissions` = acceso a todo (no rompe admins existentes).
- Spec de referencia: `docs/superpowers/specs/2026-08-11-improvements-design.md`.

---

### Task 1: Schema + migración (permisos, capturas, código de producto)

**Files:**
- Modify: `src/db/schema.ts`
- Create/Modify: `drizzle/0009_*.sql` (generado por drizzle-kit y editado a mano)
- Verify: `dev.db`

**Interfaces:**
- Produces: columna `users.permissions` (text, nullable); `payments.photo_url` (text); `supplier_payments.photo_url` (text); `inventory_items.barcode` + `photo_url`; tabla `payment_receipts` (id, clientId, appointmentId, amountVes, rate, amountUsd, photoUrl, status `'pending'|'approved'|'rejected'`, reviewedBy, reviewedAt, reviewNotes, paymentId, createdAt + índices). Los ids de `inventory_items` pasan de uuid a códigos `INV-001`, `INV-002`, …

- [ ] **Step 1: Añadir campos al schema**

En `src/db/schema.ts`:

1. En la tabla `users`, tras la línea de `role`, añade:
```ts
  permissions: text("permissions"),
```
2. En `payments`, tras `reference`:
```ts
  photoUrl: text("photo_url"),
```
3. En `supplierPayments`, tras `reference`:
```ts
  photoUrl: text("photo_url"),
```
4. En `inventoryItems`, tras `notes`:
```ts
  barcode: text("barcode"),
  photoUrl: text("photo_url"),
```
5. Al final del archivo, después de `cancelledAppointments`, añade la nueva tabla:
```ts
export const paymentReceipts = sqliteTable(
  "payment_receipts",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => users.id),
    appointmentId: text("appointment_id").references(() => appointments.id),
    amountVes: real("amount_ves").notNull(),
    rate: real("rate").notNull(),
    amountUsd: real("amount_usd").notNull(),
    photoUrl: text("photo_url").notNull(),
    status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at"),
    reviewNotes: text("review_notes"),
    paymentId: text("payment_id").references(() => payments.id),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("payment_receipts_client_idx").on(t.clientId),
    index("payment_receipts_status_idx").on(t.status),
  ]
);
```

- [ ] **Step 2: Generar la migración**

Run: `npm run db:generate`
Expected: crea `drizzle/0009_<random>.sql` con los `ALTER TABLE … ADD COLUMN` (o recreación de tabla si drizzle lo exige para SQLite) + `CREATE TABLE payment_receipts`, actualiza `drizzle/meta/_journal.json` y crea `0009_snapshot.json`.

- [ ] **Step 3: Revisar la migración generada**

Abre `drizzle/0009_*.sql` y verifica que contenga la creación de `payment_receipts` con sus dos índices. Si drizzle recreó `inventory_items` (en vez de ADD COLUMN), confirma que el `CREATE TABLE` de inventario incluya `barcode` y `photo_url`.

- [ ] **Step 4: Añadir la migración de datos (uuid → código de producto)**

Al final del archivo `drizzle/0009_*.sql`, añade:
```sql
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint
CREATE TEMP TABLE `_inv_map` (`old_id` text PRIMARY KEY NOT NULL, `new_id` text NOT NULL);
--> statement-breakpoint
INSERT INTO `_inv_map` (`old_id`, `new_id`) SELECT `id`, printf('INV-%03d', row_number() OVER (ORDER BY `rowid`)) FROM `inventory_items`;
--> statement-breakpoint
UPDATE `bill_items` SET `inventory_item_id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `bill_items`.`inventory_item_id`) WHERE `inventory_item_id` IN (SELECT `old_id` FROM `_inv_map`);
--> statement-breakpoint
UPDATE `inventory_movements` SET `inventory_item_id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `inventory_movements`.`inventory_item_id`) WHERE `inventory_item_id` IN (SELECT `old_id` FROM `_inv_map`);
--> statement-breakpoint
UPDATE `service_products` SET `inventory_item_id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `service_products`.`inventory_item_id`) WHERE `inventory_item_id` IN (SELECT `old_id` FROM `_inv_map`);
--> statement-breakpoint
UPDATE `inventory_items` SET `id` = (SELECT `new_id` FROM `_inv_map` WHERE `old_id` = `inventory_items`.`id`);
--> statement-breakpoint
DROP TABLE `_inv_map`;
```
Nota: `PRAGMA defer_foreign_keys=ON` es legal dentro de la transacción de drizzle-kit y aplaza la comprobación de FKs hasta el COMMIT, permitiendo actualizar los hijos antes que el padre.

- [ ] **Step 5: Aplicar la migración**

Run: `npm run db:migrate`
Expected: aplica 0009 sin errores.

- [ ] **Step 6: Verificar schema y datos**

Run:
```powershell
npx tsx -e "import {db,schema} from './src/db/index'; import {eq,sql} from 'drizzle-orm'; const items=db.select({id:schema.inventoryItems.id,barcode:schema.inventoryItems.barcode}).from(schema.inventoryItems).all(); console.log('items', items); const bills=db.select({id:schema.billItems.inventoryItemId}).from(schema.billItems).all(); console.log('billItems refs', bills); const rc=db.select({c:sql<number>\`count(*)\`}).from(schema.paymentReceipts).get(); console.log('receipts', rc); const u=db.select({permissions:schema.users.permissions}).from(schema.users).limit(1).get(); console.log('users.permissions col', u);"
```
Expected: ids de items tipo `INV-001`, referencias de `bill_items` apuntando a esos códigos, tabla `payment_receipts` vacía, columna `permissions` en users.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/0009_*.sql drizzle/meta/_journal.json drizzle/meta/0009_snapshot.json
git commit -m "feat(db): permisos, capturas de pago y código de producto en inventario"
```

---

### Task 2: Helpers de permisos + endpoints `my-permissions` y `exchange-rate/current`

**Files:**
- Create: `src/lib/permissions.ts`
- Modify: `src/lib/authz.ts`
- Create: `src/app/api/my-permissions/route.ts`
- Create: `src/app/api/exchange-rate/current/route.ts`

**Interfaces:**
- Consumes: `Session` de next-auth; `isAdmin`, `isSuperAdmin` de `authz.ts`.
- Produces:
  - `PERMISSION_KEYS: string[]`, `PERMISSION_LABELS: Record<string,string>` (usadas en Task 3, 5).
  - `getPermissions(session): Promise<string[] | null>` — `null` = todos.
  - `hasPermission(session, perm): Promise<boolean>`.
  - `canAdjustInventory(session): Promise<boolean>`.
  - `GET /api/my-permissions` → `{ permissions: string[] | null }`.
  - `GET /api/exchange-rate/current` → `{ rate, source }` sin auth (para el cliente).

- [ ] **Step 1: Crear constantes de permisos**

Crea `src/lib/permissions.ts`:
```ts
export const PERMISSION_KEYS = [
  "appointments",
  "clients",
  "balances",
  "purchases",
  "accountsPayable",
  "inventory",
  "adjustInventory",
  "financials",
  "settings",
  "services",
  "adminUsers",
  "paymentApproval",
] as const;

export const PERMISSION_LABELS: Record<string, string> = {
  appointments: "Agenda",
  clients: "Clientes",
  balances: "Cuentas por cobrar",
  purchases: "Compras",
  accountsPayable: "Cuentas por pagar",
  inventory: "Inventario",
  adjustInventory: "Inventario (ajustes)",
  financials: "Estados financieros",
  settings: "Configuración",
  services: "Servicios",
  adminUsers: "Gestión de admins",
  paymentApproval: "Aprobar pagos",
};
```

- [ ] **Step 2: Ampliar `src/lib/authz.ts`**

Añade al final (mantén las funciones existentes):
```ts
import { db, schema } from "@/db/index";

function parsePermissions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.every((p) => typeof p === "string") ? arr : null;
  } catch {
    return null;
  }
}

export async function getPermissions(session: Session | null): Promise<string[] | null> {
  if (!session?.user?.id) return null;
  const user = db
    .select({ permissions: schema.users.permissions })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();
  return parsePermissions(user?.permissions ?? null);
}

export async function hasPermission(session: Session | null, perm: string): Promise<boolean> {
  if (await isSuperAdmin(session)) return true;
  if (!(await isAdmin(session))) return false;
  const perms = await getPermissions(session);
  if (perms === null) return true;
  return perms.includes(perm);
}

export async function canAdjustInventory(session: Session | null): Promise<boolean> {
  if (await isSuperAdmin(session)) return true;
  if (!(await isAdmin(session))) return false;
  const perms = await getPermissions(session);
  if (perms === null) return true;
  return perms.includes("adjustInventory");
}
```
Nota: `eq` ya está importado en `authz.ts`; añade `import { db, schema } from "@/db/index";` al principio.

- [ ] **Step 3: Endpoint `GET /api/my-permissions`**

Crea `src/app/api/my-permissions/route.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPermissions } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const permissions = await getPermissions(session);
  return NextResponse.json({ permissions });
}
```

- [ ] **Step 4: Endpoint público `GET /api/exchange-rate/current`**

Crea `src/app/api/exchange-rate/current/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getTodayRate } from "@/lib/bcv";

export async function GET() {
  const { rate, source } = await getTodayRate();
  return NextResponse.json({ rate, source });
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissions.ts src/lib/authz.ts src/app/api/my-permissions/route.ts src/app/api/exchange-rate/current/route.ts
git commit -m "feat(auth): sistema de permisos por usuario y tasa pública"
```

---

### Task 3: Guardas por permiso en páginas del dashboard + navegación filtrada

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`
- Modify: `src/app/(admin)/dashboard/clients/page.tsx`
- Modify: `src/app/(admin)/dashboard/balances/page.tsx`
- Modify: `src/app/(admin)/dashboard/purchases/page.tsx`
- Modify: `src/app/(admin)/dashboard/accounts-payable/page.tsx`
- Modify: `src/app/(admin)/dashboard/inventory/page.tsx`
- Modify: `src/app/(admin)/dashboard/financials/page.tsx`
- Modify: `src/app/(admin)/dashboard/settings/page.tsx`
- Modify: `src/app/(admin)/dashboard/services/page.tsx`
- Modify: `src/app/(admin)/dashboard/admin-users/page.tsx`
- Modify: `src/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `hasPermission`, `canAdjustInventory` de `authz.ts`; `PERMISSION_LABELS` de `permissions.ts`.
- Produces: cada página admin redirige si falta su permiso; el layout filtra `NAV_ITEMS`; `InventoryContent` recibe prop `canAdjust: boolean`.

- [ ] **Step 1: Guardas en cada página**

En cada página de dashboard, sustituye:
```ts
import { isAdmin } from "@/lib/authz";
...
if (!(await isAdmin(session))) redirect("/");
```
por (importando `hasPermission` y/o `canAdjustInventory` desde `@/lib/authz`):

| Página | Import | Guarda |
|---|---|---|
| `dashboard/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "appointments"))) redirect("/");` |
| `dashboard/clients/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "clients"))) redirect("/");` |
| `dashboard/balances/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "balances"))) redirect("/");` |
| `dashboard/purchases/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "purchases"))) redirect("/");` |
| `dashboard/accounts-payable/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "accountsPayable"))) redirect("/");` |
| `dashboard/inventory/page.tsx` | `hasPermission`, `canAdjustInventory` | guarda `inventory` + pasa prop: `<InventoryContent canAdjust={await canAdjustInventory(session)} />` |
| `dashboard/financials/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "financials"))) redirect("/");` |
| `dashboard/settings/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "settings"))) redirect("/");` |
| `dashboard/services/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "services"))) redirect("/");` |
| `dashboard/admin-users/page.tsx` | `hasPermission` | `if (!(await hasPermission(session, "adminUsers"))) redirect("/");` |

En `inventory/page.tsx` (mantén `import { redirect } from "next/navigation";` y el render de `InventoryContent`):
```ts
export default async function InventoryPage() {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) redirect("/");
  const canAdjust = await canAdjustInventory(session);
  return <InventoryContent canAdjust={canAdjust} />;
}
```

- [ ] **Step 2: Filtrado de navegación en `src/app/(admin)/layout.tsx`**

Añade al inicio del componente (la función es `"use client"`):
```tsx
import { useEffect, useState } from "react";

const NAV_ITEMS: { href: string; label: string; icon: string; perm?: string }[] = [
  { href: "/dashboard", label: "Agenda", icon: "📅", perm: "appointments" },
  { href: "/dashboard/clients", label: "Clientes", icon: "👤", perm: "clients" },
  { href: "/dashboard/balances", label: "Cuentas por cobrar", icon: "💰", perm: "balances" },
  { href: "/dashboard/purchases", label: "Compras", icon: "🛒", perm: "purchases" },
  { href: "/dashboard/accounts-payable", label: "Cuentas por pagar", icon: "💳", perm: "accountsPayable" },
  { href: "/dashboard/inventory", label: "Inventario", icon: "📦", perm: "inventory" },
  { href: "/dashboard/financials", label: "Estados financieros", icon: "📊", perm: "financials" },
  { href: "/dashboard/settings", label: "Configuración", icon: "⏰", perm: "settings" },
  { href: "/dashboard/services", label: "Servicios", icon: "💅", perm: "services" },
  { href: "/dashboard/admin-users", label: "Admins", icon: "🛡️", perm: "adminUsers" },
];
```
Y dentro del componente:
```tsx
const [visibleNav, setVisibleNav] = useState<typeof NAV_ITEMS>(NAV_ITEMS);

useEffect(() => {
  fetch("/api/my-permissions")
    .then((r) => r.json())
    .then((data: { permissions?: string[] | null }) => {
      const perms = data.permissions ?? null;
      if (perms === null) {
        setVisibleNav(NAV_ITEMS);
      } else {
        setVisibleNav(NAV_ITEMS.filter((item) => !item.perm || perms.includes(item.perm)));
      }
    })
    .catch(() => setVisibleNav(NAV_ITEMS));
}, []);
```
Sustituye `{NAV_ITEMS.map((item) => {` por `{visibleNav.map((item) => {` en el `<nav>`.

- [ ] **Step 3: Aceptar prop `canAdjust` en `InventoryContent`**

En `src/app/(admin)/dashboard/inventory/InventoryContent.tsx` cambia la firma:
```tsx
export function InventoryContent({ canAdjust = false }: { canAdjust?: boolean }) {
```
(Aún no se usa; se consumirá en Task 11/12.)

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx" "src/app/(admin)/dashboard/clients/page.tsx" "src/app/(admin)/dashboard/balances/page.tsx" "src/app/(admin)/dashboard/purchases/page.tsx" "src/app/(admin)/dashboard/accounts-payable/page.tsx" "src/app/(admin)/dashboard/inventory/page.tsx" "src/app/(admin)/dashboard/financials/page.tsx" "src/app/(admin)/dashboard/settings/page.tsx" "src/app/(admin)/dashboard/services/page.tsx" "src/app/(admin)/dashboard/admin-users/page.tsx" "src/app/(admin)/layout.tsx" "src/app/(admin)/dashboard/inventory/InventoryContent.tsx"
git commit -m "feat(auth): guardas de permiso en páginas admin y navegación filtrada"
```

---

### Task 4: Guardas de permiso en las APIs de módulos

**Files (modify):** todos los `route.ts` de: `bills`, `bills/[id]`, `suppliers`, `suppliers/[id]`, `expense-categories`, `expense-categories/[id]`, `bank-accounts`, `bank-accounts/[id]`, `supplier-payments`, `supplier-payments/[id]`, `inventory/items`, `inventory/items/[id]`, `inventory/items/[id]/movements`, `service-products`, `financials/pnl`, `working-hours`, `payments`, `payments/[id]`, `balances`, `appointments/cancelled`.

**Interfaces:**
- Consumes: `hasPermission` de `authz.ts`.
- Produces: cada endpoint admin devuelve 401 si falta el permiso del módulo.

- [ ] **Step 1: Reemplazar `isAdmin` por `hasPermission` en cada ruta**

Para cada archivo listado, en cada handler `GET`/`POST`/`PATCH`/`DELETE` que hoy use `isAdmin(session)`, sustituye `if (!(await isAdmin(session)))` por `if (!(await hasPermission(session, "<perm>")))`, con `import { hasPermission } from "@/lib/authz";` (puedes eliminar `isAdmin` del import si deja de usarse; `authz` lo sigue exportando para otras rutas).

| Ruta(s) | permiso |
|---|---|
| `bills`, `bills/[id]`, `suppliers`, `suppliers/[id]`, `expense-categories`, `expense-categories/[id]` | `"purchases"` |
| `bank-accounts`, `bank-accounts/[id]`, `supplier-payments`, `supplier-payments/[id]` | `"accountsPayable"` |
| `inventory/items`, `inventory/items/[id]`, `service-products` | `"inventory"` |
| `inventory/items/[id]/movements` | `"inventory"` en `GET`; en `POST`, además: si `kind==='adjust'` y `!(await canAdjustInventory(session))` → `return NextResponse.json({ error: "No autorizado" }, { status: 403 });` |
| `financials/pnl`, `working-hours` | `"financials"` y `"settings"` respectivamente |
| `payments`, `payments/[id]`, `balances` | `"balances"` |
| `appointments/cancelled` | `"appointments"` |

Para `inventory/items/[id]/movements/route.ts`, el `POST` quedará así (dentro del handler, tras `const session = await auth();`):
```ts
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
```
y dentro del bloque donde ya calculas `kind` (tras `const kind: "out" | "adjust" = ...`), añade:
```ts
  if (kind === "adjust" && !(await canAdjustInventory(session))) {
    return NextResponse.json({ error: "No autorizado para ajustar stock" }, { status: 403 });
  }
```
Actualiza el import: `import { isAdmin, hasPermission, canAdjustInventory } from "@/lib/authz";`

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bills/route.ts src/app/api/bills/\[id\]/route.ts src/app/api/suppliers/route.ts src/app/api/suppliers/\[id\]/route.ts src/app/api/expense-categories/route.ts src/app/api/expense-categories/\[id\]/route.ts src/app/api/bank-accounts/route.ts src/app/api/bank-accounts/\[id\]/route.ts src/app/api/supplier-payments/route.ts src/app/api/supplier-payments/\[id\]/route.ts src/app/api/inventory/items/route.ts src/app/api/inventory/items/\[id\]/route.ts src/app/api/inventory/items/\[id\]/movements/route.ts src/app/api/service-products/route.ts src/app/api/financials/pnl/route.ts src/app/api/working-hours/route.ts src/app/api/payments/route.ts src/app/api/payments/\[id\]/route.ts src/app/api/balances/route.ts src/app/api/appointments/cancelled/route.ts
git commit -m "feat(auth): guardas de permiso por módulo en las APIs admin"
```

---

### Task 5: Gestión de permisos por admin (API + UI)

**Files:**
- Modify: `src/app/api/admins/route.ts`
- Modify: `src/app/(admin)/dashboard/admin-users/AdminUsersContent.tsx`

**Interfaces:**
- Consumes: `PERMISSION_KEYS`, `PERMISSION_LABELS` de `permissions.ts`.
- Produces: `GET /api/admins` incluye `permissions` (array o null) por admin; `PATCH /api/admins` actualiza permisos.

- [ ] **Step 1: Exponer y actualizar permisos en `/api/admins`**

En `GET` (el select de admins), añade `permissions: schema.users.permissions` al objeto `select`, y en el `map`:
```ts
  const res = admins.map((a) => {
    let permissions: string[] | null = null;
    try {
      const parsed = a.permissions ? JSON.parse(a.permissions) : null;
      permissions = Array.isArray(parsed) ? parsed : null;
    } catch {
      permissions = null;
    }
    return { ...a, permissions, isPrimary: a.email === superAdminEmail };
  });
```
Añade un handler `PATCH` (mismo `isSuperAdmin` que los demás):
```ts
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!(await isSuperAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { email, permissions } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (email === process.env.ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "El admin principal tiene acceso a todos los módulos" },
      { status: 403 }
    );
  }
  const valid = Array.isArray(permissions) && permissions.every((p: unknown) => typeof p === "string");
  if (!valid) {
    return NextResponse.json({ error: "permissions debe ser un array de strings" }, { status: 400 });
  }
  db.update(schema.users)
    .set({ permissions: JSON.stringify(permissions) })
    .where(eq(schema.users.email, email))
    .run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Editor de permisos en `AdminUsersContent.tsx`**

Actualiza el tipo:
```tsx
type Admin = {
  id: string;
  email: string;
  name: string | null;
  isPrimary?: boolean;
  permissions?: string[] | null;
};
```
Importa las constantes:
```tsx
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/permissions";
```
Añade estado para guardar:
```tsx
const [savingPerms, setSavingPerms] = useState<string | null>(null);
const [permError, setPermError] = useState("");
```
Añade la función:
```tsx
async function handleSavePermissions(admin: Admin) {
  setSavingPerms(admin.email);
  setPermError("");
  try {
    const perms = admin.permissions ?? [];
    const res = await fetch("/api/admins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: admin.email, permissions: perms }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo guardar permisos");
    }
    setSuccess("Permisos actualizados");
    await fetchAdmins();
  } catch (e) {
    setPermError(e instanceof Error ? e.message : "Error inesperado");
  } finally {
    setSavingPerms(null);
  }
}
```
Dentro de la tarjeta de cada admin (junto al botón "Quitar admin"), añade (solo si `!admin.isPrimary`):
```tsx
<div className="mt-3 border-t border-gray-100 pt-3">
  <p className="mb-2 text-xs font-medium text-gray-600">Permisos por módulo</p>
  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
    {PERMISSION_KEYS.map((key) => {
      const checked = (admin.permissions ?? null) === null || (admin.permissions ?? []).includes(key);
      return (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={checked}
            disabled={(admin.permissions ?? null) === null}
            onChange={() => {
              const perms = admin.permissions ?? [];
              const next = checked ? perms.filter((p) => p !== key) : [...perms, key];
              admin.permissions = next;
              setAdmins((prev) => prev.map((a) => (a.email === admin.email ? { ...a, permissions: next } : a)));
            }}
            className="h-4 w-4"
          />
          {PERMISSION_LABELS[key]}
        </label>
      );
    })}
  </div>
  {(admin.permissions ?? null) === null && (
    <p className="mt-2 text-xs text-gray-400">Acceso a todos los módulos (por defecto).</p>
  )}
  <div className="mt-3 flex gap-2">
    <button
      onClick={() => {
        admin.permissions = PERMISSION_KEYS.map((k) => k);
        setAdmins((prev) => prev.map((a) => (a.email === admin.email ? { ...a, permissions: [...PERMISSION_KEYS] } : a)));
      }}
      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
    >
      Marcar todos
    </button>
    <button
      onClick={() => {
        admin.permissions = [];
        setAdmins((prev) => prev.map((a) => (a.email === admin.email ? { ...a, permissions: [] } : a)));
      }}
      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
    >
      Ninguno
    </button>
    <button
      onClick={() => void handleSavePermissions(admin)}
      disabled={savingPerms === admin.email}
      className="rounded-lg bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50"
    >
      {savingPerms === admin.email ? "Guardando..." : "Guardar permisos"}
    </button>
  </div>
  {permError && <p className="mt-2 text-xs text-red-600">{permError}</p>}
</div>
```
Nota: para el admin principal (`isPrimary`) no muestres el editor (siempre acceso total).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admins/route.ts src/app/\(admin\)/dashboard/admin-users/AdminUsersContent.tsx
git commit -m "feat(admin): editor de permisos por usuario admin"
```

---

### Task 6: Captura en pagos de clientes (API + diálogo)

**Files:**
- Modify: `src/app/api/payments/route.ts` (POST y GET)
- Modify: `src/components/RegisterPaymentDialog.tsx`

**Interfaces:**
- Consumes: `/api/upload` (devuelve `{ url }`).
- Produces: `POST /api/payments` acepta `photoUrl` opcional; `GET` lo devuelve.

- [ ] **Step 1: Aceptar `photoUrl` en `POST /api/payments`**

En `src/app/api/payments/route.ts`, en el destructuring del body añade `photoUrl`, y en el objeto `payment` añade:
```ts
    photoUrl: typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null,
```
En `GET`, el `select().from(schema.payments)` ya devuelve todas las columnas (incluida la nueva) — no requiere cambio.

- [ ] **Step 2: Subida de captura en `RegisterPaymentDialog.tsx`**

Añade estado:
```tsx
const [photoUrl, setPhotoUrl] = useState("");
const [uploading, setUploading] = useState(false);
```
Añade la función:
```tsx
async function handleUpload(file: File) {
  setUploading(true);
  setError("");
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("No se pudo subir la captura");
    const data = await res.json();
    setPhotoUrl(data.url);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error subiendo captura");
  } finally {
    setUploading(false);
  }
}
```
En el body del `submit()`, tras `notes,` añade:
```ts
      if (photoUrl) body.photoUrl = photoUrl;
```
Añade el campo UI (después del input de notas):
```tsx
<div className="mt-4">
  <label className="mb-1 block text-xs font-medium text-gray-600">Captura (opcional)</label>
  <input
    type="file"
    accept="image/*"
    disabled={uploading}
    onChange={(e) => {
      const f = e.target.files?.[0];
      if (f) void handleUpload(f);
    }}
    className={inputCls}
  />
  {uploading && <p className="mt-1 text-xs text-gray-500">Subiendo...</p>}
  {photoUrl && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="Captura" className="mt-2 h-20 w-20 rounded-lg object-cover" />
  )}
</div>
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payments/route.ts src/components/RegisterPaymentDialog.tsx
git commit -m "feat(pagos): captura opcional al registrar pago de cliente"
```

---

### Task 7: Captura obligatoria en pagos a proveedores (API + diálogo)

**Files:**
- Modify: `src/app/api/supplier-payments/route.ts`
- Modify: `src/components/SupplierPaymentDialog.tsx`
- Modify: `src/app/api/supplier-payments/[id]/route.ts` (GET devuelve columna nueva automáticamente)

**Interfaces:**
- Consumes: `/api/upload`.
- Produces: `POST /api/supplier-payments` exige `photoUrl` (400 si falta).

- [ ] **Step 1: Exigir `photoUrl` en `POST /api/supplier-payments`**

En `src/app/api/supplier-payments/route.ts`, tras la validación de `reference`, añade:
```ts
  if (typeof body.photoUrl !== "string" || !body.photoUrl.trim()) {
    return NextResponse.json({ error: "La captura del pago es requerida" }, { status: 400 });
  }
```
Y en el objeto `payment` añade:
```ts
    photoUrl: body.photoUrl.trim(),
```

- [ ] **Step 2: Subida obligatoria en `SupplierPaymentDialog.tsx`**

Añade estado:
```tsx
const [photoUrl, setPhotoUrl] = useState("");
const [uploading, setUploading] = useState(false);
```
Función:
```tsx
async function handleUpload(file: File) {
  setUploading(true);
  setError("");
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("No se pudo subir la captura");
    const data = await res.json();
    setPhotoUrl(data.url);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error subiendo captura");
  } finally {
    setUploading(false);
  }
}
```
En `submit()`, antes de `setSaving(true);`, añade:
```ts
    if (!photoUrl) {
      setError("La captura del pago es requerida");
      return;
    }
```
Y en el body:
```ts
        photoUrl,
```
Añade el campo UI (después del input de notas):
```tsx
<div>
  <label className="mb-1 block text-xs font-medium text-gray-600">Captura del pago *</label>
  <input
    type="file"
    accept="image/*"
    disabled={uploading}
    onChange={(e) => {
      const f = e.target.files?.[0];
      if (f) void handleUpload(f);
    }}
    className={inputCls}
  />
  {uploading && <p className="mt-1 text-xs text-gray-500">Subiendo...</p>}
  {photoUrl && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="Captura" className="mt-2 h-20 w-20 rounded-lg object-cover" />
  )}
</div>
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/supplier-payments/route.ts src/components/SupplierPaymentDialog.tsx
git commit -m "feat(pagos): captura obligatoria al pagar a proveedores"
```

---

### Task 8: API de capturas de pago de clientes (`payment_receipts`)

**Files:**
- Create: `src/app/api/payment-receipts/route.ts`
- Create: `src/app/api/payment-receipts/[id]/route.ts`

**Interfaces:**
- Consumes: `auth`, `db/schema`, `hasPermission`, `getTodayRate` (de `@/lib/bcv`).
- Produces:
  - `POST /api/payment-receipts` (cliente autenticado): `{ appointmentId?, amountVes, photoUrl }` → 201, tasa del día congelada, `amountUsd`.
  - `GET /api/payment-receipts` (admin: todas, `?status=`; cliente: solo las suyas) → filas con `clientName`.
  - `PATCH /api/payment-receipts/[id]` (admin `paymentApproval`): `{ action: 'approve'|'reject', notes? }`.
  - `DELETE /api/payment-receipts/[id]` (admin, solo `pending`).

- [ ] **Step 1: Crear `src/app/api/payment-receipts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin, hasPermission } from "@/lib/authz";
import { getTodayRate } from "@/lib/bcv";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = await isAdmin(session);
  const q = db
    .select({
      id: schema.paymentReceipts.id,
      clientId: schema.paymentReceipts.clientId,
      clientName: schema.users.name,
      appointmentId: schema.paymentReceipts.appointmentId,
      amountVes: schema.paymentReceipts.amountVes,
      rate: schema.paymentReceipts.rate,
      amountUsd: schema.paymentReceipts.amountUsd,
      photoUrl: schema.paymentReceipts.photoUrl,
      status: schema.paymentReceipts.status,
      reviewedBy: schema.paymentReceipts.reviewedBy,
      reviewedAt: schema.paymentReceipts.reviewedAt,
      reviewNotes: schema.paymentReceipts.reviewNotes,
      paymentId: schema.paymentReceipts.paymentId,
      createdAt: schema.paymentReceipts.createdAt,
    })
    .from(schema.paymentReceipts)
    .leftJoin(schema.users, eq(schema.users.id, schema.paymentReceipts.clientId));

  if (admin) {
    const status = req.nextUrl.searchParams.get("status");
    const rows = status === "pending" || status === "approved" || status === "rejected"
      ? q.where(eq(schema.paymentReceipts.status, status)).orderBy(desc(schema.paymentReceipts.createdAt)).all()
      : q.orderBy(desc(schema.paymentReceipts.createdAt)).all();
    return NextResponse.json(rows);
  }

  const mine = q
    .where(eq(schema.paymentReceipts.clientId, session.user.id))
    .orderBy(desc(schema.paymentReceipts.createdAt))
    .all();
  return NextResponse.json(mine);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const amountVes = Number(body.amountVes);
  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : "";
  if (!Number.isFinite(amountVes) || amountVes <= 0) {
    return NextResponse.json({ error: "amountVes es requerido y debe ser mayor a 0" }, { status: 400 });
  }
  if (!photoUrl) {
    return NextResponse.json({ error: "La captura es requerida" }, { status: 400 });
  }
  const { rate } = await getTodayRate();
  if (!rate || rate <= 0) {
    return NextResponse.json(
      { error: "No hay tasa BCV disponible; refresca la tasa del día antes" },
      { status: 400 }
    );
  }
  const appointmentId = body.appointmentId ? String(body.appointmentId) : null;
  if (appointmentId) {
    const appt = db
      .select({ clientId: schema.appointments.clientId })
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId))
      .get();
    if (!appt || appt.clientId !== session.user.id) {
      return NextResponse.json({ error: "La cita no pertenece al cliente" }, { status: 400 });
    }
  }
  const now = Math.floor(Date.now() / 1000);
  const receipt = {
    id: crypto.randomUUID(),
    clientId: session.user.id,
    appointmentId,
    amountVes: Math.round(amountVes * 100) / 100,
    rate,
    amountUsd: Math.round((amountVes / rate) * 100) / 100,
    photoUrl,
    status: "pending" as const,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    paymentId: null,
    createdAt: now,
  };
  db.insert(schema.paymentReceipts).values(receipt).run();
  return NextResponse.json(receipt, { status: 201 });
}
```

- [ ] **Step 2: Crear `src/app/api/payment-receipts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin, hasPermission } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "paymentApproval"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const receipt = db.select().from(schema.paymentReceipts).where(eq(schema.paymentReceipts.id, id)).get();
  if (!receipt) {
    return NextResponse.json({ error: "Captura no encontrada" }, { status: 404 });
  }
  if (receipt.status !== "pending") {
    return NextResponse.json({ error: "Esta captura ya fue revisada" }, { status: 400 });
  }
  const body = await req.json();
  const action = body.action;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const now = Math.floor(Date.now() / 1000);
  const adminId = session?.user?.id;

  if (action === "approve") {
    const paymentId = crypto.randomUUID();
    const payment = {
      id: paymentId,
      userId: receipt.clientId,
      appointmentId: receipt.appointmentId,
      amountUsd: receipt.amountUsd,
      currency: "VES" as const,
      amountVes: receipt.amountVes,
      rate: receipt.rate,
      reference: `Captura aprobada ${id.slice(0, 8)}`,
      paidAt: now,
      notes,
      createdBy: adminId ?? receipt.clientId,
      photoUrl: receipt.photoUrl,
      createdAt: now,
    };
    db.transaction((tx) => {
      tx.insert(schema.payments).values(payment).run();
      tx.update(schema.paymentReceipts)
        .set({ status: "approved", reviewedBy: adminId, reviewedAt: now, reviewNotes: notes, paymentId })
        .where(eq(schema.paymentReceipts.id, id))
        .run();
    });
    return NextResponse.json({ success: true, paymentId });
  }

  if (action === "reject") {
    db.update(schema.paymentReceipts)
      .set({ status: "rejected", reviewedBy: adminId, reviewedAt: now, reviewNotes: notes })
      .where(eq(schema.paymentReceipts.id, id))
      .run();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const receipt = db.select().from(schema.paymentReceipts).where(eq(schema.paymentReceipts.id, id)).get();
  if (!receipt) {
    return NextResponse.json({ error: "Captura no encontrada" }, { status: 404 });
  }
  if (receipt.status !== "pending") {
    return NextResponse.json({ error: "Solo se pueden eliminar capturas pendientes" }, { status: 400 });
  }
  db.delete(schema.paymentReceipts).where(eq(schema.paymentReceipts.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.
Run (con la app en `npm run dev` o tras build): prueba manual: crear captura como cliente, aprobarla como admin, verificar que `payments` recibe la fila y el balance baja.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payment-receipts/route.ts "src/app/api/payment-receipts/[id]/route.ts"
git commit -m "feat(pagos): capturas de pago de clientes con aprobación admin"
```

---

### Task 9: Bloque "Mis pagos" en el perfil del cliente

**Files:**
- Create: `src/components/ReportPaymentDialog.tsx`
- Modify: `src/app/(client)/profile/page.tsx`
- Modify: `src/app/(client)/profile/ProfileContent.tsx`

**Interfaces:**
- Consumes: `POST /api/payment-receipts`, `GET /api/payment-receipts`, `GET /api/exchange-rate/current`, `/api/upload`.
- Produces: prop `balanceUsd: number` en `ProfileContent`; diálogo para reportar pago con captura; historial con estados.

- [ ] **Step 1: Calcular saldo en `profile/page.tsx`**

Tras la consulta `completedAppointments`, añade:
```ts
import { sql, and, eq } from "drizzle-orm";

  const due = db
    .select({ s: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)` })
    .from(schema.servicePurchases)
    .innerJoin(schema.appointments, eq(schema.appointments.id, schema.servicePurchases.appointmentId))
    .where(and(eq(schema.servicePurchases.userId, user.id), eq(schema.appointments.status, "completed")))
    .get()?.s ?? 0;

  const paid = db
    .select({ s: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, user.id))
    .get()?.s ?? 0;

  const balanceUsd = Math.round((due - paid) * 100) / 100;
```
(Revisa que los imports `sql`, `and`, `eq` estén presentes; el archivo ya importa `eq, and, gte, sql`.)

Pasa la prop:
```tsx
      balanceUsd={balanceUsd}
```

- [ ] **Step 2: Crear `src/components/ReportPaymentDialog.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";

type Props = {
  balanceUsd: number;
  appointments: { id: string; serviceName: string; startTime: number }[];
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function ReportPaymentDialog({ balanceUsd, appointments, onClose, onSaved }: Props) {
  const [appointmentId, setAppointmentId] = useState("");
  const [amountVes, setAmountVes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/exchange-rate/current")
      .then((r) => r.json())
      .then((data) => setRate(data.rate ?? null))
      .catch(() => setRate(null));
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("No se pudo subir la captura");
      const data = await res.json();
      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo captura");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const v = parseFloat(amountVes);
    if (!Number.isFinite(v) || v <= 0) {
      setError("Escribe un monto en Bs mayor a 0");
      return;
    }
    if (!photoUrl) {
      setError("Adjunta la captura de la transferencia");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payment-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointmentId || null, amountVes: v, photoUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo reportar el pago");
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
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Reportar pago</h3>
        <p className="mt-1 text-sm text-gray-500">
          Saldo pendiente:{" "}
          <span className="font-semibold text-gray-900">${balanceUsd.toFixed(2)}</span>
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cita (opcional)</label>
            <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.serviceName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Monto en Bs *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountVes}
              onChange={(e) => setAmountVes(e.target.value)}
              placeholder="Ej: 1500"
              className={inputCls}
            />
            {rate && (
              <p className="mt-1 text-xs text-gray-500">
                Tasa BCV del día: {rate.toFixed(2)} Bs/US$ → ≈ $
                {((parseFloat(amountVes) || 0) / rate).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Captura de la transferencia *</label>
            <input
              type="file"
              accept="image/*"
              disabled={uploading || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
              className={inputCls}
            />
            {uploading && <p className="mt-1 text-xs text-gray-500">Subiendo...</p>}
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Captura" className="mt-2 h-24 w-24 rounded-lg object-cover" />
            )}
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-gray-400">
          El salón debe aprobar tu pago para que se aplique a tu cuenta.
        </p>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || uploading} className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors">
            {saving ? "Enviando..." : "Reportar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrar en `ProfileContent.tsx`**

Añade props e imports:
```tsx
import { useState, useEffect } from "react";
import { ReportPaymentDialog } from "@/components/ReportPaymentDialog";

type Props = {
  user: ProfileUser;
  appointments: Appointment[];
  upcomingAppointments: UpcomingAppointment[];
  balanceUsd: number;
};
```
Estado y fetch del historial:
```tsx
  const [showReport, setShowReport] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  type Receipt = {
    id: string;
    amountVes: number;
    rate: number;
    amountUsd: number;
    status: string;
    photoUrl: string;
    reviewNotes: string | null;
    createdAt: number;
  };

  const loadReceipts = useCallback(() => {
    fetch("/api/payment-receipts")
      .then((r) => r.json())
      .then((data) => setReceipts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);
```
(Importa `useCallback`, `useEffect` de react; el archivo ya usa `useRouter`, `useState`.)

Render (justo después de la sección de "Próximas citas"):
```tsx
      {/* Mis pagos */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mis pagos</h2>
          {balanceUsd > 0 && (
            <button
              onClick={() => setShowReport(true)}
              className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
            >
              Reportar pago
            </button>
          )}
        </div>
        {balanceUsd > 0 ? (
          <p className="mb-3 text-sm text-gray-500">
            Debes{" "}
            <span className="font-semibold text-gray-900">${balanceUsd.toFixed(2)}</span>.
            Paga en Bs y adjunta la captura; el salón la aprobará.
          </p>
        ) : (
          <p className="mb-3 text-sm text-gray-500">No tienes saldo pendiente.</p>
        )}
        {receipts.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">Aún no has reportado pagos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                {r.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoUrl} alt="Captura" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {r.amountVes.toFixed(2)} Bs ≈ ${r.amountUsd.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(r.createdAt * 1000))}
                  </p>
                  {r.status === "rejected" && r.reviewNotes && (
                    <p className="text-xs text-red-600">Motivo: {r.reviewNotes}</p>
                  )}
                </div>
                <span
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    r.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : r.status === "rejected"
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.status === "approved" ? "Aprobado" : r.status === "rejected" ? "Rechazado" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
```
Al final del JSX (junto a los demás modales, si los hubiera):
```tsx
      {showReport && (
        <ReportPaymentDialog
          balanceUsd={balanceUsd}
          appointments={appointments}
          onClose={() => setShowReport(false)}
          onSaved={() => {
            setShowReport(false);
            loadReceipts();
            router.refresh();
          }}
        />
      )}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportPaymentDialog.tsx src/app/\(client\)/profile/page.tsx src/app/\(client\)/profile/ProfileContent.tsx
git commit -m "feat(perfil): reportar pagos con captura e historial de estados"
```

---

### Task 10: Pestaña "Pagos recibidos" en Cuentas por cobrar

**Files:**
- Modify: `src/app/(admin)/dashboard/balances/BalancesContent.tsx`

**Interfaces:**
- Consumes: `GET /api/payment-receipts`, `PATCH /api/payment-receipts/[id]`, `ConfirmDialog`.
- Produces: tabs `Cuentas por cobrar` / `Pagos recibidos` con aprobar/rechazar.

- [ ] **Step 1: Añadir tabs y listado**

En `BalancesContent.tsx`, añade estado:
```tsx
const [tab, setTab] = useState<"balances" | "receipts">("balances");
const [receipts, setReceipts] = useState<Receipt[]>([]);
const [receiptFilter, setReceiptFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

type Receipt = {
  id: string;
  clientId: string;
  clientName: string | null;
  amountVes: number;
  rate: number;
  amountUsd: number;
  photoUrl: string;
  status: string;
  reviewNotes: string | null;
  paymentId: string | null;
  createdAt: number;
};

const loadReceipts = useCallback(async () => {
  const params = new URLSearchParams();
  if (receiptFilter !== "all") params.set("status", receiptFilter);
  const res = await fetch(`/api/payment-receipts?${params.toString()}`);
  if (res.ok) setReceipts(Array.isArray(await res.json()) ? await res.json() : []);
}, [receiptFilter]);

useEffect(() => {
  if (tab === "receipts") void loadReceipts();
}, [tab, loadReceipts]);

async function reviewReceipt(id: string, action: "approve" | "reject") {
  const notes = action === "reject" ? window.prompt("Motivo del rechazo:") ?? "" : "";
  const res = await fetch(`/api/payment-receipts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    window.alert(data.error || "No se pudo revisar la captura");
  }
  await loadReceipts();
}
```
(El archivo ya importa `useCallback`.)

- [ ] **Step 2: Render de tabs y contenido**

En el JSX, sustituye el bloque superior (header + `loading`/`clients`) para incluir las tabs. Concretamente, tras el `<div className="mb-6">` del header, inserta:
```tsx
      <div className="mb-6 flex gap-2">
        {(["balances", "receipts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-pink-main text-gray-900" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t === "balances" ? "Cuentas por cobrar" : "Pagos recibidos"}
          </button>
        ))}
      </div>
```
Y envuelve el bloque actual de balances con `{tab === "balances" && ( ... )}`. Añade al final del archivo (después del bloque de balances):
```tsx
      {tab === "receipts" && (
        <div>
          <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setReceiptFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  receiptFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobadas" : s === "rejected" ? "Rechazadas" : "Todas"}
              </button>
            ))}
          </div>

          {receipts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay capturas de pago aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <div key={r.id} className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  {r.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photoUrl} alt="Captura" className="h-16 w-16 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{r.clientName ?? "Cliente"}</p>
                    <p className="text-sm text-gray-500">
                      {r.amountVes.toFixed(2)} Bs ≈ <span className="font-semibold text-gray-900">${r.amountUsd.toFixed(2)}</span> · tasa {r.rate.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(r.createdAt)}</p>
                    {r.reviewNotes && <p className="mt-1 text-xs text-red-600">{r.reviewNotes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === "pending" ? (
                      <>
                        <button
                          onClick={() => void reviewReceipt(r.id, "approve")}
                          className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => void reviewReceipt(r.id, "reject")}
                          className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Rechazar
                        </button>
                      </>
                    ) : (
                      <span
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {r.status === "approved" ? "Aprobada" : "Rechazada"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
```
Después de aprobar/rechazar, recarga también balances si `tab === 'balances'` no es necesario (se recarga al cambiar de tab).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/dashboard/balances/BalancesContent.tsx
git commit -m "feat(balances): pestaña de pagos recibidos con aprobación"
```

---

### Task 11: Inventario API — código de producto, código de barras y foto

**Files:**
- Modify: `src/app/api/inventory/items/route.ts`
- Modify: `src/app/api/inventory/items/[id]/route.ts`

**Interfaces:**
- Consumes: `hasPermission` (ya aplicada en Task 4).
- Produces: `POST /api/inventory/items` valida `code` único y lo usa como `id`; `PATCH` edita `barcode`/`photoUrl` (no `code`); `GET` devuelve `barcode`/`photoUrl`.

- [ ] **Step 1: `POST` con código de producto**

En `src/app/api/inventory/items/route.ts`, sustituye el `POST`:
```ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    return NextResponse.json({ error: "El código de producto es requerido y solo admite letras, números, guiones y guiones bajos" }, { status: 400 });
  }
  const exists = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, code)).get();
  if (exists) {
    return NextResponse.json({ error: "Ya existe un producto con ese código" }, { status: 400 });
  }
  const barcode = typeof body.barcode === "string" && body.barcode.trim() ? body.barcode.trim() : null;
  const photoUrl = typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null;
  const row = {
    id: code,
    name,
    unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "unidad",
    stock: 0,
    avgCost: 0,
    minStock: typeof body.minStock === "number" && body.minStock >= 0 ? body.minStock : 0,
    isActive: 1,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    barcode,
    photoUrl,
    createdAt: Math.floor(Date.now() / 1000),
  };
  db.insert(schema.inventoryItems).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
```
Actualiza el import a: `import { isAdmin, hasPermission } from "@/lib/authz";` (o elimina `isAdmin` si deja de usarse en el archivo — se usa en GET).

- [ ] **Step 2: `PATCH` para barcode/photoUrl**

En `src/app/api/inventory/items/[id]/route.ts`, añade en el `PATCH` (tras las demás lecturas):
```ts
  const barcode = body.barcode !== undefined
    ? (typeof body.barcode === "string" && body.barcode.trim() ? body.barcode.trim() : null)
    : existing.barcode;
  const photoUrl = body.photoUrl !== undefined
    ? (typeof body.photoUrl === "string" && body.photoUrl.trim() ? body.photoUrl.trim() : null)
    : existing.photoUrl;
```
Y en el `.set({ ... })` añade `barcode, photoUrl`; en el return añade `barcode, photoUrl`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/inventory/items/route.ts "src/app/api/inventory/items/[id]/route.ts"
git commit -m "feat(inventario): código de producto como PK, código de barras y foto"
```

---

### Task 12: Inventario grid (tabla) con foto, código y permiso de ajuste

**Files:**
- Modify: `src/app/(admin)/dashboard/inventory/InventoryContent.tsx`

**Interfaces:**
- Consumes: prop `canAdjust: boolean`; APIs de inventario (Tasks 4 y 11).
- Produces: pestaña Productos como tabla con columnas Foto/Código/Nombre/Código de barras/Unidad/Stock/Stock mín/Costo avg/Valor/Acciones; botón "Ajuste" solo si `canAdjust`; formulario con código obligatorio, barcode y foto.

- [ ] **Step 1: Añadir campos al tipo y al formulario**

En `InventoryContent.tsx`, amplía `InventoryItem`:
```tsx
type InventoryItem = {
  id: string;
  code?: string;
  name: string;
  unit: string;
  stock: number;
  avgCost: number;
  minStock: number;
  isActive: number;
  notes: string | null;
  barcode: string | null;
  photoUrl: string | null;
  stockValue: number;
  estUsos: number | null;
};
```
Amplía el formulario de nuevo producto:
```tsx
const [newItemForm, setNewItemForm] = useState({ code: "", name: "", unit: "unidad", minStock: "0", barcode: "", photoUrl: "" });
```
En `createItem()`, envía:
```ts
        body: JSON.stringify({
          code: newItemForm.code.trim(),
          name,
          unit: newItemForm.unit.trim(),
          minStock: Number(newItemForm.minStock) || 0,
          barcode: newItemForm.barcode.trim(),
          photoUrl: newItemForm.photoUrl,
        }),
```
y resetea `setNewItemForm({ code: "", name: "", unit: "unidad", minStock: "0", barcode: "", photoUrl: "" });`
Y añade el estado para subir foto:
```tsx
const [uploading, setUploading] = useState(false);
```
Con función:
```tsx
async function handleUpload(file: File) {
  setUploading(true);
  setConfirmError("");
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("No se pudo subir la foto");
    const data = await res.json();
    setNewItemForm((f) => ({ ...f, photoUrl: data.url }));
  } catch (err) {
    setConfirmError(err instanceof Error ? err.message : "Error subiendo foto");
  } finally {
    setUploading(false);
  }
}
```

- [ ] **Step 2: Convertir la lista de productos en tabla**

Sustituye el bloque `{items.length === 0 ? ( ... ) : ( <div className="mt-6 space-y-3"> {items.map(...)} </div> )}` de la pestaña Productos por:
```tsx
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-3">Foto</th>
                    <th className="px-3 py-3">Código</th>
                    <th className="px-3 py-3">Nombre</th>
                    <th className="px-3 py-3">Cód. barras</th>
                    <th className="px-3 py-3">Unidad</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Stock mín</th>
                    <th className="px-3 py-3">Costo avg</th>
                    <th className="px-3 py-3">Valor</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const lowStock = item.stock <= item.minStock && item.minStock > 0;
                    return (
                      <tr key={item.id} className={`border-b border-gray-50 ${item.isActive === 0 ? "opacity-50" : ""}`}>
                        <td className="px-3 py-2">
                          {item.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.photoUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <span className="block h-10 w-10 rounded-lg bg-gray-100" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.id}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.isActive === 0 && <span className="text-xs text-gray-400">Inactivo</span>}
                          {lowStock && <span className="ml-1 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Stock bajo</span>}
                          {item.estUsos !== null && <span className="ml-1 text-xs text-gray-400">≈ {item.estUsos} usos</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{item.barcode ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{item.unit}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.stock}</td>
                        <td className="px-3 py-2 text-gray-500">{item.minStock}</td>
                        <td className="px-3 py-2 text-gray-600">${item.avgCost.toFixed(2)}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">${item.stockValue.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1.5">
                            <button onClick={() => setMovementItem(item)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
                              Salida
                            </button>
                            {canAdjust && (
                              <button onClick={() => setMovementItem(item)} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200">
                                Ajuste
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditForm({ name: item.name, unit: item.unit, minStock: String(item.minStock), isActive: item.isActive });
                              }}
                              className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                            >
                              Editar
                            </button>
                            <button onClick={() => setDeletingItem(item)} className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200">
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
```

- [ ] **Step 3: Añadir código/barcode/foto al formulario de creación**

En el bloque "Nuevo producto", sustituye el `<div className="flex gap-2">` por:
```tsx
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={newItemForm.code}
                onChange={(e) => setNewItemForm({ ...newItemForm, code: e.target.value })}
                placeholder="Código de producto * (ej: ACR-001)"
                className={inputCls}
              />
              <input
                value={newItemForm.name}
                onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                placeholder="Nombre *"
                className={inputCls}
              />
              <input
                value={newItemForm.barcode}
                onChange={(e) => setNewItemForm({ ...newItemForm, barcode: e.target.value })}
                placeholder="Código de barras (opcional)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <input
                  value={newItemForm.unit}
                  onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                  placeholder="Unidad"
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  value={newItemForm.minStock}
                  onChange={(e) => setNewItemForm({ ...newItemForm, minStock: e.target.value })}
                  placeholder="Stock mín."
                  className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
                className={inputCls}
              />
              {newItemForm.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={newItemForm.photoUrl} alt="Foto" className="h-16 w-16 rounded-lg object-cover" />
              )}
            </div>
```
Y el botón queda:
```tsx
              <button
                onClick={() => void createItem()}
                disabled={busy || uploading || !newItemForm.code.trim() || !newItemForm.name.trim()}
                className="mt-3 shrink-0 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
              >
                + Producto
              </button>
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/dashboard/inventory/InventoryContent.tsx
git commit -m "feat(inventario): grid de productos con foto, código, barras y permiso de ajuste"
```

---

### Task 13: Compras grid maestro-detalle

**Files:**
- Modify: `src/app/(admin)/dashboard/purchases/PurchasesContent.tsx`

**Interfaces:**
- Consumes: `GET /api/bills` (ya devuelve `items`, `paidUsd`).
- Produces: tab Facturas como tabla (nº factura/proveedor/fecha/vence/tipo/total/estado) con detalle expandible (Ver) y acciones.

- [ ] **Step 1: Estado de expansión**

Añade en `PurchasesContent`:
```tsx
const [expandedBill, setExpandedBill] = useState<string | null>(null);
```

- [ ] **Step 2: Reemplazar la lista de tarjetas por tabla maestro-detalle**

Sustituye el bloque `{bills.length === 0 ? ( ... ) : ( <div className="space-y-3"> bills.map(...) </div> )}` dentro de la tab Facturas por:
```tsx
          {bills.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay facturas con estos filtros</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3"># Factura</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Vence</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Total $</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => {
                    const overdue = b.dueDate && b.status !== "paid" && b.dueDate * 1000 < Date.now();
                    return (
                      <>
                        <tr key={b.id} className={`border-b border-gray-50 ${overdue ? "bg-red-50/50" : ""}`}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.invoiceNumber ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{b.supplierName ?? "Sin proveedor"}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(b.billDate)}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(b.dueDate)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${typePill[b.type]}`}>
                              {b.type === "inventory" ? "Inventario" : "Gasto fijo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">${b.totalUsd.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusPill[b.status]}`}>
                              {b.status === "pending" ? "Pendiente" : b.status === "partial" ? "Parcial" : "Pagada"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setExpandedBill(expandedBill === b.id ? null : b.id)}
                                className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                              >
                                {expandedBill === b.id ? "Ocultar" : "Ver"}
                              </button>
                              <button
                                onClick={() => void openEdit(b.id)}
                                className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => setDeleting({ kind: "bill", id: b.id })}
                                disabled={b.paidUsd > 0}
                                className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedBill === b.id && (
                          <tr key={`${b.id}-detail`} className="border-b border-gray-50 bg-gray-50/50">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                <span className="text-gray-500">
                                  Pagado <span className="font-semibold text-gray-900">${b.paidUsd.toFixed(2)}</span>
                                </span>
                                <span className="text-gray-500">
                                  Pendiente <span className="font-semibold text-gray-900">${Math.max(0, b.totalUsd - b.paidUsd).toFixed(2)}</span>
                                </span>
                                {b.categoryName && <span className="text-gray-500">Categoría: {b.categoryName}</span>}
                                {b.notes && <span className="text-gray-400">{b.notes}</span>}
                              </div>
                              {b.items.length > 0 && (
                                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-100 text-gray-400">
                                        <th className="px-3 py-2">Descripción</th>
                                        <th className="px-3 py-2">Cantidad</th>
                                        <th className="px-3 py-2">Costo un.</th>
                                        <th className="px-3 py-2">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {b.items.map((it) => (
                                        <tr key={it.id} className="border-b border-gray-50">
                                          <td className="px-3 py-2 text-gray-700">{it.description ?? "Item de inventario"}</td>
                                          <td className="px-3 py-2 text-gray-600">{it.quantity}</td>
                                          <td className="px-3 py-2 text-gray-600">${it.unitCostUsd.toFixed(2)}</td>
                                          <td className="px-3 py-2 font-medium text-gray-900">${it.totalUsd.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {b.items.length === 0 && (
                                <p className="text-xs text-gray-400">Sin detalle de líneas.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
```
Nota: `b.items` ya viene en el `GET /api/bills` (mapa `itemsByBill`). `b.type` y `b.status` ya están en el tipo `Bill`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/dashboard/purchases/PurchasesContent.tsx
git commit -m "feat(compras): grid maestro-detalle de facturas"
```

---

### Task 14: Seeds demo + documentación + verificación final

**Files:**
- Modify: `src/db/seed-finance-demo.ts`
- Modify: `src/db/seed-client-demo.ts`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: schema actualizado (Task 1).
- Produces: demo de inventario con códigos y capturas de pago; docs actualizadas.

- [ ] **Step 1: Actualizar `seed-finance-demo.ts`**

Sustituye los 4 items para que usen códigos como id y añade barcode:
```ts
const itemMon = { id: "ACR-001", name: "Monómero acrílico", unit: "ml", stock: 0, avgCost: 0, minStock: 200, isActive: 1, notes: null, barcode: "7701000000001", photoUrl: null, createdAt: now };
const itemPow = { id: "ACR-002", name: "Polvo acrílico", unit: "g", stock: 0, avgCost: 0, minStock: 150, isActive: 1, notes: null, barcode: "7701000000002", photoUrl: null, createdAt: now };
const itemGel = { id: "GEL-001", name: "Esmalte semipermanente", unit: "ml", stock: 0, avgCost: 0, minStock: 100, isActive: 1, notes: null, barcode: "7701000000003", photoUrl: null, createdAt: now };
const itemTips = { id: "TIP-001", name: "Tips pack", unit: "pack", stock: 0, avgCost: 0, minStock: 10, isActive: 1, notes: null, barcode: "7701000000004", photoUrl: null, createdAt: now };
```
Después del pago a proveedor (tras `db.update(schema.bills).set({ status: "partial" })...`), añade una captura demo:
```ts
const demoClient = db.select().from(schema.users).where(eq(schema.users.role, "client")).all()[0];
if (demoClient) {
  const rateDemo = 60;
  const receiptId = crypto.randomUUID();
  const receiptDemo = {
    id: receiptId,
    clientId: demoClient.id,
    appointmentId: null,
    amountVes: 500,
    rate: rateDemo,
    amountUsd: Math.round((500 / rateDemo) * 100) / 100,
    photoUrl: "/uploads/demo-captura.jpg",
    status: "pending" as const,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    paymentId: null,
    createdAt: now - 1 * DAY,
  };
  db.insert(schema.paymentReceipts).values(receiptDemo).run();
}
```
Verifica que el `wipe()` borre también receipts (añade al inicio de `wipe()`: `db.delete(schema.paymentReceipts).run();`).

- [ ] **Step 2: Actualizar `seed-client-demo.ts` (opcional)**

Si el seed de clienta crea pagos, añade un `paymentReceipts` pendiente para ella (mismo patrón que Step 1). Verifica primero si el archivo ya inserta en `schema.payments`.

- [ ] **Step 3: Actualizar `AGENTS.md`**

- En `users`: añade línea `permissions: text (JSON array; null = todos los módulos)`.
- En `inventory_items`: `id` es el **código de producto** (PK); añade `barcode` y `photo_url`.
- En `payments` y `supplier_payments`: añade `photo_url` (obligatoria en pagos a proveedores).
- Nueva tabla `payment_receipts` (capturas con aprobación).
- Nueva sección de **Permisos**: claves de permiso y regla `null` = todos; ajustes de inventario y aprobación de pagos con permisos propios.
- Rutas nuevas: `/api/payment-receipts`, `/api/my-permissions`, `/api/exchange-rate/current`.
- Componentes: `ReportPaymentDialog`; notas de grid en `PurchasesContent` e `InventoryContent`.

- [ ] **Step 4: Actualizar `CHANGELOG.md`**

Bajo `## [Sin publicar]`, añade entradas: inventario con código/barras/foto en grid; compras en grid maestro-detalle; capturas de pago (clientes con aprobación, proveedores obligatorias); sistema de permisos por admin; tasa pública; documentación.

- [ ] **Step 5: Actualizar `README.md`**

Mención breve de permisos por admin y pagos con capturas.

- [ ] **Step 6: Verificación completa**

Run:
```powershell
npx tsc --noEmit
```
Expected: PASS.
```powershell
npm run lint
```
Expected: PASS (0 errores).
```powershell
npm run db:seed:finance
npm run db:seed:client
```
Expected: seeds OK.
```powershell
npm run build
```
Expected: build PASS con todas las rutas (incluidas las nuevas API).

- [ ] **Step 7: Commit**

```bash
git add src/db/seed-finance-demo.ts src/db/seed-client-demo.ts agents.md CHANGELOG.md README.md
git commit -m "feat: seeds de permisos y capturas + documentación de mejoras"
```

---

## Self-Review

**Spec coverage:**
- Bug cancelación → ya implementado (fuera de scope, confirmado en spec). ✅
- Compras grid maestro-detalle → Task 13. ✅
- Inventario grid con código (PK), barcode y foto → Tasks 1, 11, 12. ✅
- Ajustes solo con permiso → Task 4 + Task 12 (botón condicionado a `canAdjust`). ✅
- Captura obligatoria en pagos a proveedores → Task 7. ✅
- Captura opcional en pagos de clientes → Task 6. ✅
- Pagos recibidos (cliente reporta con tasa del día, admin aprueba/rechaza, descuenta balance) → Tasks 8, 9, 10. ✅
- Permisos JSON por usuario + UI → Tasks 2, 3, 5. ✅
- Migración uuid→código + remapeo de FKs → Task 1 Step 4. ✅
- Seeds y docs → Task 14. ✅

**Placeholder scan:** Sin "TBD"/"TODO"; cada paso incluye código o instrucciones exactas. El formulario de edición de producto de inventario (Task 12) mantiene el editor inline existente (no se reemplaza el bloque `editingId === item.id` — sigue funcionando y solo edita name/unit/minStock/isActive; barcode/photoUrl se pueden editar al crear; se omite el editor de barcode/foto en edición por YAGNI y queda documentado para una iteración posterior).

**Type consistency:** `hasPermission`, `getPermissions`, `canAdjustInventory` definidos en Task 2 y usados en Tasks 3-5, 8, 11. Prop `canAdjust` definida en Task 3 y consumida en Task 12. `paymentReceipts` schema en Task 1 y usado en Tasks 8-10. `PERMISSION_KEYS`/`PERMISSION_LABELS` en Task 2, usados en Task 5. ✅

**Posible riesgo (documentado):** `PRAGMA defer_foreign_keys=ON` dentro de la transacción de drizzle-kit puede no ser soportado por versiones antiguas de SQLite; better-sqlite3 13 usa SQLite ≥ 3.45, que lo soporta. Si `npm run db:migrate` fallara en Task 1, alternativa: recrear la tabla `inventory_items` con `CREATE TABLE inventory_items_new ...; INSERT ... SELECT; DROP TABLE inventory_items; ALTER TABLE inventory_items_new RENAME TO inventory_items;` (mismo bloque que ya se escribió, solo que reordenando el UPDATE de hijos antes del DROP).
