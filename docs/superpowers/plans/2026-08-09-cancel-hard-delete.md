# Hard Delete de Citas al Cancelar + Archivo de Canceladas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al cancelar una cita (admin o cliente) se borra la fila permanentemente y se archiva un snapshot en `cancelled_appointments`, visible en una pestaña "Canceladas" del dashboard.

**Architecture:** Se agrega una tabla de auditoría (`cancelled_appointments`) y un método `DELETE` en la ruta existente `src/app/api/appointments/[id]/route.ts` (auth admin o propietario) que archiva el snapshot, borra los eventos de Google Calendar y elimina la fila (cascade sobre `service_purchases`/`appointment_photos`; `payments.appointment_id` queda NULL). Se elimina el soft delete (`status='cancelled'`): el `PATCH` lo rechaza y se borra la ruta `POST /cancel`. Una nueva ruta `GET /api/appointments/cancelled` alimenta la pestaña del dashboard.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (SQLite, `better-sqlite3`), `drizzle-kit` (migraciones), Tailwind.

## Global Constraints

- **Sin test runner en el repo.** No hay framework de tests instalado (package.json sin script `test`). La verificación por tarea usa los comandos del repo: `npx tsc --noEmit`, `npm run lint`, `npm run build`, y pasos manuales sobre `npm run dev`.
- **Nombres de columnas en camelCase** en el schema de Drizzle (el nombre SQL se pasa explícito: `text("appointment_id")`).
- **Timestamps en unix seconds** (`Math.floor(Date.now() / 1000)`).
- **Timezone del salón** en TODAS las fechas de la UI (`timeZone: "America/Caracas"`).
- **Migraciones:** `npm run db:generate` (genera el snapshot en `drizzle/`), `npm run db:migrate` (aplica). `foreign_keys = ON` ya está en `src/db/index.ts`.
- **Idioma de UI y errores:** español.
- **Regla de mantenimiento del repo:** cualquier cambio relevante actualiza `AGENTS.md`, `CHANGELOG.md` y `README.md` en el mismo commit.
- **No añadir comentarios al código** salvo que se pidan.
- `crypto.randomUUID()` para todos los `id`.

---

### Task 1: Tabla `cancelled_appointments` + migración

**Files:**
- Modify: `src/db/schema.ts` (añadir tabla al final, tras `serviceProducts`)

**Interfaces:**
- Produces: tabla `schema.cancelledAppointments` con columnas: `id`, `appointmentId`, `clientId` (FK users), `serviceId` (FK services, nullable), `serviceName`, `servicePrice`, `startTime`, `endTime`, `referencePhotoUrls` (text, JSON), `cancelledBy` (FK users), `cancelledAt` (int, not null), `reason` (text, nullable). Índices en `clientId` y `cancelledAt`.

- [ ] **Step 1: Añadir la tabla al schema**

En `src/db/schema.ts`, después del cierre de `serviceProducts` (línea 297), añadir:

```ts
export const cancelledAppointments = sqliteTable(
  "cancelled_appointments",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id"),
    clientId: text("client_id").notNull().references(() => users.id),
    serviceId: text("service_id").references(() => services.id),
    serviceName: text("service_name").notNull(),
    servicePrice: real("service_price").notNull().default(0),
    startTime: integer("start_time"),
    endTime: integer("end_time"),
    referencePhotoUrls: text("reference_photo_urls"),
    cancelledBy: text("cancelled_by").notNull().references(() => users.id),
    cancelledAt: integer("cancelled_at").notNull(),
    reason: text("reason"),
  },
  (t) => [
    index("cancelled_appointments_client_idx").on(t.clientId),
    index("cancelled_appointments_cancelled_at_idx").on(t.cancelledAt),
  ]
);
```

`index` ya está importado en la línea 1 de `schema.ts`. No añadir imports nuevos.

- [ ] **Step 2: Generar y aplicar la migración**

Run: `npm run db:generate`
Expected: crea `drizzle/0008_*.sql` y una entrada nueva en `drizzle/meta/_journal.json` con `CREATE TABLE \`cancelled_appointments\``.

Run: `npm run db:migrate`
Expected: aplica la migración a `dev.db` sin errores.

- [ ] **Step 3: Verificar que la tabla existe**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `node -e "const D=new (require('better-sqlite3'))('dev.db'); console.log(D.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='cancelled_appointments'\").get())"`
Expected: `{ name: 'cancelled_appointments' }`.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle
git commit -m "feat(db): tabla cancelled_appointments para archivo de citas canceladas"
```

---

### Task 2: `DELETE /api/appointments/[id]` + guard de `PATCH` para `cancelled`

**Files:**
- Modify: `src/app/api/appointments/[id]/route.ts` (añadir `DELETE`, ajustar `PATCH`)

**Interfaces:**
- Consumes: `schema.cancelledAppointments` (Task 1), `isAdmin` (`src/lib/authz.ts`), `deleteEventOnPrimaryCalendar` y `getAdminUserId` (`src/lib/calendar.ts`).
- Produces: `DELETE /api/appointments/:id` → `{ success: true, deleted: true }` (200); 401 sin sesión, 404 si no existe, 403 si no es admin ni propietario, 400 si `status === 'completed'`. `PATCH` con `status:'cancelled'` → 400.

- [ ] **Step 1: Guard de `PATCH`**

En `src/app/api/appointments/[id]/route.ts`, reemplazar el bloque de las líneas 42-47:

```ts
  if (status === "cancelled" && (appointment.status === "completed" || appointment.status === "cancelled")) {
    return NextResponse.json(
      { error: "Esta cita ya no se puede cancelar" },
      { status: 400 }
    );
  }
```

por:

```ts
  if (status === "cancelled") {
    return NextResponse.json(
      { error: "Usa el método DELETE para cancelar citas" },
      { status: 400 }
    );
  }
```

- [ ] **Step 2: Eliminar el bloque muerto de cancelación en `PATCH`**

Eliminar el bloque completo de las líneas 85-101 (el `if (status === "cancelled" && appointment.status !== "cancelled") { ... }` que borraba los eventos de GC), porque `status === "cancelled"` ahora devuelve 400 antes de llegar ahí.

- [ ] **Step 3: Añadir el handler `DELETE`**

Al final de `src/app/api/appointments/[id]/route.ts`, tras el `PATCH`, añadir:

```ts
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const admin = await isAdmin(session);
  if (!admin && appointment.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (appointment.status === "completed") {
    return NextResponse.json(
      { error: "No se puede cancelar una cita completada" },
      { status: 400 }
    );
  }

  const purchase = db
    .select()
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.appointmentId, id))
    .get();

  const photos = db
    .select({ url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(eq(schema.appointmentPhotos.appointmentId, id))
    .all();

  db.insert(schema.cancelledAppointments)
    .values({
      id: crypto.randomUUID(),
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      serviceName: purchase?.serviceName ?? "",
      servicePrice: purchase?.servicePrice ?? 0,
      startTime: appointment.startTime ?? null,
      endTime: appointment.endTime ?? null,
      referencePhotoUrls: photos.length
        ? JSON.stringify(photos.map((p) => p.url))
        : null,
      cancelledBy: session.user.id,
      cancelledAt: Math.floor(Date.now() / 1000),
      reason: null,
    })
    .run();

  if (appointment.googleEventIdClient) {
    await deleteEventOnPrimaryCalendar(
      appointment.clientId,
      appointment.googleEventIdClient
    );
  }
  if (appointment.googleEventIdAdmin) {
    const adminUserId = await getAdminUserId();
    if (adminUserId) {
      await deleteEventOnPrimaryCalendar(
        adminUserId,
        appointment.googleEventIdAdmin
      );
    }
  }

  db.delete(schema.appointments).where(eq(schema.appointments.id, id)).run();

  return NextResponse.json({ success: true, deleted: true });
}
```

- [ ] **Step 4: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/appointments/[id]/route.ts
git commit -m "feat(api): DELETE de citas con archivo de canceladas y guard en PATCH"
```

---

### Task 3: `GET /api/appointments/cancelled`

**Files:**
- Create: `src/app/api/appointments/cancelled/route.ts`

**Interfaces:**
- Consumes: `schema.cancelledAppointments` (Task 1), `isAdmin`.
- Produces: `GET /api/appointments/cancelled` (admin) → array de `{ id, appointmentId, serviceName, servicePrice, startTime, endTime, referencePhotoUrls: string[], cancelledBy, cancelledAt, reason, clientName }` ordenado por `cancelledAt` DESC.

- [ ] **Step 1: Crear la ruta**

Crear `src/app/api/appointments/cancelled/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = db
    .select({
      id: schema.cancelledAppointments.id,
      appointmentId: schema.cancelledAppointments.appointmentId,
      clientId: schema.cancelledAppointments.clientId,
      serviceName: schema.cancelledAppointments.serviceName,
      servicePrice: schema.cancelledAppointments.servicePrice,
      startTime: schema.cancelledAppointments.startTime,
      endTime: schema.cancelledAppointments.endTime,
      referencePhotoUrls: schema.cancelledAppointments.referencePhotoUrls,
      cancelledBy: schema.cancelledAppointments.cancelledBy,
      cancelledAt: schema.cancelledAppointments.cancelledAt,
      reason: schema.cancelledAppointments.reason,
      clientName: schema.users.name,
    })
    .from(schema.cancelledAppointments)
    .innerJoin(
      schema.users,
      eq(schema.cancelledAppointments.clientId, schema.users.id)
    )
    .orderBy(desc(schema.cancelledAppointments.cancelledAt))
    .all();

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      referencePhotoUrls: r.referencePhotoUrls
        ? JSON.parse(r.referencePhotoUrls)
        : [],
    }))
  );
}
```

- [ ] **Step 2: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/appointments/cancelled/route.ts
git commit -m "feat(api): endpoint de citas canceladas para el dashboard"
```

---

### Task 4: Dashboard — cancelar con `DELETE` y pestaña "Canceladas"

**Files:**
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`

**Interfaces:**
- Consumes: `DELETE /api/appointments/:id` (Task 2), `GET /api/appointments/cancelled` (Task 3).
- Produces: vista `"cancelled"` en el toggle, `handleCancel` usando `DELETE`.

- [ ] **Step 1: Tipo de estado y toggle**

En `DashboardContent.tsx`, línea 57, cambiar:

```ts
  const [view, setView] = useState<"day" | "week">("day");
```

por:

```ts
  const [view, setView] = useState<"day" | "week" | "cancelled">("day");
```

En el bloque del toggle (líneas 183-197), cambiar `(["day", "week"] as const)` por `(["day", "week", "cancelled"] as const)` y el label `{v === "day" ? "Día" : "Semana"}` por:

```tsx
            {v === "day" ? "Día" : v === "week" ? "Semana" : "Canceladas"}
```

- [ ] **Step 2: Estado y fetch de canceladas**

Junto a los otros `useState` (línea ~69), añadir:

```ts
  const [cancelledList, setCancelledList] = useState<
    {
      id: string;
      clientId: string;
      serviceName: string;
      servicePrice: number;
      startTime: number | null;
      cancelledBy: string;
      cancelledAt: number;
      clientName: string;
    }[]
  >([]);
```

Junto a `fetchAppointments`/`fetchBlockouts`, añadir:

```ts
  const fetchCancelled = useCallback(async () => {
    const res = await fetch("/api/appointments/cancelled");
    const data = await res.json();
    setCancelledList(Array.isArray(data) ? data : []);
  }, []);
```

En el `useEffect` (líneas 84-87), añadir la llamada `fetchCancelled();` dentro del cuerpo y `fetchCancelled` al array de dependencias (queda `[fetchAppointments, fetchBlockouts, fetchCancelled]`). En `refreshAll()` (líneas 133-137, función plana, sin deps) añadir `fetchCancelled();`.

- [ ] **Step 3: `handleCancel` con `DELETE`**

Reemplazar `handleCancel` (líneas 121-131):

```ts
  async function handleCancel(id: string) {
    setCancellingBusy(true);
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setCancellingBusy(false);
    setCancelling(null);
    refreshAll();
  }
```

por:

```ts
  async function handleCancel(id: string) {
    setCancellingBusy(true);
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    setCancellingBusy(false);
    setCancelling(null);
    refreshAll();
  }
```

- [ ] **Step 4: Vista "Canceladas"**

Tras el bloque de la vista `week` (que termina antes del `ConfirmDialog`, ~línea 360), añadir el bloque condicional de la vista `cancelled`:

```tsx
      {view === "cancelled" && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            Historial de citas canceladas
          </h2>
          {cancelledList.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400">No hay citas canceladas</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Canceló</th>
                    <th className="px-4 py-3">Cuándo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cancelledList.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        {c.startTime
                          ? new Intl.DateTimeFormat("es-ES", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "America/Caracas",
                            }).format(new Date(c.startTime * 1000))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.clientName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.serviceName}</td>
                      <td className="px-4 py-3">${c.servicePrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.cancelledBy === c.clientId ? "Cliente" : "Admin"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Intl.DateTimeFormat("es-ES", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "America/Caracas",
                        }).format(new Date(c.cancelledAt * 1000))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: Actualizar mensaje del `ConfirmDialog` de cancelar**

En la línea 373, cambiar el `message` de `¿Cancelar la cita de ${cancelling.clientName}? Se eliminará también del calendario.` por:

```tsx
          message={`¿Cancelar la cita de ${cancelling.clientName}? Se eliminará y quedará registrada en el historial de canceladas.`}
```

- [ ] **Step 6: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

Run: `npm run build`
Expected: build completo sin errores.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(admin)/dashboard/DashboardContent.tsx"
git commit -m "feat(ui): cancelar con DELETE y pestaña Canceladas en la agenda"
```

---

### Task 5: Perfil del cliente — cancelar con `DELETE` + borrar ruta `/cancel`

**Files:**
- Modify: `src/app/(client)/profile/ProfileContent.tsx`
- Delete: `src/app/api/appointments/[id]/cancel/route.ts`

**Interfaces:**
- Consumes: `DELETE /api/appointments/:id` (Task 2) que autoriza al propietario.
- Produces: cancelación desde `/profile` con hard delete.

- [ ] **Step 1: Cambiar el fetch en `handleCancel`**

En `src/app/(client)/profile/ProfileContent.tsx`, líneas 52-54:

```ts
      const res = await fetch(`/api/appointments/${id}/cancel`, {
        method: "POST",
      });
```

por:

```ts
      const res = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
```

- [ ] **Step 2: Borrar la ruta `/cancel`**

Eliminar el archivo `src/app/api/appointments/[id]/cancel/route.ts` y su carpeta vacía.

- [ ] **Step 3: Verificación**

Run: `npx tsc --noEmit`
Expected: sin errores (no debe quedar ninguna referencia a `/cancel`).

Run: `npm run lint`
Expected: sin errores nuevos.

Run: `npm run build`
Expected: build completo sin errores.

Run: `rg "appointments/.*/cancel" src` (o `Select-String`)
Expected: sin coincidencias.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(client)/profile/ProfileContent.tsx" "src/app/api/appointments/[id]/cancel/route.ts"
git commit -m "feat(ui): cancelar citas desde el perfil con hard delete"
```

---

### Task 6: Documentación + verificación final

**Files:**
- Modify: `AGENTS.md`, `CHANGELOG.md`, `README.md`

**Interfaces:**
- Consumes: comportamiento final de las Tasks 1-5.

- [ ] **Step 1: Actualizar `AGENTS.md`**

- En "Tabla: appointments": aclarar que al cancelar se borra la fila (hard delete) y se archiva en `cancelled_appointments`.
- Añadir sección "Tabla: cancelled_appointments" tras `appointments` describiendo columnas (`id`, `appointment_id`, `client_id`, `service_id`, `service_name`, `service_price`, `start_time`, `end_time`, `reference_photo_urls`, `cancelled_by`, `cancelled_at`, `reason`).
- En "Reglas de borrado": reemplazar la entrada de "Cancelar cita (admin)" por: `DELETE /api/appointments/[id]` (admin o propietario) borra la cita permanentemente tras archivar el snapshot en `cancelled_appointments` y borrar los eventos de Google Calendar; las citas `completed` no se pueden cancelar (400).
- En "Estructura de Rutas" / dashboard: añadir vista "Canceladas" en la agenda y ruta `GET /api/appointments/cancelled`.

- [ ] **Step 2: Actualizar `CHANGELOG.md`**

En la sección "[Sin publicar]" — "### Cambiado", añadir:

```markdown
### Cambiado
- Cancelar una cita ahora la elimina definitivamente (hard delete) y archiva un snapshot en la nueva tabla `cancelled_appointments` (visible en la pestaña "Canceladas" de la agenda). Aplica tanto desde el dashboard admin como desde `/profile`; el `PATCH` con `status: cancelled` y el endpoint `/cancel` quedan obsoletos.
```

- [ ] **Step 3: Actualizar `README.md`**

Mencionar la pestaña "Canceladas" en el historial de la agenda y el comportamiento de cancelación (hard delete + archivo). Si `README.md` tiene una sección de funcionalidades del dashboard, añadir una línea al respecto.

- [ ] **Step 4: Verificación completa**

Run: `npm run db:setup`
Expected: migración + seed sin errores.

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores.

Run: `npm run build`
Expected: build completo.

- [ ] **Step 5: Prueba manual (dev server)**

Run: `npm run dev`
- Admin cancela una cita `pending`/`confirmed` → desaparece del día/semana, aparece en "Canceladas" con snapshot, no hay fila en `appointments`, no quedan eventos de GC.
- Cliente cancela desde `/profile` → desaparece de próximas citas y aparece en "Canceladas" con "Cliente" como actor.
- Cancelar cita `completed` → 400 "No se puede cancelar una cita completada".
- `PATCH` con `status: 'cancelled'` → 400 "Usa el método DELETE para cancelar citas".
- Cita inexistente → 404; cita ajena (cliente distinto, no admin) → 403.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md CHANGELOG.md README.md
git commit -m "docs: hard delete de citas al cancelar y archivo de canceladas"
```
