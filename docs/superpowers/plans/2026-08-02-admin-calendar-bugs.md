# Admins + Google Calendar + Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-admin system with roles, a calendar dashboard that reschedules appointments and syncs events to both client's and admin's Google Calendar, booking/photo/session bug fixes, and a documentation-maintenance rule.

**Architecture:** NextAuth v5 + Drizzle (SQLite). Adds `users.role`, `appointment_photos` 1:N table, `lib/authz.ts` authorization helpers, `/api/admins` (superadmin only), `lib/calendar.ts` (Google Calendar v3 via stored OAuth access tokens with refresh flow), extends `POST/PATCH /api/appointments`, a day/week calendar view in `DashboardContent`, multi-photo submit in `BookingWizard`, and `/profile` upcoming appointments.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, better-sqlite3 + Drizzle, NextAuth v5 beta.32, tsc/lint, npm scripts. Timezone: America/Caracas (`-04:00`).

## Global Constraints

- Spanish UI strings (`es-ES`), timezone America/Caracas everywhere.
- Drizzle only (no raw SQL queries in app code; SQL pure via Drizzle). Style: Tailwind pastel palette as existing.
- Auth via NextAuth v5; provider credentials live in `.env` as `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (v5 naming). Admin= `ADMIN_EMAIL` (superadmin), plus new `role` column.
- Uploads go to `/public/uploads`; images referenced by URL.
- Every relevant change must also update `AGENTS.md`, `CHANGELOG.md`, `README.md` (rule added in this iteration).
- Verification commands (no JS test framework installed): `npx tsc --noEmit`, `npm run lint`, plus curl against the dev server (`npm run dev`) for API routes.
- Migrations: `npx drizzle-kit generate`, then `npx drizzle-kit migrate`.
- Commit style (from history): `Fase N: <desc>` / `feat: ...`. No automatic commits: commit only when user asks.

---

### Task 1: Data model — role + appointment_photos + indices

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0001_*.sql` (via drizzle-kit generate)
- Modify: `src/db/seed.ts` (add role in testing inserts as needed)

**Interfaces:**
- Produces: `users.role: text default 'client'`; table `appointment_photos(id, appointmentId, url, position, createdAt)`; index on `appointments.clientId`, `appointments.startTime`. Consumers later read `field('appointment_photos')` and `users.role`.

- [ ] **Step 1: Edit schema**

In `src/db/schema.ts`:
- Add to `users` table: `role: text("role").notNull().default("client"),`
- Add new table after `appointments`:
  ```ts
  export const appointmentPhotos = sqliteTable("appointment_photos", {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id").notNull().references(() => appointments.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at"),
  });
  ```
- Add unique? no. Keep simple.

- [ ] **Step 2: Add indices**

```ts
// at bottom of schema.ts
export const clientIdIndex = sqliteIndex("appointments_client_id_idx").on(appointments.clientId);
export const startTimeIndex = sqliteIndex("appointments_start_time_idx").on(appointments.startTime);
```

- [ ] **Step 3: Generate + apply migration**

Run: `npx drizzle-kit generate` then `npx drizzle-kit migrate`
Expected: new `drizzle/0001_*.sql` with `ALTER TABLE users ADD role` + `CREATE TABLE appointment_photos` + two `CREATE INDEX`.

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. If `sqliteIndex` import missing, add it to the drizzle imports in `schema.ts`.

- [ ] **Step 5: Sanity check DB**

Run: `node -e "const D=require('better-sqlite3');const db=new D('dev.db');console.log(db.prepare('PRAGMA table_info(users)').all().map(c=>c.name));console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'appointment_photos\'').get())"`
Expected: `role` present in users cols; `appointment_photos` table exists.

---

### Task 2: AuthZ helpers + session role

**Files:**
- Create: `src/lib/authz.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Produces:
  ```ts
  import type { Session } from "next-auth";
  export function getSessionRole(session: Session | null): "client" | "admin";
  export async function isAdmin(session: Session | null): Promise<boolean>;
  export async function isSuperAdmin(session: Session | null): Promise<boolean>;
  ```
  `isSuperAdmin` checks `session?.user?.email === process.env.ADMIN_EMAIL`.

- [ ] **Step 1: Write `src/lib/authz.ts`**

```ts
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

export function getSessionRole(session: Session | null): "client" | "admin" {
  return session?.user?.role === "admin" ? "admin" : "client";
}

export async function isAdmin(session: Session | null): Promise<boolean> {
  if (!session?.user?.id) return false;
  const user = db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, session.user.id)).get();
  return user?.role === "admin";
}

export async function isSuperAdmin(session: Session | null): Promise<boolean> {
  return session?.user?.email === process.env.ADMIN_EMAIL;
}
```

- [ ] **Step 2: Extend NextAuth session typing + role**

Edit `src/lib/auth.ts`:
- In `callbacks.session`, also set `session.user.role` from DB:
  ```ts
  const user = db.select({ role: schema.users.role, name: schema.users.name, image: schema.users.image }).from(schema.users).where(eq(schema.users.id, user.id)).get();
  if (session.user) { session.user.id = user.id; session.user.role = user?.role ?? "client"; }
  return session;
  ```
  (Import `db`, `schema`, `eq` at top.)
- Add a `signIn` callback that promotes `ADMIN_EMAIL`-logged users:
  ```ts
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email;
      if (email && email === process.env.ADMIN_EMAIL) {
        try {
          db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.email, email)).run();
        } catch (e) { console.error("role promote failed", e); }
      }
      return true;
    },
    ...
  }
  ```
  Note: user row must already exist (adapter creates it); row may be created before `signIn` callback runs — acceptable for this MVP.
- Create `src/types/next-auth.d.ts` augmenting Session user:
  ```ts
  import type { DefaultSession } from "next-auth";
  declare module "next-auth" {
    interface Session {
      user: { id: string; role: string } & DefaultSession["user"];
    }
  }
  declare module "@auth/core/jwt" { interface JWT { role?: string } }
  ```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → expect no errors.

---

### Task 3: BookingWizard — multi-photo upload + submit hardening

**Files:**
- Modify: `src/components/BookingWizard.tsx`

**Interfaces:**
- Produces: Step 3 allows selecting multiple images; `handleConfirm` uploads each to `/api/upload`, sends `referencePhotoUrls: string[]` in POST `/api/appointments`; on non-OK shows inline error `submitError`; sets `submitting=false` in `finally`.

- [ ] **Step 1: State changes**

Replace `referenceFile`/`referencePreview` (single) with:
```ts
const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
const [submitError, setSubmitError] = useState<string>("");
```
In the input `onChange` use `e.target.files` → `Array.from(files).slice(0,6)`.

- [ ] **Step 2: Rewrite `handleConfirm`**

```ts
async function handleConfirm() {
  if (!selectedService || !selectedSlot || status !== "authenticated") return;
  setSubmitting(true);
  setSubmitError("");
  try {
    const referencePhotoUrls: string[] = [];
    for (const file of referenceFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) throw new Error("Error subiendo la foto");
      const data = await up.json();
      referencePhotoUrls.push(data.url);
    }
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: selectedService.id, startTime: selectedSlot, referencePhotoUrls }),
    });
    if (!res.ok) throw new Error("No se pudo agendar, intenta de nuevo");
    router.push("/success");
  } catch (e) {
    setSubmitError(e instanceof Error ? e.message : "Error inesperado");
  } finally {
    setSubmitting(false);
  }
}
```

- [ ] **Step 3: Render previews & error**

- Replace preview block: map `referencePreviews` to `<img>` thumbnails.
- Add below buttons: `{submitError && <p className="text-sm text-red-600">{submitError}</p>}`
- Button label keeps `submitting ? "Reservando…" : "Confirmar reserva"` with `disabled={submitting}`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` and `npm run lint` → expect clean.

---

### Task 4: Appointments API — multi-photo create + calendar hooks

**Files:**
- Modify: `src/app/api/appointments/route.ts`
- Create: `src/lib/calendar.ts` (stub calls)

**Interfaces:**
- Consumes: `appointmentPhotos` schema.
- Produces:
  ```ts
  export async function syncAppointmentToGoogleCalendars(appointmentId: string): Promise<void>
  ```
  called after insert. (Calendar lib built in Task 6; here we write the stub and call site.)

- [ ] **Step 1: Update POST body parsing**

```ts
const { serviceId, startTime, referencePhotoUrl, referencePhotoUrls } = body;
const urls: string[] = referencePhotoUrls?.length ? referencePhotoUrls : (referencePhotoUrl ? [referencePhotoUrl] : []);
```

- [ ] **Step 2: Insert appointment + photos**

After insert appointment:
```ts
urls.forEach((url, i) => {
  db.insert(schema.appointmentPhotos).values({
    id: crypto.randomUUID(), appointmentId: appointment.id, url, position: i, createdAt: now,
  }).run();
});
```

- [ ] **Step 3: Call calendar sync stub**

```ts
import { syncAppointmentPhotosToGoogleCalendarsPlaceholder } from "@/lib/calendar"; // replace in Task 6
await syncAppointmentPhotosToGoogleCalendarsPlaceholder(appointment.id);
```
(Task 7 replaces with real sync.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → expect success.

---

### Task 5: Dashboard admin authorization by role

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx`
- Modify: `src/app/api/appointments/route.ts` (GET)
- Modify: `src/app/api/appointments/[id]/route.ts`
- Modify: `src/app/api/clients/[id]/route.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Produces: all admin endpoints + dashboard use `isAdmin(await auth())`; middleware keeps login gate + redirects `/dashboard` for non-logs (DB check in pages/API is authoritative).

- [ ] **Step 1: Dashboard page**

Replace `if (session?.user?.email !== process.env.ADMIN_EMAIL)` with `const ok = await isAdmin(session); if (!ok) redirect("/");` (import from `@/lib/authz`).

- [ ] **Step 2: appointments GET**

Replace `if (session?.user?.email !== process.env.ADMIN_EMAIL)` with `if (!(await isAdmin(session)))`.

- [ ] **Step 3: appointments/[id] PATCH**

Same replacement.

- [ ] **Step 4: clients/[id]**

Read + confirm current pattern; replace auth check with `isAdmin`.

- [ ] **Step 5: middleware**

Middleware can't hit DB with adapter sessions; keep `isLoggedIn` gate. For `/dashboard` non-admin (no role available in JWT), leave page-level check authoritative. Simplify middleware to:
```ts
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;
  if (pathname.startsWith("/dashboard") && !isLoggedIn) return NextResponse.redirect(new URL("/", req.url));
  if (pathname.startsWith("/profile") && !isLoggedIn) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
});
```
(matcher unchanged.)

- [ ] **Step 6: Typecheck**

`npx tsc --noEmit` clean.

---

### Task 6: Google Calendar lib (`src/lib/calendar.ts`)

**Files:**
- Create: `src/lib/calendar.ts`

**Interfaces:**
- Produces:
  ```ts
  import type { Appointment, Service, User } from "@/db/schema";
  export async function createEventOnPrimaryCalendar(userId: string, { summary, description, start, end }): Promise<string | null>;
  export async function updateEventOnPrimaryCalendar(userId: string, eventId: string, { start, end }): Promise<boolean>;
  export async function deleteEventOnPrimaryCalendar(userId: string, eventId: string): Promise<boolean>;
  export async function getValidAccessToken(userId: string): Promise<string | null>;
  ```

- [ ] **Step 1: Write token refresh helper**

`getValidAccessToken`:
- Query `schema.accounts` where `userId` and `provider='google'`.
- If `!account?.access_token` → return null.
- If `expires_at` (int) `> now-60` → return token.
- Else refresh via:
  ```
  POST https://oauth2.googleapis.com/token
  body: client_id, client_secret, refresh_token, grant_type=refresh_token  (URLSearchParams)
  ```
  on 200 update `access_token`, `expires_at` via `db.update`; return new token.
- On failure return null.

- [ ] **Step 2: create/update/delete**

- create: `POST https://www.googleapis.com/calendar/v3/calendars/primary/events` header `Authorization: Bearer t`. body `{ summary, start:{dateTime: ISO UTC}, end:{dateTime: ISO UTC} }`. Return `data.id` or null.
- update: `PATCH .../events/{id}` body `{ start:{dateTime}, end:{dateTime} }`, return `ok`.
- delete: `DELETE .../events/{id}`, return `ok`.

- [ ] **Step 3: Helpers for our appointment shapes**

```ts
export async function createAppointmentClientEvent(appointment: { clientId: string; startTime: number; endTime: number; summary: string }): Promise<string | null>
export async function createAppointmentAdminEvent(appointment: { startTime: number; endTime: number; summary: string }): Promise<string | null>
export async function updateAppointmentEvent(userId: string, eventId: string, start: number, end: number): Promise<boolean>
export async function deleteAppointmentEvent(userId: string, eventId: string): Promise<boolean>
```
where admin userId resolved via `ADMIN_EMAIL` lookup in `users`.

- [ ] **Step 4: Typecheck**

`npx tsc --noEmit`.

---

### Task 7: Wire real calendar sync into appointments

**Files:**
- Modify: `src/app/api/appointments/route.ts`
- Modify: `src/app/api/appointments/[id]/route.ts`
- Modify: `src/components/Dashboard` reschedule call site later (Task 8)

**Interfaces:**
- Consumes Task 6 functions; produces: `googleEventIdClient`, `googleEventIdAdmin` updated.

- [ ] **Step 1: POST — create events**

After photos insert (Task 4):
```ts
const clientUserId = session.user.id;
const summary = `Cita: ${service.name}`; // service.name available
const start = appointment.startTime!; const end = appointment.endTime!;
const clientEventId = await createAppointmentEvent(clientUserId, start, end, summary);
const adminEventId = await createAppointmentAdminEvent(start, end, summary);
if (clientEventId || adminEventId) {
  db.update(schema.appointments).set({ googleEventIdClient: clientEventId, googleEventIdAdmin: adminEventId }).where(eq(schema.appointments.id, appointment.id)).run();
}
```
Wrap `createAppointmentAdminEvent` in try/catch — best effort. Always return `{ id }` even if calendar is `null`.

- [ ] **Step 2: PATCH /api/appointments/[id] reschedule**

Accept `{ startTime?, status? }`:
```ts
const body = await req.json();
const upd: Record<string, unknown> = {};
if (body.status) upd.status = body.status;
if (typeof body.startTime === "number") { upd.startTime = body.startTime; upd.endTime = Math.floor(body.startTime/1000) + (serviceDura); }
```
Fetch service duration to recompute end. Update DB. If both event ids present, call `updateEventById` for client+admin with new start/end.
- [ ] **Step 3: typecheck + lint**

---

### Task 8: Dashboard calendar view + reschedule UI

**Files:**
- Create: `src/components/ReschedulePicker.tsx` (client, modal)
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`
- Modify: `src/components/AppointmentCard.tsx`

**Interfaces:**
- Consumes: `PATCH /api/appointments/:id` with `{startTime, status?}`, `GET /api/appointments?date=`; produces week/day tabs.

- [ ] **Step 1: ReschedulePicker**

Props: `{ appt: Appointment; onClose():void; onRescheduled():void }`. Renders date input + time select (slots from `/api/slots?date=&serviceId=`) + "Guardar". Calls PATCH: `body: { startTime: unix, status: appt.status }`. Show error/success.

- [ ] **Step 2: DashboardContent**

- Add `view: "day" | "week"` state; day = existing list; week = 7 columns (Mon..Sun), fetch each date: reuse AppointmentCard mini column + a "Reprogramar" button that opens `ReschedulePicker`.
- `refresh` after picker closes.

- [ ] **Step 3: AppointmentCard**

Add optional `onReschedule?: () => void` prop; render "Reprogramar" button when present.

- [ ] **Step 4: typecheck + lint**

---

### Task 9: Profile — show upcoming appointments

**Files:**
- Modify: `src/app/(client)/profile/page.tsx`
- Modify: `src/app/(client)/profile/ProfileContent.tsx`

**Interfaces:**
- Produces: `props.upcoming: Appointment[]`, alongside existing completed.

- [ ] **Step 1: page**

Query appointments for `clientId` with status IN ('pending','confirmed') ordered by start asc → pass `upcoming`.

- [ ] **Step 2: ProfileContent**

Render section "Próximas citas" listing date, time, service, reference photo (if any) above the completed timeline.

- [ ] **Step 3: typecheck + lint**

---

### Task 10: Admins management (API + UI)

**Files:**
- Create: `src/app/api/adminMatrix` — `src/app/api/admins/route.ts`
- Create: `src/app/(admin)/dashboard/admin-users/page.tsx`
- Modify: `src/app/(admin)/layout.tsx` (sidebar item "Admins")
- Modify: `src/middleware.ts` not needed for role (page-level)

**Interfaces:**
- API: `GET`, `POST {email}`, `DELETE {email}` superadmin-only.
- UI: list admins, remove, add via email.

- [ ] **Step 1: API route**

```ts
// GET
const session = await auth(); if (!(await isSuperAdmin(session))) return 401;
list = db.select({id, email, name, role}).from(users).where(eq(users.role,"admin")).all();

// POST {email}
isSuperAdmin; validate email; user? update role='admin' : console warn; return 200/404.

// DELETE {email}
superadmin; if email===ADMIN_EMAIL return 403; db.update({role:'client'}).where(eq(email)).
```

- [ ] **Step 2: UI page**

Client component: fetch list; add form (email input + Add button → POST then reload); each row shows email + "Quitar admin" (DELETE) disabled for superadmin email.

- [ ] **Step 3: nav**

Add `{ href: "/dashboard/admins", label: "Admins", icon: "🛡️" }` to `NAV_ITEMS`.

- [ ] **Step 4: typecheck + lint**

---

### Task 11: Doc maintenance rule (AGENTS.md, CHANGELOG, README)

**Files:**
- Modify: `AGENTS.md` (UTF-16 LE — read/write preserving BOM)
- Create: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: AGENTS.md**

Append to Reglas section (preserve UTF-16 LE):
> Cada cambio relevante (funcionalidad nueva/quitada o bug corregido) obliga a actualizar AGENTS.md (si aplica), CHANGELOG.md y README.md en el mismo commit.
Use PowerShell: `Get-Content AGENTS.md -Encoding Unicode` → modify → `Set-Content -Encoding Unicode`.

- [ ] **Step 2: CHANGELOG.md**

Create with Keep a Changelog format; first entry covering this iteration (Added: roles/admins, multi-photo, calendar sync, week view; Fixed: session env, booking stuck).

- [ ] **Step 3: README.md**

Rewrite to describe product, run steps (`npm install`, `npm run db:setup`, `npm run dev`), env vars table (AUTH_GOOGLE_ID/SECRET, ADMIN_EMAIL, NEXTAUTH_URL/SECRET), structure overview, maintenance rule.

- [ ] **Step 4: Final verify & full build**

`npx tsc --noEmit`, `npm run lint`, `npm run build`. Report result.

---

## Self-Review checklist

- Spec coverage: Task 1 → Parte 2 (data); Tasks 2,5,10 → Parte 3 (admins); Tasks 3,4,6,7,8 → Parte 4 (calendar) & Parte 1 (bugs/multi-photo); Task 9 → Parte 1 (profile próximas); Task 11 → Parte 5 (mantenimiento). ✓
- Placeholder scan: Task 6 consumed in Task 7; `createAppointmentEvent` helper defined in Task 6 used consistently; PATCH reused. ✓
- Type consistency: `syncAppointmentPhotosToGoogleCalendarsPlaceholder` stub replaced by real call in Task 7; `appointmentPhotos` name consistent with schema. ✓