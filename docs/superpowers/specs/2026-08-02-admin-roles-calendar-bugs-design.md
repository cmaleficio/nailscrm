# Administración, Google Calendar y Corrección de Bugs - Design Document

Fecha: 2026-08-02
Base: Next.js 16.2.12 (App Router, `src/`), TypeScript, Tailwind v4, SQLite + Drizzle, NextAuth v5 (Auth.js) beta.32, timezone America/Caracas (UTC-4).

## Alcance

Cinco partes:

1. **Bugs de reserva y sesión** (resultados de las pruebas de la app) → Parte 1.
2. **Modelo de datos** (rol, multi-foto) cross-cutting → Parte 2.
3. **Sistema de administradores** (múltiples admins con rol) → Parte 3.
4. **Dashboard con calendario + Google Calendar real** → Parte 4.
5. **Regla de mantenimiento** (AGENTS.md + CHANGELOG/README) → Parte 5.

---

## Parte 1 — Bugs y estabilidad de reserva/sesión

### Causa raíz ya corregida
Los errores reportados (401 en `POST /api/appointments`, "se cierra la sesión", `/api/auth/error?error=Configuration` → 500, "Ver mis citas" sin destino) se originaron porque `.env` usaba nombres de vars v4 (`GOOGLE_CLIENT_ID`) mientras Auth.js v5 exige `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`. Con `clientId` `undefined` no se establecía `authjs.session-token`, por lo tanto todo flujo autenticado fallaba. Esto ya fue corregido (`.env` + `.env.template` pasaron a `AUTH_*`).

Acciones de verificación/hardening pendientes:

1. **`handleConfirm` de `BookingWizard.tsx`** — envolver en `try/catch`, `finally { setSubmitting(false) }`, y redirección por `router.push` solo en éxito real. Si `res.ok` es `false`, mostrar mensaje de error (p. ej. toast/inline) en vez de dejar el botón "Reservando..." atascado.
2. **Multi-foto en reserva** — permitir subir **varias** fotos de referencia en el paso 3. Dos opciones de modelo de datos (ver Parte 2 de esquema).
3. **Evento en sesión `Middleware`** — en `src/middleware.ts`, el uso de `process.env.ADMIN_EMAIL` y `req.auth?.user?.email` debe migrar a rol (Parte 3). Además proteger rutas `/dashboard/admins`.
4. **`/profile` incompleto** — hoy solo muestra citas `completed`. Debe mostrar también `pending`/`confirmed` (próximas) para que "Ver mis citas" tenga contenido real; error reportado "no lleva a ningún sitio" era por sesión rota, pero de paso damos valor real.
5. **Boton "Reservando"** — además del `finally`, agregar disable real durante la subida, y no perder el estado si el submit falla.

### Esquema (cambio de datos)
Para multi-foto: en `appointments.referencePhotoUrl` (single) → mantener la columna y **agregar tabla** `appointment_photos` (relación 1:N):

```
appointment_photos:
  id             text PK
  appointment_id text NOT NULL FK -> appointments.id (on delete cascade)
  url            text NOT NULL
  position       integer NOT NULL default 0
  created_at     integer
```

- `POST /api/appointments` aceptará `referencePhotoUrls: string[]` (además de conservar lectura de `referencePhotoUrl` para compat).
- Dashboard y perfil leerán las fotos desde la tabla nueva.

---

## Parte 2 — Esquema de roles y modelos datos

### users.role
Agregar columna a `users`:
```
role: text NOT NULL default 'client'  -- valores: 'client' | 'admin'
```
- El admin principal (de `ADMIN_EMAIL`) se marca `admin` automáticamente en un callback de `signIn` de NextAuth (si no existía el usuario, se crea como `admin`; si existe y es dueño del email, se promueve).
- Los demás usuarios quedan `client`.

### Índices
- `appointments.client_id`, `appointments.start_time` — índices para agenda/calendario.

---

## Parte 3 — Sistema de administradores

### Objetivo
Cualquier usuario con `role = 'admin'` accede a `/dashboard/*`. El admin principal (`ADMIN_EMAIL`) puede añadir/quitar otros admins desde una UI nueva.

### Cambios de código

1. **`src/db/schema.ts`** — `role` en `users`.
2. **Migración Drizzle** — `drizzle-kit generate` + `drizzle-kit migrate` (o script en la PR).
3. **`src/lib/auth.ts`** — callback `signIn`/`session`:
   - En `session`, exponer `session.user.role`.
   - En `signIn`, si el email es `ADMIN_EMAIL` y el user recién creado → `role='admin'`.
4. **`src/lib/authz.ts`** — helpers centralizados:
   ```ts
   export function getSessionUserRole(session): 'user' | 'admin'
   export async function isAdmin(session): Promise<boolean>
   export async function isSuperAdmin(session): Promise<boolean>  // email === ADMIN_EMAIL
   ```
5. **Middleware** — sustituir `email === process.env.ADMIN_EMAIL` por:
   - `/dashboard/**` requiere `role === 'admin'`. (El middleware no tiene DB; se resuelve vía el token/JWT de NextAuth con el rol incluido en `session`. Al usar adapter con sesiones DB, el rol no está en JWT → evaluar alternativas: middleware llama API o simplemente vuelve a redirigir y la página Server-chequea DB. **Decisión:** el middleware redirige si no está logueado; la autorización real por rol se hace en los Server Components y API routes con `isAdmin()` desde DB).
6. **`src/app/api/admins/route.ts`** (nuevo, solo superadmin):
   - `GET` listar admins.
   - `POST { email }` → setear `role='admin'` (usuario existente o crea placeholder si no existe).
   - `DELETE { email }` → quitar rol (no aplicar al superadmin).
7. **UI `/dashboard/admins`** (reemplaza placeholder): lista de admins con botón quitar + input email para añadir. Sidebar en `(admin)/layout.tsx` agrega item "Admins".
8. **Header.tsx** — decidir destino "Mi cuenta" por `role` (admin → `/dashboard`, user → `/profile`).

---

## Parte 4 — Dashboard con calendario + Google Calendar

### Objetivo
Vista de agenda con calendario (día y semana) mostrando: cliente, servicio, horas, fotos de referencia, y poder **mover/reagendar** una cita, actualizando **el evento en el calendario de Google del cliente y del admin** (eventos espejos).

### Integración Google Calendar (real)
No existe hoy. Se requiere:

1. **Token del cliente y del admin** — ya se persisten en tabla `account` (access_token, refresh_token, expires_at) porque los usuarios inician sesión con Google. Para el admin (calendar.cc) así para el cliente.
2. **`src/lib/calendar.ts`** (nuevo):
   ```ts
   export async function createAppointmentEventClient(userId, appointment): Promise<{id}|null>
   export async function createAppointmentEventAdmin(userId, appointment): Promise<{id}|null>
   export async function updateAppointmentEventClient(userId, appointment): Promise<boolean>
   export async function updateAppointmentEventAdmin(userId, appointment): Promise<boolean>
   export async function deleteAppointmentEvent(userId, eventId): Promise<boolean>
   ```
   - Llamadas a `https://www.googleapis.com/calendar/v3/calendars/primary/events` con `Authorization: Bearer <access_token>` del usuario correspondiente.
   - **Refresh token flow**: si `expires_at` pasó, renovar con `oauth2/v4/token` usando `refresh_token`, actualizar `account.*` y reintentar.
   - Los `googleEventIdClient` / `googleEventIdAdmin` en `appointments` guardan los IDs retornados.
3. **`POST /api/appointments`** — tras insertar en SQLite, crear eventos en ambos calendarios y persistir los IDs. Si el token del admin/cliente falla, crear la cita igual (best-effort) y logConsolear.
4. **`PATCH /api/appointments/[id]`** — aceptar además nuevo `startTime` (o rango) para *reagendar*:
   - Actualiza `startTime`/`endTime` en DB.
   - Llama `updateAppointmentEvent*` para ambos eventos con la nueva hora.
   - Además conserva cambios de `status`.
5. **Vista `DashboardContent`** — agregar:
   - Selector diario + vista de semana (7 columnas por hora o lista por día).
   - Cada nodo muestra: hora, cliente, servicio, foto referencia.
   - Botón **"Reprogramar"** abre selector (nueva fecha+hora) que dispara `PATCH`.
   - En vista lista, la tarjeta existente gana botón Reprogramar + foto (AppointmentCard recibe `onReschedule` y URL de fotos array).

### Notas flagrantes / decisiones
- **Reconciliación:** si el token del admin no está (admin sin login Google), la escritura del evento admin se salta (best-effort) — documentar.
- No se borrarán eventos de Google al cancelar en esta iteración (fuera de alcance) salvo que sea trivial; se puede agregar `deleteEvent` opcional.
- Las apps de Google deben tener el scope `https://www.googleapis.com/auth/calendar.events` (ya se pide en `auth.config.ts`).

---

## Parte 5 — Regla de mantenimiento (AGENTS.md, README, CHANGELOG)

### AGENTS.md
Agregar línea obligatoria (en la sección de Reglas/Desarrollo):
> "Cada cambio relevante (funcionalidad nueva/quitada o bug corregido) obliga a actualizar AGENTS.md (si aplica), CHANGELOG.md y README.md en el mismo commit/pull."

### CHANGELOG.md
Crear `CHANGELOG.md` en la raíz con formato Keep a Changelog (added/changed/fixed), entrada inicial describiendo esta iteración completa.

### README.md
Reescribir el README actual (que es el boilerplate de create-next-app) con: descripción del producto, funcionalidades, stack, cómo correr (setup/entorno/AUTH en vars), estructura de carpetas, y sección de mantenimiento referenciando AGENTS/CHANGELOG.

> Nota técnica: `AGENTS.md` (y `conventions.md`) están codificados en **UTF-16 LE** (BOM `FF FE`) — editar preservando codificación (usar PowerShell con `-Encoding` o convertir con WriteFile y Encoding.UTF16) para no romper.

---

## Decisiones abiertas resueltas

- **Calendar events:** Se crean y actualizan en **ambos** calendarios (cliente y admin) → `googleEventIdClient` + `googleEventIdAdmin`.
- **Admins:** constancia por columna `role`, super admin definido por `ADMIN_EMAIL`.
- **Citas del perfil:** `/profile` muestra citas próximas + pasadas completadas.