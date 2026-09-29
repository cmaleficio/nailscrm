# Plan: servicios principales + complementarios, y fix de fan-out

**Fecha:** 2026-09-28
**Specs:** `docs/superpowers/specs/2026-09-28-booking-combinations-design.md`,
`docs/superpowers/specs/2026-09-28-appointment-purchase-fanout-design.md`

Orden deliberado: primero los helpers puros con sus tests (todo lo demás depende de ellos), luego
schema, luego endpoints, luego UI, y al final el fix de fan-out que toca los reads. Cada paso es
verificable por separado.

## Paso 1 — `src/lib/booking-combos.ts` + test

Puro, sin BD. Es la única fuente de las reglas de combinación; `/api/slots` y
`POST /api/appointments` lo consumen ambos.

- `MAX_COMPLEMENTARY_SERVICES = 4`
- `parseComplementaryIds(input: string | string[] | null | undefined): string[]`
- `resolveBookingServices(services, principalId, complementaryIds): ComboResolution`
- `formatServiceNames(names: string[]): string`

`booking-combos.test.ts`: solo complementarios · principal + complementarios · sin principal
(`principalId = null`) · complemento no marcado como tal → error · servicio inexistente · inactivo ·
grupo **solo** → ok (se preserva el autoagendado público actual) · grupo + complementario → error ·
grupo como complementario → error · principal repetido en la lista de
complementarios → error · tope · dedupe · matemática de `totalDurationMins` y `totalPrice` ·
`anchorServiceId` con y sin principal.

## Paso 2 — `src/lib/appointment-purchases.ts` + test

Puro. `summarizePurchases(appointments, purchases)`. Ver el spec de fan-out para el algoritmo de
agrupación por `(appointmentId, userId)` y la selección del grupo de `appointments.client_id`.

`appointment-purchases.test.ts`: 1 compra · N compras del mismo cliente (multi-servicio: suma +
orden con `isPrimary` primero) · N compras de clientes distintos (curso: **no** infla el precio) ·
todas `isPrimary=0` → `isComplementaryOnly` · cita sin compras → fallback a `services.name` ·
orden determinista entre complementarios con el mismo `created_at`.

## Paso 3 — `src/lib/slots.ts`: `maxContiguousMins` + `slots.test.ts`

`maxContiguousMins(input)` reusa el predicado de solapamiento de `generateSlots`. No se toca
`generateSlots`.

`slots.test.ts` (hoy no existe — cierra el hueco de cobertura): grid de 15 min anclado a `openMin` ·
cota `m + duration <= closeMin` · slot con duración mayor que la ventana → array vacío · solapamiento
semiabierto (termina justo cuando empieza la otra = no solapa) · filtro de pasado · y
`maxContiguousMins` contra: día vacío, huecos ocupados por citas, por blockouts, y acotado por
`now` y por `closeMin`.

## Paso 4 — Migración `drizzle/0022_*.sql`

```sql
ALTER TABLE `services` ADD `is_complementary` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `service_purchases` ADD `is_primary` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `cancelled_appointments` ADD `service_items` text;
```

Actualizar `src/db/schema.ts` (`services`, `servicePurchases`, `cancelledAppointments`) y generar con
`npm run db:generate`, que produce `0022_*.sql`, `meta/0022_snapshot.json` y la entrada en
`_journal.json`. Si drizzle-kit propone un nombre, renombrarlo a algo descriptivo como
`0022_service-roles-and-purchase-items.sql` (hay precedente: `0005`, `0006`, `0018`, `0019`, `0020`).
Aplicar con `npm run db:migrate` y correr `npm run db:seed` para verificar los defaults.

## Paso 5 — `GET /api/slots`

- `serviceId` **opcional**; nuevo `addServiceIds`.
- Resolver con `resolveBookingServices` → 400 con `error` si no valida.
- `durationMins: totalDurationMins`, `serviceNames`, `hasAvailability: slots.some(s => s.available)`,
  `maxContiguousMins`.
- De paso quedan validados `is_active` y `is_group`, que hoy no lo están.

## Paso 6 — `POST /api/appointments`

- Aceptar `addServiceIds: string[]`; `serviceId` sigue siendo el principal (sigue siendo requerido
  **para el camino legacy de 1 servicio**; el caso solo-complementarios llega con `addServiceIds`
  únicamente, así que se vuelve a hacer opcional junto con la validación del helper).
- `endTime = startTime + totalDurationMins * 60`; `validateSlot`.
- `appointments.serviceId = anchorServiceId`.
- N compras en **un** `.values([...])` con `isPrimary` 1 solo para la principal.
- Calendar y `logActivity` con nombres unidos; metadata con `complementaryIds`, `serviceNames`,
  `totalPrice`.
- **Restricción dura: no introducir ningún `await` entre `validateSlot` y los inserts.** Hoy la
  seguridad contra carreras es accidental (better-sqlite3 síncrono + event loop de un hilo); un
  `await` en medio la rompe.

## Paso 7 — `GET /api/appointments` (fix de fan-out, bug de cursos incluido)

- Quitar el `leftJoin` de `baseQuery`, `dayQuery` y `pendingQuery`.
- Segunda query de compras con `innerJoin(appointments)` replicando el `where` de la variante
  (`ne(status,"cancelled")` + ventana de `dayQuery`; ventana de `pendingQuery` para esa variante).
- Fusionar con `summarizePurchases` antes de responder; añadir `isComplementaryOnly`.
- Conservar el `studentCount` de `enrollCounts` tal cual.

## Paso 8 — `PATCH` y `DELETE /api/appointments/[id]`

PATCH:
- preservar duración: `durationSec = (appointment.endTime ?? 0) - (appointment.startTime ?? 0)`, y
  `endTime = startTime + durationSec`;
- `validateSlot(startTime, endTime)` → 409;
- la actualización de Google Calendar usa el `endTime` ya calculado.

DELETE:
- compras con `.all()` en vez de `.get()`;
- `service_name` unido, `service_price` = suma, `service_items` = JSON `[{name, price, durationMins}]`;
- `logActivity` con nombres unidos.

## Paso 9 — `GET /api/purchases`, `POST /api/course-sessions`

- `?appointmentId=` devuelve **array** (con `?appointmentId` nulo sigue el resto de la ruta).
- `POST /api/course-sessions`: 400 explícito si llega `addServiceIds`.

## Paso 10 — Nombres unidos en captions (mecanismo B)

- `GET /api/production-photos`: subquery escalar `group_concat` sobre `SELECT DISTINCT` para
  `serviceName`; alimenta `buildProductionCaption` y el nombre de descarga del visor.
- `GET /api/clients/[id]`: idem para `photoGroups` y `passportGroups`.
- Ambos verificados en no cambiar el número de filas (contrastar el `count` devuelto).

## Paso 11 — `GET/POST/PATCH /api/services`

- `isComplementary` en el POST (`body.isComplementary ? 1 : 0`) y en el PATCH con el patrón de
  fallback de `[id]/route.ts:74-75`.
- 400 si llega `isComplementary` e `isGroup` a la vez.
- `GET` ya devuelve la fila completa, así que `isComplementary` llega al cliente sin cambios.

## Paso 12 — UI: `ServicesContent.tsx`

Los seis puntos de `isGroup` replicados (`type Service`, `type EditingState`, `EMPTY_FORM`, cuerpo
POST, cuerpo PATCH, `startEdit` con `=== 1`), checkbox en el formulario de alta y en la edición
inline, mutual exclusividad en el `onChange` de ambos, y badge "Complementario" en la lista junto al
badge Activo/Inactivo.

## Paso 13 — UI: `BookingWizard.tsx`

- Tipo `Service` ampliado con `isComplementary: number` e `isGroup: number`.
- Estado: `selectedService: Service | null` (principal, **opcional**) y
  `selectedComplementaries: Service[]` (multi).
- Paso 1 en una pantalla con las dos secciones; **quitar el auto-avance** de `:303`; pie fijo con
  totales y botón "Continuar" (habilitado con ≥1 servicio). Volver atrás desde el paso 2 conserva
  la selección.
- `fetchSlots` envía `addServiceIds`; guardar `hasAvailability` y `maxContiguousMins` del response.
- Paso 2: bifurcar el estado vacío de `:409` entre "día lleno" (lista de espera) y "no cabe"
  (`maxContiguousMins` vs total) con botón "Quitar un servicio" que quita el último seleccionado y
  vuelve al paso 1.
- Paso 3: lista por servicio con precio y duración, total, y **hora de finalización** calculada con
  la duración total.
- `handleConfirm` manda `addServiceIds`; el guard pasa a "≥1 servicio && selectedSlot".
- `preselectedService`: si el servicio por query param es complementario, seleccionar como
  complementario.

## Paso 14 — UI: `NewAppointmentDialog.tsx`

- Tipo `Service` con `isComplementary`; estado `complementaryIds: string[]`.
- Multi-selección bajo el `<select>`; `addServiceIds` en el fetch de slots y en el POST; `+` la
  key de complementarios en las deps del efecto; mensaje de "no cabe" con `maxContiguousMins`.
- El `<option>` del select marca visualmente los complementarios para que el admin sepa qué puede
  combinar.

## Paso 15 — Documentación obligatoria (mismo commit)

- `agents.md`: columna `is_complementary` en la tabla `services`; `is_primary` en
  `service_purchases`; `service_items` en `cancelled_appointments`; la regla "1 cita + N compras" y
  la del ancla; contrato `addServiceIds` de `/api/slots` y `POST /api/appointments`; el invariante
  anti-fan-out; la exclusión de cursos; y el `validateSlot` del reprogramar.
- `CHANGELOG.md`: entrada con el fix de las 5 tarjetas duplicadas por sesión de curso.
- `README.md`: sección de servicios principales/complementarios.

## Paso 16 — Verificación

- `npm test` (los tres archivos nuevos + los 10 existentes).
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm run db:generate` / `db:migrate` / `db:seed` en una base limpia: confirmar que las 3 columnas
  quedan con los defaults esperados y que el catálogo sigue intacto.
- Recorrido manual: (a) marcar un servicio como complementario en `/dashboard/services`; (b)
  reservar principal + 2 complementarios; (c) reservar solo complementarios; (d) intentar una
  combinación que no cabe y verificar que bloquea con el mensaje correcto y sin lista de espera;
  (e) completar y cobrar, y revisar saldo, muro y portal; (f) agenda con una sesión de curso de
  varios alumnos → **una** sola tarjeta; (g) reprogramar una cita de 3 servicios y verificar que
  conserva la duración y que un slot ocupado devuelve 409.
