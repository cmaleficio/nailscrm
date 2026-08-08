# Muro con fotos finales, modelos en reserva, CRM de clientes y fotos de servicios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el ciclo de fotos del salón (carga al completar cita → muro; modelos seleccionables al reservar → carrusel en agenda), completar el CRM de clientes, y añadir fotos de servicios con carrusel en el home.

**Architecture:** SQLite + Drizzle. Las fotos de referencia y finales viven en `appointment_photos` con una nueva columna `kind` (`'reference'`/`'final'`); el muro se alimenta de fotos `kind='final'`. Nueva tabla `service_photos` para las fotos de catálogo. UI con componentes client ya existentes (`DashboardContent`, `ClientCRMPanel`, `BookingWizard`, `GalleryGrid`, `ServicesContent`, `ServiceCard`).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Drizzle ORM + better-sqlite3, NextAuth v5.

**No hay framework de tests en el repo.** La verificación de cada tarea es: `npx tsc --noEmit`, `npm run lint`, y comprobaciones manuales descritas. Se ejecuta `npm run build` al final (Tareas 13–14).

## Global Constraints

- Mobile-first en vistas de cliente; paleta rosa pastel (`#FFE5EC`/`#FFC2D1`), blanco, `#F5F5F5`; `rounded-xl`, sombras suaves.
- Drizzle con queries SQL puras (no Prisma).
- Timezone local del salón para fechas: `America/Caracas` (offset `-04:00`).
- WhatsApp solo deep links (`wa.me`).
- Privacidad: solo nombre de pila en muro público.
- Nada de comentarios en el código salvo que se pidan.
- Todo cambio relevante obliga a actualizar `AGENTS.md`, `CHANGELOG.md` y `README.md` en el mismo commit.
- Comando de verificación general: `npm run lint && npx tsc --noEmit`.

---

### Task 1: Schema y migración

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0005_*.sql` (generada)

**Interfaces:**
- Produces: `schema.appointmentPhotos.kind: text` (default `'reference'`) y tabla `schema.servicePhotos` con campos `id: text`, `serviceId: text`, `url: text`, `position: integer`, `createdAt: integer`.

- [ ] **Step 1: Añadir `kind` a `appointment_photos` y crear `service_photos`**

Editar `src/db/schema.ts`. En `appointmentPhotos` (líneas 83–89) añadir `kind` al final del objeto:

```ts
export const appointmentPhotos = sqliteTable("appointment_photos", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at"),
  kind: text("kind").notNull().default("reference"),
});
```

Añadir al final del archivo la tabla de fotos de servicio:

```ts
export const servicePhotos = sqliteTable("service_photos", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at"),
});
```

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npx drizzle-kit generate --name=photo-kind-and-service-photos`
Expected: crea `drizzle/0005_*.sql` (y snapshot). Si `drizzle-kit` pregunta algo, aceptar el valor por defecto que proponga.

Run: `npx drizzle-kit migrate`
Expected: aplica la migración a `dev.db` sin errores.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores).

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "feat(db): kind en appointment_photos y tabla service_photos"
```

---

### Task 2: API de servicios con fotos

**Files:**
- Modify: `src/app/api/services/route.ts`
- Create: `src/app/api/services/[id]/photos/route.ts`
- Create: `src/app/api/services/[id]/photos/[photoId]/route.ts`

**Interfaces:**
- Consumes: `schema.servicePhotos`, `schema.services`.
- Produces: `GET /api/services` devuelve cada servicio con `photos: { id, url, position }[]`. `POST /api/services/[id]/photos` body `{ urls: string[] }` → `{ success: true }`. `DELETE /api/services/[id]/photos/[photoId]` → `{ success: true }`.

- [ ] **Step 1: GET /api/services incluye fotos**

En `src/app/api/services/route.ts` añadir un helper y usarlo en los 3 retornos (por `id`, `includeInactive`, público). La función `GET` actual:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

function withPhotos<T extends { id: string }>(rows: T[]) {
  const photos = db.select().from(schema.servicePhotos).all();
  const byService = new Map<string, { id: string; url: string; position: number }[]>();
  for (const p of photos) {
    const list = byService.get(p.serviceId) ?? [];
    list.push({ id: p.id, url: p.url, position: p.position });
    byService.set(p.serviceId, list);
  }
  return rows.map((r) => ({
    ...r,
    photos: (byService.get(r.id) ?? []).sort((a, b) => a.position - b.position),
  }));
}
```

Aplicar en el retorno por id, el de `includeInactive` y el público:

```ts
if (id) {
  const service = db.select().from(schema.services).where(eq(schema.services.id, id)).get();
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(withPhotos([service])[0]);
}
...
if (includeInactive) {
  ...
  return NextResponse.json(withPhotos(db.select().from(schema.services).orderBy(schema.services.name).all()));
}
...
const services = db.select().from(schema.services).where(eq(schema.services.isActive, 1)).all();
return NextResponse.json(withPhotos(services));
```

- [ ] **Step 2: POST fotos de servicio**

Crear `src/app/api/services/[id]/photos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const service = db.select().from(schema.services).where(eq(schema.services.id, id)).get();
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const urls: string[] = Array.isArray(body?.urls)
    ? body.urls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
    : [];
  const now = Math.floor(Date.now() / 1000);
  const existing = db
    .select({ position: schema.servicePhotos.position })
    .from(schema.servicePhotos)
    .where(eq(schema.servicePhotos.serviceId, id))
    .all();
  let nextPos = existing.length ? Math.max(...existing.map((p) => p.position)) + 1 : 0;
  for (const url of urls) {
    db.insert(schema.servicePhotos)
      .values({ id: crypto.randomUUID(), serviceId: id, url, position: nextPos, createdAt: now })
      .run();
    nextPos += 1;
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: DELETE foto de servicio**

Crear `src/app/api/services/[id]/photos/[photoId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id, photoId } = await params;
  const photo = db
    .select()
    .from(schema.servicePhotos)
    .where(eq(schema.servicePhotos.id, photoId))
    .get();
  if (!photo || photo.serviceId !== id) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  db.delete(schema.servicePhotos).where(eq(schema.servicePhotos.id, photoId)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/services
git commit -m "feat(api): fotos de servicios (list, upload, delete)"
```

---

### Task 3: API del muro a nivel de foto

**Files:**
- Modify: `src/app/api/gallery/route.ts`

**Interfaces:**
- Consumes: `schema.appointmentPhotos.kind`.
- Produces: `GET /api/gallery` → `{ items: { id, url, clientName, serviceName, serviceId, appointmentId }[], nextCursor, hasMore }`. Cada `item.id` es el id de la foto.

- [ ] **Step 1: Reescribir `GET /api/gallery`**

Reemplazar el contenido de `src/app/api/gallery/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/index";
import { like, sql, eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const filter = searchParams.get("filter") || "";
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 50);

  const conditions = [
    eq(schema.appointmentPhotos.kind, "final"),
    eq(schema.appointments.sharedToGallery, 1),
  ];

  if (filter) {
    conditions.push(like(schema.services.name, `%${filter}%`));
  }

  if (cursor) {
    conditions.push(sql`${schema.appointmentPhotos.createdAt} < ${Number(cursor)}`);
  }

  const rows = db
    .select({
      id: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      clientName: schema.users.name,
      serviceName: schema.services.name,
      serviceId: schema.services.id,
      appointmentId: schema.appointments.id,
      createdAt: schema.appointmentPhotos.createdAt,
    })
    .from(schema.appointmentPhotos)
    .innerJoin(schema.appointments, eq(schema.appointmentPhotos.appointmentId, schema.appointments.id))
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(and(...conditions))
    .orderBy(sql`${schema.appointmentPhotos.createdAt} DESC`)
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    url: r.url ?? "/placeholder.svg",
    clientName: r.clientName,
    serviceName: r.serviceName,
    serviceId: r.serviceId,
    appointmentId: r.appointmentId,
  }));
  const nextCursor = hasMore ? String(rows[limit - 1]?.createdAt ?? "") : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gallery/route.ts
git commit -m "feat(api): muro de inspiración por foto final (kind='final')"
```

---

### Task 4: API de citas — completar con fotos finales y fotos de referencia

**Files:**
- Modify: `src/app/api/appointments/[id]/route.ts`
- Create: `src/app/api/appointments/[id]/photos/route.ts`

**Interfaces:**
- Consumes: `schema.appointmentPhotos.kind`, `schema.appointments.sharedToGallery`.
- Produces: `PATCH /api/appointments/[id]` acepta `{ status, finalPhotos?: string[] }`. `GET /api/appointments/[id]/photos` → `{ id, url }[]` (solo `kind='reference'`).

- [ ] **Step 1: Ampliar `PATCH`**

En `src/app/api/appointments/[id]/route.ts`, dentro del bloque `if (status === "completed" && appointment.status !== "completed")` (después del incremento de visitas/ingresos, es decir justo antes de cerrar el `if`), añadir el manejo de fotos finales:

```ts
  if (status === "completed" && appointment.status !== "completed") {
    const client = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, appointment.clientId))
      .get();

    if (client) {
      const service = db
        .select()
        .from(schema.services)
        .where(eq(schema.services.id, appointment.serviceId))
        .get();

      db.update(schema.users)
        .set({
          totalVisits: (client.totalVisits ?? 0) + 1,
          totalRevenue: (client.totalRevenue ?? 0) + (service?.price ?? 0),
        })
        .where(eq(schema.users.id, client.id))
        .run();
    }

    const finalPhotos: string[] = Array.isArray(body.finalPhotos)
      ? body.finalPhotos.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
      : [];

    if (finalPhotos.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      finalPhotos.forEach((url, i) => {
        db.insert(schema.appointmentPhotos)
          .values({
            id: crypto.randomUUID(),
            appointmentId: id,
            url,
            position: i,
            createdAt: now,
            kind: "final",
          })
          .run();
      });
      db.update(schema.appointments)
        .set({
          finalPhotoUrl: finalPhotos[0],
          sharedToGallery: 1,
        })
        .where(eq(schema.appointments.id, id))
        .run();
    }
  }
```

- [ ] **Step 2: Nuevo endpoint GET fotos de referencia**

Crear `src/app/api/appointments/[id]/photos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const photos = db
    .select({ id: schema.appointmentPhotos.id, url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(
      and(
        eq(schema.appointmentPhotos.appointmentId, id),
        eq(schema.appointmentPhotos.kind, "reference")
      )
    )
    .orderBy(schema.appointmentPhotos.position)
    .all();
  return NextResponse.json(photos);
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/appointments
git commit -m "feat(api): completar cita con fotos finales y endpoint de fotos de referencia"
```

---

### Task 5: API de clientes (listado, alta manual) y perfil propio

**Files:**
- Create: `src/app/api/clients/route.ts`
- Modify: `src/app/api/clients/[id]/route.ts`
- Create: `src/app/api/profile/route.ts`

**Interfaces:**
- Consumes: `schema.users.role`, `bcryptjs`.
- Produces:
  - `GET /api/clients?q=...` → lista `{ id, name, email, phone, address, totalVisits, totalRevenue, techNotes, createdAt }`.
  - `POST /api/clients` body `{ name, email?, phone?, address? }` → `{ success: true, id }`.
  - `PATCH /api/clients/[id]` acepta `{ name?, phone?, address?, techNotes? }`.
  - `PATCH /api/profile` (self) acepta `{ phone?, address? }`.

- [ ] **Step 1: Crear `GET`/`POST /api/clients`**

Crear `src/app/api/clients/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, like, or, and } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const conditions = [eq(schema.users.role, "client")];
  if (q) {
    conditions.push(
      or(
        like(schema.users.name, `%${q}%`),
        like(schema.users.email, `%${q}%`),
        like(schema.users.phone, `%${q}%`)
      )!
    );
  }
  const clients = db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      address: schema.users.address,
      totalVisits: schema.users.totalVisits,
      totalRevenue: schema.users.totalRevenue,
      techNotes: schema.users.techNotes,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(and(...conditions))
    .orderBy(schema.users.name)
    .all();
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "El correo es inválido" }, { status: 400 });
  }

  if (!email) {
    email = `${crypto.randomUUID()}@local`;
  }

  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un cliente con ese correo" },
      { status: 409 }
    );
  }

  const randomPassword = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    phone: phone || null,
    address: address || null,
    passwordHash,
    totalVisits: 0,
    totalRevenue: 0,
    role: "client" as const,
    createdAt: Math.floor(Date.now() / 1000),
  };

  db.insert(schema.users).values(user).run();

  return NextResponse.json({ success: true, id: user.id }, { status: 201 });
}
```

- [ ] **Step 2: Ampliar `PATCH /api/clients/[id]`**

En `src/app/api/clients/[id]/route.ts`, reemplazar el cuerpo del `PATCH` para aceptar más campos:

```ts
  const { id } = await params;
  const body = await req.json();
  const update: Partial<typeof schema.users.$inferSelect> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.address !== undefined) update.address = body.address;
  if (body.techNotes !== undefined) update.techNotes = body.techNotes;

  if (Object.keys(update).length > 0) {
    db.update(schema.users).set(update).where(eq(schema.users.id, id)).run();
  }

  return NextResponse.json({ success: true });
```

- [ ] **Step 3: Crear `PATCH /api/profile`**

Crear `src/app/api/profile/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const update: Partial<typeof schema.users.$inferSelect> = {};
  if (typeof body.phone === "string") update.phone = body.phone.trim();
  if (typeof body.address === "string") update.address = body.address.trim();
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  db.update(schema.users).set(update).where(eq(schema.users.id, session.user.id)).run();
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).get();
  return NextResponse.json(user);
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/clients src/app/api/profile
git commit -m "feat(api): CRM de clientes (listado/alta/edición) y perfil propio"
```

---

### Task 6: Teléfono en sesión y página `/complete-registration`

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/types/next-auth.d.ts`
- Create: `src/app/(client)/complete-registration/page.tsx`
- Create: `src/app/(client)/complete-registration/CompleteRegistrationForm.tsx`
- Modify: `src/app/(client)/profile/page.tsx`
- Modify: `src/app/(public)/book/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/profile`.
- Produces: `session.user.phone: string | null | undefined`; página `/complete-registration` que redirige a `/profile` si el usuario ya tiene teléfono.

- [ ] **Step 1: Añadir `phone` al token y a la sesión**

En `src/lib/auth.ts`, modificar el callback `jwt` (leer phone junto a role) y el `session`:

```ts
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        const row = db
          .select({ role: schema.users.role, phone: schema.users.phone })
          .from(schema.users)
          .where(eq(schema.users.id, user.id))
          .get();
        token.role = row?.role ?? "client";
        token.phone = row?.phone ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as string) ?? "client";
        session.user.phone = (token.phone as string | null) ?? null;
      }
      return session;
    },
```

En `src/types/next-auth.d.ts`, ampliar tipos:

```ts
declare module "next-auth" {
  interface Session {
    user: { id: string; role: string; phone?: string | null } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    phone?: string | null;
  }
}
```

- [ ] **Step 2: Redirigir en `/profile` si falta teléfono**

En `src/app/(client)/profile/page.tsx`, después del bloque `if (!user) { redirect("/"); }`:

```ts
  if (!user.phone) {
    redirect("/complete-registration");
  }
```

- [ ] **Step 3: Redirigir en `/book` si el usuario autenticado no tiene teléfono**

Reemplazar `src/app/(public)/book/page.tsx`:

```tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { BookingWizard } from "@/components/BookingWizard";

export default async function BookPage() {
  const session = await auth();
  if (session?.user?.id) {
    const user = db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, session.user.id)).get();
    if (user && !user.phone) {
      redirect("/complete-registration");
    }
  }
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-gray-400">
          Cargando...
        </div>
      }
    >
      <BookingWizard />
    </Suspense>
  );
}
```

- [ ] **Step 4: Página `/complete-registration`**

Crear `src/app/(client)/complete-registration/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { CompleteRegistrationForm } from "./CompleteRegistrationForm";

export default async function CompleteRegistrationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).get();
  if (!user) {
    redirect("/");
  }
  if (user.phone) {
    redirect("/profile");
  }
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
        Completa tu registro
      </h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        Necesitamos tu número de teléfono para contactarte sobre tus citas.
      </p>
      <CompleteRegistrationForm initialName={user.name} />
    </div>
  );
}
```

Crear `src/app/(client)/complete-registration/CompleteRegistrationForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none";

export function CompleteRegistrationForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("El número de teléfono es requerido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), address: address.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar");
      }
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
        <input value={initialName} disabled className={inputCls + " bg-gray-50 text-gray-500"} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Teléfono (WhatsApp) <span className="text-red-500">*</span>
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+58 412 123 4567"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Dirección (opcional)</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Tu dirección"
          className={inputCls}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-pink-main px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-pink-light disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando..." : "Guardar y continuar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts "src/app/(client)/complete-registration" "src/app/(client)/profile/page.tsx" "src/app/(public)/book/page.tsx"
git commit -m "feat(auth): pedir teléfono tras registro con Google (complete-registration)"
```

---

### Task 7: Diálogo "Completar cita" con carga de fotos

**Files:**
- Create: `src/components/CompleteAppointmentDialog.tsx`
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`
- Modify: `src/components/AppointmentCard.tsx` (si acaso, para texto del botón)

**Interfaces:**
- Consumes: `PATCH /api/appointments/[id]` con `{ status, finalPhotos }`, `POST /api/upload`.
- Produces: `CompleteAppointmentDialog` con props `{ appointmentId: string; clientName: string; serviceName: string; onClose: () => void; onCompleted: () => void }`.

- [ ] **Step 1: Crear el diálogo**

Crear `src/components/CompleteAppointmentDialog.tsx`:

```tsx
"use client";

import { useState } from "react";

type Props = {
  appointmentId: string;
  clientName: string;
  serviceName: string;
  onClose: () => void;
  onCompleted: () => void;
};

export function CompleteAppointmentDialog({
  appointmentId,
  clientName,
  serviceName,
  onClose,
  onCompleted,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Completar cita</h3>
        <p className="mt-1 text-sm text-gray-500">
          {clientName} · {serviceName}
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

- [ ] **Step 2: Conectar en `DashboardContent`**

En `src/app/(admin)/dashboard/DashboardContent.tsx`:
- Importar el diálogo.
- Añadir estado `const [completing, setCompleting] = useState<Appointment | null>(null);`.
- Reemplazar `handleComplete`:

```ts
  function handleComplete(appt: Appointment) {
    setCompleting(appt);
  }
```

- En el render de `AppointmentCard` (vista día), cambiar `onComplete={handleComplete}` por `onComplete={() => handleComplete(appt)}` (en la vista semana no hay botón completar; si se desea, añadirlo más adelante).
- Añadir antes del cierre del `<div>` raíz:

```tsx
      {completing && (
        <CompleteAppointmentDialog
          appointmentId={completing.id}
          clientName={completing.clientName}
          serviceName={completing.serviceName}
          onClose={() => setCompleting(null)}
          onCompleted={() => {
            setCompleting(null);
            refreshAll();
          }}
        />
      )}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: en `/dashboard` con `npm run dev`, pulsar "Completar" en una cita pendiente → se abre el diálogo; subir fotos → "Confirmar completado" → la cita pasa a completada y las fotos aparecen en `/` (muro) tras `npm run db:seed` no es necesario; el muro solo muestra fotos `kind='final'`.

- [ ] **Step 4: Commit**

```bash
git add src/components/CompleteAppointmentDialog.tsx "src/app/(admin)/dashboard/DashboardContent.tsx"
git commit -m "feat(dashboard): completar cita con subida de fotos finales"
```

---

### Task 8: Carrusel de modelos en la agenda + contactos en el panel CRM

**Files:**
- Create: `src/components/PhotoCarousel.tsx`
- Modify: `src/components/ClientCRMPanel.tsx`

**Interfaces:**
- Consumes: `GET /api/appointments/[id]/photos`, `PATCH /api/clients/[id]`.
- Produces: `PhotoCarousel` con props `{ photos: { id: string; url: string }[] }`. `ClientCRMPanel` con props opcionales `appointmentId?`, `serviceName?`, `appointmentDate?`, `appointmentTime?`.

- [ ] **Step 1: Crear `PhotoCarousel`**

Crear `src/components/PhotoCarousel.tsx`:

```tsx
"use client";

import { useState } from "react";

type Photo = { id: string; url: string };

export function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const current = photos[Math.min(index, photos.length - 1)];
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Modelos de referencia
      </p>
      <div className="relative overflow-hidden rounded-xl bg-gray-soft">
        <img src={current.url} alt="Modelo de referencia" className="h-52 w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 hover:bg-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? "bg-pink-main" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ampliar `ClientCRMPanel`**

En `src/components/ClientCRMPanel.tsx`:
- Cambiar el tipo `Props` para props opcionales:

```ts
type Props = {
  clientId: string;
  appointmentId?: string;
  serviceName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  onClose: () => void;
};
```

- Añadir estado y fetch del carrusel:

```ts
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    if (!appointmentId) return;
    fetch(`/api/appointments/${appointmentId}/photos`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPhotos(data);
      })
      .catch(() => {});
  }, [appointmentId]);
```

- Envolver el fetch de compras con `if (!appointmentId) return;`.
- Añadir un apartado de contactos editables. Estado nuevo:

```ts
  const [contact, setContact] = useState({ name: "", phone: "", address: "" });
  const [editingContact, setEditingContact] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
```

En el `useEffect` de `clientId`, rellenar `contact`:

```ts
        setClient(data);
        setTechNotes(data.techNotes || "");
        setContact({
          name: data.name ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
        });
```

Función guardar contactos:

```ts
  async function saveContact() {
    if (!client) return;
    setContactSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contact.name,
          phone: contact.phone,
          address: contact.address,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setClient({ ...client, name: contact.name, phone: contact.phone, address: contact.address });
      setEditingContact(false);
    } catch {
      setEditingContact(false);
    } finally {
      setContactSaving(false);
    }
  }
```

- Ajustar `const whatsappUrl` para el caso sin cita:

```ts
  const whatsappUrl = client.phone
    ? `https://wa.me/${client.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        appointmentId
          ? `Hola ${client.name}, te recuerdo tu cita de ${serviceName ?? ""} el ${appointmentDate ?? ""} a las ${appointmentTime ?? ""}.`
          : `Hola ${client.name}!`
      )}`
    : null;
```

- En el JSX:
  - Debajo del header (`<h3>{client.name}</h3>`), añadir `<PhotoCarousel photos={photos} />`.
  - Antes de las notas técnicas, añadir la sección de contacto editable:

```tsx
        <div className="mb-6 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contacto</p>
            {!editingContact && (
              <button
                onClick={() => setEditingContact(true)}
                className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Editar
              </button>
            )}
          </div>
          {!editingContact ? (
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <p className="font-medium text-gray-900">{contact.name}</p>
              {contact.phone && <p>{contact.phone}</p>}
              {contact.address && <p className="text-gray-500">{contact.address}</p>}
              {!contact.phone && !contact.address && (
                <p className="text-gray-400">Sin datos de contacto</p>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                placeholder="Nombre"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
              />
              <input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="Teléfono"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
              />
              <input
                value={contact.address}
                onChange={(e) => setContact({ ...contact, address: e.target.value })}
                placeholder="Dirección"
                className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-pink-main focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveContact}
                  disabled={contactSaving}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {contactSaving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => setEditingContact(false)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
```

  - Sustituir `{client.phone && (...)}` por `{whatsappUrl && (...)}` para el enlace de WhatsApp.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: en `/dashboard` (día y semana) abrir una cita → el panel muestra carrusel con las fotos de referencia del cliente (necesitas que existan, p.ej. tras `npm run db:seed:client`).

- [ ] **Step 4: Commit**

```bash
git add src/components/PhotoCarousel.tsx src/components/ClientCRMPanel.tsx
git commit -m "feat(dashboard): carrusel de modelos en la agenda y contactos editables en CRM"
```

---

### Task 9: Página `/dashboard/clients`

**Files:**
- Create: `src/app/(admin)/dashboard/clients/ClientsContent.tsx`
- Modify: `src/app/(admin)/dashboard/clients/page.tsx`

**Interfaces:**
- Consumes: `GET /api/clients`, `POST /api/clients`, `ClientCRMPanel` (con `appointmentId` opcional).
- Produces: `ClientsContent` sin props, página `/dashboard/clients`.

- [ ] **Step 1: Crear `ClientsContent`**

Crear `src/app/(admin)/dashboard/clients/ClientsContent.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ClientCRMPanel } from "@/components/ClientCRMPanel";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  totalVisits: number | null;
  totalRevenue: number | null;
  techNotes: string | null;
  createdAt: number | null;
};

const inputCls =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-pink-main focus:outline-none";

export function ClientsContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchClients = useCallback(async (query: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const res = await fetch(`/api/clients?${params}`);
    if (res.ok) setClients(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void fetchClients(q), 300);
    return () => clearTimeout(t);
  }, [q, fetchClients]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el cliente");
      }
      setShowNew(false);
      setForm({ name: "", email: "", phone: "", address: "" });
      await fetchClients(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">
            Registro de clientes con visitas, ingresos y notas técnicas.
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="rounded-xl bg-pink-main px-4 py-2 text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
        >
          {showNew ? "Cancelar" : "+ Nuevo cliente"}
        </button>
      </div>

      {showNew && (
        <form onSubmit={createClient} className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Nuevo cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email (opcional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+58 412 123 4567"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={saving || !form.name}
            className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creando..." : "Crear cliente"}
          </button>
        </form>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, email o teléfono..."
        className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-pink-main focus:outline-none"
      />

      <div className="space-y-3">
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-pink-main hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500 truncate">{c.email}</p>
                <p className="text-sm text-gray-500">{c.phone ?? "Sin teléfono"}</p>
                {c.address && <p className="text-sm text-gray-400 truncate">{c.address}</p>}
              </div>
              <div className="flex shrink-0 gap-3 text-center">
                <div className="rounded-lg bg-pink-light px-3 py-1.5">
                  <p className="text-sm font-bold text-gray-900">{c.totalVisits ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Visitas</p>
                </div>
                <div className="rounded-lg bg-pink-light px-3 py-1.5">
                  <p className="text-sm font-bold text-gray-900">${(c.totalRevenue ?? 0).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">Ingresos</p>
                </div>
              </div>
            </div>
          </button>
        ))}
        {clients.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400">No se encontraron clientes</p>
          </div>
        )}
      </div>

      {selected && (
        <ClientCRMPanel
          clientId={selected.id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Actualizar la página**

Reemplazar `src/app/(admin)/dashboard/clients/page.tsx`:

```tsx
import { ClientsContent } from "./ClientsContent";

export default function ClientsPage() {
  return <ClientsContent />;
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: `/dashboard/clients` muestra clientes con búsqueda, alta manual y panel con notas/contactos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/dashboard/clients"
git commit -m "feat(admin): CRM de clientes (listado, búsqueda, alta manual)"
```

---

### Task 10: Modelos de inspiración en la confirmación de reserva

**Files:**
- Modify: `src/components/BookingWizard.tsx`

**Interfaces:**
- Consumes: `GET /api/gallery`.
- Produces: `selectedModels: string[]` (URLs) que se envían como `referencePhotoUrls` junto con las subidas. Soporta el query param `referencePhotoUrl` (preselección desde el muro).

- [ ] **Step 1: Estado y fetch del muro**

En `src/components/BookingWizard.tsx`:

Añadir tipos:

```ts
type GalleryItem = {
  id: string;
  url: string;
  serviceName: string;
};
```

Añadir estado:

```ts
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
```

En el `useEffect` de montaje, guardar el resultado del fetch del muro y leer el param `referencePhotoUrl`:

```ts
  useEffect(() => {
    fetch("/api/gallery?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) setGallery(data.items);
      })
      .catch(() => {});
    void fetchServices();
    void preselectedService();
  }, []);
```

En `preselectedService()`, además, leer `referencePhotoUrl`:

```ts
    const referencePhotoUrl = searchParams.get("referencePhotoUrl");
    if (referencePhotoUrl) {
      setSelectedModels((prev) =>
        prev.includes(referencePhotoUrl) ? prev : [...prev, referencePhotoUrl]
      );
    }
```

- [ ] **Step 2: Manejar selección de modelos**

Añadir funciones junto a los handlers existentes:

```ts
  function toggleModel(url: string) {
    setSelectedModels((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }
```

- [ ] **Step 3: Enviar las URLs combinadas**

En `handleConfirm`, tras subir los archivos, combinar:

```ts
      const urlsToSend = [...referencePhotoUrls, ...selectedModels];
```

Y usarla en el body:

```ts
          referencePhotoUrl: urlsToSend[0] || "",
          referencePhotoUrls: urlsToSend,
```

- [ ] **Step 4: Sección "Modelos de inspiración" en el paso 3**

Dentro del bloque `{step === 3 && selectedService && (`, después del bloque de subida de fotos (después de la línea que cierra `{referencePreviews.length > 0 && (...)}`) y antes de `{submitError && (`), insertar:

```tsx
          {/* Modelos de inspiración */}
          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Elige modelos del muro de inspiración (opcional)
            </label>
            {gallery.length === 0 ? (
              <p className="text-sm text-gray-400">
                Aún no hay modelos en el muro de inspiración
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gallery.map((g) => {
                  const selected = selectedModels.includes(g.url);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleModel(g.url)}
                      className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                        selected ? "border-pink-main" : "border-transparent"
                      }`}
                    >
                      <img src={g.url} alt={g.serviceName} className="aspect-square w-full object-cover" />
                      {selected && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-main text-xs font-bold text-gray-900">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedModels.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-sm text-gray-500">
                  {selectedModels.length} modelo{selectedModels.length > 1 ? "s" : ""} seleccionado
                  {selectedModels.length > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedModels.map((url) => (
                    <div key={url} className="relative">
                      <img src={url} alt="Modelo" className="h-16 w-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => toggleModel(url)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: en `/book` (paso 3) aparece la mini-galería; al seleccionar modelos y confirmar, se guardan como `referencePhotoUrls`. Probar `navegación /?referencePhotoUrl=...` no aplica; en cambio probar desde el modal del muro (Task 13) que `serviceId` y `referencePhotoUrl` preseleccionan.

- [ ] **Step 6: Commit**

```bash
git add src/components/BookingWizard.tsx
git commit -m "feat(book): modelos del muro de inspiración en confirmación de reserva"
```

---

### Task 11: Gestor de fotos de servicios

**Files:**
- Modify: `src/app/(admin)/dashboard/services/ServicesContent.tsx`

**Interfaces:**
- Consumes: `POST /api/services/[id]/photos`, `DELETE /api/services/[id]/photos/[photoId]`, `POST /api/upload`, y el campo `photos` que ahora devuelve `GET /api/services`.

- [ ] **Step 1: Tipos y fetch**

En `src/app/(admin)/dashboard/services/ServicesContent.tsx`, actualizar el tipo `Service`:

```ts
type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
  isActive: number;
  photos: { id: string; url: string; position: number }[];
};
```

- [ ] **Step 2: Añadir subida/borrado de fotos**

Añadir estado:

```ts
  const [uploadingId, setUploadingId] = useState<string | null>(null);
```

Añadir handlers:

```ts
  async function handleUploadPhotos(service: Service, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setUploadingId(service.id);
    setError("");
    setSuccess("");
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
      const res = await fetch(`/api/services/${service.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudieron guardar las fotos");
      }
      setSuccess("Fotos subidas");
      await fetchServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeletePhoto(serviceId: string, photoId: string) {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/services/${serviceId}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar la foto");
      }
      setSuccess("Foto eliminada");
      await fetchServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }
```

- [ ] **Step 3: UI en cada tarjeta de servicio**

Dentro del render no-edición de cada servicio (bloque `) : (` que muestra `service.name`), después del `<p className="mt-2 text-sm text-gray-600">${service.price...}</p>`, añadir el grid de fotos y el input de subida:

```tsx
                {service.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {service.photos.map((photo) => (
                      <div key={photo.id} className="relative">
                        <img
                          src={photo.url}
                          alt={service.name}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                        <button
                          onClick={() => handleDeletePhoto(service.id, photo.id)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  {uploadingId === service.id ? "Subiendo..." : "Subir fotos del servicio"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingId === service.id}
                    className="hidden"
                    onChange={(e) => handleUploadPhotos(service, e)}
                  />
                </label>
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: `/dashboard/services` permite subir/eliminar fotos por servicio; en el home aparecen en el carrusel (tras Task 12).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/dashboard/services/ServicesContent.tsx"
git commit -m "feat(admin): gestor de fotos por servicio"
```

---

### Task 12: Carrusel de fotos en `ServiceCard` y home

**Files:**
- Modify: `src/components/ServiceCard.tsx`
- Modify: `src/app/(public)/page.tsx`

**Interfaces:**
- Consumes: `schema.servicePhotos`.
- Produces: `ServiceCard` con prop extra `photos: { id: string; url: string }[]`.

- [ ] **Step 1: Añadir carrusel a `ServiceCard`**

Reemplazar `src/components/ServiceCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type ServiceCardProps = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMins: number;
  photos: { id: string; url: string }[];
};

export function ServiceCard({
  id,
  name,
  description,
  price,
  durationMins,
  photos,
}: ServiceCardProps) {
  const [index, setIndex] = useState(0);
  const photo = photos.length > 0 ? photos[Math.min(index, photos.length - 1)] : null;
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative overflow-hidden rounded-xl bg-gray-soft">
        {photo ? (
          <>
            <img src={photo.url} alt={name} className="h-36 w-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 hover:bg-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 hover:bg-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </>
        ) : (
          <div className="flex h-36 items-center justify-center text-gray-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>${price.toFixed(2)}</span>
        <span className="text-gray-300">|</span>
        <span>{durationMins} min</span>
      </div>
      <Link
        href={`/book?serviceId=${id}`}
        className="mt-2 rounded-xl bg-pink-main px-4 py-2.5 text-center text-sm font-medium text-gray-900 transition-colors hover:bg-pink-light"
      >
        Agendar
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Pasar fotos desde el home**

En `src/app/(public)/page.tsx`, cargar fotos y pasarlas:

```tsx
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { ServiceCard } from "@/components/ServiceCard";
import { GalleryGrid } from "@/components/GalleryGrid";

export default async function HomePage() {
  const services = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.isActive, 1))
    .all();

  const allPhotos = db.select().from(schema.servicePhotos).all();
  const byService = new Map<string, { id: string; url: string }[]>();
  for (const p of allPhotos) {
    const list = byService.get(p.serviceId) ?? [];
    list.push({ id: p.id, url: p.url });
    byService.set(p.serviceId, list);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-16">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {process.env.NEXT_PUBLIC_SALON_NAME || "Nails Salon"}
          </h1>
          <p className="mt-2 text-gray-500">
            Reserva tu cita online y descubre nuestro catálogo de servicios
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} {...s} photos={byService.get(s.id) ?? []} />
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold text-gray-900">
          Muro de Inspiración
        </h2>
        <GalleryGrid />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: `/` muestra el carrusel en cada tarjeta con fotos; sin fotos muestra el placeholder.

- [ ] **Step 4: Commit**

```bash
git add src/components/ServiceCard.tsx "src/app/(public)/page.tsx"
git commit -m "feat(home): carrusel de fotos en tarjetas de servicio"
```

---

### Task 13: Clic en foto del muro → agendar servicio similar

**Files:**
- Modify: `src/components/GalleryGrid.tsx`

**Interfaces:**
- Consumes: la nueva respuesta de `GET /api/gallery` (foto a nivel de item).
- Produces: modal con botón que navega a `/book?serviceId=X&referencePhotoUrl=Y`.

- [ ] **Step 1: Reescribir `GalleryGrid`**

Reemplazar `src/components/GalleryGrid.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FilterPills } from "./FilterPills";

type GalleryItem = {
  id: string;
  url: string;
  clientName: string;
  serviceName: string;
  serviceId: string;
  appointmentId: string;
};

export function GalleryGrid() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  const fetchItems = useCallback(
    async (reset = false) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (!reset && cursor) params.set("cursor", cursor);
      if (activeFilter) params.set("filter", activeFilter);
      params.set("limit", "10");

      const res = await fetch(`/api/gallery?${params}`);
      const data = await res.json();

      if (reset) {
        setItems(data.items);
        setCursor(null);
        setHasMore(data.hasMore);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
      setLoading(false);
    },
    [cursor, activeFilter]
  );

  useEffect(() => {
    void fetchItems(true);
  }, [fetchItems, activeFilter]);

  if (items.length === 0 && !loading) {
    return (
      <div>
        <FilterPills activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <p className="mt-8 text-center text-sm text-gray-400">
          Aún no hay fotos compartidas
        </p>
      </div>
    );
  }

  return (
    <div>
      <FilterPills activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div className="mt-6 columns-2 gap-3 sm:columns-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-gray-soft text-left transition-shadow hover:shadow-md"
          >
            <img
              src={item.url}
              alt={`Uñas de ${item.clientName}`}
              className="w-full object-cover"
              loading="lazy"
            />
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900">{item.clientName}</p>
              <p className="text-xs text-gray-500">{item.serviceName}</p>
            </div>
          </button>
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchItems(false)}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
            <img src={selected.url} alt={`Uñas de ${selected.clientName}`} className="w-full object-cover" />
            <div className="p-5">
              <p className="font-medium text-gray-900">¿Agendar un servicio similar con este modelo?</p>
              <p className="mt-1 text-sm text-gray-500">
                {selected.serviceName} · modelo de {selected.clientName}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                <Link
                  href={`/book?serviceId=${selected.serviceId}&referencePhotoUrl=${encodeURIComponent(selected.url)}`}
                  onClick={() => setSelected(null)}
                  className="flex-1 rounded-xl bg-pink-main px-4 py-2 text-center text-sm font-medium text-gray-900 hover:bg-pink-light transition-colors"
                >
                  Agendar
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.
Manual: en `/`, clic en una foto del muro abre el modal; "Agendar" lleva a `/book` con servicio y modelo preseleccionados (verificado en Task 10).

- [ ] **Step 3: Build de verificación parcial**

Run: `npm run build`
Expected: build exitoso. Si falla por tipos/lint, corregir y repetir.

- [ ] **Step 4: Commit**

```bash
git add src/components/GalleryGrid.tsx
git commit -m "feat(muro): clic en foto para agendar servicio similar con ese modelo"
```

---

### Task 14: Seeds y documentación

**Files:**
- Modify: `src/db/seed-client-demo.ts`
- Modify: `src/db/seed-demo.ts`
- Modify: `AGENTS.md`, `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: `schema.appointmentPhotos.kind`, `schema.servicePhotos`.
- Produces: semillas con fotos finales (`kind='final'`) para el muro, y fotos de servicio para el home.

- [ ] **Step 1: Actualizar `seed-client-demo.ts`**

En `src/db/seed-client-demo.ts`, dentro del bucle `for (const a of appointments)`, después del bloque `a.referenceUrls.forEach(...)` añadir el insert de fotos finales:

```ts
  if (a.finalUrl) {
    db.insert(schema.appointmentPhotos)
      .values({
        id: crypto.randomUUID(),
        appointmentId: id,
        url: a.finalUrl,
        position: 0,
        createdAt: startTime + a.service.durationMins * 60,
        kind: "final",
      })
      .run();
  }
```

Además, para que el home tenga fotos de servicios, añadir al final (antes de `console.log("✨ Demo client seed complete!")`) un bloque que siembra `service_photos` para los servicios existentes:

```ts
const existingServicePhotos = db.select().from(schema.servicePhotos).all();
if (existingServicePhotos.length === 0) {
  const photoSeeds: { url: string; position: number; service?: string }[] = [
    { url: "https://picsum.photos/seed/svc-acrilicas/500/400", position: 0 },
    { url: "https://picsum.photos/seed/svc-gel/500/400", position: 1 },
    { url: "https://picsum.photos/seed/svc-clasico/500/400", position: 2 },
  ];
  const svcList = db.select().from(schema.services).all();
  svcList.forEach((svc, i) => {
    const seed = photoSeeds[i % photoSeeds.length];
    db.insert(schema.servicePhotos)
      .values({
        id: crypto.randomUUID(),
        serviceId: svc.id,
        url: seed.url,
        position: seed.position,
        createdAt: now,
      })
      .run();
  });
  console.log("✅ Fotos de servicios sembradas");
}
```

- [ ] **Step 2: Actualizar `seed-demo.ts`**

En `src/db/seed-demo.ts`, tras el insert de appointments (bloque `db.insert(schema.appointments).values(appointments).run();`), añadir fotos finales para los que tengan `finalPhotoUrl`:

```ts
  for (const a of appointments) {
    if (a.finalPhotoUrl) {
      db.insert(schema.appointmentPhotos)
        .values({
          id: crypto.randomUUID(),
          appointmentId: a.id,
          url: a.finalPhotoUrl,
          position: 0,
          createdAt: a.startTime + 3600,
          kind: "final",
        })
        .run();
    }
  }
```

Tras el bloque de `galleryEntries` (después de su insert), añadir:

```ts
  for (const g of galleryEntries) {
    if (g.finalPhotoUrl) {
      db.insert(schema.appointmentPhotos)
        .values({
          id: crypto.randomUUID(),
          appointmentId: g.id,
          url: g.finalPhotoUrl,
          position: 0,
          createdAt: g.startTime + 3600,
          kind: "final",
        })
        .run();
    }
  }
```

- [ ] **Step 3: Ejecutar semillas y verificar**

Run: `npm run db:seed:client`
Expected: regenera las citas del demo con fotos finales y fotos de servicios.

Run: `npm run db:seed` (si la base está vacía; si ya tiene datos, al menos no debe romper).
Expected: no rompe.

- [ ] **Step 4: Documentación**

- `CHANGELOG.md`: añadir bajo `## [Sin publicar]` → `### Añadido` las entradas:
  - Completar cita con subida de varias fotos finales que se publican automáticamente en el muro de inspiración.
  - Selección de modelos del muro de inspiración al confirmar reserva (fotos de referencia).
  - Carrusel de modelos de referencia al abrir una cita en la agenda (vista día y semana).
  - CRM de clientes: listado, búsqueda, alta manual, edición de teléfono/dirección/notas y stats de visitas/ingresos en `/dashboard/clients`.
  - Página `/complete-registration` que pide teléfono tras registrarse con Google.
  - Fotos de servicios: gestor en `/dashboard/services` y carrusel en las tarjetas del home.
  - Muro de inspiración: clic en foto para agendar un servicio similar con ese modelo.
- `README.md`: reflejar las nuevas funcionalidades (muro por fotos, CRM, fotos de servicios, complete-registration).
- `AGENTS.md`: actualizar el modelo de datos (columna `kind` en `appointment_photos`, tabla `service_photos`) y la lista de componentes clave si aplica.

- [ ] **Step 5: Verificación final**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/seed-client-demo.ts src/db/seed-demo.ts AGENTS.md CHANGELOG.md README.md
git commit -m "chore: seeds con fotos finales/servicios y documentación"
```

---

## Self-Review (checklist corrido tras escribir el plan)

- **Cobertura de spec:**
  - Completar cita con fotos → Task 7 (dialog + PATCH finalPhotos). ✔
  - Fotos del completado salen en el muro → Tasks 3 y 4 (`kind='final'` + gallery). ✔
  - Muro al confirmar reserva → Task 10. ✔
  - Carrusel en agenda (día y semana) → Task 8 (panel compartido). ✔
  - CRM: registro al iniciar sesión/agendar (users = clientes) → Task 5 (listado). ✔
  - Teléfono tras registro Google → Task 6. ✔
  - CRM con nombre/teléfono/dirección/visitas → Tasks 5, 8, 9. ✔
  - Fotos de servicios + carrusel home → Tasks 2, 11, 12. ✔
  - Clic en muro → agendar similar → Task 13. ✔
  - Push a GitHub antes de cambios → ya realizado (commit `fd176ae`). ✔
- **Placeholders:** sin "TBD"/"TODO"; todo paso incluye código o comando concreto. ✔
- **Consistencia de tipos:** `kind: "final"` usado en Tasks 3/4/14; `servicePhotos` con `{ id, url, position }`; `ClientCRMPanel` props opcionales consistentes entre Tasks 8 y 9; `GalleryGrid` item con `serviceId`/`url` consistente entre Tasks 3 y 13; `selectedModels` consistente en Task 10. ✔
