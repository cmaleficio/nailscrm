# Quitar un servicio suelto de una cita + fixes del wizard y del portal de cliente

**Fecha:** 2026-09-29

Continuación de `2026-09-28-booking-combinations-design.md` y
`2026-09-28-appointment-purchase-fanout-design.md`, ambos implementados pero con tres defectos
reportados en producción.

## Contexto

La feature de servicios complementarios (1 cita + N compras) se implementó ayer. Tres cosas no
funcionan:

1. **El paso 1 del wizard muestra la lista de servicios principales cuando la clienta ya viene con
   uno elegido desde el home.** El catálogo de `/` lista *todos* los servicios activos, así que
   "Agendar" lleva a `/book?serviceId=X`; ahí el paso 1 vuelve a pedir que elija un servicio, aunque
   la lista ya se vio en el home. Y si lo que se eligió fue un **complementario**, el
   `?serviceId=` se **descarta en silencio** (`BookingWizard.tsx:84`): la clienta tiene que volver a
   buscar el servicio a mano, y una reserva solo-complementarios es imposible de hacer desde el home.
2. **El portal de cliente repite la misma cita una vez por servicio y React avisa de claves
   duplicadas** (`ProfileContent.tsx:186`, clave `appt.id`): `GET` de "próximas citas" hace
   `LEFT JOIN` a `service_purchases`, que es 1 : N, y selecciona `appointments.id` como clave.
3. **No se puede quitar un servicio suelto de una cita.** `DELETE /api/appointments/[id]` cancela la
   visita entera (por diseño) y `DELETE /api/purchases/[id]` solo borra compras **huérfanas**. Si una
   clienta se agendó `Acrílicas + Matiz + Diseño` y quiere quitarse el Diseño, no hay cómo: o cancela
   todo, o llama por WhatsApp y el salón edita la base a mano.

Los tres se arreglan juntos porque comparten el mismo eje: **`service_purchases` es 1 : N y cada
lectura y cada mutación tiene que hablar de "una cita con N servicios", no de "N citas"**.

## Causas raíz (confirmadas)

| # | Causa raíz | Ubicación |
|---|---|---|
| 1 | El paso 1 siempre pinta `principalServices`, sin importar si hay `?serviceId=`; y `preselectedService` descarta los complementarios (`data.isComplementary !== 1`) en vez de seleccionarlos. Además salta al paso 2, así que el paso 1 solo se ve al pulsar "Atrás". | `src/components/BookingWizard.tsx:77-95`, `:128-130`, `:377`, `:387-390` |
| 2 | `leftJoin(servicePurchases, appointmentId)` multiplica la fila de la cita por cada compra y `id` es `appointments.id`. El fan-out ya se corrigió en `completedAppointments` (`:57-104`) y **no** en `upcomingAppointments` (`:43-46`). | `src/app/(client)/profile/page.tsx:43-46` |
| 3 | No existe la operación. La cancelación es por cita; el borrado de compras solo acepta `appointment_id IS NULL`. | `src/app/api/appointments/[id]/route.ts:209`, `src/app/api/purchases/[id]/route.ts:126-131` |

Bonus detectado en la misma función que el bug 1: un `?serviceId=` inexistente hace
`setSelectedService({ error: "Not found" })` (no se valida `data.id`), dejando duraciones y precios
`undefined` → `NaN` en el total y un POST roto. Se corrige de paso.

## Decisiones

- **Sin cambios de esquema.** Todo sale de `service_purchases` + `appointments` como están. No hay
  migración.
- **Quitar = borrar duro la compra**, igual que `DELETE /api/course-sessions/[id]/enrollments`
  (`:78-80`) borra la compra del alumno dado de baja. `void` queda reservado para la cancelación
  de la cita entera, donde la fila de compra desaparece igual por `CASCADE` y el archivo vive en
  `cancelled_appointments`. Borrar duro y no dejar la compra en `void` es lo que hace que **todas**
  las lecturas existentes (agenda, CRM, CXC, portal) ven el conjunto nuevo sin tocar un solo filtro.
- **Se puede quitar cualquier servicio, principal incluido.** El diseño de combinaciones ya
  considera válida una cita "solo complementarios" (`0 principales + N complementarios`), así que
  quitar el principal deja una cita válida. No se reescribe `is_primary`: los que quedan en `0`
  hacen que la agenda muestre el badge "Solo complementarios", que es un estado ya diseñado.
- **No se llama a `validateSlot`.** Quitar un servicio **encoge** el bloque, así que no puede crear
  un solape. Y `validateSlot` rechaza con "No puedes reservar en el pasado" (`availability.ts:53`)
  justo las citas que ya empezaron, que hoy sí se pueden depurar. Encoger un bloque que ya era válido
  no necesita revalidarlo.
- **`end_time` se recalcula con los snapshots** (`service_purchases.service_duration_mins`), no con
  el catálogo: es lo que se reservó y lo que se cobró, igual que la compra es inmutable.
- **El ancla se recalcula siempre** (no solo cuando se quita el ancla): `appointments.service_id`
  pasa a ser el `service_id` de la primera compra restante en el orden canónico
  (`is_primary` primero, luego nombre). Esto además sana derivas previas. Si ninguna compra
  restante trae `service_id` (columna nullable), se conserva el ancla actual.
- **La clienta puede hacerlo sola**, igual que ya puede cancelar la cita entera
  (`appointments/[id]/route.ts:230-233`). Sin clave de permiso nueva: admin (cualquiera, como
  cancelar) o la dueña de la cita.
- **Los cursos quedan fuera**: en una sesión de curso cada compra es un alumno, y darlo de baja es
  otra operación con su propio endpoint y sus propias consecuencias. Una cita con
  `course_enrollments` se rechaza con un mensaje que apunta ahí.
- **Google Calendar actualiza también el título.** `updateEventOnPrimaryCalendar` (`calendar.ts:122`)
  solo manda `start`/`end`, así que sin tocarlo el evento de la clienta seguiría diciendo
  "Acrílicas + Matiz + Diseño" con el Matiz ya quitado. Se le agrega un `summary` **opcional** (el
  `PATCH` de Google solo reemplaza los campos enviados) y el endpoint lo pasa con los nombres
  nuevos. Reprogramar sigue sin mandar `summary`, igual que hoy.
- **El wizard no gana un test de DOM.** No hay `@testing-library/react` en el repo (el patrón jsdom
  es `createRoot` + `act`), y un test del wizard tendría que mockear `useSearchParams`, `useSession`
  y `fetch`. Las dos reglas que se rompen ("no mostrar principales si vienes con uno" y "no repetir
  el complementario elegido") se extraen a **funciones puras** en `src/lib/booking-combos.ts`, que es
  donde ya vive la lógica de combinaciones compartida entre `/api/slots` y `POST /api/appointments`.
- **Hueco de test reconocido:** el fan-out del portal vive en una query de página de servidor y el
  repo no tiene arnés de BD en tests. Se cubre con un test **de fuente** que falla si algún read de
  citas vuelve a hacer `leftJoin` a `service_purchases` (mismo precedente que
  `tracking-scope.test.ts`, que ata el matcher del proxy a su helper).

## Diseño

### Feature 1 — `summarizePurchases` expone los ítems de la cita

`src/lib/appointment-purchases.ts`:

- `PurchaseSummaryRow` gana **`id: string`** y **`serviceDurationMins: number`** (ambos
  `notNull` en el esquema, así que no hay `| null`). Son campos requeridos a propósito: los 5
  llamadores (`profile/page.tsx`, `api/appointments`, `api/gallery`, `api/production-photos`,
  `api/clients/[id]`) quedan obligados por TypeScript a seleccionar las mismas columnas, y
  `items` nunca puede salir incompleto.
- `PurchaseSummary` gana **`items: PurchaseSummaryItem[]`**:
  `{ id, name, price, durationMins, isPrimary }`, en el mismo orden canónico que `serviceNames`
  (principal primero, resto por nombre). Es el subconjunto que `pickGroup` decidió que representa la
  cita, así que arrastra gratis la distinción curso / multi-servicio.
- La rama de cita **sin compras** devuelve `items: []` y conserva `serviceName` del catálogo.
- Se extrae el comparador a `comparePurchaseRows` para que el orden no se defina dos veces.

Nuevo helper puro, en el mismo archivo:

```ts
// Entrada: una compra de service_purchases (PurchaseSummaryRow más serviceId,
// que es nullable en el esquema). No reutiliza PurchaseSummaryRow a propósito:
// los 5 llamadores de summarizePurchases no necesitan service_id, y obligarles
// a seleccionar una columna que no usan sería ruido en 5 queries.
export type RemainingPurchase = {
  id: string;
  serviceId: string | null;
  serviceName: string;
  servicePrice: number;
  serviceDurationMins: number;
  isPrimary: number | null;
};

export function remainingCombination(purchases: RemainingPurchase[]): {
  items: PurchaseSummaryItem[];   // ordenados
  names: string[];                // para el título del evento y el log
  totalDurationMins: number;
  totalPrice: number;
  anchorServiceId: string | null; // null si ninguna compra trae service_id
}
```

Ordena con el mismo comparador, suma duraciones y precios, y devuelve el ancla como el
`serviceId` del primero con `serviceId` no nulo. Con `[]` devuelve ceros y `anchorServiceId: null`.
Es pura, sin BD, y es donde vive la regla de "el primero manda".

### Feature 2 — Portal de cliente: una fila por cita

`src/app/(client)/profile/page.tsx`:

- `upcomingAppointments` (`:29-55`) pierde el `leftJoin` a `service_purchases`; el nombre del
  ancla se resuelve con `coalesce(services.name)` sin purchase y las compras llegan en una **segunda
  query** filtrada por `inArray(appointmentId, ids)`, fusionadas con `summarizePurchases`. Es
  literalmente el patrón que el archivo ya aplica 30 líneas más abajo para las completadas
  (`:84-104`); se unifican en un helper local `purchaseRowsFor(ids)` para no duplicar la query.
- Cada fila pasa a llevar `serviceNames: string[]` e `items`, además de `serviceName` (unido) para
  el `title` de `ReportPaymentDialog` y las fotos de referencia.
- `ProfileContent` recibe `items: AppointmentServiceItem[]` y pinta **una línea por servicio** dentro
  de la tarjeta de "Mis próximas citas", cada una con su precio, su duración y su "Quitar" (solo si
  `items.length > 1`). Todo lo demás —miniatura de referencia, fecha, badge de estado y el "Cancelar"
  de la visita— **sigue a nivel de tarjeta**, porque pertenece a la cita y no a un servicio. Se queda
  **una** tarjeta por cita → se van las claves duplicadas y "Cancelar" vuelve a cancelar la visita
  entera, que es lo que el botón dice.

### Feature 3 — `DELETE /api/appointments/[id]/services?purchaseId=`

`src/app/api/appointments/[id]/services/route.ts`. Espejo de
`DELETE /api/course-sessions/[id]/enrollments?clientId=` (mismo verbo, misma forma, mismo dominio).

Guardas, en orden (la primera que falla corta):

| # | Condición | Respuesta |
|---|---|---|
| 1 | sin sesión | 401 `No autorizado` |
| 2 | la cita no existe | 404 |
| 3 | no es admin y no es la dueña | 403 `No autorizado` |
| 4 | `status === "completed"` | 400 `No se puede quitar un servicio de una cita completada` |
| 5 | la cita tiene ≤ 1 compra | 400 `La cita debe tener al menos un servicio. Para eliminarla del todo, cancela la cita.` |
| 6 | la compra no existe o no es de esa cita | 404 `Ese servicio no pertenece a la cita` |
| 7 | la cita tiene `course_enrollments` | 400 `Los alumnos de una sesión de curso se gestionan desde la sesión` |

Efectos, en **una transacción**:

1. `DELETE FROM service_purchases WHERE id = ?` (borrado duro).
2. Recalcular con `remainingCombination` sobre las compras restantes: `appointments.end_time =
   start_time + totalDurationMins * 60` y `appointments.service_id = anchorServiceId` si no es
   `null`.
3. `recomputeFinancialStatus(userId)` para el `user_id` de la compra quitada y para
   `appointments.client_id` (en el multi-servicio son el mismo; se hace el `Set` de los dos por
   si acaso). Sale de la transacción: es best-effort y escribe en otras tablas.

Después: `logActivity({ entity: "purchases", action: "delete", label: \`Servicio quitado de la cita:
${clientName} – ${serviceName}\`, metadata: { appointmentId, purchaseId, newEndTime, newTotalDurationMins, newServiceName } })`.
No hace falta una acción nueva en `AUDIT_ACTIONS`: `delete` sobre `purchases` es exactamente lo que
ya registra `DELETE /api/purchases/[id]`.

Si `GOOGLE_CALENDAR_ENABLED === "true"`, `updateAppointmentEvent` para los eventos de clienta y admin
con el `end_time` nuevo **y** el `summary` con los nombres restantes. `updateAppointmentEvent` y
`updateEventOnPrimaryCalendar` ganan un `summary?: string` opcional; el body solo lo incluye cuando
viene, de modo que el llamador de reprogramar no cambia de comportamiento.

Respuesta `200 { success, appointmentId, serviceId, endTime, serviceName, totalDurationMins }`
—la UI la usa para el `router.refresh()` y para mostrar el nuevo total.

### Feature 4 — UI para quitar un servicio

**Portal de la clienta** (`ProfileContent.tsx`): estado `removingPurchaseId` con la misma
confirmación en línea que ya usa el "Cancelar" (`confirmingId`): "Quitar" → "¿Quitar *Diseño* de tu
cita? Se recalculará el total y la duración." → "Sí, quitar" / "No". Un solo `removingId` a la vez,
mensaje de error en el `cancelError` que ya existe, y `router.refresh()` al terminar. Con 1 solo
servicio no se muestra el botón (la API lo rechaza, pero la UI ni lo ofrece).

**CRM del admin** (`ClientCRMPanel.tsx`): botón "Quitar" en cada fila de la lista "Servicios
adquiridos" (`:541-562`), con `ConfirmDialog` (el componente ya está importado en el archivo para
el borrado de cliente) y refresco con el `fetch` de `/api/purchases?appointmentId=` que ya existe
(`applyPurchases`). Dos props nuevas:

- `appointmentStatus?: string` — `DashboardContent` lo pasa desde `selectedAppointment.status`; si
  es `completed` el botón no se pinta. Sin él, el admin vería un botón que siempre falla.
- `onChanged?: () => void` — `DashboardContent` lo pasa como `refreshAll()`, porque quitar un
  servicio cambia la duración de la cita y la tarjeta de la agenda tiene que redibujarse.

`ClientsContent` abre el panel sin `appointmentId` (el bloque de servicios ni se monta), así que no
necesita cambios.

### Feature 5 — Paso 1 del wizard

`src/lib/booking-combos.ts` (puro, testeado):

```ts
export function classifyBookingEntry(service): "principal" | "complementary" | "ignore"
```

Un `?serviceId=` que apunta a un complementario se clasifica como `complementary`; cualquier otro
servicio existente, `principal`; inexistente o inactivo, `ignore`. Esto implementa lo que el spec de
combinaciones ya pedía (`:239-241`) y que el código hizo al revés.

```ts
export function partitionBookingServices(services, preselectedId: string | null): {
  principal: Service[];      // [] si preselectedId !== null
  complementary: Service[];  // sin el preselectedId
}
```

Las dos reglas del bug 1 en una función: con `preselectedId`, `principal` va vacío (los principales
ya se eligieron en el home) y el complementario elegido desaparece de la lista porque ya está en el
resumen.

`BookingWizard.tsx`:

- Nuevo estado `preselectedId: string | null` (y no se re-deriva de `selectedService`: si no, quitar
  el servicio en el resumen escondería la lista para siempre).
- `preselectedService` deja de hacer `setStep(2)` y valida `data.id === serviceId`; con
  `classifyBookingEntry` pone el principal o agrega a `complementaryIds`. `MAX_COMPLEMENTARY_SERVICES`
  no corre riesgo aquí: es el primer y único elemento.
- `principalServices` / `complementaryServices` salen de `partitionBookingServices`.
- **Escape hatch**: en el panel "Tu cita", el servicio venido del home lleva un "Cambiar" que limpia
  `preselectedId` + la selección y devuelve el paso 1 completo. Sin esto, un clic equivocado en el
  home era un callejón sin salida: no había forma de deshacer la elección.
- **Se quita el salto al paso 2 al hacer clic en un principal** (`:387-390`). Es lo que ya pedía el
  spec de combinaciones (`:232-233`) y es lo mismo que el bug 1: con salto automático, la clienta que
  entra sin `?serviceId=` nunca ve la sección de complementarios. Se queda en el paso 1, con el
  principal resaltado (el estilo `chosen` ya existe) y el "Continuar" de abajo.
- Sin cambios en los pasos 2 y 3, ni en `primaryService` (el ancla con solo complementarios), ni en
  `toggleComplementary` / `choosePrimary` / `fetchSlots`.

## Migración de datos

Ninguna. No hay columnas nuevas.

## Tests

`src/lib/appointment-purchases.test.ts` (puro, sin BD):

- `summarizePurchases` devuelve `items` con los ids, en orden principal-primero, y solo del grupo
  del cliente (el caso-escuela del curso: 5 alumnos → `items` de 1, no 5).
- Cita sin compras → `items: []` y `serviceName` del catálogo.
- `remainingCombination`: suma de duraciones y precios; el ancla es el `is_primary`; con dos
  complementarios el ancla es el primero por nombre; una compra con `serviceId: null` no rompe el
  ancla (usa la siguiente con `service_id`); `[]` → ceros y `anchorServiceId: null`.

`src/lib/booking-combos.test.ts`:

- `classifyBookingEntry`: complementario → `complementary`, normal → `principal`, curso →
  `principal` (un curso **sí** se puede agendar solo, `appointments` no autoinscribe), `null` /
  error / id que no coincide → `ignore`.
- `partitionBookingServices`: con `preselectedId` de un principal → `principal` vacío y el
  complementario elegido fuera de `complementary`; sin `preselectedId` → las dos listas completas.

`src/lib/appointment-fanout.test.ts` (nuevo, test de fuente): lee los archivos que leen citas
(`src/app/(client)/profile/page.tsx`, `src/app/api/appointments/route.ts`,
`src/app/api/gallery/route.ts`, `src/app/api/production-photos/route.ts`,
`src/app/api/clients/[id]/route.ts`) y falla si alguno hace `leftJoin(schema.servicePurchases` /
`leftJoin(schema.servicePurchases`. Es el invariante de una fila por cita, convertido en test.

Verificación manual (no automatizable hoy): `/book?serviceId=<principal>`, `/book?serviceId=<complementario>`,
`/book` a secas, y quitar un servicio desde el perfil y desde el CRM viendo que la agenda, la CXC y
el evento de Google quedan coherentes.

## Fuera de alcance

- **Añadir** un servicio a una cita ya creada (solo quitar). Es la operación inversa, con su propio
  conjunto de reglas de disponibilidad.
- **Reagendar** una cita combinando quitar y añadir en la misma pantalla.
- `NewAppointmentDialog` (agenda del admin) no cambia: ya separa principal (`<select>`) de
  complementarios.
- Test de DOM del wizard (requiere `@testing-library/react` o mockear tres módulos de Next).
- Arnés de tests contra SQLite.

## Documentación (mismo commit)

- `AGENTS.md`: el endpoint nuevo y su guarda; la lista de "Guardas auditadas por endpoint"; el
  comportamiento del paso 1 con y sin `?serviceId=`; la regla de "quitar un servicio = borrar la
  compra + recalcular `end_time`/ancla + evento de Google"; el invariante de fan-out y el test que
  lo ata; `summary` opcional en `updateAppointmentEvent`.
- `CHANGELOG.md` y `README.md`: entrada de la versión.
