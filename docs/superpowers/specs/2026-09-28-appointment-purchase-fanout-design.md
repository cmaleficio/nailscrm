# Fix del fan-out de `service_purchases` en la lectura de citas

**Fecha:** 2026-09-28

## Contexto

Al agregar servicios complementarios a una cita (ver
`docs/superpowers/specs/2026-09-28-booking-combinations-design.md`) aparece con fuerza un defecto que
ya existía en el código: **`GET /api/appointments` devuelve una fila por fila de
`service_purchases`**, no una fila por cita.

Esto no es un detalle cosmético. Es la razón por la que la agenda renderiza **tarjetas duplicadas**
y por la que hay que arreglarlo antes de poder cobrar bien una cita de varios servicios.

## El defecto

`GET /api/appointments` (las tres variantes: `baseQuery`, `dayQuery`, `pendingQuery`) hace:

```ts
.from(schema.appointments)
.innerJoin(schema.users, ...)
.innerJoin(schema.services, ...)
.leftJoin(
  schema.servicePurchases,
  eq(schema.servicePurchases.appointmentId, schema.appointments.id)
)
```

El objetivo del `leftJoin` es simple: obtener el `service_name` y el `service_price` que la agenda
muestra. Pero `service_purchases` es una relación **1 : N** con `appointments`, así que el join se
combina con el resto y **duplica la fila de la cita una vez por cada compra**.

`service_purchases.appointment_id` nunca tuvo unique (`schema.ts:117`, solo un índice en `:131`),
precisamente porque los cursos grupales escriben N compras sobre 1 cita. El `leftJoin` siempre estuvo
escrito asumiendo 1 : 1, y hoy eso solo "funciona" porque el único caso 1 : N real (el curso) está
en la agenda del admin, no en el flujo masivo de la clienta.

## Los dos bugs que produce

### Bug 1 — Curso grupal con 5 alumnos → 5 tarjetas duplicadas (preexistente)

Este **no depende de la feature nueva**: ya está en producción. `POST /api/course-sessions`
(`src/app/api/course-sessions/route.ts:29-70`) crea 1 `appointments` + N `course_enrollments` + N
`service_purchases` (una por alumno). `GET /api/appointments` con `?date=` devuelve esa cita 5 veces.
`DashboardContent` la pinta 5 veces en el render del día (`:387-406`) y 5 veces en la semana
(`:463-497`). El admin ve la misma sesión de curso repetida, y `appointmentCounts`/`enrollCounts`
(`:134-141`) intenta compensar solo el número de alumnos, no las filas duplicadas.

ElAgg de precio también queda mal: cada fila trae el `servicePrice` de **un** alumno, así que el
"Resumen" (`:148`, `summaryTotalRevenue`) suma el precio del curso una vez por alumno en vez de una
vez por sesión.

### Bug 2 — Cita con servicios complementarios → N tarjetas (nuevo)

Con la feature, una cita de `Acrílicas Full + Matiz + Diseño` escribe 3 compras, y el mismo
`leftJoin` la devuelve 3 veces. Peor: la clienta vería su historial con la misma visita repetida
(`src/app/(client)/profile/page.tsx:35` y `:63` tienen el mismo `leftJoin`), y la CXC por
`CompleteAppointmentDialog` recibiría un precio parcial en lugar del total.

## Estrategias evaluadas

### A) `GROUP BY` con `group_concat` en SQL
```sql
group_concat(sp.service_name, ' + ') , sum(sp.service_price)
```
- Pro: una sola query, sin JS.
- Contra: `sum(sp.service_price)` **infla el curso** (5 alumnos × precio = 5× el total real de la
  sesión). Habría que distinguir "varias compras del mismo cliente" (multi-servicio) de "varias
  compras de clientes distintos" (curso) dentro de la agregación, lo que es frágil y dependent de
  `appointments.client_id` en el propio SQL. Además `group_concat` con separador custom **no admite
  `DISTINCT`**
  en SQLite, así que el nombre del curso saldría repetido 5 veces.

### B) Subquery escalar correlated
```sql
(SELECT group_concat(n, ' + ') FROM (
   SELECT DISTINCT sp.service_name AS n FROM service_purchases sp
   WHERE sp.appointment_id = appointments.id))
```
- Pro: cero filas extra, sin JS, y el `DISTINCT` interno resuelve el nombre duplicado del curso.
- Contra: **no sirve para el precio**. `SUM` sigue sin poder distinguir el caso curso del
  multi-servicio, y subqueries correlacionados por fila son caros si la lista crece. Excelente para
  *solo el nombre* (ver abajo), insuficiente para el read de la agenda.

### C) Segunda query + fusión en JS (elegida)
Quitar el `leftJoin`. La query de citas queda 1 : 1 por construcción (solo joins a `users` y
`services`, ambas N : 1). Las compras llegan en una **segunda query que hace join a `appointments`**
con los mismos filtros de la variante, y se fusionan en un `Map` en JS.

- Pro: **una fila por cita garantizado** por la forma de la query, no por un `DISTINCT` esperanzado.
- Pro: permite el detalle de "elige el grupo de compras de este cliente", que **sí** distingue el
  curso del multi-servicio de forma explícita y testeable.
- Pro: se puede exponer metadata por cita (`serviceItems`, `isComplementaryOnly`) que `group_concat`
  no da fácil.
- Pro: el patrón de "segunda query agrupada + `Map`" **ya existe en el archivo** (`enrollCounts`,
  `:134-141`), así que es idiomático del repo.
- Contra: dos queries en vez de una; se acepta (es el mismo patrón que ya usa `enrollCounts`).

Por qué el "grupo del cliente" y no "el primero": una sesión de curso tiene N compras de N
usuarios distintos. Al agrupar por `(appointmentId, userId)`, cada alumno es un grupo de 1. En
`appointments.client_id` está el primer alumno inscrito, así que su grupo tiene exactamente 1
compra → el precio y el nombre de la sesión son correctos, y no `precio × 5`.

## El helper puro: `src/lib/appointment-purchases.ts`

```ts
summarizePurchases(appointments, purchases) -> Map<appointmentId, {
  serviceName: string,   // "A + B + C", principal primero
  servicePrice: number,  // suma del grupo del cliente
  isComplementaryOnly: boolean, // todas isPrimary=0
  hasPrincipal: boolean,
}>
```

Es una función **pura** (arrays entra, `Map` sale) y por tanto trivialmente testeable con
`appointment-purchases.test.ts`, sin montar la base de datos. La lógica:

- agrupa compras por `(appointmentId, userId)`;
- por cita, elige el grupo cuyo `userId === appointment.clientId` (si no hay match, el primero);
- dentro del grupo, ordena la principal (`is_primary=1`) primero y el resto por nombre para que el
  orden sea determinista (las compras comparten `created_at`);
- `servicePrice` = suma del grupo elegido;
- si la cita no tiene compras (p.ej. creada antes de esta feature, o el camino de
  `POST /api/purchases` con `appointmentId` null), cae a `services.name` y precio 0.

## Dónde se aplica

- **`GET /api/appointments`** (agenda admin, día / semana / resumen / pendientes) — la query de
  compras replica el `where` de la variante correspondiente (status, y la ventana de fecha de
  `dayQuery` o de `pendingQuery`). Es lo que arregla los **dos** bugs.
- **`src/app/(client)/profile/page.tsx`** (`:35`, `:63`) — mismo `leftJoin`, misma solución, para que
  la clienta vea su visita una sola vez.

## Dónde NO se aplica (y por qué)

- **`GET /api/production-photos`** (`route.ts:100`) y **`GET /api/clients/[id]`**
  (`photoGroups`/`passportGroups`) hoy leen **solo** `services.name` a través de `appointments` y
  **no** hacen join a `service_purchases` — están a salvo del fan-out por diseño (así lo documenta
  `AGENTS.md` para el CRM: usar el snapshot de compras "multiplicaría cada foto tantas veces como
  alumnos tenga la cita"). El único problema es de **caption**: con varios servicios mostrarían solo
  el ancla. Se resuelve con la estrategia **B** (subquery `group_concat` con `DISTINCT` interno),
  que es la correcta aquí porque solo importa el nombre, nunca el precio, y no agrega filas.

## Invariante de regresión

> **Una fila por cita, siempre.** Ningún read de citas debe multiplicar filas por
> `service_purchases`. Si alguna consulta futura vuelve a hacer `leftJoin` a `service_purchases`
> para traer precio o nombre, debe pasar primero por `summarizePurchases` (o por un `group_concat`
> cuando solo necesite el nombre) — nunca por el join directo.

Este invariante debe quedar escrito en `AGENTS.md` (sección de fan-out de compras) y quedar
anclado en `appointment-purchases.test.ts` con el caso-escuela (N compras de N clientes distintos) y
el caso multi-servicio (N compras del mismo cliente) como regresiones permanentes.
