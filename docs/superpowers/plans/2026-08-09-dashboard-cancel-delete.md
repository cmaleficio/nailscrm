# Cancelar citas, eliminar clientes y servicios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir botón de cancelar cita en la vista semana de la agenda, botón de eliminar clientes sin movimientos (lista + panel CRM) y botón de eliminar servicios sin uso, todos con diálogo de confirmación.

**Architecture:** Backend: dos endpoints `DELETE` nuevos (`/api/clients/[id]`, `/api/services/[id]`) con validación de referencias y una guarda en el `PATCH` de citas. Frontend: componente reutilizable `ConfirmDialog` y botones en `DashboardContent`, `ClientsContent`, `ClientCRMPanel` y `ServicesContent`. No hay cambios de schema ni migraciones.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind, Drizzle ORM + better-sqlite3 (síncrono), ESLint (`npm run lint`), typecheck (`npx tsc --noEmit`). **No hay framework de tests en el repo**; la verificación de cada task es `npx tsc --noEmit` + `npm run lint` + smoke test manual con el dev server.

## Global Constraints

- Sin comentarios en el código (regla del repo).
- Todos los endpoints nuevos exigen `isAdmin` (vía `auth()` + `isAdmin(session)` de `src/lib/authz.ts`).
- Estilos: `rounded-xl`, sombras suaves, botones rojos con `bg-red-50 text-red-600 hover:bg-red-100`, modales con `fixed inset-0 z-50`.
- `better-sqlite3` es síncrono (`db.*.run()/.all()/.get()`); solo `fetch()`/`auth()` son async.
- Los usuarios con `role === "admin"` no se pueden eliminar.
- Docs (`agents.md`, `CHANGELOG.md`, `README.md`) se actualizan en el commit final del feature (regla de mantenimiento del repo).

---

### Task 1: Componente `ConfirmDialog`

**Files:**
- Create: `src/components/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `ConfirmDialog` con props `{ title: string; message: string; confirmLabel?: string; danger?: boolean; busy?: boolean; error?: string | null; onConfirm: () => void; onClose: () => void }`. No auto-cierra al confirmar: el padre decide cuándo llamar a `onClose` (cierra tras éxito).

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{message}</p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              danger
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-pink-main text-gray-900 hover:bg-pink-light"
            }`}
          >
            {busy ? "Procesando..." : confirmLabel}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 2: Guarda en `PATCH /api/appointments/[id]` — no cancelar citas completadas/canceladas

**Files:**
- Modify: `src/app/api/appointments/[id]/route.ts` (tras el bloque `if (!appointment)` del 404)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: la cita `completed`/`cancelled` ya no se puede cancelar vía PATCH (400).

- [ ] **Step 1: Añadir la guarda**

Tras el bloque del 404 (después de `return NextResponse.json({ error: "Appointment not found" }, { status: 404 });`), insertar:

```ts
  if (status === "cancelled" && (appointment.status === "completed" || appointment.status === "cancelled")) {
    return NextResponse.json(
      { error: "Esta cita ya no se puede cancelar" },
      { status: 400 }
    );
  }
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 3: Cancelar cita en la agenda (vista día y semana) con confirmación

**Files:**
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx`
- Create: nada (usa `ConfirmDialog` de Task 1)

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 1).
- Produces: estado `cancelling: Appointment | null`, `handleCancel(id)` disparado desde el diálogo, botón "Cancelar" en celdas de la vista semana.

- [ ] **Step 1: Importar `ConfirmDialog` y añadir estados**

Añadir al top:

```tsx
import { ConfirmDialog } from "@/components/ConfirmDialog";
```

Tras `const [completing, setCompleting] = useState<Appointment | null>(null);`:

```tsx
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancellingBusy, setCancellingBusy] = useState(false);
```

- [ ] **Step 2: Convertir `handleCancel` en la acción confirmada**

Reemplazar la función `handleCancel` completa por:

```tsx
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

- [ ] **Step 3: Vista día — cancelar pasa por el diálogo**

Cambiar en `AppointmentCard` la prop `onCancel={handleCancel}` por:

```tsx
                  onCancel={() => setCancelling(appt)}
```

- [ ] **Step 4: Vista semana — botón "Cancelar" en cada cita activa**

Dentro del bloque de cada cita de la semana (después del botón "Ver"), añadir, solo para citas activas:

```tsx
                            {appt.status === "pending" || appt.status === "confirmed" ? (
                              <button
                                onClick={() => setCancelling(appt)}
                                className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100"
                              >
                                Cancelar
                              </button>
                            ) : null}
```

- [ ] **Step 5: Renderizar el `ConfirmDialog`**

Junto a los otros diálogos (por ejemplo tras el bloque de `rescheduling`), añadir:

```tsx
      {cancelling && (
        <ConfirmDialog
          title="Cancelar cita"
          message={`¿Cancelar la cita de ${cancelling.clientName}? Se eliminará también del calendario.`}
          confirmLabel="Cancelar cita"
          danger
          busy={cancellingBusy}
          onConfirm={() => handleCancel(cancelling.id)}
          onClose={() => setCancelling(null)}
        />
      )}
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 4: Backend `DELETE /api/clients/[id]`

**Files:**
- Modify: `src/app/api/clients/[id]/route.ts` (añadir handler `DELETE`; `sql` ya está importado)

**Interfaces:**
- Consumes: `schema.users`, `schema.appointments`, `schema.payments`, `schema.waitlist`, `isAdmin`.
- Produces: `DELETE /api/clients/{id}` → 401 si no admin; 404 si no existe; 403 si `role==='admin'`; 400 si tiene citas/pagos/waitlist; `{ success: true }` si se borra.

- [ ] **Step 1: Añadir el handler `DELETE`**

Al final del archivo:

```ts
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!user) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (user.role === "admin") {
    return NextResponse.json(
      { error: "No se puede eliminar a un usuario administrador" },
      { status: 403 }
    );
  }

  const appointmentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.appointments)
      .where(eq(schema.appointments.clientId, id))
      .get()?.count ?? 0;

  if (appointmentsCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene citas; no se puede eliminar" },
      { status: 400 }
    );
  }

  const paymentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.userId, id))
      .get()?.count ?? 0;

  if (paymentsCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene pagos o cuentas por cobrar; no se puede eliminar" },
      { status: 400 }
    );
  }

  const waitlistCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.clientId, id))
      .get()?.count ?? 0;

  if (waitlistCount > 0) {
    return NextResponse.json(
      { error: "El cliente está en la lista de espera; no se puede eliminar" },
      { status: 400 }
    );
  }

  db.delete(schema.users).where(eq(schema.users.id, id)).run();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 5: Backend `DELETE /api/services/[id]`

**Files:**
- Modify: `src/app/api/services/[id]/route.ts` (añadir handler `DELETE` y `sql` al import)

**Interfaces:**
- Consumes: `schema.services`, `schema.appointments`, `schema.servicePurchases`, `isAdmin`.
- Produces: `DELETE /api/services/{id}` → 401 si no admin; 404 si no existe; 400 si tiene citas/compras; `{ success: true }` si se borra (las fotos `service_photos` se van por CASCADE).

- [ ] **Step 1: Añadir `sql` al import**

Cambiar:

```ts
import { eq } from "drizzle-orm";
```

por:

```ts
import { eq, sql } from "drizzle-orm";
```

- [ ] **Step 2: Añadir el handler `DELETE`**

Al final del archivo:

```ts
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .get();

  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const appointmentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.appointments)
      .where(eq(schema.appointments.serviceId, id))
      .get()?.count ?? 0;

  if (appointmentsCount > 0) {
    return NextResponse.json(
      { error: "El servicio tiene citas asociadas; desactívalo en su lugar" },
      { status: 400 }
    );
  }

  const purchasesCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.serviceId, id))
      .get()?.count ?? 0;

  if (purchasesCount > 0) {
    return NextResponse.json(
      { error: "El servicio tiene compras asociadas; desactívalo en su lugar" },
      { status: 400 }
    );
  }

  db.delete(schema.services).where(eq(schema.services.id, id)).run();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 6: Eliminar cliente desde la lista de clientes

**Files:**
- Modify: `src/app/(admin)/dashboard/clients/ClientsContent.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 1), `DELETE /api/clients/{id}` (Task 4).
- Produces: botón "Eliminar" en cada fila; fila reestructurada de `<button>` a `<div>`; estado `deleting`.

- [ ] **Step 1: Importar `ConfirmDialog` y añadir estados**

```tsx
import { ConfirmDialog } from "@/components/ConfirmDialog";
```

Tras `const [error, setError] = useState("");`:

```tsx
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
```

- [ ] **Step 2: Añadir el handler de confirmación**

Tras `createClient`:

```tsx
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/clients/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el cliente");
      }
      setDeleting(null);
      await fetchClients(q);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setDeleteBusy(false);
    }
  }
```

- [ ] **Step 3: Reestructurar la fila y añadir botón "Eliminar"**

Reemplazar el bloque de cada fila (`clients.map((c) => (<button ...>...</button>))`) por:

```tsx
        {clients.map((c) => (
          <div
            key={c.id}
            className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-pink-main hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => setSelected(c)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500 truncate">{c.email}</p>
                <p className="text-sm text-gray-500">{c.phone ?? "Sin teléfono"}</p>
                {c.address && <p className="text-sm text-gray-400 truncate">{c.address}</p>}
              </button>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex gap-3 text-center">
                  <div className="rounded-lg bg-pink-light px-3 py-1.5">
                    <p className="text-sm font-bold text-gray-900">{c.totalVisits ?? 0}</p>
                    <p className="text-[10px] text-gray-500">Visitas</p>
                  </div>
                  <div className="rounded-lg bg-pink-light px-3 py-1.5">
                    <p className="text-sm font-bold text-gray-900">${(c.totalRevenue ?? 0).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">Ingresos</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDeleting(c);
                    setDeleteError("");
                  }}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
```

- [ ] **Step 4: Renderizar el `ConfirmDialog`**

Antes del cierre `</div>` final (tras el bloque `{selected && (...)}`):

```tsx
      {deleting && (
        <ConfirmDialog
          title="Eliminar cliente"
          message={`¿Eliminar a ${deleting.name}? Solo se permite si no tiene citas, pagos ni lista de espera.`}
          confirmLabel="Eliminar"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 7: Eliminar cliente desde el `ClientCRMPanel`

**Files:**
- Modify: `src/components/ClientCRMPanel.tsx`
- Modify: `src/app/(admin)/dashboard/clients/ClientsContent.tsx` (pasar `onDeleted`)
- Modify: `src/app/(admin)/dashboard/DashboardContent.tsx` (pasar `onDeleted`)

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 1), `DELETE /api/clients/{id}` (Task 4).
- Produces: prop `onDeleted?: () => void` en `ClientCRMPanel`, botón "Eliminar cliente" en el panel, y wiring de `onDeleted` en los dos consumidores.

- [ ] **Step 1: Importar `ConfirmDialog` y añadir prop/estados en `ClientCRMPanel`**

```tsx
import { ConfirmDialog } from "@/components/ConfirmDialog";
```

En el type `Props`, tras `onClose: () => void;`:

```tsx
  onDeleted?: () => void;
```

Desestructurar `onDeleted` en la firma del componente (tras `onClose,`).

Tras `const [showPayment, setShowPayment] = useState(false);`:

```tsx
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
```

- [ ] **Step 2: Añadir el handler de confirmación**

Tras `saveContact`:

```tsx
  async function confirmDeleteClient() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el cliente");
      }
      setConfirmDelete(false);
      onDeleted?.();
      onClose();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setDeleteBusy(false);
    }
  }
```

- [ ] **Step 3: Añadir el botón "Eliminar cliente"**

Tras el bloque `{whatsappUrl && (...)}` (antes de `{showPayment && (...)}`):

```tsx
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-3 w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Eliminar cliente
        </button>
```

- [ ] **Step 4: Renderizar el `ConfirmDialog`**

Junto al bloque `{showPayment && (...)}`:

```tsx
      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar cliente"
          message={`¿Eliminar a ${client.name}? Solo se permite si no tiene citas, pagos ni lista de espera.`}
          confirmLabel="Eliminar"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDeleteClient}
          onClose={() => setConfirmDelete(false)}
        />
      )}
```

- [ ] **Step 5: Pasar `onDeleted` desde `ClientsContent`**

En el bloque `{selected && (...)}`, dentro de `<ClientCRMPanel ...>`, tras `onClose={() => setSelected(null)}`:

```tsx
          onDeleted={() => {
            setSelected(null);
            fetchClients(q);
          }}
```

- [ ] **Step 6: Pasar `onDeleted` desde `DashboardContent`**

En el bloque `{selectedClientId && selectedAppointment && (<ClientCRMPanel ...>)}`, tras el `onClose`:

```tsx
          onDeleted={() => {
            setSelectedClientId(null);
            setSelectedAppointment(null);
            refreshAll();
          }}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 8: Eliminar servicio en `ServicesContent`

**Files:**
- Modify: `src/app/(admin)/dashboard/services/ServicesContent.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 1), `DELETE /api/services/{id}` (Task 5).
- Produces: botón "Eliminar" junto a "Desactivar"; estado `deleting`.

- [ ] **Step 1: Importar `ConfirmDialog` y añadir estados**

```tsx
import { ConfirmDialog } from "@/components/ConfirmDialog";
```

Tras `const [uploadingId, setUploadingId] = useState<string | null>(null);`:

```tsx
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
```

- [ ] **Step 2: Añadir el handler de confirmación**

Tras `handleToggleActive`:

```tsx
  async function confirmDeleteService() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/services/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el servicio");
      }
      setDeleting(null);
      setSuccess("Servicio eliminado");
      await fetchServices();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setDeleteBusy(false);
    }
  }
```

- [ ] **Step 3: Añadir botón "Eliminar" junto a "Desactivar"**

En el contenedor `flex shrink-0 items-center gap-2` (donde están "Editar" y "Desactivar"), tras el botón de `handleToggleActive`:

```tsx
                    <button
                      onClick={() => {
                        setDeleting(service);
                        setDeleteError("");
                      }}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Eliminar
                    </button>
```

- [ ] **Step 4: Renderizar el `ConfirmDialog`**

Antes del cierre `</div>` final:

```tsx
      {deleting && (
        <ConfirmDialog
          title="Eliminar servicio"
          message={`¿Eliminar el servicio "${deleting.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDeleteService}
          onClose={() => setDeleting(null)}
        />
      )}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` y `npm run lint`
Expected: sin errores.

---

### Task 9: Smoke test manual con el dev server

**Files:**
- Ninguno (verificación).

- [ ] **Step 1: Arrancar el dev server y probar**

Run: `npm run dev` (fondo) y verificar con el navegador/curl:

1. **Agenda semana:** en una cita `pending`/`confirmed` aparece "Cancelar"; al confirmar, la cita pasa a `cancelled` y desaparece de la semana. En la vista día, "Cancelar" también pide confirmación.
2. **Cancelar cita completada:** el PATCH con `status:"cancelled"` devuelve 400 (via `/api/appointments/{id}`).
3. **Cliente sin movimientos:** se elimina desde la fila de `/dashboard/clients` y desde el panel CRM.
4. **Cliente con citas/pagos:** el DELETE devuelve 400 y el mensaje aparece en el diálogo.
5. **Cliente admin:** DELETE devuelve 403.
6. **Servicio sin uso:** se elimina y sus fotos desaparecen.
7. **Servicio con citas/compras:** DELETE devuelve 400 con el mensaje de "desactívalo en su lugar".

- [ ] **Step 2: Parar el dev server**

---

### Task 10: Documentación y commit

**Files:**
- Modify: `agents.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Actualizar `agents.md`**

En "Estructura de Rutas" (sección Protegidas), tras la línea de `/dashboard/services`:

```markdown
- `/dashboard/services` → Gestión de servicios (+ fotos del servicio, eliminar si no tiene uso)
```

En "🎨 Componentes UI Clave", añadir:

```markdown
- ConfirmDialog: modal de confirmación reutilizable (cancelar cita, eliminar cliente/servicio)
```

En "📦 Modelo de Datos" o donde corresponda, añadir las reglas de borrado:

```markdown
- Eliminar cliente (`DELETE /api/clients/[id]`, admin): solo si NO tiene citas, pagos/cuentas por cobrar ni filas en waitlist. Los usuarios con role 'admin' no se eliminan (403). Las filas de Auth.js (account/session) se borran por CASCADE.
- Eliminar servicio (`DELETE /api/services/[id]`, admin): solo si NO tiene citas ni service_purchases (400 + sugerir desactivar). Las fotos (service_photos) se borran por CASCADE.
- Cancelar cita: `PATCH /api/appointments/[id]` con `status:'cancelled'` (borra eventos de Google Calendar); las citas completed/cancelled no se pueden cancelar (400). En la agenda, cancelar pide confirmación (ConfirmDialog).
```

- [ ] **Step 2: Actualizar `CHANGELOG.md`**

En "[Sin publicar] → ### Añadido", añadir:

```markdown
- Botón "Cancelar" con confirmación para las citas en la agenda (vistas día y semana); las citas completadas/canceladas no se pueden cancelar.
- Eliminar clientes desde la lista y desde el panel CRM (`DELETE /api/clients/[id]`): solo si no tienen citas, pagos/cuentas por cobrar ni lista de espera; los admins están protegidos.
- Eliminar servicios (`DELETE /api/services/[id]`) además de desactivarlos: solo si no tienen citas ni compras asociadas (de lo contrario se sugiere desactivar).
```

- [ ] **Step 3: Actualizar `README.md`**

En "Funcionalidades principales", en el ítem del Dashboard admin, tras "y 'Bloquear tiempo' para marcar horarios no disponibles", añadir:

```markdown
, botón "Cancelar" con confirmación, y en `dashboard/services` un botón "Eliminar" (solo servicios sin citas ni compras). En `/dashboard/clients` se pueden eliminar clientes sin movimientos (sin citas, pagos ni lista de espera), tanto desde la lista como desde el panel CRM.
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/app/api/appointments/[id]/route.ts src/app/api/clients/[id]/route.ts src/app/api/services/[id]/route.ts src/app/\(admin\)/dashboard/DashboardContent.tsx src/app/\(admin\)/dashboard/clients/ClientsContent.tsx src/app/\(admin\)/dashboard/services/ServicesContent.tsx src/components/ClientCRMPanel.tsx agents.md CHANGELOG.md README.md
git commit -m "feat(admin): cancelar cita con confirmación, eliminar clientes sin movimientos y eliminar servicios"
```
