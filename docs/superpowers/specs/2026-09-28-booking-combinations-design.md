# Servicios principales y complementarios en una misma cita

**Fecha:** 2026-09-28

## Contexto

Hoy el salón solo puede agendar **un servicio por cita**. `appointments.service_id` es un único
`NOT NULL`, `end_time` siempre se deriva de un solo `duration_mins`, y la agenda trata el salón
como un recurso de un solo hilo donde dos citas nunca pueden solaparse. Eso obliga a que, si una
clienta quiere unas acrílicas con un matiz y un diseño de temporada,/agende tres citas distintas
(mal) o que la manicurista improvise sin que el sistema lo registre.

Se necesita que el modelo de servicios tenga un **rol** configurable por servicio —principal o
complementario— y que una cita pueda llevar **varios servicios de una vez**, tomando el tiempo de
agenda igual a la **suma de sus duraciones** y cobrándolos como ítems separados en la CXC.

La unidad de negocio sigue siendo **una visita**: la clienta reserva, llega, se le hace todo en un
bloque corrido, y la admin marca la visita como completada una sola vez.

## Decisiones tomadas

- **1 cita + N compras.** Una fila en `appointments` con `end_time = start + Σ duraciones`, y N filas
  en `service_purchases`. El esquema **ya lo permite** (las sesiones de curso grupal escriben N
  compras sobre 1 cita; `service_purchases.appointment_id` nunca tuvo unique). No se crea ninguna
  tabla nueva.
- **Clasificación = solo el rol por servicio.** Un flag `is_complementary` (0/1) editable en
  `/dashboard/services`. Se descartó una matriz de compatibilidad principal→complementario: el
  salón vende catálogo abierto y la matriz solo añadiría configuración que mantener.
- **El servicio principal es OPCIONAL.** Se pueden apilar varios complementarios sin ninguna
  principal (`0` principales + N complementarios es una reserva válida). El principal sigue siendo
  lo habitual, pero no es un requisito.
- **El ancla.** `appointments.service_id` sigue siendo `NOT NULL` y se sigue usando en ~6
  `innerJoin` (`GET /api/appointments`, portal del cliente, producción, archivo de canceladas,
  guarda de borrado de servicio, reseñas). **No se vuelve nullable**: SQLite obligaría a recrear
  la tabla y, peor, un `innerJoin` sobre una columna nullable **sacaría la cita de la agenda**
  silenciosamente. Cuando no hay principal, `service_id` guarda el **primer complementario** como
  ancla. El rol real de cada servicio lo dan las compras vía `is_primary`.
- **Sumar duraciones, sin pausa entre servicios.** `end_time = start + Σ duraciones`. Coherente con
  el diseño actual (no hay buffer entre citas) y con el grid de 15 min, que ya admite bloques de
  180–200+ min.
- **Horario corrido con bloqueo duro.** La combinación se agenda **siempre en un bloque contiguo**.
  Si no cabe, no se permite agendar hasta que se quiten servicios de la lista.
- **Tope de 4 complementarios** por cita (`MAX_COMPLEMENTARY_SERVICES`), para acotar el peor caso
  de duración y el ruido en la agenda.
- **Los cursos grupales no se combinan, pero no se rompen.** Lo que se prohíbe es la
  *combinación*: un `is_group=1` no puede llevar complementarios ni ser complementario, y
  `POST /api/course-sessions` rechaza `addServiceIds` con 400. Un curso **solo** sí se puede
  agendar por `/book`, igual que antes de esta feature.
  > **Corrección respecto a la primera redacción del spec.** La versión anterior decía que un
  > `is_group=1` no podía ser principal. Al implementarlo se comprobó que
  > `POST /api/appointments` **nunca** autoinscribe alumnos: hoy un cliente que entra a `/book`
  > puede autoagendar un curso y lo que obtiene es una cita normal (1 `appointments` + 1
  > `service_purchases`, sin `course_enrollments`); las sesiones de grupo de verdad son las de
  > `/api/course-sessions`, que sí crean una compra por alumno. Prohibir el curso como principal
  > habría roto a mano un flujo público que ya existe, así que la regla final es "solo sí,
  > combinado no". La UI tampoco ofrece un curso como complementario porque la flag `is_group`
  > es excluyente con `is_complementary`.
- **Fuera de alcance:** "Servicio realizado" (`POST /api/purchases` con `appointmentId` null) sigue
  registrando una sola compra huérfana.

## Diseño

### Feature 1 — Rol del servicio

Nueva columna en `services`:
- `is_complementary` (integer, default 0) — 1 = es un extra que se puede apilar junto a (o en lugar
  de) un servicio principal. Default 0 deja **todos los servicios existentes como principales**, sin
  backfill.

Se edita en `/dashboard/services` en los mismos seis puntos que `is_group` (tipo `Service`, tipo
`EditingState`, `EMPTY_FORM`, cuerpo del POST, cuerpo del PATCH, `startEdit`), en el formulario de
alta **y** en la edición inline, más un badge "Complementario" en la lista (a diferencia de
`is_group`, que no tiene badge: aquí el rol cambia lo que la clienta ve en el wizard, así que el
admin necesita verlo de un vistazo).

**Mutua exclusividad:** un servicio no puede ser grupo y complementario a la vez. Se fuerza en la
UI (marcar uno desmarca el otro) **y** en la API (400 si llegan ambos), porque la UI no es la única
que escribe.

### Feature 2 — Combinación de servicios (helper puro)

`src/lib/booking-combos.ts`, funciones puras sin acceso a BD, para que `/api/slots` y
`POST /api/appointments` apliquen **exactamente las mismas reglas** (si divergieran, el read
mostraría un horario que el write rechazaría):

- `parseComplementaryIds(raw)` — separa por coma, recorta, deduplica y corta al tope. Acepta el
  string de query (`?addServiceIds=a,b`) y el array del body de la misma forma.
- `resolveBookingServices(services, principalId | null, complementaryIds)` → 
  `{ services, principal, complementaries, totalDurationMins, totalPrice, anchorServiceId, error }`
  Reglas, en orden:
  1. al menos un servicio en total, si no `error: "Elige al menos un servicio"`;
  2. principal, si viene: existe, `is_active=1`, `is_complementary=0`, `is_group=0`;
  3. cada complementario: existe, `is_active=1`, `is_complementary=1`, `is_group=0`;
  4. no repetir el id del principal en la lista de complementarios;
  5. `complementaryIds.length <= MAX_COMPLEMENTARY_SERVICES`.
  `anchorServiceId` = el principal si existe, y si no el primer complementario.
- `formatServiceNames(names)` → `"Acrílicas Full + Matiz + Diseño"`.

La duración y el precio **nunca** se aceptan del cliente: se recomputan desde las filas de
`services`. Es la misma defensa que ya hace el write actual con `endTime`.

### Feature 3 — Horario corrido y bloqueo duro

La contigüidad ya está garantizada en las dos puntas por el predicado semiabierto
`slotStart < a.endTime && slotEnd > a.startTime`, evaluado contra el rango **completo**
`[start, start + total)`:

- `generateSlots` (`src/lib/slots.ts:31-36`) decide slot por slot.
- `validateSlot` (`src/lib/availability.ts:48-70`) decide en el write path, con query sin ventana de
  día (también cubre el cruce medianoche, mejor que el read).

Lo que falta es el **contrato de UX**: hoy `BookingWizard.tsx:409` trata igual "el día está lleno" y
"tu combinación no cabe", y en ambos casos ofrece la lista de espera. Se necesita distinguirlo.

`GET /api/slots` pasa a devolver, además de lo actual:
- `durationMins` — el **total** de la combinación, no el de un servicio.
- `serviceNames` — nombres unidos, para que el wizard pueda mostrarlos sin otro fetch.
- `hasAvailability` — `slots.some(s => s.available)`. No es lógica nueva: es exactamente lo que la
  UI ya calcula en el cliente hoy, movido al servidor para que `/api/appointments` y el wizard no
  puedan discrepar.
- `maxContiguousMins` — el bloque libre más largo del día, con `src/lib/slots.ts:new
  maxContiguousMins()`. Reusa el **mismo predicado de solapamiento** de `generateSlots` (walk de 15
  en 15 sobre cada inicio candidato, acotado por `closeMin` y por `now`), así que por construcción
  es la máxima duración que el grid reportaría como disponible. No puede divergir.

Con esos dos datos, el paso 2 del wizard bifurca su estado vacío:
- `maxContiguousMins < shortestServiceDuration` → el día **está lleno** → lista de espera, como hoy.
- `maxContiguousMins >= shortestServiceDuration` pero `!hasAvailability` → la **combinación no
  cabe** → mensaje "Esta combinación son X min y el mayor bloque libre es de Y min. Quita un
  servicio", con botón que quita el último seleccionado y regresa al paso 1. Sin lista de espera y
  sin poder avanzar al paso 3.

`serviceId` pasa a ser **opcional** también en `/api/slots` (para poder consultar slots de una
reserva solo-complementarios) y en `POST /api/appointments`.

De paso, resolver la combinación con el helper **cierra dos huecos actuales** de `/api/slots` y
`POST /api/appointments`: ninguno validaba `services.is_active` (un servicio desactivado era
agendable) ni `is_group`.

### Feature 4 — N compras sobre una cita

`POST /api/appointments`:
- resuelve la combinación, `endTime = startTime + totalDurationMins * 60`, `validateSlot`;
- inserta **una** `appointments` con `serviceId = anchorServiceId`;
- inserta las N compras en **un solo** `.values([...])`: la principal con `is_primary=1`, las
  complementarias con `is_primary=0`, todas con el snapshot inmutable de siempre (nombre,
  descripción, precio, duración) y `financial_status='pending'`.
- título de Google Calendar y `logActivity` con los nombres unidos.

`is_primary` nuevo en `service_purchases` (integer, default 1) sirve para tres cosas: orden
determinista (las compras de una cita comparten `created_at`, así que sin él el orden de los
complementarios no está definido), marcar visualmente la principal, y derivar
`isComplementaryOnly` (todas con `is_primary=0`). Default 1 deja correctas las filas existentes.

Lo que **ya funciona sin cambios** porque cuelga de `appointment_id` o de `user_id`:
completar (`:103-115` ya fecha `completion_date` en todas las compras de la cita y suma
`totalVisits +1` una vez), fotos, reseñas, uso de inventario y kardex, lista de espera, CXC, P&L,
`recomputeFinancialStatus`.

### Feature 5 — Fan-out de compras (arreglo de bug preexistente)

El `LEFT JOIN` a `service_purchases` en `GET /api/appointments` produce **una fila por compra**, lo
que rompe dos cosas: las citas de varios servicios saldrían repetidas, y —bug que ya existe hoy— una
sesión de curso de 5 alumnos renderiza 5 tarjetas duplicadas en la agenda.

Se resuelve quitando el `LEFT JOIN` y trayendo las compras en una **segunda query** que hace join a
`appointments` con los mismos filtros, fusionando en JS. El detalle que evita que el precio de un
curso se infle a `precio × 5` es elegir el grupo de compras cuyo `user_id` coincide con
`appointments.client_id` (en un curso, `client_id` es el primer alumno inscrito, cuyo grupo tiene 1
compra).

**Detalle aparte, en un spec dedicado:** `docs/superpowers/specs/2026-09-28-appointment-purchase-fanout-design.md`.

### Feature 6 — Cancelación y archivo

`DELETE /api/appointments/[id]` pasa de `.get()` a `.all()` sobre las compras. `cancelled_appointments`
tiene `service_name` (text, not null) y `service_price` (real) de un solo valor, así que:
- `service_name` = nombres unidos (`"Acrílicas Full + Matiz"`), que es lo que se muestra en la
  pestaña "Canceladas";
- `service_price` = **suma** (es el número que importa para cualquier lectura agregada);
- `service_items` (**columna nueva**, text) = JSON `[{ name, price, durationMins }]`, que preserva el
  detalle por ítem. Es el mismo patrón que ya usa `reference_photo_urls`; las filas viejas tienen
  `service_items = null` y se leen igual (fallback al nombre único).

El `void` masivo (`UPDATE ... WHERE appointment_id = ?`) y el `recomputeFinancialStatus` por cliente
ya cubren N sin cambios.

### Feature 7 — Reprogramar citas

`PATCH /api/appointments/[id]` con `{ startTime }` tiene dos defectos que esta feature convierte en
daño real:

1. `endTime` se recalcula desde `services.durationMins` del **servicio ancla**
   (`[id]/route.ts:64-65`). Una cita de `Acrílicas 120 + Matiz 60 + Diseño 30` (210 min)
   reprogramada se encoge sola a 120 min y **se solapa con la cita que estaba detrás**. Doble reserva
   silenciosa. → Se pasa a preservar la duración existente: `endTime - startTime`.
2. **No llama a `validateSlot`.** No comprueba pasado, horario de trabajo ni solapamiento. La UI lo
   disimula porque `ReschedulePicker` pide slots a `/api/slots`, pero el endpoint acepta cualquier
   timestamp. Con bloques más largos el riesgo de solape sube. → Se añade `validateSlot` con 409.

Las citas de curso no se tocan: no pueden llevar complementarios, así que conservan su duración
de una sola compra.

### Feature 8 — APIs

- `GET /api/slots` — `serviceId` opcional, nuevo `addServiceIds`, devuelve `durationMins` total,
  `serviceNames`, `hasAvailability`, `maxContiguousMins`. 400 con el error del helper.
- `POST /api/appointments` — acepta `addServiceIds: string[]`; `serviceId` sigue siendo el
  principal. N compras en un insert.
- `GET /api/appointments` — sin `LEFT JOIN`; segunda query + fusión.
- `DELETE /api/appointments/[id]` — `.all()`, nombres unidos, suma y `service_items`.
- `PATCH /api/appointments/[id]` — preserva duración + `validateSlot`.
- `GET /api/purchases?appointmentId=` — devuelve **array** (hoy `.get()` devuelve una compra
  arbitraria de las N).
- `POST /api/course-sessions` — 400 explícito si llega `addServiceIds`.
- `GET/POST/PATCH /api/services` — `isComplementary` con la coerción de `[id]/route.ts:74-75`; 400 si
  llega junto con `isGroup`.
- `GET /api/production-photos` y `GET /api/clients/[id]` — leen solo `services.name` (sin fan-out),
  pero mostrarían solo el ancla. Pasan a un **subquery escalar** `group_concat` sobre un
  `SELECT DISTINCT`, mecanismo distinto al de la agenda a propósito: aquí solo importa el nombre y
  el `DISTINCT` interno evita repetir el nombre del curso 5 veces. Cero filas extra.

### Feature 9 — UI (mobile-first, paleta rosa)

**`/dashboard/services`** — checkbox "Es complementario" junto al de "Es curso/grupo" en el alta y
en la edición inline, con mutual exclusividad, y badge "Complementario" en la lista.

**`/book` (wizard)** — el paso 1 se reestructura en una sola pantalla con dos secciones:
- "Servicio principal (opcional)": single-select de los servicios no complementarios.
- "Servicios complementarios": multi-select de chips `Matiz · +$5 · +15 min`, siempre visible.

Se elimina el auto-avance al paso 2 (hoy `:303` salta al hacer clic) porque con multi-selección no
hay una elección única que justifique saltar: ahora hay un pie fijo con la duración y el precio
totales y un botón "Continuar" habilitado con ≥1 servicio seleccionado. El paso 2 pide slots con
`addServiceIds`, y el total se recalcula al vuelo. El paso 3 lista cada servicio con su precio y
duración, el total, y **la hora de finalización** (hoy no se muestra, y con bloques de 2–3 h se
vuelve confuso).

`preselectedService` (`:72-88`): si el `?serviceId=` de entrada apunta a un servicio complementario,
se selecciona como complementario y salta al paso 2 (una reserva solo-complementarios), en vez de
como principal.

**`/dashboard` → "Nueva cita"** — mismo panel de multi-selección bajo el `<select>` de servicio,
`addServiceIds` en el fetch de slots y en el POST, `addServiceIdsKey` en las deps del efecto para
limpiar el slot elegido, y el mismo mensaje de "no cabe" con `maxContiguousMins`.

**Sin cambios:** `AppointmentCard`, `CompleteAppointmentDialog`, `CompletedAppointmentDialog`,
`ClientCRMPanel`, balances y P&L. Reciben `serviceName` ya unido y `servicePrice` ya como total, así
que no necesitan enterarse de nada. El badge "Solo complementarios" sale de `isComplementaryOnly` en
la agenda.

## Migración de datos

Tres columnas, todas con default que deja correctas las filas existentes:

```sql
ALTER TABLE services ADD is_complementary integer DEFAULT 0 NOT NULL;
ALTER TABLE service_purchases ADD is_primary integer DEFAULT 1 NOT NULL;
ALTER TABLE cancelled_appointments ADD service_items text;
```

- `is_complementary = 0` → todo el catálogo existente sigue siendo principal, sin backfill.
- `is_primary = 1` → las compras existentes se consideran principales, que es exactamente lo que son.
- `service_items = null` → el archivo de canceladas viejo se lee igual.

A partir de ahí, marcar un servicio como complementario en `/dashboard/services` es toda la
configuración que hace falta.

## Fuera del alcance

- Matriz de compatibilidad principal → complementario (se evaluó y se descartó; ver "Decisiones").
- "Servicio realizado" (`AddServiceDialog`) con complementarios.
- Cualquier cambio en el modelo de cursos, incluido el auto-registro público de un curso por `/book`
  (que hoy es posible).
- Intervalos de limpieza entre servicios dentro de la misma cita (se evaluó `+5 min`; se descartó
  por inconsistir con el grid de 15 min y con el diseño sin buffer).
- Descuento por paquete (el total es siempre la suma de precios).
