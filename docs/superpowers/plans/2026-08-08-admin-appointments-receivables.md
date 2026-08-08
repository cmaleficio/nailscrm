# Citas del admin para walk-ins, horario de trabajo, cuentas por cobrar y pagos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin cree citas para clientes no registrados (walk-ins) y bloques "no disponible", configure su horario de trabajo por día, y lleve cuentas por cobrar con registro de pagos ($ o Bs, tasa BCV scrapeada de bcv.org.ve).

**Architecture:** Nuevas tablas `working_hours`, `payments` y `exchange_rates` (migración Drizzle). El saldo se calcula en vivo (`Σ service_purchases.servicePrice de citas completed − Σ payments.amountUsd`). `src/lib/slots.ts` pasa a usar el horario configurado; nueva validación de disponibilidad en el servidor compartida; nueva lib `bcv.ts` que descarga el HTML del BCV a un `.txt` y lo scrapea con regex; nuevas APIs y páginas admin. Todos los endpoints nuevos exigen `isAdmin`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, Drizzle ORM + better-sqlite3 (sincrónico), NextAuth v5 (`auth()`), Node paths `@/` alias, timezone `America/Caracas`.

## Global Constraints

- Timezone local: TODAS las fechas se convierten con `America/Caracas` (patrón existente `new Date(date + "T00:00:00-04:00")`).
- Drizzle con queries SQL puras; `db` es síncrono (better-sqlite3); solo `fetch()` de BCV es async.
- Auth: `const session = await auth(); if (!(await isAdmin(session))) return 401`.
- UI: paleta rosa (`bg-pink-main`, `bg-pink-light`, `bg-gray-soft`), `rounded-xl`, sombras suaves, mobile-first.
- NO agregar comentarios al código. NO usar APIs de terceros para la tasa (solo `bcv.org.ve`).
- Verificación por tarea: `npx tsc --noEmit` + `npm run lint` (los ~22 warnings pre-existentes NO se tocan) + `npm run build` al final.
- Cada commit de funcionalidad debe incluir la actualización de `AGENTS.md` (si aplica), `CHANGELOG.md` y `README.md` en el MISMO commit (regla del repo). La documentación completa va en la Task 16, pero si un task añade ruta/componente nuevo de UI visible, debe reflejarlo ahí.
- Datos demo: `npm run db:seed:client` regenera citas del cliente demo (clienta@email.com / Cliente123!).

---

### Task 1: Schema — tablas `working_hours`, `payments`, `exchange_rates`

**Files:**
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces: `schema.workingHours`, `schema.payments`, `schema.exchangeRates` usados por todas las tasks siguientes.

- [ ] **Step 1: Añadir las tablas**

Al final de `src/db/schema.ts`, tras el bloque `blockouts`, añadir:

```ts
export const workingHours = sqliteTable("working_hours", {
  dayOfWeek: integer("day_of_week").primaryKey(),
  isOpen: integer("is_open").notNull().default(1),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("18:00"),
});

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    appointmentId: text("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    amountUsd: real("amount_usd").notNull(),
    currency: text("currency").$type<"USD" | "VES">().notNull().default("USD"),
    amountVes: real("amount_ves"),
    rate: real("rate"),
    reference: text("reference").notNull(),
    paidAt: integer("paid_at"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("payments_user_idx").on(t.userId),
    index("payments_appointment_idx").on(t.appointmentId),
  ]
);

export const exchangeRates = sqliteTable("exchange_rates", {
  id: text("id").primaryKey(),
  date: text("date").unique().notNull(),
  rate: real("rate").notNull(),
  source: text("source").$type<"bcv" | "manual">().notNull().default("bcv"),
  createdAt: integer("created_at"),
});
```

- [ ] **Step 2: Generar y aplicar migración**

Run: `npx drizzle-kit generate --name=working-hours-payments-exchange-rates`
Expected: nuevo archivo `drizzle/0006_*.sql` (u orden siguiente) con las 3 tablas.

Run: `npx drizzle-kit migrate`
Expected: aplica.

- [ ] **Step 3: Verificar**

Run:
```
npx tsc --noEmit
node -e "const D=require('better-sqlite3');const db=new D('dev.db');console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name IN (\'working_hours\',\'payments\',\'exchange_rates\')').all())"
```
Expected: tsc PASS; las 3 tablas existen.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "feat(db): tablas working_hours, payments y exchange_rates"
```

---

### Task 2: Libs de utilidades de tiempo y BCV

**Files:**
- Create: `src/lib/time.ts`
- Create: `src/lib/bcv.ts`

**Interfaces:**
- Consumes: `db`, `schema.exchangeRates`.
- Produces:
  - `todayStr(): string` — fecha actual "YYYY-MM-DD" en `America/Caracas`.
  - `dateTimeToTs(date: string, time: string): number` — "YYYY-MM-DD" + "HH:MM" → unix segundos (UTC-4).
  - `dateToDayStartTs(date: string): number` — unix del 00:00 local.
  - `normalizeBcvNumber(s: string): number | null`
  - `extractBcvUsdRate(html: string): number | null`
  - `fetchBcvRate(): Promise<number | null>`
  - `getTodayRate(): Promise<{ date: string; rate: number | null; source: "bcv" | "manual" | null }>`

- [ ] **Step 1: Crear `src/lib/time.ts`**

```ts
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dateToDayStartTs(date: string): number {
  return Math.floor(new Date(date + "T00:00:00-04:00").getTime() / 1000);
}

export function dateTimeToTs(date: string, time: string): number {
  return Math.floor(new Date(`${date}T${time}:00-04:00`).getTime() / 1000);
}
```

- [ ] **Step 2: Crear `src/lib/bcv.ts`**

```ts
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { todayStr } from "@/lib/time";

export function normalizeBcvNumber(s: string): number | null {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractBcvUsdRate(html: string): number | null {
  const m = html.match(
    /recuadrotsmc[\s\S]*?USD[\s\S]*?<strong class="strong-tb">([\d.,]+)<\/strong>/i
  );
  if (!m) return null;
  return normalizeBcvNumber(m[1]);
}

export async function fetchBcvRate(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(
      "https://www.bcv.org.ve/tasas-informativas-sistema-bancario",
      {
        headers: {
          "Accept-Language": "es",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const file = path.join(os.tmpdir(), `bcv-tasa-${todayStr()}.txt`);
    await writeFile(file, html, "utf8");
    const saved = await readFile(file, "utf8");
    return extractBcvUsdRate(saved);
  } catch (e) {
    console.error("bcv fetch failed", e);
    return null;
  }
}

export async function getTodayRate(): Promise<{
  date: string;
  rate: number | null;
  source: "bcv" | "manual" | null;
}> {
  const date = todayStr();
  const cached = db
    .select()
    .from(schema.exchangeRates)
    .where(eq(schema.exchangeRates.date, date))
    .get();
  if (cached) return { date, rate: cached.rate, source: cached.source };
  const rate = await fetchBcvRate();
  if (rate === null) return { date, rate: null, source: null };
  db.insert(schema.exchangeRates)
    .values({ id: crypto.randomUUID(), date, rate, source: "bcv", createdAt: Math.floor(Date.now() / 1000) })
    .run();
  return { date, rate, source: "bcv" };
}
```

- [ ] **Step 3: Verificar (función pura con el HTML real del BCV)**

Run:
```
npx tsx -e "import { extractBcvUsdRate, normalizeBcvNumber } from './src/lib/bcv'; const html='<div class=\"row recuadrotsmc\"><div class=\"col-sm-6 col-xs-6\"><img src=\"/sites/default/files/dollar-04_2.png\" class=\"icono_bss_blanco1\"><span> USD</span></div><div class=\"col-sm-6 col-xs-6 centrado textp\"><strong class=\"strong-tb\">757,54060000</strong></div></div>'; console.log('rate', extractBcvUsdRate(html), 'num', normalizeBcvNumber('1.000,00'))"
```
Expected: `rate 757.5406 num 1000`.

- [ ] **Step 4: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS sin errores nuevos.

```bash
git add src/lib/time.ts src/lib/bcv.ts
git commit -m "feat(lib): utilidades de tiempo y tasa BCV scrapeada de bcv.org.ve"
```

---

### Task 3: Horario de trabajo — lib y refactor de `slots.ts`

**Files:**
- Create: `src/lib/workingHours.ts`
- Modify: `src/lib/slots.ts`

**Interfaces:**
- Consumes: `db`, `schema.workingHours`, `dateToDayStartTs`.
- Produces:
  - `DEFAULT_WORKING_HOURS: { dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string }[]`
  - `parseHhMm(s: string): number` (minutos desde 0:00)
  - `getWorkingHoursAll(): WorkingHoursRow[]` (7 filas, completando defaults)
  - `getWorkingHoursForDate(date: string): { isOpen: boolean; openMin: number; closeMin: number }`
  - `generateSlots` ahora recibe `openMin`/`closeMin` en `SlotInput`.

- [ ] **Step 1: Crear `src/lib/workingHours.ts`**

```ts
import { db, schema } from "@/db/index";
import { dateToDayStartTs } from "@/lib/time";

export type WorkingHoursRow = {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

export const DEFAULT_WORKING_HOURS: WorkingHoursRow[] = Array.from(
  { length: 7 },
  (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0,
    startTime: "09:00",
    endTime: "18:00",
  })
);

export function parseHhMm(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function getWorkingHoursAll(): WorkingHoursRow[] {
  const rows = db.select().from(schema.workingHours).all();
  const byDay = new Map<number, WorkingHoursRow>();
  for (const r of rows) {
    byDay.set(r.dayOfWeek, {
      dayOfWeek: r.dayOfWeek,
      isOpen: r.isOpen === 1,
      startTime: r.startTime,
      endTime: r.endTime,
    });
  }
  return DEFAULT_WORKING_HOURS.map((d) => byDay.get(d.dayOfWeek) ?? d);
}

export function getWorkingHoursForDate(date: string): {
  isOpen: boolean;
  openMin: number;
  closeMin: number;
} {
  const day = new Date(dateToDayStartTs(date) * 1000).getDay();
  const row = getWorkingHoursAll()[day];
  if (!row || !row.isOpen) return { isOpen: false, openMin: 0, closeMin: 0 };
  return {
    isOpen: true,
    openMin: parseHhMm(row.startTime),
    closeMin: parseHhMm(row.endTime),
  };
}
```

- [ ] **Step 2: Modificar `src/lib/slots.ts`**

Reemplazar el bloque completo de `SlotInput` y `generateSlots`:

```ts
export type SlotInput = {
  date: string;
  durationMins: number;
  existingAppointments: { startTime: number; endTime: number }[];
  blockouts: { startTime: number; endTime: number }[];
  openMin: number;
  closeMin: number;
};

export function generateSlots(input: SlotInput): SlotTime[] {
  const { date, durationMins, existingAppointments, blockouts, openMin, closeMin } = input;

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);
  const dayEnd = dayStart + 24 * 3600;

  const slots: SlotTime[] = [];

  for (let m = openMin; m + durationMins <= closeMin; m += 60) {
    const slotStart = dayStart + m * 60;
    const slotEnd = slotStart + durationMins * 60;

    const overlapsAppointment = existingAppointments.some(
      (a) => slotStart < a.endTime && slotEnd > a.startTime
    );

    const overlapsBlockout = blockouts.some(
      (b) => slotStart < b.endTime && slotEnd > b.startTime
    );

    const now = Math.floor(Date.now() / 1000);
    const isPast = slotStart <= now;

    const hour = Math.floor(m / 60);
    const minute = m % 60;
    slots.push({
      hour,
      minute,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      available: !overlapsAppointment && !overlapsBlockout && !isPast,
    });
  }

  return slots;
}
```

- [ ] **Step 3: Verificar función pura**

Run:
```
npx tsx -e "import { generateSlots } from './src/lib/slots'; const day='2026-08-10'; const s=generateSlots({date:day,durationMins:60,existingAppointments:[],blockouts:[],openMin:9*60,closeMin:12*60}); console.log(s.map(x=>x.label).join(','));"
```
Expected: `09:00,10:00,11:00` (3 slots, termina a las 12).

- [ ] **Step 4: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/lib/workingHours.ts src/lib/slots.ts
git commit -m "feat(lib): horario de trabajo por día y generateSlots configurable"
```

---

### Task 4: Lógica de disponibilidad compartida

**Files:**
- Create: `src/lib/availability.ts`

**Interfaces:**
- Consumes: `db`, `schema.appointments`, `schema.blockouts`, `getWorkingHoursForDate`, `dateToDayStartTs`.
- Produces: `validateSlot(startTime: number, endTime: number): string | null` — devuelve mensaje de error o `null` si el slot es válido.

- [ ] **Step 1: Crear `src/lib/availability.ts`**

```ts
import { db, schema } from "@/db/index";
import { and, gte, lt, sql } from "drizzle-orm";
import { getWorkingHoursForDate } from "@/lib/workingHours";
import { dateToDayStartTs } from "@/lib/time";

export function getOverlappingAppointments(
  startTime: number,
  endTime: number
): { startTime: number; endTime: number }[] {
  return db
    .select({
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
    })
    .from(schema.appointments)
    .where(
      and(
        sql`${schema.appointments.status} IN ('pending', 'confirmed')`,
        lt(schema.appointments.startTime, endTime),
        gte(schema.appointments.endTime, startTime)
      )
    )
    .all()
    .filter(
      (a): a is { startTime: number; endTime: number } =>
        a.startTime !== null && a.endTime !== null
    );
}

export function getOverlappingBlockouts(
  startTime: number,
  endTime: number
): { startTime: number; endTime: number }[] {
  return db
    .select({
      startTime: schema.blockouts.startTime,
      endTime: schema.blockouts.endTime,
    })
    .from(schema.blockouts)
    .where(and(lt(schema.blockouts.startTime, endTime), gte(schema.blockouts.endTime, startTime)))
    .all()
    .filter(
      (b): b is { startTime: number; endTime: number } =>
        b.startTime !== null && b.endTime !== null
    );
}

export function validateSlot(startTime: number, endTime: number): string | null {
  if (startTime <= Math.floor(Date.now() / 1000)) {
    return "No puedes reservar en el pasado";
  }
  const date = new Date(startTime * 1000).toLocaleDateString("en-CA", {
    timeZone: "America/Caracas",
  });
  const { isOpen, openMin, closeMin } = getWorkingHoursForDate(date);
  if (!isOpen) return "El salón está cerrado ese día";
  const dayStart = dateToDayStartTs(date);
  const startMin = (startTime - dayStart) / 60;
  const endMin = (endTime - dayStart) / 60;
  if (startMin < openMin || endMin > closeMin) {
    return "El horario está fuera del horario de trabajo";
  }
  if (getOverlappingAppointments(startTime, endTime).length > 0) {
    return "Ese horario ya está ocupado";
  }
  if (getOverlappingBlockouts(startTime, endTime).length > 0) {
    return "Ese horario está bloqueado";
  }
  return null;
}
```

- [ ] **Step 2: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/lib/availability.ts
git commit -m "feat(lib): validación de disponibilidad de slots en el servidor"
```

---

### Task 5: API `GET /api/slots` con horario de trabajo

**Files:**
- Modify: `src/app/api/slots/route.ts`

**Interfaces:**
- Consumes: `getWorkingHoursForDate`, `generateSlots`.
- Produces: respuesta `{ slots, durationMins, openTime, closeTime }` (openTime/closeTime como `"HH:MM"` o `null` si cerrado).

- [ ] **Step 1: Modificar `route.ts`**

Importar `getWorkingHoursForDate` y usarlo antes de llamar a `generateSlots` (después del bloque de `blockouts`, línea ~69):

```ts
  const { isOpen, openMin, closeMin } = getWorkingHoursForDate(date);

  const slots = isOpen
    ? generateSlots({
        date,
        durationMins: service.durationMins,
        existingAppointments,
        blockouts,
        openMin,
        closeMin,
      })
    : [];

  return NextResponse.json({
    slots,
    durationMins: service.durationMins,
    openTime: isOpen
      ? `${String(Math.floor(openMin / 60)).padStart(2, "0")}:${String(openMin % 60).padStart(2, "0")}`
      : null,
    closeTime: isOpen
      ? `${String(Math.floor(closeMin / 60)).padStart(2, "0")}:${String(closeMin % 60).padStart(2, "0")}`
      : null,
  });
```

Añadir el import al inicio: `import { getWorkingHoursForDate } from "@/lib/workingHours";`

- [ ] **Step 2: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/api/slots/route.ts
git commit -m "feat(slots): generar horarios según working_hours del día"
```

---

### Task 6: API blockouts (GET/POST y DELETE)

**Files:**
- Create: `src/app/api/blockouts/route.ts`
- Create: `src/app/api/blockouts/[id]/route.ts`

**Interfaces:**
- Consumes: `auth`, `isAdmin`, `db`, `schema.blockouts`, `getOverlappingAppointments` (para avisar si el bloque se solapa con citas).
- Produces: `GET /api/blockouts?from=&to=` → `{ id, startTime, endTime, reason }[]`; `POST /api/blockouts` body `{ startTime, endTime, reason? }` → bloque creado; `DELETE /api/blockouts/[id]`.

- [ ] **Step 1: Crear `src/app/api/blockouts/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { and, gte, lt } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { getOverlappingAppointments } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = db
    .select()
    .from(schema.blockouts)
    .where(
      and(
        from ? gte(schema.blockouts.startTime, Number(from)) : undefined,
        to ? lt(schema.blockouts.startTime, Number(to)) : undefined
      )
    );
  const rows = q.all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { startTime, endTime, reason } = body;
  if (
    typeof startTime !== "number" ||
    typeof endTime !== "number" ||
    startTime >= endTime
  ) {
    return NextResponse.json(
      { error: "startTime y endTime válidos son requeridos" },
      { status: 400 }
    );
  }
  if (getOverlappingAppointments(startTime, endTime).length > 0) {
    return NextResponse.json(
      { error: "El bloque se solapa con una cita existente" },
      { status: 409 }
    );
  }
  const blockout = {
    id: crypto.randomUUID(),
    startTime,
    endTime,
    reason: typeof reason === "string" ? reason : null,
  };
  db.insert(schema.blockouts).values(blockout).run();
  return NextResponse.json(blockout);
}
```

Nota: en `GET`, drizzle permite `undefined` en las condiciones de `and(...)` y las ignora. Verificar que compile; si el `where` con `undefined` no compila, reemplazar por construir el `where` solo si hay params (usar `sql` condicional).

- [ ] **Step 2: Crear `src/app/api/blockouts/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  db.delete(schema.blockouts).where(eq(schema.blockouts.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/api/blockouts
git commit -m "feat(api): gestionar bloques no disponibles"
```

---

### Task 7: API `GET /api/working-hours` y `PUT /api/working-hours`

**Files:**
- Create: `src/app/api/working-hours/route.ts`

**Interfaces:**
- Consumes: `getWorkingHoursAll`, `parseHhMm`, `db`, `schema.workingHours`.
- Produces: `GET` → 7 filas `{ dayOfWeek, isOpen, startTime, endTime }`; `PUT` body `{ hours: [...] }` → upsert.

- [ ] **Step 1: Crear `src/app/api/working-hours/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { isAdmin } from "@/lib/authz";
import { getWorkingHoursAll, parseHhMm } from "@/lib/workingHours";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(getWorkingHoursAll());
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const hours: unknown[] = Array.isArray(body.hours) ? body.hours : [];
  const parsed = hours.map((h) => {
    const r = h as { dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string };
    if (
      typeof r.dayOfWeek !== "number" ||
      r.dayOfWeek < 0 ||
      r.dayOfWeek > 6 ||
      typeof r.startTime !== "string" ||
      typeof r.endTime !== "string"
    ) {
      throw new Error("Horario inválido");
    }
    if (parseHhMm(r.startTime) >= parseHhMm(r.endTime)) {
      throw new Error("La hora de inicio debe ser anterior a la de cierre");
    }
    return r;
  });
  try {
    const now = Math.floor(Date.now() / 1000);
    const tx = db.transaction((tx) => {
      for (const r of parsed) {
        const existing = tx
          .select({ dayOfWeek: schema.workingHours.dayOfWeek })
          .from(schema.workingHours)
          .where(eq(schema.workingHours.dayOfWeek, r.dayOfWeek))
          .get();
        if (existing) {
          tx.update(schema.workingHours)
            .set({ isOpen: r.isOpen ? 1 : 0, startTime: r.startTime, endTime: r.endTime })
            .where(eq(schema.workingHours.dayOfWeek, r.dayOfWeek))
            .run();
        } else {
          tx.insert(schema.workingHours)
            .values({
              dayOfWeek: r.dayOfWeek,
              isOpen: r.isOpen ? 1 : 0,
              startTime: r.startTime,
              endTime: r.endTime,
            })
            .run();
        }
      }
    });
    tx();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
```

Añadir al import de drizzle: `import { eq } from "drizzle-orm";`

- [ ] **Step 2: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/api/working-hours/route.ts
git commit -m "feat(api): leer y guardar horario de trabajo por día"
```

---

### Task 8: `POST /api/appointments` — clientId admin + validación de disponibilidad

**Files:**
- Modify: `src/app/api/appointments/route.ts`

**Interfaces:**
- Consumes: `validateSlot`.
- Produces: `POST` acepta `{ clientId?, serviceId, startTime, referencePhotoUrl?, referencePhotoUrls? }`. Con `clientId` → requiere admin; sin él → flujo público (cliente = sesión). Error `409` si el slot no está disponible.

- [ ] **Step 1: Modificar el handler `POST`**

Reemplazar el cuerpo de `POST` (líneas 59–136 actuales) por:

```ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const {
    serviceId,
    startTime,
    referencePhotoUrl,
    referencePhotoUrls,
    clientId,
  } = body;

  if (!serviceId || typeof startTime !== "number") {
    return NextResponse.json(
      { error: "serviceId and startTime are required" },
      { status: 400 }
    );
  }

  const targetClientId: string = clientId
    ? clientId
    : session.user.id;

  if (clientId && !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (clientId) {
    const target = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, targetClientId))
      .get();
    if (!target) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
  }

  const urls: string[] = referencePhotoUrls?.length
    ? referencePhotoUrls
    : referencePhotoUrl
      ? [referencePhotoUrl]
      : [];

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, serviceId))
    .get();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const endTime = startTime + service.durationMins * 60;
  const now = Math.floor(Date.now() / 1000);

  const availabilityError = validateSlot(startTime, endTime);
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError }, { status: 409 });
  }

  const appointment = {
    id: crypto.randomUUID(),
    clientId: targetClientId,
    serviceId,
    startTime,
    endTime,
    status: "pending",
    referencePhotoUrl: urls[0] || null,
    createdAt: now,
  };

  db.insert(schema.appointments).values(appointment).run();

  urls.forEach((url, i) => {
    db.insert(schema.appointmentPhotos)
      .values({
        id: crypto.randomUUID(),
        appointmentId: appointment.id,
        url,
        position: i,
        createdAt: now,
      })
      .run();
  });

  db.insert(schema.servicePurchases)
    .values({
      id: crypto.randomUUID(),
      userId: targetClientId,
      appointmentId: appointment.id,
      serviceId: service.id,
      serviceName: service.name,
      serviceDescription: service.description,
      servicePrice: service.price,
      serviceDurationMins: service.durationMins,
      createdAt: now,
    })
    .run();

  await syncAppointmentToGoogleCalendars(appointment, service.name);

  return NextResponse.json({ id: appointment.id });
}
```

Añadir import: `import { validateSlot } from "@/lib/availability";`

- [ ] **Step 2: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/api/appointments/route.ts
git commit -m "feat(api): citas para walk-ins (clientId admin) con validación de disponibilidad"
```

---

### Task 9: API pagos (GET/POST y DELETE)

**Files:**
- Create: `src/app/api/payments/route.ts`
- Create: `src/app/api/payments/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `schema.payments`, `getTodayRate` (NO: la tasa la manda el cliente del form).
- Produces: `GET /api/payments?userId=` → pagos desc por `paidAt`; `POST /api/payments` body `{ userId, appointmentId?, amountUsd?, currency, amountVes?, rate?, reference, paidAt?, notes? }`; `DELETE /api/payments/[id]`.

- [ ] **Step 1: Crear `src/app/api/payments/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  let q = db.select().from(schema.payments);
  if (userId) q = q.where(eq(schema.payments.userId, userId));
  const rows = q.orderBy(desc(schema.payments.paidAt)).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const {
    userId,
    appointmentId,
    amountUsd,
    currency,
    amountVes,
    rate,
    reference,
    paidAt,
    notes,
  } = body;

  if (!userId || typeof reference !== "string" || !reference.trim()) {
    return NextResponse.json({ error: "userId y reference son requeridos" }, { status: 400 });
  }

  const client = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (appointmentId) {
    const appt = db
      .select({ clientId: schema.appointments.clientId })
      .from(schema.appointments)
      .where(eq(schema.appointments.id, appointmentId))
      .get();
    if (!appt || appt.clientId !== userId) {
      return NextResponse.json(
        { error: "La cita no pertenece al cliente" },
        { status: 400 }
      );
    }
  }

  const cur: "USD" | "VES" = currency === "VES" ? "VES" : "USD";
  let usd = 0;
  if (cur === "VES") {
    if (typeof amountVes !== "number" || typeof rate !== "number" || rate <= 0 || amountVes <= 0) {
      return NextResponse.json(
        { error: "amountVes y rate son requeridos para pagos en Bs" },
        { status: 400 }
      );
    }
    usd = Math.round((amountVes / rate) * 100) / 100;
  } else {
    if (typeof amountUsd !== "number" || amountUsd <= 0) {
      return NextResponse.json({ error: "amountUsd es requerido" }, { status: 400 });
    }
    usd = Math.round(amountUsd * 100) / 100;
  }

  const now = Math.floor(Date.now() / 1000);
  const payment = {
    id: crypto.randomUUID(),
    userId,
    appointmentId: appointmentId ?? null,
    amountUsd: usd,
    currency: cur,
    amountVes: cur === "VES" ? amountVes : null,
    rate: cur === "VES" ? rate : null,
    reference: reference.trim(),
    paidAt: typeof paidAt === "number" ? paidAt : now,
    notes: typeof notes === "string" ? notes : null,
    createdBy: session.user.id,
    createdAt: now,
  };

  db.insert(schema.payments).values(payment).run();
  return NextResponse.json(payment);
}
```

- [ ] **Step 2: Crear `src/app/api/payments/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  db.delete(schema.payments).where(eq(schema.payments.id, id)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/api/payments
git commit -m "feat(api): registrar, listar y eliminar pagos"
```

---

### Task 10: API balances y ampliación de `/api/clients/[id]`

**Files:**
- Create: `src/app/api/balances/route.ts`
- Modify: `src/app/api/clients/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `schema.servicePurchases`, `schema.appointments`, `schema.payments`.
- Produces: `GET /api/balances` → `{ totalUsd, clients: [{ clientId, name, phone, balanceUsd, unpaidAppointments }] }`; `GET /api/clients/[id]` → añade `balanceUsd` y `payments` (últimos 10).

- [ ] **Step 1: Crear `src/app/api/balances/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dueRows = db
    .select({
      userId: schema.servicePurchases.userId,
      due: sql<number>`sum(${schema.servicePurchases.servicePrice})`,
      unpaid: sql<number>`count(*)`,
    })
    .from(schema.servicePurchases)
    .innerJoin(
      schema.appointments,
      eq(schema.appointments.id, schema.servicePurchases.appointmentId)
    )
    .where(eq(schema.appointments.status, "completed"))
    .groupBy(schema.servicePurchases.userId)
    .all();

  const paidRows = db
    .select({
      userId: schema.payments.userId,
      paid: sql<number>`sum(${schema.payments.amountUsd})`,
    })
    .from(schema.payments)
    .groupBy(schema.payments.userId)
    .all();

  const paidMap = new Map<string, number>();
  for (const p of paidRows) paidMap.set(p.userId, p.paid ?? 0);

  const clients: {
    clientId: string;
    name: string;
    phone: string | null;
    balanceUsd: number;
    unpaidAppointments: number;
  }[] = [];

  let totalUsd = 0;
  for (const d of dueRows) {
    const balance = Math.round(((d.due ?? 0) - (paidMap.get(d.userId) ?? 0)) * 100) / 100;
    if (balance <= 0.004) continue;
    const user = db
      .select({ name: schema.users.name, phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, d.userId))
      .get();
    clients.push({
      clientId: d.userId,
      name: user?.name ?? "Desconocido",
      phone: user?.phone ?? null,
      balanceUsd: balance,
      unpaidAppointments: d.unpaid ?? 0,
    });
    totalUsd = Math.round((totalUsd + balance) * 100) / 100;
  }

  clients.sort((a, b) => b.balanceUsd - a.balanceUsd);

  return NextResponse.json({ totalUsd, clients });
}
```

- [ ] **Step 2: Ampliar `GET /api/clients/[id]`**

En `src/app/api/clients/[id]/route.ts`, añadir `sql` al import de drizzle y, tras obtener `client` y validar que existe, calcular:

```ts
  const dueRow = db
    .select({
      due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
    })
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

  const paidRow = db
    .select({ paid: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, id))
    .get();

  const payments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.userId, id))
    .orderBy(sql`${schema.payments.paidAt} DESC`)
    .limit(10)
    .all();

  return NextResponse.json({
    ...client,
    balanceUsd: Math.round(((dueRow?.due ?? 0) - (paidRow?.paid ?? 0)) * 100) / 100,
    payments,
  });
```

Actualizar el import de drizzle en ese archivo a: `import { eq, and, sql } from "drizzle-orm";`

- [ ] **Step 3: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/app/api/balances/route.ts src/app/api/clients/[id]/route.ts
git commit -m "feat(api): saldos de cuentas por cobrar y saldo del cliente"
```

---

### Task 11: Dashboard — diálogos "Nueva cita" y "Bloquear tiempo" + render de bloques

**Files:**
- Create: `src/components/NewAppointmentDialog.tsx`
- Create: `src/components/BlockoutDialog.tsx`
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`

**Interfaces:**
- Consumes: `GET /api/clients?q=`, `POST /api/clients`, `GET /api/services`, `GET /api/slots`, `POST /api/appointments`, `GET /api/blockouts`, `POST /api/blockouts`, `DELETE /api/blockouts/[id]`, `dateTimeToTs`, `todayStr`.
- Produces: `NewAppointmentDialog` con props `{ onClose: () => void; onCreated: () => void }`; `BlockoutDialog` con props `{ onClose: () => void; onCreated: () => void }`.

- [ ] **Step 1: Crear `src/components/NewAppointmentDialog.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

type Service = { id: string; name: string; price: number; durationMins: number };
type Client = { id: string; name: string; phone: string | null };
type Slot = { label: string; available: boolean };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function NewAppointmentDialog({ onClose, onCreated }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServices(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!serviceId || !date) return;
    fetch(`/api/slots?date=${date}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setSelectedSlot("");
      })
      .catch(() => {});
  }, [serviceId, date]);

  const searchClients = useCallback(async (q: string) => {
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`);
    if (res.ok) setClients(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void searchClients(query), 300);
    return () => clearTimeout(t);
  }, [query, searchClients]);

  async function createClient() {
    if (!newForm.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newForm.name, phone: newForm.phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el cliente");
      }
      const data = await res.json();
      setClientId(data.id);
      setShowNew(false);
      setNewForm({ name: "", phone: "" });
      await searchClients(newForm.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  }

  async function submit() {
    if (!clientId || !serviceId || !selectedSlot) return;
    setSaving(true);
    setError("");
    try {
      const startTime = dateTimeToTs(date, selectedSlot);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, serviceId, startTime }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear la cita");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl max-h-[90vh]">
        <h3 className="text-lg font-semibold text-gray-900">Nueva cita</h3>
        <p className="mt-1 text-sm text-gray-500">
          Crea una cita para un cliente, incluso si no está registrado.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            className={inputCls}
          />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  clientId === c.id
                    ? "bg-pink-main text-gray-900"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="ml-2 text-xs text-gray-500">{c.phone}</span>}
              </button>
            ))}
          </div>
          {!showNew ? (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="mt-2 text-sm font-medium text-pink-700 hover:text-pink-600"
            >
              + Crear nuevo cliente
            </button>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
              <input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="Nombre *"
                className={inputCls}
              />
              <input
                value={newForm.phone}
                onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                placeholder="Teléfono"
                className={inputCls}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createClient}
                  disabled={creating || !newForm.name.trim()}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creando..." : "Crear y seleccionar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Servicio</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={inputCls}
          >
            <option value="">Elegir servicio...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — ${s.price.toFixed(2)} · {s.durationMins} min
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {serviceId && (
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Hora</label>
            {slots.length === 0 ? (
              <p className="text-sm text-gray-400">No hay horarios disponibles ese día</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setSelectedSlot(s.label)}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition-colors disabled:opacity-30 ${
                      selectedSlot === s.label
                        ? "border-pink-main bg-pink-main text-gray-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
            disabled={saving || !clientId || !serviceId || !selectedSlot}
            className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
          >
            {saving ? "Creando..." : "Crear cita"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Nota: verificar que `POST /api/clients` devuelva `{ id, ... }`. Revisar `src/app/api/clients/route.ts`; si devuelve otra forma, ajustar `data.id` al campo real.

- [ ] **Step 2: Crear `src/components/BlockoutDialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { todayStr, dateTimeToTs } from "@/lib/time";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export function BlockoutDialog({ onClose, onCreated }: Props) {
  const [date, setDate] = useState(todayStr());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (start >= end) {
      setError("La hora de inicio debe ser anterior a la de cierre");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/blockouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: dateTimeToTs(date, start),
          endTime: dateTimeToTs(date, end),
          reason,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo bloquear el horario");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Bloquear tiempo</h3>
        <p className="mt-1 text-sm text-gray-500">
          Marca un horario como no disponible (ej. almuerzo, feriado).
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Inicio</label>
            <select value={start} onChange={(e) => setStart(e.target.value)} className={inputCls}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fin</label>
            <select value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Motivo (opcional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Almuerzo, feriado..."
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
            {saving ? "Bloqueando..." : "Bloquear"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrar en `DashboardContent.tsx`**

Cambios concretos:

1) Imports: añadir
```tsx
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { BlockoutDialog } from "@/components/BlockoutDialog";
import { dateToDayStartTs } from "@/lib/time";
```

2) Tipo nuevo (tras `Appointment`):
```tsx
type Blockout = { id: string; startTime: number; endTime: number; reason: string | null };
```

3) Estado nuevo (junto a los existentes):
```tsx
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showBlockout, setShowBlockout] = useState(false);
  const [blockouts, setBlockouts] = useState<Blockout[]>([]);
  const [weekBlockouts, setWeekBlockouts] = useState<Record<string, Blockout[]>>({});
```

4) Fetch de bloques del día (dentro de `fetchAppointments` o función nueva):
```tsx
  const fetchBlockouts = useCallback(async () => {
    const from = dateToDayStartTs(today);
    const res = await fetch(`/api/blockouts?from=${from}&to=${from + 86400}`);
    const data = await res.json();
    setBlockouts(Array.isArray(data) ? data : []);
  }, [today]);
```
y llamarla en el `useEffect` junto a `fetchAppointments`.

5) En `fetchWeek`, añadir bloques por día:
```tsx
    const blockEntries: Record<string, Blockout[]> = {};
    for (const d of dates) {
      const date = fmtDate(d);
      const from = dateToDayStartTs(date);
      const resB = await fetch(`/api/blockouts?from=${from}&to=${from + 86400}`);
      const dataB = await resB.json();
      blockEntries[date] = Array.isArray(dataB) ? dataB : [];
    }
    setWeekBlockouts(blockEntries);
```
y en `refreshAll` recargar `fetchBlockouts()`.

6) Botones en el header (junto al toggle día/semana, dentro del `div` `mb-4 inline-flex...`). Añadir **antes** de ese div:
```tsx
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setShowNewAppointment(true)}
          className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          + Nueva cita
        </button>
        <button
          onClick={() => setShowBlockout(true)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ⛔ Bloquear tiempo
        </button>
      </div>
```

7) Render de bloques en la vista día: dentro del `view === "day"` div, después del `h2` y antes del listado de citas, añadir:
```tsx
          {blockouts.length > 0 && (
            <div className="mb-4 space-y-2">
              {blockouts.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-100 px-4 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      ⛔ {timeStr(b.startTime)} — {timeStr(b.endTime)}
                    </p>
                    {b.reason && <p className="text-xs text-gray-500">{b.reason}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await fetch(`/api/blockouts/${b.id}`, { method: "DELETE" });
                      refreshAll();
                    }}
                    className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
```

8) En la vista semana, marcar el día con bloque: en el `weekDates.map`, tras el `p` con el día, si `(weekBlockouts[date] ?? []).length > 0` mostrar `⛔` (un `<span>` pequeño gris).

9) Diálogos al final (junto a los otros modales):
```tsx
      {showNewAppointment && (
        <NewAppointmentDialog
          onClose={() => setShowNewAppointment(false)}
          onCreated={() => {
            setShowNewAppointment(false);
            refreshAll();
          }}
        />
      )}
      {showBlockout && (
        <BlockoutDialog
          onClose={() => setShowBlockout(false)}
          onCreated={() => {
            setShowBlockout(false);
            refreshAll();
          }}
        />
      )}
```

- [ ] **Step 4: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS (puede añadir warnings de `<img>`/`no-unused-vars` nuevos en DashboardContent; si aparece `dateStr` no usado, NO tocar otros warnings pre-existentes, solo los del código nuevo que introduzcas).

```bash
git add src/components/NewAppointmentDialog.tsx src/components/BlockoutDialog.tsx "src/app/(admin)/dashboard/DashboardContent.tsx"
git commit -m "feat(dashboard): crear citas para walk-ins y bloquear tiempo desde la agenda"
```

---

### Task 12: Pago al completar cita

**Files:**
- Modify: `src/components/CompleteAppointmentDialog.tsx`
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`

**Interfaces:**
- Consumes: `GET /api/exchange-rate`, `POST /api/payments`.
- Produces: `CompleteAppointmentDialog` recibe props nuevas `clientId: string` y `servicePrice: number`.

- [ ] **Step 1: Reescribir `src/components/CompleteAppointmentDialog.tsx`**

Reemplazar el archivo completo por:

```tsx
"use client";

import { useState, useEffect } from "react";
import { todayStr } from "@/lib/time";

type Props = {
  appointmentId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  servicePrice: number;
  onClose: () => void;
  onCompleted: () => void;
};

type Rate = { rate: number | null; source: string | null };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function CompleteAppointmentDialog({
  appointmentId,
  clientId,
  clientName,
  serviceName,
  servicePrice,
  onClose,
  onCompleted,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [amountUsd, setAmountUsd] = useState(String(servicePrice));
  const [amountVes, setAmountVes] = useState("");
  const [rate, setRate] = useState<Rate>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(todayStr());

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => setRate(data))
      .catch(() => {});
  }, []);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setFiles((prev) => [...prev, ...selected]);
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: formData });
        if (!up.ok) throw new Error("No se pudo subir una foto");
        const data = await up.json();
        urls.push(data.url);
      }
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", finalPhotos: urls }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo completar la cita");
      }

      if (paid) {
        const effectiveRate = currency === "VES" ? parseFloat(manualRate || String(rate.rate || "")) : null;
        if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
          throw new Error("Escribe la tasa del día");
        }
        const body: Record<string, unknown> = {
          userId: clientId,
          appointmentId,
          currency,
          reference,
          paidAt: Math.floor(
            new Date(`${paidDate}T00:00:00-04:00`).getTime() / 1000
          ),
        };
        if (currency === "USD") body.amountUsd = parseFloat(amountUsd) || 0;
        else {
          body.amountVes = parseFloat(amountVes) || 0;
          body.rate = effectiveRate;
        }
        const payRes = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!payRes.ok) {
          const data = await payRes.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo registrar el pago");
        }
      }
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Completar cita</h3>
        <p className="mt-1 text-sm text-gray-500">
          {clientName} · {serviceName} · ${servicePrice.toFixed(2)}
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            ¿Quieres subir fotos del resultado?
          </label>
          <p className="mb-3 text-xs text-gray-400">
            Puedes subir varias fotos. Se publicarán automáticamente en el muro de inspiración.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Subir fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
          </label>
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {previews.map((p, i) => (
                <div key={p} className="relative">
                  <img src={p} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
            />
            ¿Pagó en el momento?
          </label>
          {paid && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "USD" | "VES")}
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
                    className={inputCls}
                  />
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountVes}
                    onChange={(e) => setAmountVes(e.target.value)}
                    placeholder="Monto en Bs"
                    className={inputCls}
                  />
                )}
              </div>
              {currency === "VES" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tasa del día</label>
                  {rate.rate ? (
                    <p className="mb-1 text-xs text-gray-500">
                      Tasa BCV: {rate.rate.toFixed(2)} Bs/US$ (puedes corregirla)
                    </p>
                  ) : (
                    <p className="mb-1 text-xs text-amber-600">
                      No se pudo obtener la tasa automática. Escribe la tasa manualmente.
                    </p>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualRate}
                    onChange={(e) => setManualRate(e.target.value)}
                    placeholder={String(rate.rate ?? "Tasa Bs/US$")}
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Número de referencia *
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: 00012345"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del pago</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
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
            onClick={confirm}
            disabled={saving}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Completando..." : "Confirmar completado"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pasar las props nuevas en `DashboardContent`**

En el render de `{completing && (...)}` actual, añadir `clientId={completing.clientId}` y `servicePrice={Number(...)}`. `DashboardContent` no tiene hoy el precio del servicio en `Appointment`; añadirlo:

1) En el tipo `Appointment`, añadir `servicePrice: number;`.
2) El `GET /api/appointments?date=` no devuelve precio. Para no tocar esa API, el diálogo puede usar el precio del snapshot; pero lo más simple: añadir el precio al SELECT del GET en `src/app/api/appointments/route.ts`:
   - Añadir al select: `servicePrice: schema.servicePurchases.servicePrice,`
   - En el render: `servicePrice={completing.servicePrice ?? 0}`.
3) En el `CompleteAppointmentDialog`, pasar `clientId={completing.clientId}` y `servicePrice={completing.servicePrice ?? 0}`.

- [ ] **Step 3: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/components/CompleteAppointmentDialog.tsx "src/app/(admin)/dashboard/DashboardContent.tsx" src/app/api/appointments/route.ts
git commit -m "feat(dashboard): registrar pago (USD/Bs con tasa) al completar una cita"
```

---

### Task 13: Página "Cuentas por cobrar" con registro de pagos

**Files:**
- Create: `src/app/(admin)/dashboard/balances/page.tsx`
- Create: `src/app/(admin)/dashboard/balances/BalancesContent.tsx`
- Create: `src/components/RegisterPaymentDialog.tsx`
- Modify: `src/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/balances`, `GET /api/payments?userId=`, `POST /api/payments`, `DELETE /api/payments/[id]`, `GET /api/exchange-rate`.
- Produces: `RegisterPaymentDialog` props `{ clientId: string; clientName: string; onClose: () => void; onSaved: () => void }`.

- [ ] **Step 1: Crear `src/app/(admin)/dashboard/balances/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { BalancesContent } from "./BalancesContent";

export default async function BalancesPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <BalancesContent />;
}
```

- [ ] **Step 2: Crear `src/components/RegisterPaymentDialog.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { todayStr } from "@/lib/time";

type Props = {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
};

type Rate = { rate: number | null; source: string | null };

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function RegisterPaymentDialog({ clientId, clientName, onClose, onSaved }: Props) {
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [amountUsd, setAmountUsd] = useState("");
  const [amountVes, setAmountVes] = useState("");
  const [rate, setRate] = useState<Rate>({ rate: null, source: null });
  const [manualRate, setManualRate] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => setRate(data))
      .catch(() => {});
  }, []);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const effectiveRate = currency === "VES" ? parseFloat(manualRate || String(rate.rate || "")) : null;
      if (currency === "VES" && (!effectiveRate || effectiveRate <= 0)) {
        throw new Error("Escribe la tasa del día");
      }
      const body: Record<string, unknown> = {
        userId: clientId,
        currency,
        reference,
        paidAt: Math.floor(new Date(`${paidDate}T00:00:00-04:00`).getTime() / 1000),
        notes,
      };
      if (currency === "USD") body.amountUsd = parseFloat(amountUsd) || 0;
      else {
        body.amountVes = parseFloat(amountVes) || 0;
        body.rate = effectiveRate;
      }
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar el pago");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Registrar pago</h3>
        <p className="mt-1 text-sm text-gray-500">{clientName}</p>

        <div className="mt-4 flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "VES")}
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
              placeholder="Monto en $"
              className={inputCls}
            />
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountVes}
              onChange={(e) => setAmountVes(e.target.value)}
              placeholder="Monto en Bs"
              className={inputCls}
            />
          )}
        </div>

        {currency === "VES" && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Tasa del día</label>
            {rate.rate ? (
              <p className="mb-1 text-xs text-gray-500">
                Tasa BCV: {rate.rate.toFixed(2)} Bs/US$ (puedes corregirla)
              </p>
            ) : (
              <p className="mb-1 text-xs text-amber-600">
                No se pudo obtener la tasa automática. Escribe la tasa manualmente.
              </p>
            )}
            <input
              type="number"
              min="0"
              step="0.01"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder={String(rate.rate ?? "Tasa Bs/US$")}
              className={inputCls}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Número de referencia *</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej: 00012345"
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Fecha del pago</label>
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">Notas (opcional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: abono, pago pendiente..."
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
            className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear `src/app/(admin)/dashboard/balances/BalancesContent.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { RegisterPaymentDialog } from "@/components/RegisterPaymentDialog";

type BalanceClient = {
  clientId: string;
  name: string;
  phone: string | null;
  balanceUsd: number;
  unpaidAppointments: number;
};

type Payment = {
  id: string;
  amountUsd: number;
  currency: string;
  amountVes: number | null;
  rate: number | null;
  reference: string;
  paidAt: number | null;
  notes: string | null;
};

export function BalancesContent() {
  const [totalUsd, setTotalUsd] = useState(0);
  const [clients, setClients] = useState<BalanceClient[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [registering, setRegistering] = useState<BalanceClient | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/balances");
      const data = await res.json();
      setTotalUsd(data.totalUsd ?? 0);
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  async function toggleClient(clientId: string) {
    const next = expanded === clientId ? null : clientId;
    setExpanded(next);
    if (next && !payments[next]) {
      const res = await fetch(`/api/payments?userId=${next}`);
      if (res.ok) {
        const data = await res.json();
        setPayments((prev) => ({ ...prev, [next]: Array.isArray(data) ? data : [] }));
      }
    }
  }

  async function deletePayment(clientId: string, paymentId: string) {
    if (!window.confirm("¿Eliminar este pago?")) return;
    await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
    setPayments((prev) => ({
      ...prev,
      [clientId]: (prev[clientId] ?? []).filter((p) => p.id !== paymentId),
    }));
    await loadBalances();
  }

  const fmtDate = (ts: number | null) =>
    ts
      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "America/Caracas" }).format(new Date(ts * 1000))
      : "—";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar</h1>
        <p className="text-sm text-gray-500">
          Total adeudado:{" "}
          <span className="font-semibold text-gray-900">${totalUsd.toFixed(2)}</span>
        </p>
      </div>

      {loading && clients.length === 0 ? (
        <p className="text-gray-400">Cargando...</p>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No hay cuentas por cobrar pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.clientId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => void toggleClient(c.clientId)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone ?? "Sin teléfono"}</p>
                  <p className="text-sm text-gray-500">{c.unpaidAppointments} cita(s) sin pagar</p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="rounded-lg bg-pink-light px-3 py-1.5 text-sm font-bold text-gray-900">
                    ${c.balanceUsd.toFixed(2)}
                  </p>
                  <button
                    onClick={() => setRegistering(c)}
                    className="rounded-xl bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light transition-colors"
                  >
                    Registrar pago
                  </button>
                </div>
              </div>

              {expanded === c.clientId && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Historial de pagos
                  </p>
                  {!payments[c.clientId] || payments[c.clientId].length === 0 ? (
                    <p className="text-sm text-gray-400">Sin pagos registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {payments[c.clientId].map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              ${p.amountUsd.toFixed(2)} {p.currency === "VES" && `· ${p.amountVes?.toFixed(2)} Bs`}
                            </p>
                            <p className="text-xs text-gray-500">
                              Ref: {p.reference} · {fmtDate(p.paidAt)}
                            </p>
                            {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                          </div>
                          <button
                            onClick={() => void deletePayment(c.clientId, p.id)}
                            className="rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {registering && (
        <RegisterPaymentDialog
          clientId={registering.clientId}
          clientName={registering.name}
          onClose={() => setRegistering(null)}
          onSaved={() => {
            setRegistering(null);
            void loadBalances();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Añadir nav en `src/app/(admin)/layout.tsx`**

En `NAV_ITEMS`, tras Clientes:
```tsx
  { href: "/dashboard/balances", label: "Cuentas por cobrar", icon: "💰" },
```

- [ ] **Step 5: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add "src/app/(admin)/dashboard/balances" src/components/RegisterPaymentDialog.tsx "src/app/(admin)/layout.tsx"
git commit -m "feat(dashboard): sección cuentas por cobrar con registro y borrado de pagos"
```

---

### Task 14: Configuración de horario + saldo en el CRM

**Files:**
- Create: `src/app/(admin)/dashboard/settings/page.tsx`
- Create: `src/app/(admin)/dashboard/settings/SettingsContent.tsx`
- Modify: `src/components/ClientCRMPanel.tsx`
- Modify: `src/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/working-hours`, `GET /api/clients/[id]` (ya incluye `balanceUsd` y `payments`), `RegisterPaymentDialog`.
- Produces: `SettingsContent` (página `/dashboard/settings`); `ClientCRMPanel` muestra saldo y pagos.

- [ ] **Step 1: Crear `src/app/(admin)/dashboard/settings/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/authz";
import { redirect } from "next/navigation";
import { SettingsContent } from "./SettingsContent";

export default async function SettingsPage() {
  const session = await auth();
  if (!(await isAdmin(session))) redirect("/");
  return <SettingsContent />;
}
```

- [ ] **Step 2: Crear `src/app/(admin)/dashboard/settings/SettingsContent.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";

type Day = {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const inputCls =
  "rounded-xl border border-gray-200 px-2 py-1.5 text-sm focus:border-pink-main focus:outline-none";

export function SettingsContent() {
  const [hours, setHours] = useState<Day[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/working-hours")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHours(data);
      })
      .catch(() => {});
  }, []);

  function updateDay(dayOfWeek: number, patch: Partial<Day>) {
    setHours((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Horario de trabajo por día de la semana</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {hours.map((d) => (
            <div key={d.dayOfWeek} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={d.isOpen}
                  onChange={(e) => updateDay(d.dayOfWeek, { isOpen: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-pink-main focus:ring-pink-main"
                />
                {DAY_LABELS[d.dayOfWeek]}
              </label>
              {d.isOpen ? (
                <div className="flex items-center gap-2">
                  <select
                    value={d.startTime}
                    onChange={(e) => updateDay(d.dayOfWeek, { startTime: e.target.value })}
                    className={inputCls}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-400">a</span>
                  <select
                    value={d.endTime}
                    onChange={(e) => updateDay(d.dayOfWeek, { endTime: e.target.value })}
                    className={inputCls}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-gray-400">Cerrado</span>
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
            Horario guardado
          </p>
        )}

        <button
          onClick={save}
          disabled={saving || hours.length === 0}
          className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar horario"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modificar `ClientCRMPanel.tsx` — sección saldo/pagos**

1) Añadir al tipo `ClientData`:
```ts
  balanceUsd: number;
  payments: {
    id: string;
    amountUsd: number;
    currency: string;
    amountVes: number | null;
    rate: number | null;
    reference: string;
    paidAt: number | null;
  }[];
```
2) Importar `RegisterPaymentDialog`.
3) Estado: `const [showPayment, setShowPayment] = useState(false);`
4) Tras el bloque de stats (`Visitas`/`Ingresos`, que termina en el `</div>` de la línea ~227), insertar una sección "Saldo":
```tsx
        <div className="mb-6 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cuenta por cobrar</p>
            <button
              onClick={() => setShowPayment(true)}
              className="rounded-lg bg-pink-main px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-pink-light transition-colors"
            >
              Registrar pago
            </button>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            ${(client.balanceUsd ?? 0).toFixed(2)}
          </p>
          {(client.payments ?? []).length > 0 && (
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
              {client.payments.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    ${p.amountUsd.toFixed(2)} · Ref: {p.reference}
                  </span>
                  <span className="text-xs text-gray-400">
                    {p.paidAt
                      ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "America/Caracas" }).format(new Date(p.paidAt * 1000))
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
```
5) Al final del JSX (antes del `</div>` final), añadir el diálogo:
```tsx
      {showPayment && (
        <RegisterPaymentDialog
          clientId={client.id}
          clientName={client.name}
          onClose={() => setShowPayment(false)}
          onSaved={() => {
            setShowPayment(false);
            fetch(`/api/clients/${clientId}`)
              .then((r) => r.json())
              .then((data) => {
                setClient(data);
                setTechNotes(data.techNotes || "");
                setContact({ name: data.name ?? "", phone: data.phone ?? "", address: data.address ?? "" });
              });
          }}
        />
      )}
```
Nota: el `useEffect` que carga el cliente debe volver a correr; la recarga manual de arriba basta para actualizar el saldo.

- [ ] **Step 4: Añadir nav en `layout.tsx`**

En `NAV_ITEMS`, tras "Cuentas por cobrar":
```tsx
  { href: "/dashboard/settings", label: "Configuración", icon: "⏰" },
```

- [ ] **Step 5: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add "src/app/(admin)/dashboard/settings" src/components/ClientCRMPanel.tsx "src/app/(admin)/layout.tsx"
git commit -m "feat(dashboard): configuración de horario por día y saldo en el CRM"
```

---

### Task 15: Seeds — horario de trabajo y pagos demo

**Files:**
- Modify: `src/db/seed-demo.ts`
- Modify: `src/db/seed-client-demo.ts`

**Interfaces:**
- Consumes: `schema.workingHours`, `schema.payments`.
- Produces: filas de `working_hours` (Lun–Sáb 9:00–18:00, Dom cerrado) si la tabla está vacía; pagos demo para la clienta.

- [ ] **Step 1: Sembrar `working_hours` en `seed-demo.ts`**

Antes de `console.log("✨ Demo data complete!");` añadir:

```ts
// ── Working hours ──
const existingHours = db.select().from(schema.workingHours).all();
if (existingHours.length === 0) {
  const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0 ? 1 : 0,
    startTime: "09:00",
    endTime: "18:00",
  }));
  db.insert(schema.workingHours).values(hours).run();
  console.log("✅ Working hours seeded");
}
```

- [ ] **Step 2: Sembrar `working_hours` y pagos demo en `seed-client-demo.ts`**

1) Mismo bloque de `working_hours` al inicio de `main()` (tras la creación/actualización del usuario y antes de las citas):
```ts
const existingHours = db.select().from(schema.workingHours).all();
if (existingHours.length === 0) {
  const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek !== 0 ? 1 : 0,
    startTime: "09:00",
    endTime: "18:00",
  }));
  db.insert(schema.workingHours).values(hours).run();
  console.log("✅ Working hours seeded");
}
```

2) Borrar pagos previos del demo junto con las citas (al borrar citas, `payments.appointmentId` queda NULL; borramos todos los pagos del demo para regenerar):
```ts
const existingPayments = db
  .select({ id: schema.payments.id })
  .from(schema.payments)
  .where(eq(schema.payments.userId, userId!))
  .all();
for (const p of existingPayments) {
  db.delete(schema.payments).where(eq(schema.payments.id, p.id)).run();
}
```

3) Tras el bucle de citas (antes de `console.log("✨ Demo client seed complete!");`), añadir pagos demo:
```ts
const demoPayments = [
  {
    appointmentId: appointments[1]?.finalUrl ? undefined : undefined,
    amountUsd: 35,
    currency: "USD" as const,
    reference: "PAGO-001",
    paidAt: now - 14 * DAY + 11 * 3600,
  },
  {
    amountUsd: 10,
    currency: "USD" as const,
    reference: "PAGO-002",
    paidAt: now - 35 * DAY + 16 * 3600,
  },
];

// vincular el primer pago a la cita completada de acrílicas
const completedAppts = appointments.filter((a) => a.status === "completed");
for (let i = 0; i < demoPayments.length && i < completedAppts.length; i++) {
  db.insert(schema.payments)
    .values({
      id: crypto.randomUUID(),
      userId: userId!,
      appointmentId: completedAppts[i] ? undefined : undefined,
      amountUsd: demoPayments[i].amountUsd,
      currency: demoPayments[i].currency,
      reference: demoPayments[i].reference,
      paidAt: demoPayments[i].paidAt,
      createdBy: userId!,
      createdAt: now,
    })
    .run();
}
```
Nota: para enlazar el `appointmentId` del pago con la cita creada, guardar los ids creados en el bucle de citas: añadir una variable `createdAppointmentIds: string[]` que se haga `push(id)` dentro del `for (const a of appointments)` y usar `createdAppointmentIds[i]` como `appointmentId` en el pago. Si no, dejar `appointmentId` como `null` (el saldo se calcula igual por `userId`).

Recomendación concreta para este paso: dentro del bucle de citas, tras `const id = crypto.randomUUID();`, añadir `createdAppointmentIds.push(id);` (declarar la variable antes del bucle). Luego, al insertar el pago `i`, usar `appointmentId: createdAppointmentIds[i] ?? null`.

- [ ] **Step 3: Verificar seeds**

Run: `npm run db:seed:client`
Expected: regenera citas, siembra working_hours y 2 pagos demo (uno completo de $35 y un abono de $10), quedando el resto de una cita completada como deuda.

Run: `npm run db:seed`
Expected: no rompe (solo inserta working_hours si vacía).

Verificar:
```
node -e "const D=require('better-sqlite3');const db=new D('dev.db');console.log('hours', db.prepare('SELECT count(*) c FROM working_hours').get().c);console.log('payments', db.prepare('SELECT reference, amount_usd FROM payments').all())"
```
Expected: hours 7; payments con PAGO-001 ($35) y PAGO-002 ($10).

- [ ] **Step 4: tsc + lint + commit**

Run: `npx tsc --noEmit` y `npm run lint` → PASS.

```bash
git add src/db/seed-demo.ts src/db/seed-client-demo.ts
git commit -m "chore(seeds): horario de trabajo por defecto y pagos demo"
```

---

### Task 16: Documentación y verificación final

**Files:**
- Modify: `AGENTS.md`, `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: todo lo implementado.

- [ ] **Step 1: `AGENTS.md`**

- Modelo de datos: añadir las tablas `working_hours`, `payments`, `exchange_rates` (campos según la spec).
- Rutas: añadir `/dashboard/balances` (Cuentas por cobrar) y `/dashboard/settings` (Horario de trabajo).
- Componentes clave: añadir `NewAppointmentDialog`, `BlockoutDialog`, `RegisterPaymentDialog`, `SettingsContent`/`WorkingHoursEditor`.
- Datos demo: mencionar que `db:seed:client` también siembra horario por defecto y pagos demo.

- [ ] **Step 2: `CHANGELOG.md`** — bajo `## [Sin publicar]` → `### Añadido`:
- Citas creadas por el admin para clientes no registrados (walk-ins) desde la agenda, con validación de disponibilidad en el servidor.
- Bloques "no disponible" gestionables desde el dashboard (crear y eliminar).
- Horario de trabajo configurable por día de la semana en `/dashboard/settings`.
- Cuentas por cobrar: sección `/dashboard/balances` con total adeudado, historial de pagos y registro/borrado de pagos.
- Pagos en $ o Bs con la tasa del día del BCV (scrapeada de bcv.org.ve), abonos parciales y referencia obligatoria.
- Saldo de cada cliente visible en el panel CRM con registro de pagos.

- [ ] **Step 3: `README.md`** — reflejar las nuevas funcionalidades (citas walk-in, bloques, horario por día, cuentas por cobrar con tasa BCV).

- [ ] **Step 4: Verificación final**

Run:
```
npx tsc --noEmit
npm run lint
npm run build
npm run db:seed:client
```
Expected: todos PASS; build genera las nuevas páginas `/dashboard/balances` y `/dashboard/settings`.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CHANGELOG.md README.md
git commit -m "docs: cuentas por cobrar, citas walk-in, horario de trabajo y tasa BCV"
```

---

## Self-Review

**Cobertura de spec:**
- Horario por día → Tasks 3, 5, 7, 14, 15. ✔
- Citas admin para walk-ins + bloqueo de tiempo → Tasks 8, 11, 6. ✔
- Cuentas por cobrar + pagos ($/Bs, abonos, referencia) → Tasks 1, 9, 10, 12, 13, 15. ✔
- Tasa BCV scrapeada de bcv.org.ve (HTML→.txt→regex) → Task 2, 7. ✔
- Saldo en el CRM → Task 10, 14. ✔
- Navegación → Tasks 13, 14. ✔
- Seeds y docs → Tasks 15, 16. ✔

**Placeholders:** ningún paso queda con "TBD/TODO"; cada paso incluye código o comando concreto.

**Consistencia de tipos:** `validateSlot(startTime,endTime): string|null` definido en Task 4 y usado en Task 8. `generateSlots` con `openMin/closeMin` en Task 3 y usado en Task 5. `getTodayRate()` async en Task 2, consumido en Task 7 y en los diálogos. `RegisterPaymentDialog` con props `{ clientId, clientName, onClose, onSaved }` en Task 13, reusado en Task 14. `dateTimeToTs`/`todayStr` en Task 2, usados en Tasks 11, 12, 13.
