# Cursos grupales, CXC desde el agendado y P&L en base de caja

**Fecha:** 2026-08-27

## Contexto

El salón tiene un servicio que es un **curso/clases** (ej: "Curso Básico de Uñas (Clase)"). A diferencia de los servicios normales (1:1), un curso puede abarcar **varios clientes en una misma sesión**. Se necesita:

1. Saber **qué cliente asistió al curso**.
2. Tener la **CXC (cuentas por cobrar) por alumno** del curso.
3. Que eso **sume al estado de cuenta** del cliente.
4. Decidir si el curso es una categoría/módulo aparte o un tipo de servicio.

Durante el brainstorming surgió además un requisito transversal que aplica a **todos los servicios y cursos**: la deuda/CXC debe nacer **al momento de agendar** (no al completar) y permitir **pagos en cualquier momento** (abonos parciales, adelantos, pago completo). El P&L debe pasar a **base de caja** (ingresos por lo cobrado), manteniendo también una vista por producción.

## Decisiones tomadas (brainstorming)

- **Curso = sesión grupal programada**: una fecha/hora fija donde asisten varios alumnos juntos. Se agenda como un bloque en la agenda del día.
- **Precio fijo por alumno**: cada alumno inscrito genera su deuda individual por el precio del curso.
- **Solo clientes registrados** como alumnos (no walk-ins para cursos, por ahora).
- **Alcance global**: el nuevo modelo de facturación (CXC al agendar + pagos en cualquier momento + P&L por caja) aplica a **todos los servicios 1:1 y a los cursos**, de forma uniforme (no duplica lógica).
- **Desacoplar Evento del Servicio de la Transacción Económica**:
  - Evento = cita/sesión (`appointments`), con estado operativo (scheduled / completed / cancelled).
  - Transacción económica = deuda por cliente (`service_purchases`), con estado financiero (pending / partial / paid / void).
  - **Estados independientes**: el estado operativo de la cita es independiente del estado financiero de la deuda.
- **Doble registro de fechas**:
  - `completion_date` = fecha en que se prestó el servicio (producción).
  - `payment_date` (`payments.paid_at`) = fecha en que ingresó el dinero (recaudación).
  - Permite reportes tanto por producción como por recaudación.
- **CXC nace al agendar**: el `service_purchases` se crea con `financial_status='pending'` en el momento de agendar la cita o la sesión de curso.
- **Pagos en cualquier momento**: se pueden abonar/adelantar/pagar en pleno aunque la cita no esté completada.
- **`financial_status` se recalcula solo**: en cada inserción/borrado de pago, desde `Σ payments del usuario` vs `service_price` del purchase.
- **P&L en base de caja + vista por producción**: dos métricas.
  - **Recaudación** = `Σ payments` por `paid_at` en el mes.
  - **Producción** = `Σ service_purchases` por `completion_date` en el mes.
- **`totalRevenue` del cliente = lo pagado (recaudado)**; `totalVisits` = citas/sesiones completadas.
- **Cobro flexible al completar una sesión de curso**: cada alumno sin pagar queda como deuda pendiente en CXC; se puede cobrar a algunos, a todos, o dejarlos pendientes.

## Diseño

### Feature 1 — Desacople de favor de `service_purchases` (Transacción Económica)

**Schema (`src/db/schema.ts`):**

Nuevos campos en `service_purchases`:
- `financial_status` (text, default `'pending'`) — valores `pending | partial | paid | void`.
- `completion_date` (integer, nullable) — fecha de prestación del servicio; se llena al completar; null mientras esté pendiente.

Se **permite más de un `service_purchases` por `appointment_id`** (curso grupal): hoy solo hay índices (no unique constraint), por lo que no hace falta relajar nada a nivel de esquema; simplemente se deja de asumir 1:1 en el código.

**Nota de datos heredados:** las filas existentes de `service_purchases` se migran con `financial_status='pending'` y `completion_date=null`. Las asociadas a citas `completed` deberían tener `completion_date` = fecha de la cita (migración de datos o recálculo).

### Feature 2 — Nueva tabla `course_enrollments` (Evento grupal)

- `id` (text, PK)
- `appointmentId` (text, FK → appointments.id, on delete cascade) — la sesión de curso (es un `appointments` cuyo `service` es tipo curso).
- `clientId` (text, FK → users.id) — el alumno.
- `createdAt` (integer).
- unique index (`appointmentId`, `clientId`).

**Determinación de "servicio tipo curso":** se añade una marca al servicio. Opciones evaluadas:
- Aprovechar el flag `is_group` en `services` para marcar servicios con múltiples asistentes por cita (el "curso"). **(elegida)**

Nuevo campo en `services`:
- `is_group` (integer, default 0) — 1 = servicio grupal (curso/clase), admite múltiples alumnos por cita.

**¿Categoría o módulo aparte?** Decisión: el curso es un **tipo de servicio (grupo)** dentro del sistema existente, NO un módulo aislado con temario/certificados (YAGNI en MVP). Esto evita duplicar facturación y mantiene el curso aportando a la CXC/estado de cuenta del cliente sin lógica paralela.

### Feature 3 — Flujos

**a) Agendar (nace la deuda):**
- Servicio 1:1: se crea `appointments` + `service_purchases` (`financial_status='pending'`). La CXC ya refleja la deuda desde el agendado.
- Curso grupal: el admin elige servicio tipo curso, fecha/hora y la lista de alumnos (multi-select de clientes registrados). Se crea: 1 `appointments` (bloquea la agenda, visible como grupo), N `course_enrollments`, N `service_purchases` (uno por alumno, `pending`).

**b) Pagar en cualquier momento:**
- Se inserta en `payments` como hoy (tasa BCV si Bs, referencia, captura opcional).
- Tras insertar/borrar un pago se llama a `recomputeFinancialStatus(userId)` que recalcula `financial_status` de los purchases abiertos de ese usuario:
  - `paid` si `Σ payments >= servicePrice`
  - `partial` si `0 < Σ payments < servicePrice`
  - `pending` si `Σ payments = 0`

**c) Completar cita/sesión:**
- `appointments.status → 'completed'`.
- Se llena `service_purchases.completion_date` con la fecha actual en los purchases de la cita (o de todos los enrollments, en curso grupal).
- Se registran materiales (`appointment_usage`) y notas como hoy.
- `totalVisits +1` por cita/sesión completada.
- Cobro flexible: en curso grupal, cada alumno sin pagar mantiene su deuda `pending`; el admin decide a quién cobrar.

**d) Cancelación:**
- 1:1: se archiva en `cancelled_appointments` como hoy; el `service_purchases` del cliente pasa a `financial_status='void'` (no suma a CXC ni a P&L, mantiene historial).
- Curso grupal: al cancelar la sesión, tratamiento por alumno (purchases → `void`). Antes de completar, se puede **quitar un alumno** de la sesión (borra su `course_enrollments` + su `service_purchases`), para aforo correcto.

### Feature 4 — Cálculos

- **CXC por cliente / balances** = `Σ service_purchases.servicePrice` (con `financial_status != 'void'`, TODOS —no solo completadas—) − `Σ payments.amountUsd`, por `user_id`.
- **P&L – Recaudación (caja)** = `Σ payments.amountUsd` con `paid_at` en el mes.
- **P&L – Producción (devengado)** = `Σ service_purchases.servicePrice` con `completion_date` en el mes y `financial_status != 'void'`.
- **`totalRevenue` del cliente** = lo pagado acumulado (se actualiza al registrar/borrar pagos). **`totalVisits`** = citas/sesiones completadas.
- **Estado de cuenta `/profile`** = listado cronológico de purchases (pendientes y completadas) + pagos realizados, con saldo actual.

### Feature 5 — APIs

- `POST /api/course-sessions` (admin) — crea una sesión grupal: `serviceId` (tipo curso), `startTime`, `clientIds[]`. Valida servicio `is_group=1`. Crea appointment + enrollments + purchases. Bloquea slots y Google Calendar como una cita normal.
- `GET /api/course-sessions` (admin) — lista sesiones con alumnos y saldo por alumno.
- `POST/DELETE /api/course-sessions/[id]/enrollments` (admin) — añade/quita alumnos (solo antes de completar).
- Reutiliza las rutas existentes:
  - `PATCH /api/appointments/[id]` (completar): además llena `completion_date`.
  - `POST /api/payments` (registrar pago) → dispara `recomputeFinancialStatus`.
  - `DELETE /api/payments/[id]` → dispara `recomputeFinancialStatus`.
  - Cancelación (`DELETE /api/appointments/[id]`) → marca purchases del cliente como `void`.
- `GET /api/financials/pnl` → devuelve `{ recaudacion: {...}, produccion: {...} }`.
- Guardas de permisos existentes (`appointments`, `balances`, `financials`) se mantienen; `course-sessions*` → permiso `appointments`.

### Feature 6 — UI (mobile-first, paleta rosa)

- **Agenda `/dashboard`**: una sesión de curso aparece como bloque de grupo (badge "Curso" + nombre + nº de alumnos, ej. "Curso Básico de Uñas · 4 alumnos"). Las citas 1:1 muestran además un **indicador financiero** (badge Pendiente / Abonado / Pagado) sobre el estado operativo. Nueva pestaña/lógica y diálogo "Agendar sesión de curso" (multi-select de alumnos con buscador, precio por alumno y total).
- **Panel de cita / sesión**: completar, registrar pago (parcial/total), y en cursos: añadir/quitar alumno (pre-completar), lista de asistentes con su badge financiero y saldo por alumno.
- **Cuentas por cobrar `/dashboard/balances`**: deuda por cliente **desde el agendado** (no solo completadas), desglose por ítem (cita pendiente vs completada), filtro por estado financiero.
- **P&L `/dashboard/financials`**: dos paneles — Recaudación (por `paid_at`) y Producción (por `completion_date`), con desglose por servicio.
- **Perfil `/profile`**: estado de cuenta completo (pendientes + completadas + pagos, saldo).

## Migración de datos

- Añadir columnas `financial_status` y `completion_date` a `service_purchases` con los defaults descritos.
- Añadir `is_group` a `services` (default 0). Marcar el servicio "Curso Básico de Uñas" como grupo.
- Backfill: `completion_date` de purchases de citas ya `completed` → fecha de la cita; `financial_status` según pagos existentes.
- Los balances/P&L actuales cambiarán de valor (paso de base devengado a mixto/caja). Es un cambio esperado y deliberado.

## Fuera del alcance (MVP)

- Módulo de cursos con temario/niveles/certificados (se modela como servicio grupal).
- Alumnos walk-ins en cursos (solo clientes registrados).
- Lectura bidireccional de Google Calendar.
- Multi-empleado para cursos.
