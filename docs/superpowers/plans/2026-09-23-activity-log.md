# Log de Actividad de Usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar en una tabla `activity_logs` todas las mutaciones del sistema (quién, qué, cuándo) y exponerlas en una página de dashboard `/dashboard/activity` con filtros y paginación.

**Architecture:** Tabla genérica `activity_logs` (actor, entidad, acción, label, metadata JSON) + helper síncrono `logActivity(db, params)` en `src/lib/audit.ts` llamado en ~45 endpoints mutantes justo después de la mutación exitosa. Consulta vía funciones testables `listActivityLogs(db, filters)` / `listActivityActors(db)` expuestas por `GET /api/activity-logs` y `GET /api/activity-logs/actors`. UI en `src/app/(admin)/dashboard/activity/` siguiendo el patrón de página+Content de `balances`. Logging es best-effort (try/catch interno, nunca rompe la mutación de negocio).

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM + better-sqlite3 (síncrono), Tailwind CSS + shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-23-activity-log-design.md`

## Global Constraints

- **Shell:** Windows PowerShell 5.1. Encadenar con `cmd1; if ($?) { cmd2 }`. NUNCA `&&`.
- **Verificación de cada tarea:** `npx tsc --noEmit` y `npm run lint`. Tests: `npm run test` (vitest).
- **Horas/fechas:** timestamps unix en **segundos** → `Math.floor(Date.now() / 1000)`. Solo hora local del salón.
- **IDs:** `text("id").primaryKey()` relleno con `crypto.randomUUID()`.
- **Convención Drizzle:** columna snake_case ↔ propiedad camelCase; `$type<>()` para uniones.
- **Auth:** patrón `const session = await auth(); if (!(await hasPermission(session, "<perm>"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });`.
- **`logActivity` es best-effort:** envuelve el insert en try/catch con `console.error`. NUNCA altera el flujo ni la respuesta de la mutación.
- **Actor:** pasar `session?.user?.id` y `session?.user?.name ?? null`. Para acciones públicas (reserva anónima, registro, reseña, RISC) pasar `null`/`null`.
- **Import en rutas instrumentadas:** `import { logActivity } from "@/lib/audit";`
- **Cada tarea termina con un commit propio.**
- Los cambios de funcionalidad obligan a actualizar `AGENTS.md`, `CHANGELOG.md` y `README.md` en el mismo commit (Task final + Task 11).

---

### Task 1: Tabla `activity_logs`, permiso `activityLog` y migración

**Files:**
- Modify: `src/db/schema.ts` (añadir tabla al final)
- Modify: `src/lib/permissions.ts`
- Generate: migración en `drizzle/` (vía drizzle-kit)

**Interfaces:**
- Consumes: nada.
- Produces: export `schema.activityLogs` (columnas: `id`, `actorId`, `actorName`, `entity`, `action`, `entityId`, `label`, `metadata`, `createdAt`), clave de permiso `"activityLog"`.

- [ ] **Step 1: Añadir la tabla al final de `src/db/schema.ts`**

```ts
export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id),
    actorName: text("actor_name"),
    entity: text("entity").notNull(),
    action: text("action").notNull(),
    entityId: text("entity_id"),
    label: text("label").notNull(),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("activity_logs_created_at_idx").on(t.createdAt),
    index("activity_logs_actor_idx").on(t.actorId),
    index("activity_logs_entity_idx").on(t.entity),
  ]
);
```

- [ ] **Step 2: Registrar el permiso en `src/lib/permissions.ts`**

En `PERMISSION_KEYS` añade `"activityLog"` al final del array y en `PERMISSION_LABELS` añade:

```ts
  activityLog: "Log de actividad",
```

- [ ] **Step 3: Generar y aplicar la migración**

Run: `npm run db:generate; if ($?) { npm run db:migrate }`

- [ ] **Step 4: Verificar el SQL generado**

Abre el nuevo archivo en `drizzle/` (p.ej. `drizzle/0021_activity_logs.sql`) y confirma que crea `activity_logs` y los 3 índices (`activity_logs_created_at_idx`, `activity_logs_actor_idx`, `activity_logs_entity_idx`). No debe haber ALTER TABLE.

- [ ] **Step 5: Verificar tipos y lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/lib/permissions.ts drizzle/
git commit -m "feat(db): tabla activity_logs y permiso activityLog"
```

---

### Task 2: Helper `src/lib/audit.ts` (logActivity, listActivityLogs, listActivityActors) + tests

**Files:**
- Create: `src/lib/audit.ts`
- Create: `src/lib/audit.test.ts`

**Interfaces:**
- Consumes: `schema.activityLogs` (Task 1), tipo de db `ReturnType<typeof drizzle<typeof schema>>`.
- Produces (los usan Tasks 3-11):

```ts
type AuditDb = ReturnType<typeof drizzle<typeof schema>>;

type AuditEntity =
  | "appointments" | "appointment_usage" | "course_sessions" | "course_enrollments"
  | "services" | "service_photos" | "gallery_photos" | "service_products"
  | "users" | "clients" | "admins" | "waitlist" | "blockouts" | "working_hours"
  | "purchases" | "payments" | "payment_receipts" | "exchange_rates"
  | "suppliers" | "expense_categories" | "bank_accounts" | "bills" | "supplier_payments"
  | "inventory_items" | "inventory_movements" | "risc_events"
  | "brand_settings" | "nav_items" | "legal_settings";

type AuditAction =
  | "create" | "update" | "delete" | "cancel" | "complete"
  | "approve" | "reject" | "report" | "adjust" | "enroll" | "unenroll" | "void";

function logActivity(dbc: AuditDb, params: {
  entity: AuditEntity;
  action: AuditAction;
  entityId?: string | null;
  label: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
}): void;

function listActivityLogs(dbc: AuditDb, filters?: {
  entity?: string | null;
  action?: string | null;
  actor?: string | null;
  from?: number | null;
  to?: number | null;
  q?: string | null;
  limit?: number;
  offset?: number;
}): { items: { id: string; actorId: string | null; actorName: string | null; entity: string; action: string; entityId: string | null; label: string; metadata: string | null; createdAt: number }[]; total: number; hasMore: boolean; nextOffset: number | null };

function listActivityActors(dbc: AuditDb): { actorId: string | null; actorName: string | null }[];

const AUDIT_ENTITIES: readonly AuditEntity[];
const AUDIT_ACTIONS: readonly AuditAction[];
```

> Nota: `AuditEntity` se expande respecto al spec con `brand_settings`, `nav_items` y `legal_settings` para cubrir los módulos de identidad/navegación/legal. `entityId` y `actorId` del retorno de `listActivityActors` corresponden a la columna `actor_id` (puede ser null cuando el actor es público).

- [ ] **Step 1: Escribir el test que falla** — `src/lib/audit.test.ts`

```ts
import { describe, test, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { logActivity, listActivityLogs, listActivityActors } from "./audit";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

function createAuditDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER,
      image TEXT,
      phone TEXT,
      address TEXT,
      password_hash TEXT,
      google_id TEXT,
      tech_notes TEXT,
      total_visits INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'client',
      permissions TEXT,
      locked_at INTEGER,
      locked_reason TEXT,
      created_at INTEGER
    );
    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id),
      actor_name TEXT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      label TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX activity_logs_created_at_idx ON activity_logs (created_at);
    CREATE INDEX activity_logs_actor_idx ON activity_logs (actor_id);
    CREATE INDEX activity_logs_entity_idx ON activity_logs (entity);
  `);
  return drizzle(sqlite, { schema });
}

function seedActor(db: TestDb, id: string, name: string) {
  db.insert(schema.users).values({
    id, name, email: `${id}@example.com`, role: "admin", createdAt: Date.now(),
  }).run();
}

describe("logActivity", () => {
  test("inserta una fila con actor, label y metadata", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana Martínez");
    logActivity(db, {
      entity: "appointments",
      action: "create",
      entityId: "appt-1",
      label: "Cita creada",
      metadata: { price: 35, currency: "USD" },
      actorId: "a-1",
      actorName: "Ana Martínez",
    });
    const rows = db.select().from(schema.activityLogs).all();
    expect(rows.length).toBe(1);
    expect(rows[0].actorId).toBe("a-1");
    expect(rows[0].actorName).toBe("Ana Martínez");
    expect(rows[0].entity).toBe("appointments");
    expect(rows[0].action).toBe("create");
    expect(rows[0].entityId).toBe("appt-1");
    expect(rows[0].label).toBe("Cita creada");
    expect(JSON.parse(rows[0].metadata ?? "null")).toEqual({ price: 35, currency: "USD" });
    expect(rows[0].createdAt).toBeGreaterThan(0);
  });

  test("permite actor público (null) y metadata null", () => {
    const db = createAuditDb();
    logActivity(db, {
      entity: "appointments",
      action: "create",
      label: "Reserva anónima",
      metadata: null,
      actorId: null,
      actorName: null,
    });
    const rows = db.select().from(schema.activityLogs).all();
    expect(rows[0].actorId).toBeNull();
    expect(rows[0].actorName).toBeNull();
    expect(rows[0].metadata).toBeNull();
  });

  test("no lanza cuando la tabla no existe (best-effort)", () => {
    const sqlite = new Database(":memory:");
    const db = drizzle(sqlite, { schema });
    expect(() =>
      logActivity(db as TestDb, { entity: "bills", action: "create", label: "x" })
    ).not.toThrow();
  });
});

describe("listActivityLogs", () => {
  test("ordena desc por createdAt y pagina con hasMore/nextOffset", () => {
    const db = createAuditDb();
    logActivity(db, { entity: "bills", action: "create", label: "A", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "bills", action: "create", label: "B", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "bills", action: "create", label: "C", actorId: "a-1", actorName: "Ana" });
    const r1 = listActivityLogs(db, { limit: 2, offset: 0 });
    expect(r1.items.map((i) => i.label)).toEqual(["C", "B"]);
    expect(r1.total).toBe(3);
    expect(r1.hasMore).toBe(true);
    expect(r1.nextOffset).toBe(2);
    const r2 = listActivityLogs(db, { limit: 2, offset: 2 });
    expect(r2.items.map((i) => i.label)).toEqual(["A"]);
    expect(r2.hasMore).toBe(false);
    expect(r2.nextOffset).toBeNull();
  });

  test("filtra por entity, action, actor y q", () => {
    const db = createAuditDb();
    logActivity(db, { entity: "bills", action: "create", label: "Factura F-1001", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "payments", action: "create", label: "Pago $35", actorId: "a-2", actorName: "Luisa" });
    expect(listActivityLogs(db, { entity: "bills", limit: 50 }).items.length).toBe(1);
    expect(listActivityLogs(db, { actor: "a-2", limit: 50 }).items[0].label).toBe("Pago $35");
    expect(listActivityLogs(db, { action: "create", q: "F-1001", limit: 50 }).items.length).toBe(1);
  });

  test("filtra por rango from/to", () => {
    const db = createAuditDb();
    db.insert(schema.activityLogs).values({
      id: "l1", entity: "bills", action: "create", label: "1", createdAt: 1000,
    }).run();
    db.insert(schema.activityLogs).values({
      id: "l2", entity: "bills", action: "create", label: "2", createdAt: 2000,
    }).run();
    const r = listActivityLogs(db, { from: 1500, to: 2500, limit: 50 });
    expect(r.items.map((i) => i.label)).toEqual(["2"]);
  });

  test("respeta límites máximo 200 y mínimo 1", () => {
    const db = createAuditDb();
    logActivity(db, { entity: "bills", action: "create", label: "x", actorId: "a-1", actorName: "Ana" });
    expect(listActivityLogs(db, { limit: 9999, offset: 0 }).items.length).toBe(1);
  });
});

describe("listActivityActors", () => {
  test("devuelve actores distintos ignorando actor null", () => {
    const db = createAuditDb();
    seedActor(db, "a-1", "Ana");
    seedActor(db, "a-2", "Luisa");
    logActivity(db, { entity: "bills", action: "create", label: "1", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "bills", action: "create", label: "2", actorId: "a-1", actorName: "Ana" });
    logActivity(db, { entity: "payments", action: "create", label: "3", actorId: "a-2", actorName: "Luisa" });
    logActivity(db, { entity: "payments", action: "create", label: "4", actorId: null, actorName: null });
    const actors = listActivityActors(db);
    expect(actors).toEqual([
      { actorId: "a-1", actorName: "Ana" },
      { actorId: "a-2", actorName: "Luisa" },
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm run test -- src/lib/audit.test.ts`
Expected: FAIL (módulo `./audit` no existe).

- [ ] **Step 3: Escribir `src/lib/audit.ts`**

```ts
import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

export type AuditDb = ReturnType<typeof drizzle<typeof schema>>;

export const AUDIT_ENTITIES = [
  "appointments", "appointment_usage", "course_sessions", "course_enrollments",
  "services", "service_photos", "gallery_photos", "service_products",
  "users", "clients", "admins", "waitlist", "blockouts", "working_hours",
  "purchases", "payments", "payment_receipts", "exchange_rates",
  "suppliers", "expense_categories", "bank_accounts", "bills", "supplier_payments",
  "inventory_items", "inventory_movements", "risc_events",
  "brand_settings", "nav_items", "legal_settings",
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTIONS = [
  "create", "update", "delete", "cancel", "complete",
  "approve", "reject", "report", "adjust", "enroll", "unenroll", "void",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type LogActivityParams = {
  entity: AuditEntity;
  action: AuditAction;
  entityId?: string | null;
  label: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
};

export function logActivity(dbc: AuditDb, params: LogActivityParams): void {
  try {
    let metadata: string | null = null;
    if (params.metadata != null) {
      try {
        metadata = JSON.stringify(params.metadata);
      } catch {
        metadata = null;
      }
    }
    dbc.insert(schema.activityLogs).values({
      id: crypto.randomUUID(),
      actorId: params.actorId ?? null,
      actorName: params.actorName ?? null,
      entity: params.entity,
      action: params.action,
      entityId: params.entityId ?? null,
      label: params.label,
      metadata,
      createdAt: Math.floor(Date.now() / 1000),
    }).run();
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export type ActivityLogFilters = {
  entity?: string | null;
  action?: string | null;
  actor?: string | null;
  from?: number | null;
  to?: number | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

export function listActivityLogs(dbc: AuditDb, filters: ActivityLogFilters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const conditions: SQL[] = [];
  if (filters.entity) conditions.push(eq(schema.activityLogs.entity, filters.entity));
  if (filters.action) conditions.push(eq(schema.activityLogs.action, filters.action));
  if (filters.actor) conditions.push(eq(schema.activityLogs.actorId, filters.actor));
  if (filters.from != null) conditions.push(sql`${schema.activityLogs.createdAt} >= ${filters.from}`);
  if (filters.to != null) conditions.push(sql`${schema.activityLogs.createdAt} <= ${filters.to}`);
  if (filters.q && filters.q.trim()) {
    conditions.push(like(schema.activityLogs.label, `%${filters.q.trim()}%`));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const total =
    dbc.select({ n: sql<number>`count(*)` }).from(schema.activityLogs).where(where).get()?.n ?? 0;
  const items = dbc
    .select({
      id: schema.activityLogs.id,
      actorId: schema.activityLogs.actorId,
      actorName: schema.activityLogs.actorName,
      entity: schema.activityLogs.entity,
      action: schema.activityLogs.action,
      entityId: schema.activityLogs.entityId,
      label: schema.activityLogs.label,
      metadata: schema.activityLogs.metadata,
      createdAt: schema.activityLogs.createdAt,
    })
    .from(schema.activityLogs)
    .where(where)
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  const hasMore = offset + items.length < total;
  return { items, total, hasMore, nextOffset: hasMore ? offset + items.length : null };
}

export function listActivityActors(dbc: AuditDb) {
  return dbc
    .select({
      actorId: schema.activityLogs.actorId,
      actorName: schema.activityLogs.actorName,
    })
    .from(schema.activityLogs)
    .where(sql`${schema.activityLogs.actorId} is not null`)
    .groupBy(schema.activityLogs.actorId)
    .all();
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm run test -- src/lib/audit.test.ts`
Expected: PASS (4 describes, 9 tests).

- [ ] **Step 5: typecheck + lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit.ts src/lib/audit.test.ts
git commit -m "feat(audit): helper logActivity + consulta con filtros y tests"
```

---

### Task 3: Endpoints `GET /api/activity-logs` y `GET /api/activity-logs/actors`

**Files:**
- Create: `src/app/api/activity-logs/route.ts`
- Create: `src/app/api/activity-logs/actors/route.ts`

**Interfaces:**
- Consumes: `hasPermission` de `@/lib/authz`, `listActivityLogs`/`listActivityActors` de `@/lib/audit`, `db` de `@/db/index`.
- Produces: endpoints consultados por la UI (Task 4).

- [ ] **Step 1: Crear `src/app/api/activity-logs/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { listActivityLogs } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "activityLog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const result = listActivityLogs(db, {
    entity: sp.get("entity"),
    action: sp.get("action"),
    actor: sp.get("actor"),
    from: from ? Number(from) : null,
    to: to ? Number(to) : null,
    q: sp.get("q"),
    limit: Number(sp.get("limit")) || 50,
    offset: Number(sp.get("offset")) || 0,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Crear `src/app/api/activity-logs/actors/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { listActivityActors } from "@/lib/audit";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "activityLog"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(listActivityActors(db));
}
```

- [ ] **Step 3: typecheck + lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/activity-logs/
git commit -m "feat(audit): endpoints GET activity-logs y actors"
```

---

### Task 4: Página `/dashboard/activity` + nav item

**Files:**
- Create: `src/app/(admin)/dashboard/activity/page.tsx`
- Create: `src/app/(admin)/dashboard/activity/ActivityLogContent.tsx`
- Modify: `src/app/(admin)/layout.tsx` (NAV_ITEMS)

**Interfaces:**
- Consumes: `GET /api/activity-logs`, `GET /api/activity-logs/actors`, permiso `activityLog`.
- Produces: página visible para admins con el permiso.

- [ ] **Step 1: Crear `src/app/(admin)/dashboard/activity/page.tsx`** (patrón de `balances/page.tsx`)

```tsx
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/authz";
import { redirect } from "next/navigation";
import { ActivityLogContent } from "./ActivityLogContent";

export default async function ActivityPage() {
  const session = await auth();
  if (!(await hasPermission(session, "activityLog"))) redirect("/");
  return <ActivityLogContent />;
}
```

- [ ] **Step 2: Crear `src/app/(admin)/dashboard/activity/ActivityLogContent.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

type ActivityItem = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  entity: string;
  action: string;
  entityId: string | null;
  label: string;
  metadata: string | null;
  createdAt: number;
};

const ACTION_STYLES: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  cancel: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700",
  approve: "bg-emerald-100 text-emerald-700",
  reject: "bg-red-100 text-red-700",
  report: "bg-purple-100 text-purple-700",
  adjust: "bg-amber-100 text-amber-700",
  enroll: "bg-cyan-100 text-cyan-700",
  unenroll: "bg-orange-100 text-orange-700",
  void: "bg-gray-200 text-gray-600",
};

const ENTITY_LABELS: Record<string, string> = {
  appointments: "Citas",
  course_sessions: "Sesiones de curso",
  course_enrollments: "Inscripciones a curso",
  services: "Servicios",
  service_photos: "Fotos de servicio",
  gallery_photos: "Fotos del muro",
  service_products: "Uso por servicio",
  users: "Usuarios",
  clients: "Clientes",
  admins: "Admins",
  waitlist: "Lista de espera",
  blockouts: "Bloqueos",
  working_hours: "Horario",
  purchases: "Servicios realizados",
  payments: "Pagos",
  payment_receipts: "Capturas de pago",
  exchange_rates: "Tasas",
  suppliers: "Proveedores",
  expense_categories: "Categorías de gasto",
  bank_accounts: "Bancos",
  bills: "Facturas",
  supplier_payments: "Pagos a proveedores",
  inventory_items: "Inventario",
  inventory_movements: "Movimientos de inventario",
  risc_events: "Seguridad (RISC)",
  brand_settings: "Identidad",
  nav_items: "Navegación",
  legal_settings: "Legal",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Actualización",
  delete: "Borrado",
  cancel: "Cancelación",
  complete: "Completar",
  approve: "Aprobación",
  reject: "Rechazo",
  report: "Reporte",
  adjust: "Ajuste",
  enroll: "Inscripción",
  unenroll: "Baja",
  void: "Anulación",
};

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityLogContent() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actors, setActors] = useState<{ actorId: string; actorName: string | null }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState({ entity: "", action: "", actor: "", from: "", to: "", q: "" });
  const [filters, setFilters] = useState(draft);

  const runQuery = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.entity) params.set("entity", filters.entity);
        if (filters.action) params.set("action", filters.action);
        if (filters.actor) params.set("actor", filters.actor);
        if (filters.from)
          params.set("from", String(Math.floor(new Date(`${filters.from}T00:00:00`).getTime() / 1000)));
        if (filters.to)
          params.set("to", String(Math.floor(new Date(`${filters.to}T23:59:59`).getTime() / 1000)));
        if (filters.q.trim()) params.set("q", filters.q.trim());
        params.set("limit", "50");
        params.set("offset", String(nextOffset));
        const res = await fetch(`/api/activity-logs?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setItems((prev) => (nextOffset === 0 ? data.items : [...prev, ...data.items]));
        setOffset(data.nextOffset ?? nextOffset + data.items.length);
        setHasMore(data.hasMore);
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void runQuery(0);
  }, [runQuery]);

  useEffect(() => {
    const onRefresh = () => void runQuery(0);
    window.addEventListener("activity:refresh", onRefresh);
    return () => window.removeEventListener("activity:refresh", onRefresh);
  }, [runQuery]);

  useEffect(() => {
    fetch("/api/activity-logs/actors")
      .then((r) => r.json())
      .then((data) => setActors(Array.isArray(data) ? data : []))
      .catch(() => setActors([]));
  }, []);

  const selectCls =
    "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700";
  const inputCls = `${selectCls} w-full max-w-[10rem]`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Log de actividad</h1>
        <span className="text-sm text-gray-500">{total} registros</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-3">
        <select
          className={selectCls}
          value={draft.entity}
          onChange={(e) => setDraft({ ...draft, entity: e.target.value })}
        >
          <option value="">Todas las entidades</option>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={draft.action}
          onChange={(e) => setDraft({ ...draft, action: e.target.value })}
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className={selectCls}
          value={draft.actor}
          onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
        >
          <option value="">Todos los usuarios</option>
          {actors.map((a) => (
            <option key={a.actorId} value={a.actorId}>{a.actorName ?? "Usuario"}</option>
          ))}
        </select>
        <input
          type="date"
          className={inputCls}
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <input
          type="date"
          className={inputCls}
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <input
          type="text"
          placeholder="Buscar por detalle…"
          className={inputCls}
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
        <button
          onClick={() => setFilters(draft)}
          className="rounded-lg bg-pink-main px-3 py-1.5 text-sm font-medium text-gray-900 hover:opacity-90"
        >
          Filtrar
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <FragmentRow
                  key={it.id}
                  item={it}
                  expanded={expanded === it.id}
                  onToggle={() => setExpanded(expanded === it.id ? null : it.id)}
                />
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Sin registros con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => void runQuery(offset)}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  item,
  expanded,
  onToggle,
}: {
  item: ActivityItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  let parsed: unknown = null;
  if (item.metadata) {
    try {
      parsed = JSON.parse(item.metadata);
    } catch {
      parsed = item.metadata;
    }
  }
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-gray-50 hover:bg-gray-50"
      >
        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(item.createdAt)}</td>
        <td className="px-3 py-2 font-medium text-gray-900">{item.actorName ?? "—"}</td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              ACTION_STYLES[item.action] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {ACTION_LABELS[item.action] ?? item.action}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-600">{ENTITY_LABELS[item.entity] ?? item.entity}</td>
        <td className="px-3 py-2 text-gray-800">{item.label}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-3 py-3">
            <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">
              {parsed == null ? "Sin metadatos." : JSON.stringify(parsed, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 3: Añadir el nav item en `src/app/(admin)/layout.tsx`**

En `NAV_ITEMS`, justo antes de la entrada de Admins:

```ts
  { href: "/dashboard/activity", label: "Actividad", icon: "🧾", perm: "activityLog" },
```

- [ ] **Step 4: typecheck + lint**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 5: Verificación manual**

Arranca dev (`npm run dev:default`), entra como superadmin (ADMIN_EMAIL), confirma que el sidebar muestra "Actividad 🧾" y que `/dashboard/activity` carga sin errores. Con el log aún vacío muestra "Sin registros".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/dashboard/activity/"
git add "src/app/(admin)/layout.tsx"
git commit -m "feat(audit): página de log de actividad en el dashboard"
```

---

### Task 5: Instrumentar agenda y citas

**Files:** (ruta → import + llamada `logActivity`)
- Modify: `src/app/api/appointments/route.ts` (POST)
- Modify: `src/app/api/appointments/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/appointments/[id]/review/route.ts` (POST)
- Modify: `src/app/api/appointments/[id]/final-photos/route.ts` (POST, DELETE)
- Modify: `src/app/api/course-sessions/route.ts` (POST)
- Modify: `src/app/api/course-sessions/[id]/enrollments/route.ts` (POST, DELETE)
- Modify: `src/app/api/blockouts/route.ts` (POST)
- Modify: `src/app/api/blockouts/[id]/route.ts` (DELETE)
- Modify: `src/app/api/working-hours/route.ts` (PUT)

**Interfaces:**
- Consumes: `logActivity(db, params)` de `@/lib/audit` (Task 2).
- Produces: nada; solo logging.
- Para cada una: **Step A:** leer el archivo y añadir `import { logActivity } from "@/lib/audit";` en el bloque de imports. **Step B:** insertar el snippet indicado justo antes de la línea de `return NextResponse.json(...)` de éxito. Si el archivo no tiene una variable con el nombre indicado, busca la fila equivalente ya leída en el handler (nunca asumas; léela). Después de cada ruta: `npx tsc --noEmit` y el commit del grupo al final.

#### 5a. `POST /api/appointments` (crear cita)

`appointment` (objeto insertado, contiene `id`, `clientId`, `startTime`, `endTime`), `service` (fila completa, tiene `name` y `price`), `targetClientId` y `session` están en scope. Antes de `return NextResponse.json({ id: appointment.id });`:

```ts
  {
    const clientRow = db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, targetClientId))
      .get();
    logActivity(db, {
      entity: "appointments",
      action: "create",
      entityId: appointment.id,
      label: `Cita creada: ${clientRow?.name ?? "Cliente"} – ${service.name}`,
      metadata: { startTime, endTime, serviceId, servicePrice: service.price, createdByAdmin: Boolean(clientId) },
      actorId: session.user.id,
      actorName: session?.user?.name ?? null,
    });
  }
```

Nota: `eq` y `schema.users` ya están importados en este archivo.

#### 5b. `PATCH /api/appointments/[id]` (actualizar/completar)

`appointment` (fila completa leída), `status`, `startTime`, `shareToGallery`, `session` en scope. Antes de `return NextResponse.json({ success: true });`:

```ts
  {
    if (status === "completed" && appointment.status !== "completed") {
      logActivity(db, {
        entity: "appointments",
        action: "complete",
        entityId: appointment.id,
        label: `Cita completada`,
        metadata: { appointmentId: appointment.id },
        actorId: session?.user?.id,
        actorName: session?.user?.name ?? null,
      });
    } else {
      logActivity(db, {
        entity: "appointments",
        action: "update",
        entityId: appointment.id,
        label: `Cita actualizada`,
        metadata: { status, startTime, shareToGallery },
        actorId: session?.user?.id,
        actorName: session?.user?.name ?? null,
      });
    }
  }
```

#### 5c. `DELETE /api/appointments/[id]` (cancelar)

`appointment`, `service`, `purchase` (snapshot), `session` en scope. Antes de `return NextResponse.json({ success: true, deleted: true });`:

```ts
  {
    const clientRow = db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, appointment.clientId))
      .get();
    logActivity(db, {
      entity: "appointments",
      action: "cancel",
      entityId: appointment.id,
      label: `Cita cancelada: ${clientRow?.name ?? "Cliente"} – ${purchase?.serviceName ?? service?.name ?? "Servicio"}`,
      metadata: { startTime: appointment.startTime, servicePrice: purchase?.servicePrice ?? service?.price ?? 0, cancelledBy: session.user.id },
      actorId: session.user.id,
      actorName: session?.user?.name ?? null,
    });
  }
```

#### 5d. `POST /api/appointments/[id]/review` (reseña pública)

Sin sesión; actor null. Antes de `return NextResponse.json({ success: true });`:

```ts
  logActivity(db, {
    entity: "appointments",
    action: "update",
    entityId: id,
    label: `Reseña publicada con ${rating} estrellas`,
    metadata: { rating, text },
    actorId: null,
    actorName: null,
  });
```

Nota: añade `import { logActivity } from "@/lib/audit";` — este archivo NO importa `db` ni `schema` actualmente (usa solo `@/db/index` de forma indirecta). Revisa los imports: debe quedar `import { db, schema } from "@/db/index";`.

#### 5e. `POST /api/appointments/[id]/final-photos` (subir fotos finales)

`created` (array de fotos creadas), `id`, `session` en scope. Antes de `return NextResponse.json({ success: true, created });`:

```ts
  logActivity(db, {
    entity: "appointments",
    action: "update",
    entityId: id,
    label: `Fotos finales agregadas a la cita`,
    metadata: { appointmentId: id, photoCount: created.length },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 5f. `DELETE /api/appointments/[id]/final-photos` (borrar foto final)

`photo` (fila leída), `id`, `session` en scope. Antes de `return NextResponse.json({ success: true });`:

```ts
  logActivity(db, {
    entity: "appointments",
    action: "update",
    entityId: id,
    label: `Foto final eliminada de la cita`,
    metadata: { appointmentId: id, photoId, url: photo.url },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 5g. `POST /api/course-sessions` (crear sesión de curso)

`appointmentId`, `service` (fila, tiene `name`, `price`), `ids` (alumnos), `startTime`, `endTime`, `session` en scope. Antes de `return NextResponse.json({ id: appointmentId });`:

```ts
  logActivity(db, {
    entity: "course_sessions",
    action: "create",
    entityId: appointmentId,
    label: `Sesión de curso creada: ${service.name} (${ids.length} alumno${ids.length === 1 ? "" : "s"})`,
    metadata: { startTime, endTime, clientIds: ids, pricePerPupil: service.price },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 5h. `POST /api/course-sessions/[id]/enrollments` (inscribir alumno)

Lee el archivo `src/app/api/course-sessions/[id]/enrollments/route.ts`. El handler recibe `clientId` del body y valida la sesión (variable con la fila del appointment, probablemente `session` del curso o `appointment`) y el alumno (`client`). Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "course_enrollments",
    action: "enroll",
    entityId: `${appointmentId}:${clientId}`,
    label: `Alumno ${client?.name ?? clientId} inscrito al curso`,
    metadata: { appointmentId, clientId },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

Adapta `appointmentId` al nombre real de la variable del id de la sesión y `client` al nombre real de la fila del alumno leída.

#### 5i. `DELETE /api/course-sessions/[id]/enrollments` (dar baja a alumno)

Mismo archivo. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "course_enrollments",
    action: "unenroll",
    entityId: `${appointmentId}:${clientId}`,
    label: `Alumno ${client?.name ?? clientId} dado de baja del curso`,
    metadata: { appointmentId, clientId },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 5j. `POST /api/blockouts` (crear bloqueo)

Lee `src/app/api/blockouts/route.ts`. La fila insertada se llama `blockout` (contiene `id`, `startTime`, `endTime`, `reason`) o el objeto se construye en línea. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "blockouts",
    action: "create",
    entityId: blockout.id,
    label: `Bloqueo creado: ${blockout.reason ?? "sin motivo"}`,
    metadata: { startTime: blockout.startTime, endTime: blockout.endTime },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 5k. `DELETE /api/blockouts/[id]` (borrar bloqueo)

Lee `src/app/api/blockouts/[id]/route.ts`. La fila leída se llama `blockout`. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "blockouts",
    action: "delete",
    entityId: blockout.id,
    label: `Bloqueo eliminado: ${blockout.reason ?? "sin motivo"}`,
    metadata: { startTime: blockout.startTime, endTime: blockout.endTime },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 5l. `PUT /api/working-hours` (actualizar horario)

Lee `src/app/api/working-hours/route.ts`. El body contiene el horario por día (`body.schedule` o similar; si name varía, úsala). Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "working_hours",
    action: "update",
    label: "Horario de trabajo actualizado",
    metadata: schedule,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

- [ ] **Step 2: Verificar el grupo**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/appointments/ src/app/api/course-sessions/ src/app/api/blockouts/ src/app/api/working-hours/
git commit -m "feat(audit): log en citas, cursos, blockouts y horario"
```

---

### Task 6: Instrumentar clientes, espera, perfil y registro

**Files:**
- Modify: `src/app/api/clients/route.ts` (POST)
- Modify: `src/app/api/clients/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/waitlist/route.ts` (POST)
- Modify: `src/app/api/waitlist/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/profile/route.ts` (PATCH)
- Modify: `src/app/api/auth/register/route.ts` (POST)

**Interfaces:**
- Consumes: `logActivity(db, params)`.
- Produces: nada.

#### 6a. `POST /api/clients` (crear cliente)

Lee `src/app/api/clients/route.ts`. La fila creada tiene `id` y `name`; si el insert construye el objeto como `client` úsalo. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "clients",
    action: "create",
    entityId: client.id,
    label: `Cliente creado: ${client.name}`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

(Usa el objeto real que contiene id/name; si se llama distinto, adapta.)

#### 6b. `PATCH /api/clients/[id]` (editar cliente)

La fila leída se llama `client`. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "clients",
    action: "update",
    entityId: client.id,
    label: `Cliente actualizado: ${client.name}`,
    metadata: body.data,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

(Usa el objeto real del body que contenga los campos editados; si el handler lo normaliza, pasar eso.)

#### 6c. `DELETE /api/clients/[id]` (borrar cliente)

Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "clients",
    action: "delete",
    entityId: client.id,
    label: `Cliente eliminado: ${client.name}`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 6d. `POST /api/waitlist` (unirse a la espera)

Lee `src/app/api/waitlist/route.ts`. La fila insertada contiene `clientId` y `preferredDate`. Session puede ser anónimo o cliente autenticado (`session?.user?.id`). Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "waitlist",
    action: "create",
    entityId: entry.id,
    label: `Cliente en lista de espera (${new Date(preferredDate * 1000).toISOString().slice(0, 10)})`,
    metadata: { preferredDate },
    actorId: session?.user?.id ?? entry.clientId,
    actorName: session?.user?.name ?? null,
  });
```

#### 6e. `PATCH /api/waitlist/[id]` (marcar notificado)

La fila leída se llama `entry`. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "waitlist",
    action: "update",
    entityId: entry.id,
    label: "Cliente de la espera marcado como notificado",
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 6f. `DELETE /api/waitlist/[id]` (salir de la espera)

Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "waitlist",
    action: "delete",
    entityId: entry.id,
    label: "Entrada de lista de espera eliminada",
    actorId: session?.user?.id ?? entry.clientId,
    actorName: session?.user?.name ?? null,
  });
```

#### 6g. `PATCH /api/profile` (editar perfil propio)

Lee `src/app/api/profile/route.ts`. Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "users",
    action: "update",
    entityId: session?.user?.id,
    label: "Perfil actualizado",
    metadata: body,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

(Usa el objeto real de campos editados del body.)

#### 6h. `POST /api/auth/register` (registro)

Lee `src/app/api/auth/register/route.ts`. Contiene `email` y el nuevo `userId`. Sin sesión (actor null). Antes de la respuesta de éxito:

```ts
  logActivity(db, {
    entity: "users",
    action: "create",
    entityId: userId,
    label: `Nuevo registro: ${email}`,
    metadata: { email },
    actorId: null,
    actorName: null,
  });
```

(Usa los nombres reales de `userId` y `email` en scope del handler.)

- [ ] **Step 2: Verificar el grupo**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/clients/ src/app/api/waitlist/ src/app/api/profile/ src/app/api/auth/register/
git commit -m "feat(audit): log en clientes, espera, perfil y registro"
```

---

### Task 7: Instrumentar CXC, pagos y tasas

**Files:**
- Modify: `src/app/api/purchases/route.ts` (POST)
- Modify: `src/app/api/purchases/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/payments/route.ts` (POST)
- Modify: `src/app/api/payments/[id]/route.ts` (DELETE)
- Modify: `src/app/api/payment-receipts/route.ts` (POST)
- Modify: `src/app/api/payment-receipts/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/exchange-rate/route.ts` (POST)
- Modify: `src/app/api/exchange-rate/[id]/route.ts` (DELETE)

**Interfaces:**
- Consumes: `logActivity(db, params)`.
- Produces: nada.

#### 7a. `POST /api/purchases` (servicio realizado) — YA LEÍDA

`client` (fila completa, `name`), `service` (fila, `name`), `purchaseId`, `finalPrice`, `completionDate` en scope. Antes de `return NextResponse.json({ success: true, id: purchaseId }, { status: 201 });`:

```ts
  logActivity(db, {
    entity: "purchases",
    action: "create",
    entityId: purchaseId,
    label: `Servicio realizado: ${client.name} – ${service.name}`,
    metadata: { price: finalPrice, completionDate },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 7b. `POST /api/payments` (registrar pago) — YA LEÍDA

`payment` (objeto insertado con `id`, `amountUsd`, `currency`), `userId` en scope. Antes de `return NextResponse.json(payment);`:

```ts
  {
    const clientName = db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get()?.name ?? "Cliente";
    logActivity(db, {
      entity: "payments",
      action: "create",
      entityId: payment.id,
      label: `Pago registrado: ${clientName} – $${usd} (${cur})`,
      metadata: { usd, currency: cur, amountVes, rate: effectiveRate, appointmentId: payment.appointmentId },
      actorId: adminId,
      actorName: session?.user?.name ?? null,
    });
  }
```

#### 7c. `PATCH /api/payment-receipts/[id]` (aprobar/rechazar) — YA LEÍDA

`receipt` (fila), `action`, `notes`, `session` en scope. Antes de cada return de éxito (tras `reject` insertar log; tras `approve` insertar log):

```ts
  logActivity(db, {
    entity: "payment_receipts",
    action: action === "approve" ? "approve" : "reject",
    entityId: receipt.id,
    label: `Captura de pago ${action === "approve" ? "aprobada" : "rechazada"}: $${receipt.amountUsd}`,
    metadata: { amountVes: receipt.amountVes, rate: receipt.rate, notes },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

Insértalo dentro del bloque `if (action === "approve")` **y** dentro del bloque `if (action === "reject")`, justo antes de su `return`.

#### 7d. `DELETE /api/payment-receipts/[id]` (borrar captura pendiente) — YA LEÍDA

Antes de `return NextResponse.json({ success: true });`:

```ts
  logActivity(db, {
    entity: "payment_receipts",
    action: "delete",
    entityId: receipt.id,
    label: `Captura de pago eliminada: $${receipt.amountUsd}`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

#### 7e. Resto de rutas (leer archivo → adaptar variables reales)

- `DELETE /api/payments/[id]`: fila leída `payment`. Antes del return de éxito:
```ts
  logActivity(db, {
    entity: "payments",
    action: "delete",
    entityId: payment.id,
    label: `Pago eliminado: $${payment.amountUsd} (${payment.currency})`,
    metadata: { userId: payment.userId, amountVes: payment.amountVes },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```
- `POST /api/payment-receipts` (reporte de captura, cliente): fila insertada `receipt` (contiene `id`, `amountUsd`, `amountVes`). Antes del return de éxito:
```ts
  logActivity(db, {
    entity: "payment_receipts",
    action: "report",
    entityId: receipt.id,
    label: `Captura de pago reportada: $${receipt.amountUsd} (${receipt.amountVes} Bs)`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```
- `PATCH /api/purchases/[id]`: fila leída `purchase` (contiene `serviceName`, `servicePrice`). Antes del return de éxito:
```ts
  logActivity(db, {
    entity: "purchases",
    action: "update",
    entityId: purchase.id,
    label: `Servicio realizado actualizado: ${purchase.serviceName}`,
    metadata: body,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```
- `DELETE /api/purchases/[id]`: fila leída `purchase`. Antes del return de éxito:
```ts
  logActivity(db, {
    entity: "purchases",
    action: "delete",
    entityId: purchase.id,
    label: `Servicio realizado eliminado: ${purchase.serviceName}`,
    metadata: { price: purchase.servicePrice },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```
- `POST /api/exchange-rate` (tasa manual): fila insertada/actualizada con `id` y `rate`. Antes del return de éxito:
```ts
  logActivity(db, {
    entity: "exchange_rates",
    action: "create",
    entityId: row.id,
    label: `Tasa registrada: Bs ${row.rate} (${row.date})`,
    metadata: { date: row.date, rate: row.rate, source: row.source },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```
- `DELETE /api/exchange-rate/[id]`: fila leída con `date`/`rate`. Antes del return de éxito:
```ts
  logActivity(db, {
    entity: "exchange_rates",
    action: "delete",
    entityId: id,
    label: `Tasa eliminada`,
    metadata: { date, rate },
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });
```

**Fuera de este task (no se loguean):** `GET /api/exchange-rate/refresh` (cron sin actor definido).

- [ ] **Step 2: Verificar el grupo**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/purchases/ src/app/api/payments/ src/app/api/payment-receipts/ src/app/api/exchange-rate/
git commit -m "feat(audit): log en CXC, pagos y tasas"
```

---

### Task 8: Instrumentar compras y cuentas por pagar

**Files:**
- Modify: `src/app/api/suppliers/route.ts` (POST)
- Modify: `src/app/api/suppliers/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/expense-categories/route.ts` (POST)
- Modify: `src/app/api/expense-categories/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/bank-accounts/route.ts` (POST)
- Modify: `src/app/api/bank-accounts/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/bills/route.ts` (POST) — YA LEÍDA
- Modify: `src/app/api/bills/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/supplier-payments/route.ts` (POST)
- Modify: `src/app/api/supplier-payments/[id]/route.ts` (DELETE)

**Interfaces:**
- Consumes: `logActivity(db, params)`.
- Produces: nada.

#### 8a. `POST /api/bills` (factura) — YA LEÍDA

`bill` (objeto insertado con `id`, `invoiceNumber`, `type`, `currency`, `amountVes`, `totalUsd`), `adminId`, `body` en scope. Antes de `return NextResponse.json(bill, { status: 201 });`:

```ts
  {
    const supplierName = bill.supplierId
      ? db.select({ name: schema.suppliers.name }).from(schema.suppliers).where(eq(schema.suppliers.id, bill.supplierId)).get()?.name
      : null;
    logActivity(db, {
      entity: "bills",
      action: "create",
      entityId: bill.id,
      label: `Factura ${bill.invoiceNumber ? `N° ${bill.invoiceNumber}` : "sin N°"} creada (${bill.currency === "VES" ? `${bill.amountVes} Bs` : `$${bill.totalUsd}`})${supplierName ? ` – ${supplierName}` : ""}`,
      metadata: { type: bill.type, currency: bill.currency, totalUsd: bill.totalUsd, supplierId: bill.supplierId },
      actorId: adminId,
      actorName: session?.user?.name ?? null,
    });
  }
```

#### 8b. Resto de rutas (leer archivo → adaptar variables reales)

Patrón: las rutas `suppliers`/`expense-categories`/`bank-accounts`/`bills/[id]`/`supplier-payments` leen la fila afectada (nombrándola `supplier`, `category`, `account`, `bill`, `payment` según el caso) y devuelven `{ success: true }` o la fila. Inserta el `logActivity` correspondiente justo antes de cada return de éxito:

- `POST /api/suppliers`: `entity: "suppliers"`, `action: "create"`, `entityId: supplier.id`, `label: `Proveedor creado: ${supplier.name}``.
- `PATCH /api/suppliers/[id]`: `action: "update"`, `label: `Proveedor actualizado: ${supplier.name}``.
- `DELETE /api/suppliers/[id]`: `action: "delete"`, `label: `Proveedor eliminado: ${supplier.name}``.
- `POST /api/expense-categories`: `entity: "expense_categories"`, `create`, `label: `Categoría creada: ${category.name}``.
- `PATCH /api/expense-categories/[id]`: `update`, `label: `Categoría actualizada: ${category.name}``.
- `DELETE /api/expense-categories/[id]`: `delete`, `label: `Categoría eliminada: ${category.name}``.
- `POST /api/bank-accounts`: `entity: "bank_accounts"`, `create`, `label: `Banco creado: ${account.bankName} (${account.currency})``.
- `PATCH /api/bank-accounts/[id]`: `update`, `label: `Banco actualizado: ${account.bankName}``.
- `DELETE /api/bank-accounts/[id]`: `delete`, `label: `Banco eliminado: ${account.bankName}``.
- `PATCH /api/bills/[id]`: `entity: "bills"`, `update`, `entityId: bill.id`, `label: `Factura ${bill.invoiceNumber ?? "sin N°"} actualizada``, `metadata: body`.
- `DELETE /api/bills/[id]`: `delete`, `entityId: bill.id`, `label: `Factura ${bill.invoiceNumber ?? "sin N°"} eliminada``, `metadata: { totalUsd: bill.totalUsd, type: bill.type }`.
- `POST /api/supplier-payments`: `entity: "supplier_payments"`, `create`, `entityId: payment.id`, `label: `Pago a proveedor registrado: $${payment.totalUsd}` (usa `amountUsd` si está disponible: `$${payment.amountUsd}`)`, `metadata: { billId, currency, amountVes, rate }`.
- `DELETE /api/supplier-payments/[id]`: `delete`, `entityId: payment.id`, `label: `Pago a proveedor eliminado: $${payment.amountUsd}``.

En TODOS los snippets de este task añade `actorId: session?.user?.id` y `actorName: session?.user?.name ?? null`.

- [ ] **Step 2: Verificar el grupo**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/suppliers/ src/app/api/expense-categories/ src/app/api/bank-accounts/ src/app/api/bills/ src/app/api/supplier-payments/
git commit -m "feat(audit): log en compras y cuentas por pagar"
```

---

### Task 9: Instrumentar inventario, servicios y muro

**Files:**
- Modify: `src/app/api/inventory/items/route.ts` (POST)
- Modify: `src/app/api/inventory/items/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/inventory/items/[id]/movements/route.ts` (POST)
- Modify: `src/app/api/service-products/route.ts` (PUT)
- Modify: `src/app/api/services/route.ts` (POST)
- Modify: `src/app/api/services/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/services/[id]/photos/route.ts` (POST)
- Modify: `src/app/api/services/[id]/photos/[photoId]/route.ts` (DELETE)
- Modify: `src/app/api/gallery-photos/route.ts` (POST)
- Modify: `src/app/api/gallery-photos/[id]/route.ts` (DELETE)

**Interfaces:**
- Consumes: `logActivity(db, params)`.
- Produces: nada.

Snippets (leen el archivo → adaptan variable real): cada fila afectada se llama según el recurso (`item`, `movement`, `service`, `photo`, `galleryPhoto`). Añade `actorId: session?.user?.id` y `actorName: session?.user?.name ?? null` en todos.

- `POST /api/inventory/items`: `entity: "inventory_items"`, `create`, `entityId: item.id`, `label: `Producto creado: ${item.name ?? item.code}` (usa `code` si existe)`, `metadata: { code: item.code, price: item.avgCost ?? item.price }` (usa los campos reales: `code`, `name`, `avgCost`).
- `PATCH /api/inventory/items/[id]`: `update`, `entityId: item.id`, `label: `Producto actualizado: ${item.name}``, `metadata: body`.
- `DELETE /api/inventory/items/[id]`: `delete`, `entityId: item.id`, `label: `Producto eliminado: ${item.name}``.
- `POST /api/inventory/items/[id]/movements` (salida/ajuste manual): `entity: "inventory_movements"`, `action: "adjust"`, `entityId: movement.id`, `label: `Movimiento de inventario: ${movement.kind === "in" ? "entrada" : movement.kind === "out" ? "salida" : "ajuste"} de ${Math.abs(movement.quantity)} ${item.name ?? ""}``, `metadata: { kind: movement.kind, quantity: movement.quantity, notes: movement.notes }`.
- `PUT /api/service-products` (uso de inventario por servicio): `entity: "service_products"`, `update`, `label: "Uso de inventario por servicio actualizado"`, `metadata: body`.
- `POST /api/services`: `entity: "services"`, `create`, `entityId: service.id`, `label: `Servicio creado: ${service.name}``, `metadata: { price: service.price, durationMins: service.durationMins, isGroup: service.isGroup }`.
- `PATCH /api/services/[id]`: `update`, `entityId: service.id`, `label: `Servicio actualizado: ${service.name}``, `metadata: body`.
- `DELETE /api/services/[id]`: `delete`, `entityId: service.id`, `label: `Servicio eliminado: ${service.name}``.
- `POST /api/services/[id]/photos`: `entity: "service_photos"`, `create`, `entityId: photo.id`, `label: "Foto agregada al servicio"`, `metadata: { serviceId: id, position }`.
- `DELETE /api/services/[id]/photos/[photoId]`: `entity: "service_photos"`, `delete`, `entityId: photoId`, `label: "Foto eliminada del servicio"`, `metadata: { serviceId: id }`.
- `POST /api/gallery-photos`: `entity: "gallery_photos"`, `create`, `entityId: photo.id`, `label: "Foto subida al muro de inspiración"`, `metadata: { serviceId, caption }`.
- `DELETE /api/gallery-photos/[id]`: `entity: "gallery_photos"`, `delete`, `entityId: photo.id`, `label: "Foto eliminada del muro"`.

- [ ] **Step 2: Verificar el grupo**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/inventory/ src/app/api/service-products/ src/app/api/services/ src/app/api/gallery-photos/
git commit -m "feat(audit): log en inventario, servicios y muro"
```

---

### Task 10: Instrumentar admins, configuración y seguridad

**Files:**
- Modify: `src/app/api/admins/route.ts` (POST, DELETE)
- Modify: `src/app/api/admins/[id]/route.ts` (PATCH) — si existe como ruta dinámica; si el PATCH vive en `admins/route.ts` ajusta el archivo.
- Modify: `src/app/api/brand/route.ts` (PUT)
- Modify: `src/app/api/admin/nav-items/route.ts` (PUT)
- Modify: `src/app/api/admin/legal/privacy/route.ts` (PUT)
- Modify: `src/app/api/admin/legal/terms/route.ts` (PUT)
- Modify: `src/app/api/risc/events/route.ts` (POST)

**Interfaces:**
- Consumes: `logActivity(db, params)`.
- Produces: nada.

Snippets:

- `POST /api/admins`: `entity: "admins"`, `create`, `entityId: admin.id`, `label: `Admin creado: ${admin.name} (${admin.email})``. Revisa el archivo: si el POST crea un admin y el objeto se llama `admin` úsalo; el `actorId` es `session?.user?.id`. Si no hay ruta `admins/[id]` con PATCH, el PATCH vive en `admins/route.ts` y edita permisos — ahí: `entity: "admins"`, `update`, `entityId: admin.id`, `label: `Permisos de admin actualizados: ${admin.email}``, `metadata: { permissions: body.permissions }`.
- `DELETE /api/admins`: `entity: "admins"`, `delete`, `entityId: admin.id`, `label: `Admin eliminado: ${admin.name ?? admin.email}``.
- `PUT /api/brand`: `entity: "brand_settings"`, `update`, `label: "Identidad del salón actualizada"`, `metadata: body`.
- `PUT /api/admin/nav-items`: `entity: "nav_items"`, `update`, `label: "Navegación del dashboard actualizada"`.
- `PUT /api/admin/legal/privacy`: `entity: "legal_settings"`, `update`, `label: "Política de privacidad actualizada"`.
- `PUT /api/admin/legal/terms`: `entity: "legal_settings"`, `update`, `label: "Términos de servicio actualizados"`.
- `POST /api/risc/events` (receptor Google RISC, sin sesión): `entity: "users"`, `action: eventType.includes("account-disabled") ? "update" : "delete"` (si el evento es `sessions-revoked`/`tokens-revoked` se borran sesiones del usuario → usar "delete" sobre `users`; si es `account-disabled` se bloquea → "update"), `entityId: subjectSub`, `label: `Evento RISC: ${eventType.split("/").pop()}``, `metadata: { eventType, subjectSub }`, `actorId: null`, `actorName: null`. Inserta el log tras procesar el evento (después de la lógica que borra/bloquea y de la dedup por `jti`), antes de responder 200.

- [ ] **Step 2: Verificar el grupo**

Run: `npx tsc --noEmit; if ($?) { npm run lint }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admins/ src/app/api/brand/ src/app/api/admin/ src/app/api/risc/
git commit -m "feat(audit): log en admins, configuración y eventos RISC"
```

---

### Task 11: Documentar el módulo (AGENTS.md, CHANGELOG.md, README.md)

**Files:**
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: los cambios de las Tasks 1-10 (tabla, endpoints, página, permiso).

- [ ] **Step 1: `AGENTS.md`**

Después de la definición de `risc_events` (o al final del bloque de tablas Drizzle) añade el modelo:

```md
### Tabla: activity_logs (auditoría)
- id: text, primary key
- actor_id: text, foreign key → users.id (nullable; null = acción pública/anónima)
- actor_name: text (snapshot del nombre; sobrevive a cambios/borrados)
- entity: text (módulo: appointments, bills, payments, inventory_items, …)
- action: text (create | update | delete | cancel | complete | approve | reject | report | adjust | enroll | unenroll | void)
- entity_id: text (id de la fila afectada)
- label: text (resumen humano de la acción)
- metadata: text (JSON con detalles: montos, tasas, diffs)
- created_at: integer (unix seconds)
- Se llena desde `logActivity(db, ...)` (src/lib/audit.ts), llamada en cada endpoint mutante tras la mutación exitosa. Es best-effort: si falla, no rompe la operación de negocio. `GET /api/activity-logs` y `GET /api/activity-logs/actors` lo exponen (solo permiso `activityLog`). UI en `/dashboard/activity`.
```

Y en la sección de **Permisos de admins**, añade `activityLog` a la lista de claves y una línea:

```
- `activityLog` (Log de actividad): ver `/dashboard/activity`.
```

- [ ] **Step 2: `CHANGELOG.md`**

Añade bajo la sección de cambios un nuevo "Unreleased" o entrada de versión:

```md
## Unreleased
### Added
- Log de actividad de usuarios (`activity_logs`): registra quién hizo cada mutación (create/update/delete/cancel/complete/approve/reject/report/adjust/enroll/unenroll/void) en todos los módulos. Página `/dashboard/activity` con filtros (usuario, entidad, acción, rango de fechas, texto) y paginación. Nuevo permiso `activityLog`. Helper `logActivity` en `src/lib/audit.ts`.
```

- [ ] **Step 3: `README.md`**

Añade el módulo a la sección de funciones (si existe listado) o añade una línea corta: "Log de actividad (auditoría de cambios por usuario)": lee `AGENTS.md` para copy exacto del resto.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CHANGELOG.md README.md
git commit -m "docs: documentar log de actividad"
```

---

## Self-Review

**Cobertura del spec:**
- Tabla `activity_logs` → Task 1. ✓
- Helper `logActivity` + robustez (best-effort, metadata JSON) → Task 2 (tests cubren ambos). ✓
- API `GET /api/activity-logs` (entity/action/actor/from/to/q/limit/offset + total/hasMore/nextOffset) → Task 3 + funciones con tests en Task 2. ✓
- Endpoint `/api/activity-logs/actors` → Task 3 + test. ✓
- Permiso `activityLog` (PERMISSION_KEYS/LABELS) → Task 1. ✓
- Página `/dashboard/activity` (tabla, badges por acción, expandible para metadata, filtros, "Cargar más") + nav item → Task 4. ✓
- Instrumentación ~45 endpoints → Tasks 5-10. ✓
- Login/logout fuera de alcance; sin backfill; retención infinita → sin tarea (por diseño). ✓
- docs obligadas → Task 11. ✓

**Placeholders:** se dan bloques de código completos para el core (schema, audit.ts, tests, rutas API, UI) y snippets concretos por endpoint; las rutas no leídas llevan "lee el archivo y adapta la variable real" con el snippet listo — ninguna tarea queda sin contenido accionable.

**Consistencia de tipos:** `logActivity(dbc, params)` con `entity`/`action` tipados por las uniones `AuditEntity`/`AuditAction`; `listActivityLogs` devuelve `{ items, total, hasMore, nextOffset }`, que la ruta y la UI consumen tal cual; `listActivityActors` devuelve `{ actorId, actorName }`. Los campos `metadata`/`createdAt` en `ActivityItem` (UI) coinciden con lo que devuelve la ruta.