# Quitar un servicio suelto de una cita + fixes del wizard y del portal — Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Goal:** Que una clienta o el admin puedan quitar un servicio individual de una cita existente sin cancelar la visita, y de paso arreglar el paso 1 del wizard con `?serviceId=` y las claves duplicadas de "Mis próximas citas".

**Architecture:** Todo el cálculo de combinaciones (ordenar, sumar, anclar) vive en funciones puras de `src/lib/appointment-purchases.ts`, que es el único punto donde se decide qué servicios forman una cita. Un endpoint nuevo borra una fila de `service_purchases` y recalcula `end_time`/`service_id` con esas funciones; las dos UIs (portal del cliente y panel CRM) consumen el mismo endpoint. El fan-out de compras se resuelve **no** haciendo JOIN: las compras se cargan aparte y se fusionan en memoria, que es el patrón que ya usan `src/app/api/appointments/route.ts` y el bloque de citas completadas del propio perfil.

**Tech Stack:** Next.js 15 (App Router, `src/`), TypeScript, Drizzle ORM + better-sqlite3, Tailwind + shadcn/ui, Vitest 2.1.9 (`vitest run`), Node 20.

**Spec:** `docs/superpowers/specs/2026-09-29-service-removal-and-booking-fixes-design.md` — el plan implementa ese spec; ambos viajan juntos y quien ejecute debe leerlos.

## Restricciones globales

- **Sin migración de esquema.** No se toca `src/db/schema.ts` ni se crea migración. El endpoint borra filas, no agrega columnas.
- **Zona horaria:** `SALON_TIME_ZONE` / `America/Caracas`. Los `start_time`/`end_time` son timestamps en segundos Unix.
- **Idiomas:** todos los textos visibles al usuario final en español, con tildes. Los comentarios del código, en español, y explican el *porqué* (por qué no un JOIN, por qué no `validateSlot`), nunca el qué.
- **Borrado duro:** la compra se elimina de `service_purchases` (igual que al desinscribir un alumno de curso en `DELETE /api/course-sessions/[id]/enrollments`). No se marca `void`.
- **Sin `validateSlot`:** quitar un servicio acorta el bloque, no puede crear un solape. Llamarlo rechazaría las citas que ya empezaron.
- **Citas `completed` son inmutables:** ni la UI ni la API ofrecen quitar servicios de una cita completada.
- **El botón solo aparece con más de un servicio** y la API responde 400 si es la última compra.
- **Permisos:** el endpoint acepta admin con permiso `appointments` **o** la clienta propietaria de la cita. No se agrega ninguna clave a `PERMISSION_KEYS`.
- **Auditoría:** toda mutación llama `logActivity`. El módulo es `purchases` y la acción es `delete`.
- **No se loguea contenido sensible:** los `notes`/`photo_url` de pagos no se tocan aquí.
- **Style:** 2 espacios, comillas dobles, punto y coma, `const` sobre `let`, arrow functions, sin `any` (si hace falta, `as never` como ya se usa en `src/lib/appointment-purchases.test.ts:103`).
- **Comandos en PowerShell 5.1:** nunca `&&`. Encadenar con `; if ($?) { ... }`.
- **Antes de commitear cualquier tarea:** `npx tsc --noEmit; if ($?) { npm run lint }`. Los dos deben pasar.

---

## Estructura de archivos

### Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/app/api/appointments/[id]/services/route.ts` | `DELETE` de un servicio suelto: guardas, borrado duro, recálculo de `end_time`/`service_id`, CXC, Google Calendar y auditoría. |
| `src/lib/appointment-fanout.test.ts` | Test de fuente: ninguna de las 5 lecturas de citas+citas con compras hace `leftJoin(schema.servicePurchases)`. |
| `src/lib/booking-combos.test.ts` | Tests de `classifyBookingEntry` y `partitionBookingServices`. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/appointment-purchases.ts` | `id` y `serviceDurationMins` obligatorios en `PurchaseSummaryRow`; nuevo `PurchaseSummaryItem`; `items` en cada resumen; nuevo helper puro `remainingCombination` + tipo `RemainingPurchase`. |
| `src/lib/appointment-purchases.test.ts` | Fixtures con los campos nuevos + suites `items` y `remainingCombination`. |
| `src/lib/calendar.ts` | `summary` opcional en `updateEventOnPrimaryCalendar` y su wrapper `updateAppointmentEvent`. |
| `src/app/api/appointments/route.ts` | Añadir `serviceDurationMins` al select de compras. |
| `src/app/api/gallery/route.ts` | Añadir `id` y `serviceDurationMins`. |
| `src/app/api/production-photos/route.ts` | Añadir `id` y `serviceDurationMins`. |
| `src/app/api/clients/[id]/route.ts` | Añadir `id` y `serviceDurationMins`. |
| `src/app/(client)/profile/page.tsx` | Fin del `leftJoin` en próximas citas; `summarizePurchases` también para ellas; `items` en las props. |
| `src/app/(client)/profile/ProfileContent.tsx` | `items` en el tipo, lista por servicio con "Quitar" y confirmación en línea. |
| `src/lib/booking-combos.ts` | `classifyBookingEntry`, `partitionBookingServices`, `clearPreselected`. |
| `src/components/BookingWizard.tsx` | Estado `preselectedId`, sin salto al paso 2, catálogo particionado, escape hatch "Cambiar". |
| `src/components/ClientCRMPanel.tsx` | Props `appointmentStatus`/`onChanged`; "Quitar" por servicio con `ConfirmDialog`. |
| `src/app/(admin)/dashboard/DashboardContent.tsx` | Pasar `appointmentStatus` y `onChanged` al `ClientCRMPanel`. |
| `agents.md`, `CHANGELOG.md`, `README.md` | Documentación (tarea 8). |

---

### Tarea 1: `items` en el resumen y helper `remainingCombination`

**Archivos:**
- Modificar: `src/lib/appointment-purchases.ts`
- Modificar: `src/lib/appointment-purchases.test.ts`
- Modificar: `src/app/api/appointments/route.ts:140-147`
- Modificar: `src/app/api/gallery/route.ts:77-82`
- Modificar: `src/app/api/production-photos/route.ts:132-137`
- Modificar: `src/app/api/clients/[id]/route.ts:236-242`
- Modificar: `src/app/(client)/profile/page.tsx:88-94` (select de compras de citas completadas)

**Interfaces:**
- Consume: nada (es la base de todo lo demás).
- Produce:
  ```ts
  // en src/lib/appointment-purchases.ts
  type PurchaseSummaryRow = { id: string; appointmentId: string | null; userId: string; serviceName: string; servicePrice: number; serviceDurationMins: number; isPrimary: number | null };
  type PurchaseSummaryItem = { id: string; name: string; price: number; durationMins: number; isPrimary: number | null };
  type PurchaseSummary = { serviceName: string; serviceNames: string[]; servicePrice: number; isComplementaryOnly: boolean; hasPrincipal: boolean; items: PurchaseSummaryItem[] };
  type RemainingPurchase = { id: string; serviceId: string | null; serviceName: string; servicePrice: number; serviceDurationMins: number; isPrimary: number | null };
  function remainingCombination(purchases: RemainingPurchase[]): {
    items: PurchaseSummaryItem[]; names: string[]; totalDurationMins: number; totalPrice: number; anchorServiceId: string | null;
  };
  ```

- [ ] **Paso 1: escribir los tests que fallan**

En `src/lib/appointment-purchases.test.ts`, cambia el import y el helper de filas para incluir los campos nuevos, y añade las dos suites. El helper `buy` se mantiene con los mismos parámetros en el mismo orden, así que los 20 tests existentes siguen compilando sin tocarlos:

```ts
import { describe, expect, it } from "vitest";
import {
  remainingCombination,
  summarizePurchases,
  type PurchaseSummaryRow,
  type RemainingPurchase,
} from "./appointment-purchases";

const appt = (id: string, clientId: string, serviceName: string) => ({
  id,
  clientId,
  serviceName,
});

let seq = 0;
const buy = (
  appointmentId: string,
  userId: string,
  serviceName: string,
  servicePrice: number,
  isPrimary: number | null = 1,
  serviceDurationMins = 60
): PurchaseSummaryRow => ({
  id: `p${++seq}`,
  appointmentId,
  userId,
  serviceName,
  servicePrice,
  serviceDurationMins,
  isPrimary,
});
```

Y al final del archivo:

```ts
describe("summarizePurchases · items", () => {
  it("expone una entrada por compra con id, precio y duración", () => {
    const map = summarizePurchases(
      [appt("a1", "c1", "Acrílicas Full")],
      [buy("a1", "c1", "Acrílicas Full", 35, 1, 120), buy("a1", "c1", "Diseño", 8, 0, 15)]
    );
    expect(map.get("a1")!.items).toEqual([
      { id: expect.any(String), name: "Acrílicas Full", price: 35, durationMins: 120, isPrimary: 1 },
      { id: expect.any(String), name: "Diseño", price: 8, durationMins: 15, isPrimary: 0 },
    ]);
  });

  it("NO duplica items en una sesión de curso (solo el grupo del alumno)", () => {
    const map = summarizePurchases(
      [appt("a1", "alumno1", "Curso")],
      [buy("a1", "alumno1", "Curso", 50), buy("a1", "alumno2", "Curso", 50), buy("a1", "alumno3", "Curso", 50)]
    );
    expect(map.get("a1")!.items).toHaveLength(1);
  });

  it("sin compras devuelve items vacío", () => {
    expect(summarizePurchases([appt("a1", "c1", "Acrílicas")], []).get("a1")!.items).toEqual([]);
  });
});

describe("remainingCombination", () => {
  const p = (o: { id: string; serviceName: string } & Partial<RemainingPurchase>): RemainingPurchase => ({
    serviceId: null,
    servicePrice: 0,
    serviceDurationMins: 60,
    isPrimary: null,
    ...o,
  });

  it("ordena, suma y ancla en el primero", () => {
    const r = remainingCombination([
      p({ id: "2", serviceId: "svc-2", serviceName: "Zafiro", servicePrice: 5, serviceDurationMins: 10, isPrimary: 0 }),
      p({ id: "1", serviceId: "svc-1", serviceName: "Gel", servicePrice: 25, serviceDurationMins: 60, isPrimary: 1 }),
      p({ id: "3", serviceName: "Diseño", servicePrice: 8, serviceDurationMins: 15, isPrimary: 0 }),
    ]);
    expect(r.names).toEqual(["Gel", "Diseño", "Zafiro"]);
    expect(r.items.map((i) => i.id)).toEqual(["1", "3", "2"]);
    expect(r.totalPrice).toBe(38);
    expect(r.totalDurationMins).toBe(85);
    expect(r.anchorServiceId).toBe("svc-1");
  });

  it("con lista vacía devuelve ceros y ancla nula", () => {
    expect(remainingCombination([])).toEqual({
      items: [],
      names: [],
      totalDurationMins: 0,
      totalPrice: 0,
      anchorServiceId: null,
    });
  });

  it("salta los service_id nulos para el ancla y tolera precio sucio", () => {
    const r = remainingCombination([
      p({ id: "a", serviceName: "A", servicePrice: NaN, serviceDurationMins: 30 }),
      p({ id: "b", serviceId: "svc-b", serviceName: "B", servicePrice: 10, serviceDurationMins: 30 }),
    ]);
    expect(r.anchorServiceId).toBe("svc-b");
    expect(r.totalPrice).toBe(10);
    expect(r.totalDurationMins).toBe(60);
  });
});
```

- [ ] **Paso 2: correr los tests y verlos fallar**

```
npx vitest run src/lib/appointment-purchases.test.ts
```
Esperado: FAIL. `items` no existe en el tipo de retorno y `remainingCombination` no está exportada ("No 'remainingCombination' export is defined" o error de TS equivalente).

- [ ] **Paso 3: implementación mínima en `src/lib/appointment-purchases.ts`**

Añade `id` y `serviceDurationMins` a `PurchaseSummaryRow`, y los tipos nuevos. Reemplaza el `sort` inline por el comparador compartido, y añade `items` a las dos ramas del `set`:

```ts
export type PurchaseSummaryRow = {
  id: string;
  appointmentId: string | null;
  userId: string;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
};

export type PurchaseSummaryItem = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  isPrimary: number | null;
};

export type PurchaseSummary = {
  serviceName: string;
  serviceNames: string[];
  servicePrice: number;
  isComplementaryOnly: boolean;
  hasPrincipal: boolean;
  /** Una fila por compra del grupo, no por cita: es lo que la UI lista. */
  items: PurchaseSummaryItem[];
};

/** Lo mínimo que necesita el recálculo de la cita al quitar un servicio. */
export type RemainingPurchase = {
  id: string;
  serviceId: string | null;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
};

type SortablePurchase = { serviceName: string; isPrimary: number | null };

// Principal primero; las complementarias por nombre. Es el mismo criterio con el
// que se compone el título de la cita, así que la lista y el título no pueden
// contradecirse.
function comparePurchaseRows(a: SortablePurchase, b: SortablePurchase): number {
  const pa = a.isPrimary === 1 ? 0 : 1;
  const pb = b.isPrimary === 1 ? 0 : 1;
  if (pa !== pb) return pa - pb;
  return a.serviceName.localeCompare(b.serviceName, "es");
}

function toItem(r: {
  id: string;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
}): PurchaseSummaryItem {
  return {
    id: r.id,
    name: r.serviceName,
    price: r.servicePrice,
    durationMins: r.serviceDurationMins,
    isPrimary: r.isPrimary,
  };
}
```

En `summarizePurchases`, el `sort` pasa a ser `[...chosen].sort(comparePurchaseRows)` y el `set` queda:

```ts
    out.set(appt.id, {
      serviceName: chosen.map((p) => p.serviceName).join(" + "),
      serviceNames: chosen.map((p) => p.serviceName),
      servicePrice: chosen.reduce((acc, p) => acc + (p.servicePrice || 0), 0),
      isComplementaryOnly: chosen.every((p) => p.isPrimary !== 1),
      hasPrincipal: chosen.some((p) => p.isPrimary === 1),
      items: chosen.map(toItem),
    });
```

y la rama sin compras lleva `items: []`. (`pickGroup` y su lógica de curso quedan intactos: no es parte de este cambio.)

Añade al final del archivo:

```ts
/**
 * Recalcula la combinación de una cita a partir de las compras que quedan.
 * Es pura a propósito: el endpoint la usa para decidir `end_time` y el ancla
 * antes de borrar nada, y los tests la pueden ejercitar sin base de datos.
 * `anchorServiceId` es el `service_id` de la primera compra que lo tenga, que es
 * el "el primero manda" de siempre; con compras huérfanas queda en null y el
 * llamador conserva el ancla anterior.
 */
export function remainingCombination(purchases: RemainingPurchase[]): {
  items: PurchaseSummaryItem[];
  names: string[];
  totalDurationMins: number;
  totalPrice: number;
  anchorServiceId: string | null;
} {
  const ordered = [...purchases].sort(comparePurchaseRows);
  return {
    items: ordered.map(toItem),
    names: ordered.map((p) => p.serviceName),
    totalDurationMins: ordered.reduce((acc, p) => acc + (p.serviceDurationMins || 0), 0),
    totalPrice: ordered.reduce((acc, p) => acc + (p.servicePrice || 0), 0),
    anchorServiceId: ordered.find((p) => p.serviceId)?.serviceId ?? null,
  };
}
```

- [ ] **Paso 4: los 5 llamadores deben seguir compilando**

`PurchaseSummaryRow` ahora exige `id` y `serviceDurationMins`, y hay **cinco** selects de `schema.servicePurchases` que alimentan a `summarizePurchases`. Añade las columnas que falten en cada uno:

- `src/app/api/appointments/route.ts:140-147` → añadir `serviceDurationMins: schema.servicePurchases.serviceDurationMins,` después de `servicePrice` (ya trae `id`).
- `src/app/api/gallery/route.ts:77-82` → añadir `id: schema.servicePurchases.id,` y `serviceDurationMins: schema.servicePurchases.serviceDurationMins,`.
- `src/app/api/production-photos/route.ts:132-137` → idem.
- `src/app/api/clients/[id]/route.ts:236-242` → idem.
- `src/app/(client)/profile/page.tsx:88-94` → idem (el de las citas completadas).

Regla: en ninguno de los cinco se **lee** `id` ni `serviceDurationMins` todavía; solo se seleccionan porque el tipo lo pide. No los propagues a la respuesta JSON en esta tarea: nada los necesita todavía, y `production-photos` ya calcula los días con la subconsulta de `appointment_photos`.

- [ ] **Paso 5: correr los tests y el typecheck**

```
npx vitest run src/lib/appointment-purchases.test.ts
```
Esperado: PASS (todos, los 20 antiguos + los 6 nuevos).

```
npx tsc --noEmit
```
Esperado: 0 errores. Si el typecheck falla solo con "la propiedad id/serviceDurationMins falta", es que quedó un select sin actualizar: vuelve al paso 4.

- [ ] **Paso 6: commit**

```
git add src/lib/appointment-purchases.ts src/lib/appointment-purchases.test.ts "src/app/api/appointments/route.ts" "src/app/api/gallery/route.ts" "src/app/api/production-photos/route.ts" "src/app/api/clients/[id]/route.ts" "src/app/(client)/profile/page.tsx"
git commit -m "refactor(compras): items por compra y helper remainingCombination"
```

---

### Tarea 2: `summary` opcional en Google Calendar

**Archivos:**
- Modificar: `src/lib/calendar.ts` (`updateEventOnPrimaryCalendar` y `updateAppointmentEvent`)

**Interfaces:**
- Consume: nada.
- Produce: `updateEventOnPrimaryCalendar(userId, eventId, event: { start: number; end: number; summary?: string }): Promise<boolean>` y `updateAppointmentEvent(userId, eventId, start, end, summary?): Promise<boolean>`.

- [ ] **Paso 1: entender el contrato de Calendar**

Google solo reemplaza los campos enviados en el `PATCH`: si el body no trae `summary`, el título del evento se conserva. Por eso el campo es opcional y no se manda `""` cuando no se pasa. Esta tarea no tiene test propio (no hay harness de Google en el repo); su verificación es el typecheck y la revisión del diff.

- [ ] **Paso 2: cambiar el tipo del parámetro `event`**

```ts
export async function updateEventOnPrimaryCalendar(
  userId: string,
  eventId: string,
  event: { start: number; end: number; summary?: string }
): Promise<boolean> {
```

y en el `body: JSON.stringify({...})` del `fetch`, cambia la forma del body para que el título viaje solo si se pidió:

```ts
    body: JSON.stringify({
      start: { dateTime: new Date(event.start * 1000).toISOString() },
      end: { dateTime: new Date(event.end * 1000).toISOString() },
      // Google solo reemplaza los campos presentes: si no llega summary, el
      // título del evento se queda como está. Por eso es opcional y no "".
      ...(event.summary ? { summary: event.summary } : {}),
    }),
```

- [ ] **Paso 3: propagar el parámetro en el wrapper**

```ts
export async function updateAppointmentEvent(
  userId: string,
  eventId: string,
  start: number,
  end: number,
  summary?: string
): Promise<boolean> {
  return updateEventOnPrimaryCalendar(userId, eventId, { start, end, summary });
}
```

- [ ] **Paso 4: typecheck y lint**

```
npx tsc --noEmit
npm run lint
```
Esperado: ambos en 0. Los dos llamadores actuales (`appointments/[id]/route.ts`, el PATCH de hora) siguen compilando porque `summary` es opcional.

- [ ] **Paso 5: commit**

```
git add src/lib/calendar.ts
git commit -m "feat(calendar): permitir actualizar el título del evento"
```

---

### Tarea 3: endpoint para quitar un servicio de una cita

**Archivos:**
- Crear: `src/app/api/appointments/[id]/services/route.ts`

**Interfaces:**
- Consume: `remainingCombination(purchases: RemainingPurchase[])` (tarea 1), `updateAppointmentEvent(userId, eventId, start, end, summary?)` (tarea 2), `recomputeFinancialStatus(db, userId)`, `logActivity(db, {...})`, `getAdminUserId()`, `deleteEventOnPrimaryCalendar` no hace falta.
- Produce:
  ```ts
  // DELETE /api/appointments/[id]/services?purchaseId=<service_purchases.id>
  // 200 -> { success: true, appointmentId, serviceId, endTime, serviceName, totalDurationMins }
  // 400 | 401 | 403 | 404 -> { error: string }
  ```

- [ ] **Paso 1: escribir el archivo**

```ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { hasPermission } from "@/lib/authz";
import { remainingCombination } from "@/lib/appointment-purchases";
import { recomputeFinancialStatus } from "@/lib/financial-status";
import { getAdminUserId, updateAppointmentEvent } from "@/lib/calendar";
import { logActivity } from "@/lib/audit";

/**
 * Quita UN servicio suelto de una cita sin cancelar la visita. Cancelar la cita
 * entera sigue siendo DELETE /api/appointments/[id], que además archiva el
 * snapshot; esta ruta es para el caso real de "me arrepentí del matiz".
 *
 * La compra se borra en duro (igual que al desinscribir un alumno de un curso)
 * porque service_purchases es el snapshot de lo que se cobró: dejar una fila
 * void seguiría sumando duración, precio y aparición en el estado de cuenta.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const purchaseId = req.nextUrl.searchParams.get("purchaseId");
  if (!purchaseId) {
    return NextResponse.json({ error: "purchaseId requerido" }, { status: 400 });
  }

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();
  if (!appointment) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  const isAdmin = await hasPermission(session, "appointments");
  if (!isAdmin && appointment.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (appointment.status === "completed") {
    return NextResponse.json(
      { error: "No se puede quitar un servicio de una cita completada" },
      { status: 400 }
    );
  }

  // La compra se filtra por cita además de por id: sin esto, una dueña podría
  // borrar el servicio de una cita ajena.
  const purchase = db
    .select()
    .from(schema.servicePurchases)
    .where(
      and(
        eq(schema.servicePurchases.id, purchaseId),
        eq(schema.servicePurchases.appointmentId, id)
      )
    )
    .get();
  if (!purchase) {
    return NextResponse.json(
      { error: "Ese servicio no pertenece a la cita" },
      { status: 404 }
    );
  }

  const all = db
    .select({
      id: schema.servicePurchases.id,
      serviceId: schema.servicePurchases.serviceId,
      serviceName: schema.servicePurchases.serviceName,
      servicePrice: schema.servicePurchases.servicePrice,
      serviceDurationMins: schema.servicePurchases.serviceDurationMins,
      isPrimary: schema.servicePurchases.isPrimary,
    })
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.appointmentId, id))
    .all();

  // Contar ANTES de borrar incluye la compra que se va: con una sola no quedaría nada.
  if (all.length <= 1) {
    return NextResponse.json(
      {
        error:
          "La cita debe tener al menos un servicio. Para eliminarla del todo, cancela la cita.",
      },
      { status: 400 }
    );
  }

  const enrollment = db
    .select({ id: schema.courseEnrollments.id })
    .from(schema.courseEnrollments)
    .where(eq(schema.courseEnrollments.appointmentId, id))
    .get();
  if (enrollment) {
    return NextResponse.json(
      { error: "Los alumnos de una sesión de curso se gestionan desde la sesión" },
      { status: 400 }
    );
  }

  const remaining = remainingCombination(all.filter((p) => p.id !== purchaseId));
  const summary = remaining.names.join(" + ");
  // Un start_time null es una cita rota: mejor no inventarle un end_time nuevo.
  const startTime = appointment.startTime ?? 0;
  const endTime = startTime + remaining.totalDurationMins * 60;

  db.transaction((tx) => {
    tx.delete(schema.servicePurchases)
      .where(eq(schema.servicePurchases.id, purchaseId))
      .run();
    tx.update(schema.appointments)
      .set({
        endTime,
        // Si ninguna compra restante trae service_id (compras huérfanas), se
        // conserva el ancla anterior en vez de dejar la cita sin servicio.
        ...(remaining.anchorServiceId
          ? { serviceId: remaining.anchorServiceId }
          : {}),
      })
      .where(eq(schema.appointments.id, id))
      .run();
  });

  // La clienta y el admin pagan la cita: recalcular solo para la dueña dejaría
  // al admin con el precio viejo.
  for (const userId of new Set([appointment.clientId, purchase.userId])) {
    recomputeFinancialStatus(userId);
  }

  logActivity(db, {
    entity: "purchases",
    action: "delete",
    entityId: purchaseId,
    label: `Quitó "${purchase.serviceName}" de la cita (${summary || "sin servicios"})`,
    metadata: {
      appointmentId: id,
      purchaseId,
      removedService: purchase.serviceName,
      newSummary: summary,
      newEndTime: endTime,
      newTotalDurationMins: remaining.totalDurationMins,
    },
    actorId: session.user.id,
    actorName: session.user.name ?? null,
  });

  if (process.env.GOOGLE_CALENDAR_ENABLED === "true") {
    if (appointment.googleEventIdClient) {
      await updateAppointmentEvent(
        appointment.clientId,
        appointment.googleEventIdClient,
        startTime,
        endTime,
        summary
      );
    }
    if (appointment.googleEventIdAdmin) {
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        await updateAppointmentEvent(
          adminUserId,
          appointment.googleEventIdAdmin,
          startTime,
          endTime,
          summary
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    appointmentId: id,
    serviceId: purchase.serviceId,
    endTime,
    serviceName: summary,
    totalDurationMins: remaining.totalDurationMins,
  });
}
```

**Firmas de los ayudantes (verificadas en el repo, no las inventes):**

- `recomputeFinancialStatus(userId: string): void` — un solo argumento, sin `db` (`src/lib/financial-status.ts`).
- `logActivity(dbc: AuditDb, params: LogActivityParams): void` — dos argumentos, el segundo un objeto con `{ actorId?, actorName?, entity, action, entityId, label, metadata }` (`src/lib/audit.ts`). `"purchases"` está en `AUDIT_ENTITIES` y `"delete"` en `AUDIT_ACTIONS`.

- [ ] **Paso 2: typecheck y lint**

```
npx tsc --noEmit
npm run lint
```
Esperado: 0 errores. `hasPermission` es `async` en `src/lib/authz.ts`, así que el `await` del código de arriba es obligatorio.

- [ ] **Paso 3: probar el endpoint a mano contra el servidor de desarrollo**

```
npm run dev
```

Con el cliente demo (`clienta@email.com` / `Cliente123!`) autenticado, en otra terminal:

```
curl -i -X DELETE "http://localhost:3001/api/appointments/<ID_CITA_DEMO>/services?purchaseId=<ID_COMPRA>"
```

Comprueba, en este orden: (a) sin sesión → 401; (b) `purchaseId` inexistente → 404 `Ese servicio no pertenece a la cita`; (c) con la cita demo de 1 solo servicio → 400 `La cita debe tener al menos un servicio`; (d) sobre una cita con principal + complementario → 200, y en la base de datos la fila borrada, `end_time` = `start_time + duración restante`, y `service_id` apuntando al servicio que quedó. Si la cita del demo no tiene complementarios, crea uno desde el panel de admin o inserta la fila a mano para poder probar el caso (d), y acuérdate de borrarlo después.

- [ ] **Paso 4: commit**

```
git add "src/app/api/appointments/[id]/services/route.ts"
git commit -m "feat(appointments): endpoint para quitar un servicio suelto de una cita"
```

---

### Tarea 4: portal del cliente — fin del fan-out y "Quitar" por servicio

**Archivos:**
- Modificar: `src/app/(client)/profile/page.tsx:39-46, 88-103, 105-116`
- Modificar: `src/app/(client)/profile/ProfileContent.tsx:36-43, 56, 185-255`

**Interfaces:**
- Consume: `summarizePurchases(appointments, purchaseRows)` de la tarea 1; `DELETE /api/appointments/[id]/services?purchaseId=X` de la tarea 3.
- Produce: prop `upcomingAppointments` con la forma `UpcomingAppointment = { id, startTime, endTime, status, referencePhotoUrl, serviceName, items: { id, name, price, durationMins, isPrimary }[] }`.

- [ ] **Paso 1: quitar el `leftJoin` de próximas citas en `page.tsx`**

Reemplaza el bloque de `upcomingAppointments` (líneas 39-46) por la versión sin JOIN, y añade `clientId` al select porque `summarizePurchases` lo necesita como clave del grupo:

```ts
  // Sin leftJoin a service_purchases: el JOIN multiplicaba la fila de la cita
  // por cada compra, así que una cita de 3 servicios salía 3 veces con el mismo
  // appointments.id (claves duplicadas en React). Las compras se cargan aparte y
  // se fusionan en memoria, igual que las citas completadas de más abajo.
  const upcomingAppointments = db
    .select({
      id: schema.appointments.id,
      clientId: schema.appointments.clientId,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
      referencePhotoUrl: schema.appointments.referencePhotoUrl,
      serviceName: schema.services.name,
    })
    .from(schema.appointments)
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(and(eq(schema.appointments.clientId, userId), eq(schema.appointments.status, "confirmed")))
    .orderBy(schema.appointments.startTime)
    .all();
```

- [ ] **Paso 2: fusionar las compras y pasar `items`**

Justo antes del `return NextResponse.json(...)` final, añade:

```ts
  const purchaseSelect = {
    id: schema.servicePurchases.id,
    appointmentId: schema.servicePurchases.appointmentId,
    userId: schema.servicePurchases.userId,
    serviceName: schema.servicePurchases.serviceName,
    servicePrice: schema.servicePurchases.servicePrice,
    serviceDurationMins: schema.servicePurchases.serviceDurationMins,
    isPrimary: schema.servicePurchases.isPrimary,
  };

  const upcomingIds = upcomingAppointments.map((a) => a.id);
  const upcomingPurchases = upcomingIds.length
    ? db
        .select(purchaseSelect)
        .from(schema.servicePurchases)
        .where(inArray(schema.servicePurchases.appointmentId, upcomingIds))
        .all()
    : [];

  const upcomingSummaries = summarizePurchases(
    upcomingAppointments.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      serviceName: a.serviceName,
    })),
    upcomingPurchases
  );
```

Reutiliza `purchaseSelect` también en el bloque de citas completadas (reemplaza su `.select({...})` por `.select(purchaseSelect)`) para que las dos consultas no puedan divergir.

Y en las props de `<ProfileContent ...>` cambia `upcomingAppointments={upcomingAppointments}` por:

```tsx
        upcomingAppointments={upcomingAppointments.map((a) => {
          const s = upcomingSummaries.get(a.id);
          return {
            id: a.id,
            startTime: a.startTime ?? 0,
            endTime: a.endTime ?? 0,
            status: a.status ?? "pending",
            referencePhotoUrl: a.referencePhotoUrl,
            serviceName: s?.serviceName ?? a.serviceName,
            items: s?.items ?? [],
          };
        })}
```

- [ ] **Paso 3: actualizar el tipo en `ProfileContent.tsx`**

```tsx
type UpcomingService = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  isPrimary: number | null;
};

type UpcomingAppointment = {
  id: string;
  startTime: number;
  endTime: number;
  status: string;
  referencePhotoUrl: string | null;
  serviceName: string;
  /** Una fila por servicio de la cita: lo que permite quitar uno suelto. */
  items: UpcomingService[];
};
```

- [ ] **Paso 4: estado de la confirmación y la llamada al endpoint**

Junto a los estados existentes (`confirmingId`, `cancellingId`, `cancelError`), añade:

```tsx
  const [removingPurchaseId, setRemovingPurchaseId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  async function handleRemoveService(appointmentId: string, purchaseId: string) {
    setRemoveError("");
    const res = await fetch(
      `/api/appointments/${appointmentId}/services?purchaseId=${purchaseId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRemoveError(data?.error ?? "No se pudo quitar el servicio");
      setRemovingPurchaseId(null);
      return;
    }
    setRemovingPurchaseId(null);
    router.refresh();
  }
```

- [ ] **Paso 5: reestructurar la tarjeta para que la lista quepa**

La tarjeta actual es un `flex items-center` de una sola fila (líneas 186-255). Pásala a columna: encabezado (miniatura + nombre + fecha + badge de estado), luego la lista de servicios, luego las acciones. Sustituye el bloque completo del `.map` por:

```tsx
            {upcomingAppointments.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {appt.referencePhotoUrl && (
                    <PhotoThumb
                      photos={[
                        {
                          id: `ref-${appt.id}`,
                          url: appt.referencePhotoUrl,
                          caption: `Referencia · ${appt.serviceName} · ${longDate(appt.startTime)}`,
                        },
                      ]}
                      index={0}
                      onOpen={lightbox.open}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{appt.serviceName}</p>
                    <p className="text-sm text-gray-500">
                      {new Intl.DateTimeFormat("es-ES", {
                        dateStyle: "long",
                        timeZone: "America/Caracas",
                      }).format(new Date(appt.startTime * 1000))}
                      {" · "}
                      {new Intl.DateTimeFormat("es-ES", {
                        timeStyle: "short",
                        timeZone: "America/Caracas",
                      }).format(new Date(appt.startTime * 1000))}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      appt.status === "confirmed"
                        ? "bg-green-50 text-green-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {appt.status === "confirmed" ? "Confirmada" : "Pendiente"}
                  </span>
                </div>

                {appt.items.length > 1 && (
                  <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {appt.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-gray-700">
                          {item.isPrimary === 1 ? item.name : `+ ${item.name}`}
                          <span className="ml-1 text-xs text-gray-400">
                            ${item.price.toFixed(2)} · {item.durationMins} min
                          </span>
                        </span>
                        {removingPurchaseId === item.id ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() =>
                                handleRemoveService(appt.id, item.id)
                              }
                              className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                            >
                              Sí, quitar
                            </button>
                            <button
                              onClick={() => setRemovingPurchaseId(null)}
                              className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setRemoveError("");
                              setRemovingPurchaseId(item.id);
                            }}
                            className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Quitar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex justify-end">
                  {confirmingId === appt.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCancel(appt.id)}
                        disabled={cancellingId === appt.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {cancellingId === appt.id ? "Cancelando..." : "Sí, cancelar"}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(appt.id)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Cancelar cita
                    </button>
                  )}
                </div>
              </div>
            ))}
```

El botón de la cita pasa a decir **"Cancelar cita"** porque ahora convive con "Quitar" por servicio: dos "Cancelar" en la misma tarjeta confundirían (uno quita un servicio, otro la visita entera).

- [ ] **Paso 6: mostrar el error junto a la lista**

Junto al `{cancelError && ...}` existente (después del bloque de tarjetas), añade:

```tsx
        {removeError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {removeError}
          </p>
        )}
```

- [ ] **Paso 7: typecheck, lint y pruebas**

```
npx tsc --noEmit
npm run lint
npm test
```
Esperado: los tres en verde. `npm test` incluye `appointment-purchases.test.ts` de la tarea 1.

- [ ] **Paso 8: probar en el navegador**

```
npm run dev
```

Entra como `clienta@email.com` / `Cliente123!`, abre `/profile` y verifica: (a) la cita con principal + complementario aparece **una sola vez**, no 3; (b) cada servicio es una línea con su precio y duración; (c) "Quitar" pide confirmación y, tras confirmar, la línea desaparece y el total de la cita baja; (d) "Cancelar cita" sigue cancelando la visita completa. Revisa que no haya "Hydration failed" en la consola.

- [ ] **Paso 9: commit**

```
git add "src/app/(client)/profile/page.tsx" "src/app/(client)/profile/ProfileContent.tsx"
git commit -m "fix(profile): una fila por cita y quitar servicios desde el portal"
```

---

### Tarea 5: "Quitar" en el panel CRM del admin

**Archivos:**
- Modificar: `src/components/ClientCRMPanel.tsx:1-60, 539-564`
- Modificar: `src/app/(admin)/dashboard/DashboardContent.tsx` (el `renderDrawer`)

**Interfaces:**
- Consume: `DELETE /api/appointments/[id]/services?purchaseId=X` de la tarea 3.
- Produce: dos props nuevas en `ClientCRMPanel`: `appointmentStatus?: string` y `onChanged?: () => void`.

- [ ] **Paso 1: declarar las props nuevas**

En la interfaz `Props` de `ClientCRMPanel`, añade:

```tsx
  /** Estado de la cita abierta: no se quita nada de una cita completada. */
  appointmentStatus?: string;
  /** Se llama tras un cambio para que el padre refresque la agenda. */
  onChanged?: () => void;
```

- [ ] **Paso 2: estado y llamada al endpoint**

Junto a los estados de compras que ya existen (`purchase`, `purchaseForm`, `editingPurchase`, `purchaseError`), añade:

```tsx
  const [removingPurchase, setRemovingPurchase] = useState<typeof purchases[number] | null>(null);
  const [removeError, setRemoveError] = useState("");

  async function removeService() {
    if (!removingPurchase || !appointmentId) return;
    setRemoveError("");
    const res = await fetch(
      `/api/appointments/${appointmentId}/services?purchaseId=${removingPurchase.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRemoveError(data?.error ?? "No se pudo quitar el servicio");
      setRemovingPurchase(null);
      return;
    }
    // La compra editada puede ser la que se quitó: se suelta para no dejar el
    // formulario apuntando a una fila que ya no existe.
    setRemovingPurchase(null);
    setPurchase(null);
    setPurchaseForm(null);
    await loadClient();
    onChanged?.();
  }
```

Si `loadClient` no existe con ese nombre, usa el callback que el componente ya usa para recargar sus datos (el que llama a `/api/clients/${clientId}`).

- [ ] **Paso 3: convertir la fila en `<div>` y añadir "Quitar"**

La fila actual (líneas 541-562) es un `<button>`; **no** se puede anidar otro botón dentro. La envuelves en un `<div>` con el botón de selección y el de quitar como hermanos:

```tsx
              <div className="mb-3 space-y-1.5">
                {purchases.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                      p.id === purchase?.id ? "bg-pink-light" : "bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setPurchase(p);
                        setPurchaseForm(p);
                        setEditingPurchase(false);
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <span className="min-w-0 truncate font-medium text-gray-900">
                        {p.isPrimary === 1 ? p.serviceName : `+ ${p.serviceName}`}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        ${p.servicePrice.toFixed(2)} · {p.serviceDurationMins} min
                      </span>
                    </button>
                    {appointmentStatus !== "completed" && (
                      <button
                        onClick={() => {
                          setRemoveError("");
                          setRemovingPurchase(p);
                        }}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        aria-label={`Quitar ${p.serviceName} de la cita`}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
              </div>
```

La lista completa solo se dibuja cuando `purchases.length > 1` (línea 539), así que el botón nunca aparece en una cita de un solo servicio: la regla de negocio se cumple sin una condición extra.

- [ ] **Paso 4: confirmación con `ConfirmDialog`**

`ConfirmDialog` ya está importado (línea 6). Añade un segundo diálogo junto al que ya existe (línea 753), sin tocar el del borrado de cliente:

```tsx
      <ConfirmDialog
        open={!!removingPurchase}
        title="Quitar servicio"
        message={
          removingPurchase
            ? `¿Quitar "${removingPurchase.serviceName}" de la cita? La cita sigue agendada con los servicios que quedan y el total se recalcula.`
            : ""
        }
        confirmLabel="Quitar"
        onConfirm={removeService}
        onClose={() => setRemovingPurchase(null)}
      />
```

Si el `ConfirmDialog` existente usa nombres de props distintos (`title`/`message`/`onConfirm`/`onClose`), copia exactamente esos nombres del diálogo de la línea 753.

Muestra el error del endpoint junto a `purchaseError` (línea 534), siguiendo el mismo patrón:

```tsx
            {removeError && (
              <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-600">
                {removeError}
              </p>
            )}
```

- [ ] **Paso 5: pasar las props desde la agenda**

En `renderDrawer` de `DashboardContent.tsx`, al renderizar `ClientCRMPanel`, añade:

```tsx
          appointmentStatus={selectedAppointment?.status}
          onChanged={refreshAll}
```

Si el callback de refresco de la agenda no se llama `refreshAll`, usa el que ya se invoca tras completar o editar una cita.

- [ ] **Paso 6: typecheck, lint y pruebas**

```
npx tsc --noEmit
npm run lint
npm test
```
Esperado: los tres en verde.

- [ ] **Paso 7: probar en el navegador**

```
npm run dev
```

Entra como admin, abre un cliente con cita de 2 o más servicios: (a) el drawer muestra "Quitar" por servicio; (b) la confirmación nombra el servicio y avisa que la cita sigue agendada; (c) al confirmar, la lista se actualiza sin recargar a mano y la agenda de fondo refleja el nuevo horario; (d) en una cita completada no hay botón "Quitar".

- [ ] **Paso 8: commit**

```
git add src/components/ClientCRMPanel.tsx "src/app/(admin)/dashboard/DashboardContent.tsx"
git commit -m "feat(crm): quitar un servicio suelto desde el panel del admin"
```

---

### Tarea 6: paso 1 del wizard con `?serviceId=`

**Archivos:**
- Modificar (anexar al final): `src/lib/booking-combos.ts` — **ya existe y no está commiteado**; contiene `MAX_COMPLEMENTARY_SERVICES`, `parseComplementaryIds`, `resolveBookingServices` y `formatServiceNames`. No lo reescribas: añade las 3 funciones al final del archivo.
- Modificar (anexar al final): `src/lib/booking-combos.test.ts` — **ya existe y no está commiteado**; tiene 18 tests de `parseComplementaryIds`, `formatServiceNames` y `resolveBookingServices`. Anexa las 3 describes nuevas al final y no toques las existentes. **Crear el archivo desde cero borraría 18 tests previos.**
- Modificar: `src/components/BookingWizard.tsx:77-95, 128-129, 386-390, 457-487`

**Interfaces:**
- Consume: nada.
- Produce:
  ```ts
  // en src/lib/booking-combos.ts
  function classifyBookingEntry(
    service: { id: string; isComplementary?: number | null } | null | undefined,
    requestedId: string | null
  ): "principal" | "complementary" | "ignore";
  function partitionBookingServices<T extends { id: string; isComplementary: number | null }>(
    services: T[],
    preselectedId: string | null
  ): { principal: T[]; complementary: T[] };
  function clearPreselected<T extends { id: string }>(
    selectedPrimary: T | null,
    selectedComplementaries: T[],
    preselectedId: string
  ): { primary: T | null; complementaries: T[] };
  ```

- [ ] **Paso 1: escribir los tests que fallan**

`src/lib/booking-combos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classifyBookingEntry,
  clearPreselected,
  partitionBookingServices,
} from "./booking-combos";

const svc = (id: string, isComplementary: number) => ({ id, isComplementary });

describe("classifyBookingEntry", () => {
  it("un principal preseleccionado es principal", () => {
    expect(classifyBookingEntry({ id: "a", isComplementary: 0 }, "a")).toBe("principal");
  });

  it("un complementario preseleccionado es complementario (se ofrece agregar, no se ignora)", () => {
    expect(classifyBookingEntry({ id: "b", isComplementary: 1 }, "b")).toBe("complementary");
  });

  it("una respuesta de la API que no es el servicio pedido se ignora", () => {
    expect(classifyBookingEntry({ id: "otro", isComplementary: 0 }, "a")).toBe("ignore");
    expect(classifyBookingEntry(null, "a")).toBe("ignore");
    expect(classifyBookingEntry({ id: "a", isComplementary: 0 }, null)).toBe("ignore");
  });
});

describe("partitionBookingServices", () => {
  const catalogo = [svc("a", 0), svc("b", 0), svc("c", 1), svc("d", 1)];

  it("sin preselección separa principales de complementarios", () => {
    const r = partitionBookingServices(catalogo, null);
    expect(r.principal.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.complementary.map((s) => s.id)).toEqual(["c", "d"]);
  });

  it("con preselección de un principal no ofrece principales (no hay a qué cambiar)", () => {
    const r = partitionBookingServices(catalogo, "a");
    expect(r.principal).toEqual([]);
    expect(r.complementary.map((s) => s.id)).toEqual(["c", "d"]);
  });

  it("con preselección de un complementario no lo repite en la lista", () => {
    const r = partitionBookingServices(catalogo, "c");
    expect(r.principal).toEqual([]);
    expect(r.complementary.map((s) => s.id)).toEqual(["d"]);
  });
});

describe("clearPreselected", () => {
  const a = svc("a", 0);
  const c = svc("c", 1);

  it("si era el principal, lo suelta", () => {
    const r = clearPreselected(a, [], "a");
    expect(r.primary).toBeNull();
    expect(r.complementaries).toEqual([]);
  });

  it("si era complementario, lo quita de los complementarios y conserva el resto", () => {
    const r = clearPreselected(null, [a, c], "c");
    expect(r.primary).toBeNull();
    expect(r.complementaries.map((s) => s.id)).toEqual(["a"]);
  });

  it("es idempotente cuando el id no está en ninguna de las dos listas", () => {
    const r = clearPreselected(null, [a], "zzz");
    expect(r.complementaries.map((s) => s.id)).toEqual(["a"]);
  });
});
```

- [ ] **Paso 2: correr los tests y verlos fallar**

```
npx vitest run src/lib/booking-combos.test.ts
```
Esperado: FAIL. Las tres funciones no están exportadas todavía.

- [ ] **Paso 3: implementación mínima en `src/lib/booking-combos.ts`**

```ts
/**
 * Qué hacer con el servicio que llega por `?serviceId=`. Es una decisión de
 * catálogo, no de UI: un complementario no puede ser principal (la API lo
 * rechaza), pero sí se puede ofrecer como "ya elegido" para agregar otro.
 */
export function classifyBookingEntry(
  service: { id: string; isComplementary?: number | null } | null | undefined,
  requestedId: string | null
): "principal" | "complementary" | "ignore" {
  if (!service || !requestedId || service.id !== requestedId) return "ignore";
  return service.isComplementary === 1 ? "complementary" : "principal";
}

/**
 * Reparte el catálogo. Con algo preseleccionado no se ofrecen principales:
 * la cita ya tiene su principal y, en un servidor con muchos servicios, la
 * lista completa de principales es lo que hace que el paso 1 se vea vacío.
 */
export function partitionBookingServices<
  T extends { id: string; isComplementary: number | null },
>(services: T[], preselectedId: string | null): { principal: T[]; complementary: T[] } {
  if (preselectedId) {
    return {
      principal: [],
      complementary: services.filter(
        (s) => s.isComplementary === 1 && s.id !== preselectedId
      ),
    };
  }
  return {
    principal: services.filter((s) => s.isComplementary !== 1),
    complementary: services.filter((s) => s.isComplementary === 1),
  };
}

/** Estado tras pulsar "Cambiar": la cita vuelve a no tener nada elegido. */
export function clearPreselected<T extends { id: string }>(
  selectedPrimary: T | null,
  selectedComplementaries: T[],
  preselectedId: string
): { primary: T | null; complementaries: T[] } {
  return {
    primary:
      selectedPrimary && selectedPrimary.id === preselectedId
        ? null
        : selectedPrimary,
    complementaries: selectedComplementaries.filter((s) => s.id !== preselectedId),
  };
}
```

- [ ] **Paso 4: correr los tests y verlos pasar**

```
npx vitest run src/lib/booking-combos.test.ts
```
Esperado: PASS (9 tests nuevos; el archivo tenía 18 previos y los 27 en verde).

- [ ] **Paso 5: estado `preselectedId` y quitar el salto al paso 2**

En `BookingWizard.tsx`, junto a los demás `useState` del componente:

```tsx
  // Con ?serviceId= el paso 1 sigue en pantalla: solo se ofrece lo que falta
  // (los complementarios) y "Cambiar" deshace la preselección.
  const [preselectedId, setPreselectedId] = useState<string | null>(null);
```

Reemplaza el cuerpo de `preselectedService` (líneas 77-95) por:

```tsx
  const preselectedService = useCallback(async () => {
    const serviceId = searchParams.get("serviceId");
    if (serviceId) {
      const res = await fetch(`/api/services?id=${serviceId}`);
      const data = await res.json();
      // Un complementario nunca puede ser el principal (lo rechaza la API), así
      // que uno preseleccionado se ofrece como "ya elegido" en vez de fallar al
      // confirmar. `data.id === serviceId` evita que un id inexistente contamine
      // el resumen con "undefined".
      const role = classifyBookingEntry(data, serviceId);
      if (role === "principal") setSelectedService(data);
      if (role === "complementary") {
        setComplementaryIds((prev) =>
          prev.includes(serviceId) ? prev : [...prev, serviceId]
        );
      }
      if (role !== "ignore") setPreselectedId(serviceId);
    }
    const referencePhotoUrl = searchParams.get("referencePhotoUrl");
    if (referencePhotoUrl) {
      setSelectedModels((prev) =>
        prev.includes(referencePhotoUrl) ? prev : [...prev, referencePhotoUrl]
      );
    }
  }, [searchParams]);
```

Quita el `setStep(2)` del `onClick` del principal (líneas 386-390): pulsar un principal ya no avanza, porque el paso 1 también sirve para cambiar de opinión.

```tsx
                    onClick={() => {
                      choosePrimary(s);
                    }}
```

- [ ] **Paso 6: catálogo particionado**

Sustituye las dos definiciones de las líneas 128-129 por:

```tsx
  const { principal: principalServices, complementary: complementaryServices } =
    partitionBookingServices(services, preselectedId);
```

- [ ] **Paso 7: escape hatch "Cambiar" en el resumen**

`clearPreselected` se usa desde un manejador. Añádelo junto a `toggleComplementary`:

```tsx
  function changePreselected() {
    if (!preselectedId) return;
    const next = clearPreselected(
      selectedService,
      selectedComplementaries,
      preselectedId
    );
    setSelectedService(next.primary);
    setComplementaryIds(next.complementaries.map((s) => s.id));
    setPreselectedId(null);
    // El slot se invalidaba al cambiar la combinación; aquí la combinación
    // vuelve a estar vacía, así que el slot ya no aplica.
    setSelectedSlot(null);
    if (selectedDate) void fetchSlots(selectedDate, []);
  }
```

Y en el bloque del resumen (líneas 457-487), añade el botón "Cambiar" en la línea del servicio preseleccionado. El resumen recorre `selectedService` y `selectedComplementaries`; el preseleccionado es el primero de los dos, así que basta con marcar el bloque del resumen y poner el botón en la fila cuyo `name` corresponde al preseleccionado:

```tsx
          {(selectedService || complementaryIds.length > 0) && (
            <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  Tu cita ({selectedCount}{" "}
                  {selectedCount === 1 ? "servicio" : "servicios"})
                </p>
                {preselectedId && (
                  <button
                    onClick={changePreselected}
                    className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cambiar
                  </button>
                )}
              </div>
              {/* ... el <ul> y el total de abajo quedan igual ... */}
            </div>
          )}
```

- [ ] **Paso 8: typecheck, lint y pruebas**

```
npx tsc --noEmit
npm run lint
npm test
```
Esperado: los tres en verde.

- [ ] **Paso 9: probar en el navegador**

```
npm run dev
```

Abre `/book` y comprueba los cuatro caminos: (a) `/book` sin query muestra los principales y los complementarios, y pulsar un principal **no** salta al paso 2; (b) `/book?serviceId=<COMPLEMENTARIO>` se queda en el paso 1, muestra "Tu cita (1 servicio)", "Continuar" habilitado y la lista de complementarios **sin** repetir el elegido; (c) `?serviceId=<PRINCIPAL>` igual, sin lista de principales; (d) pulsar "Cambiar" vuelve a mostrar el catálogo completo y vacía la cita. Al final, una cita que combina 1 principal + 2 complementarios debe confirmar bien contra `/api/appointments`.

- [ ] **Paso 10: commit**

```
git add src/lib/booking-combos.ts src/lib/booking-combos.test.ts src/components/BookingWizard.tsx
git commit -m "fix(booking): el paso 1 se ve siempre y acepta preselección de complementarios"
```

---

### Tarea 7: test de fuente que blinda el fan-out

**Archivos:**
- Crear: `src/lib/appointment-fanout.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: un test que falla si alguien reintroduce un `leftJoin` de compras en una consulta de citas.

- [ ] **Paso 1: escribir el test**

El bug del fan-out es silencioso: no rompe types ni tests, solo duplica filas en la UI. Un test de fuente es lo único que lo detecta aquí, porque el repo no tiene harness de BD para las rutas API. Es el mismo patrón que ya usa `src/lib/tracking-scope.test.ts` con `new URL(..., import.meta.url)`.

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Cargar compras de una cita con leftJoin multiplica la fila de la cita por
 * cada compra: una cita de 3 servicios salía 3 veces y en el portal
 * `key={appt.id}` se duplicaba. El patrón correcto es cargar las compras
 * aparte y fusionarlas con summarizePurchases, que ya distingue las compras
 * del grupo de las de otros alumnos en las sesiones de curso.
 *
 * No hay forma de testear esto en runtime sin montar la BD, así que se blinda
 * la fuente: si alguien reintroduce el JOIN, esto falla.
 */
const READERS: [string, string][] = [
  ["src/app/(client)/profile/page.tsx", "../app/(client)/profile/page.tsx"],
  ["src/app/api/appointments/route.ts", "../app/api/appointments/route.ts"],
  ["src/app/api/gallery/route.ts", "../app/api/gallery/route.ts"],
  ["src/app/api/production-photos/route.ts", "../app/api/production-photos/route.ts"],
  ["src/app/api/clients/[id]/route.ts", "../app/api/clients/[id]/route.ts"],
];

describe("citas + compras sin fan-out", () => {
  for (const [label, relative] of READERS) {
    it(`${label} no hace leftJoin a service_purchases`, () => {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      expect(source).not.toMatch(/leftJoin\(\s*schema\.servicePurchases/);
    });
  }
});
```

- [ ] **Paso 2: correr el test y confirmar que pasa**

```
npx vitest run src/lib/appointment-fanout.test.ts
```
Esperado: PASS (5 tests), porque la tarea 4 ya quitó el `leftJoin` del perfil.

- [ ] **Paso 3: comprobar que el test muerde de verdad**

Agrega temporalmente un `leftJoin(schema.servicePurchases, ...)` a `src/app/api/gallery/route.ts`, corre el test y confirma que **falla**; después revierte el cambio y vuelve a correrlo. Un test de fuente que no falla nunca no sirve.

- [ ] **Paso 4: suite completa**

```
npm test
npx tsc --noEmit
npm run lint
```
Esperado: los tres en verde.

- [ ] **Paso 5: commit**

```
git add src/lib/appointment-fanout.test.ts
git commit -m "test: blinda la fuente contra el fan-out de compras"
```

---

### Tarea 8: documentación

**Archivos:**
- Modificar: `agents.md`
- Modificar: `CHANGELOG.md`
- Modificar: `README.md`
- Modificar: `docs/superpowers/specs/2026-09-29-service-removal-and-booking-fixes-design.md` (el orden de guardas ya corregido; incluirlo en este commit)

**Interfaces:**
- Consume: todo lo implementado.
- Produce: nada ejecutable.

- [ ] **Paso 1: `agents.md`, API nueva**

En la sección de APIs nuevas, después de la viñeta de `GET/POST /api/course-sessions/[id]/enrollments`, añade:

```markdown
- `DELETE /api/appointments/[id]/services?purchaseId=` (admin con permiso `appointments` **o** la clienta propietaria): quita **un** servicio suelto de una cita sin cancelar la cita entera. **Borra la fila** de `service_purchases` en duro (igual que al desinscribir un alumno de curso), recalcula `appointments.end_time` y `appointments.service_id` con `remainingCombination(...)`, recomputa el estado financiero de la clienta **y** del admin, actualiza horario y título de los dos eventos de Google, y escribe `logActivity` (`entity: "purchases"`, `action: "delete"`). **Rechaza** con 400 si la cita está `completed`, si es una sesión de curso (sus alumnos se manejan en `/api/course-sessions/[id]/enrollments`) o si es la última compra de la cita, porque para eso está `DELETE /api/appointments/[id]`, que además archiva el snapshot. **No** llama `validateSlot`: quitar un servicio acorta el bloque y no puede crear un solape; `validateSlot` además rechazaría las citas que ya empezaron. Quitar el principal **se permite** y deja la cita en el estado "solo complementarios", que `/api/appointments` ya acepta.
```

- [ ] **Paso 2: `agents.md`, tipado de `summarizePurchases`**

En la sección de la tabla `service_purchases`, al final, añade:

```markdown
- `PurchaseSummaryRow` (`src/lib/appointment-purchases.ts`) exige `id` y `serviceDurationMins`: los 5 llamadores de `summarizePurchases` (`/api/appointments`, `/api/gallery`, `/api/production-photos`, `/api/clients/[id]` y el perfil del cliente) **deben** seleccionar esas columnas aunque no las leyan todavía. El fan-out de compras se resuelve **sin JOIN**: se cargan aparte y se fusionan en memoria con `summarizePurchases`, que además distingue el grupo de compras de la clienta del de los otros alumnos en una sesión de curso. Hay un test de fuente en `src/lib/appointment-fanout.test.ts` que falla si alguien reintroduce un `leftJoin(schema.servicePurchases)`.
```

- [ ] **Paso 3: `agents.md`, UI**

En la sección de componentes UI, amplía la viñeta de `BookingWizard` con:

```markdown
- BookingWizard: con `?serviceId=` el paso 1 **siempre** se ve, sin salto automático al paso 2. Si lo preseleccionado es un principal, no se ofrece la lista de principales (la cita ya lo tiene) y queda el botón "Cambiar" en el resumen; si es un complementario, se marca como elegido y se ofrece **solo** la lista de complementarios restantes. El reparto del catálogo y la decisión de qué hacer con el id pedido son funciones puras en `src/lib/booking-combos.ts` (`partitionBookingServices`, `classifyBookingEntry`, `clearPreselected`).
```

Y añade una viñeta nueva:

```markdown
- ProfileContent: "Mis próximas citas" pinta **una tarjeta por cita** con **una línea por servicio** (precio, duración y "Quitar" con confirmación en línea cuando hay más de uno). La miniatura de referencia, el estado y el botón "Cancelar cita" siguen a nivel de tarjeta porque pertenecen a la visita, no a un servicio.
```

- [ ] **Paso 4: `CHANGELOG.md`**

Añade una entrada al principio de la sección de versión más reciente, con el estilo de las entradas que ya están (un bloque `### Arreglado` y/o `### Nuevo`), con este texto:

```markdown
### Nuevo
- Se puede quitar un servicio suelto de una cita sin cancelar la visita: la clienta lo hace desde `/profile` ("Quitar" por servicio) y el admin desde el panel CRM. La compra se borra, el horario y el total se recalculan, y el estado de cuenta y Google Calendar quedan al día.
- Google Calendar: las actualizaciones de evento pueden cambiar también el título del evento, además del horario.

### Arreglado
- El paso 1 del wizard ya no se salta cuando se entra con `?serviceId=`. Un servicio preseleccionado deja ver el paso 1 y ofrece solo lo que falta; si es un complementario, ya no se ignora, y aparece un botón "Cambiar" para deshacer la elección.
- "Mis próximas citas" ya no muestra una tarjeta repetida por cada servicio de la misma cita (claves duplicadas de React en el portal del cliente).
```

- [ ] **Paso 5: `README.md`**

En la sección que describe las capacidades del portal del cliente, en la lista de lo que puede hacer una clienta, añade una línea con este texto:

```markdown
- Quitar un servicio que ya no quiere de una cita próxima, sin cancelarla entera.
```

- [ ] **Paso 6: commit**

```
git add agents.md CHANGELOG.md README.md "docs/superpowers/specs/2026-09-29-service-removal-and-booking-fixes-design.md"
git commit -m "docs: documentar el retiro de un servicio y los fixes de booking"
```

---

## Verificación final

Cuando las 8 tareas estén commiteadas:

```
npm test
npx tsc --noEmit
npm run lint
```

Los tres en verde, y con `npm run build && npm start` la app arranca. Un recorrido manual final, con `clienta@email.com` / `Cliente123!` y con el admin:

1. `/book?serviceId=<COMPLEMENTARIO>` muestra el paso 1 con el servicio marcado y los demás complementarios; "Cambiar" deshace.
2. `/book` sin query muestra ambos catálogos y no salta de paso al elegir.
3. `/profile` con una cita de 2 servicios: una tarjeta, dos líneas, "Quitar" quita una y la otra queda.
4. Misma cita en el CRM del admin: "Quitar" hace lo mismo y la agenda se refresca.
5. `/dashboard/activity` muestra la entrada de `purchases` / `delete` de la operación.
6. `curl` al endpoint sin sesión devuelve 401.

## Self-review del plan

**Cobertura del spec:** feature 1 (`items` + `remainingCombination` + los 5 callers) → tarea 1. Feature 2 (fin del fan-out + lista por servicio) → tarea 4, con el test de fuente en la tarea 7. Feature 3 (endpoint) → tarea 3, con la UI en las tareas 4 y 5. Feature 4 (wizard) → tarea 6. Las dos decisiones de riesgo (permitir quitar el principal, no llamar `validateSlot`) están explícitas en la restricción global y en la tarea 8.

**Inconsistencias corregidas durante la redacción:** (a) el spec definía `remainingCombination(purchases: PurchaseSummaryItemRow[])`, un tipo que no existe; la tarea 1 define `RemainingPurchase` y el spec ya lo dice. (b) El orden de guardas del endpoint en el spec ponía el "último servicio" antes del 404 de la compra; la tarea 3 valida la pertenencia de la compra primero, que es lo que dice el spec ya corregido. (c) El primer borrador de la tarea 3 traía comentarios en inglés y un `recomputeFinancialStatus(db, userId)` de más argumento; ambos corregidos, con un paso explícito para verificar las firmas reales.
