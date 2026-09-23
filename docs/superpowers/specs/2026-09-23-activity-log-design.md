# Design: Log de Actividad de Usuarios (Audit Log)

**Fecha:** 2026-09-23
**Estado:** Aprobado
**Ruta de implementación:** architectural → writing-plans

## Problema

El sistema es usado por varios usuarios (superadmin, admins con permisos parciales y clientes). No existe ningún registro persistente de qué cambios hace cada usuario: borrados, generación de citas, carga de facturas, pagos, aprobación/rechazo de capturas, etc. Hoy solo hay rastros parciales (archivo `cancelled_appointments`, kardex `inventory_movements`, columnas `created_by` dispersas). Se necesita un log de actividad auditable que registre **todas** las mutaciones del sistema y quién las hizo.

## Decisiones tomadas (brainstorming)

1. **Alcance:** todas las endpoints mutantes del sistema (~45 POST/PUT/PATCH/DELETE). No se registran lecturas (GET).
2. **Histórico:** solo hacia adelante. No se hace backfill de acciones pasadas.
3. **Visualización:** página en el dashboard (`/dashboard/activity`) con tabla paginada y filtros.
4. **Retención:** sin límite (crecimiento indefinido en `activity_logs`).
5. **Login/logout:** fuera del alcance.
6. **Enfoque:** helper `logActivity()` + tabla genérica `activity_logs`, llamado manualmente en cada endpoint mutante (opción A, aprobada).

## Modelo de datos

### Tabla: activity_logs

| columna | tipo | nota |
|---|---|---|
| id | text, primary key | `crypto.randomUUID()` |
| actor_id | text, FK → users.id, **nullable** | null = acción pública anónima (reserva desde el wizard sin sesión) |
| actor_name | text, nullable | snapshot del nombre, sobrevive a cambios/borrados del usuario |
| entity | text, not null | `appointments`, `bills`, `payments`, `inventory_items`, … |
| action | text, not null | `create`, `update`, `delete`, `cancel`, `complete`, `approve`, `reject`, `report`, `move`, `adjust`, `enroll`, … |
| entity_id | text, nullable | id de la fila afectada (null cuando no aplica, p.ej. ajustes globales) |
| label | text, not null | resumen humano: "Cita: Ana – Acrílicas Full (14:00)", "Factura F-1001" |
| metadata | text, nullable | JSON string con detalles: montos, tasas, diffs relevantes |
| created_at | integer, not null | unix seconds (`Math.floor(Date.now() / 1000)`) |

Índices:
- `activity_logs_created_at_idx` on `created_at` (orden por fecha)
- `activity_logs_actor_idx` on `actor_id` (filtro por usuario)
- `activity_logs_entity_idx` on `entity` (filtro por módulo)

Sigue las convenciones del repo: snake_case SQL ↔ camelCase TS, `$type<>()` para uniones, timestamps en segundos.

## Helper `src/lib/audit.ts`

Firma síncrona (mejor-sqlite3 es síncrono):

```ts
export type AuditEntity =
  | "appointments" | "appointment_usage" | "course_sessions" | "course_enrollments"
  | "services" | "service_photos" | "gallery_photos" | "service_products"
  | "users" | "clients" | "admins" | "waitlist" | "blockouts" | "working_hours"
  | "purchases" | "payments" | "payment_receipts" | "exchange_rates"
  | "suppliers" | "expense_categories" | "bank_accounts" | "bills" | "supplier_payments"
  | "inventory_items" | "inventory_movements" | "risc_events";

export type AuditAction =
  | "create" | "update" | "delete" | "cancel" | "complete"
  | "approve" | "reject" | "report" | "adjust" | "enroll" | "unenroll" | "void";

export function logActivity(params: {
  entity: AuditEntity;
  action: AuditAction;
  entityId?: string;
  label: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
}): void;
```

- `logActivity` hace `db.insert(schema.activityLogs).values({...}).run()`. El insert nunca debe fallar la operación de negocio: se envuelve en try/catch con `console.error` silencioso (el log es mejor-esfuerzo, nunca bloquea una mutación ya confirmada).
- En handlers se obtiene el actor igual que hoy: `const session = await auth()` → `session?.user?.id` / `session?.user?.name`.
- Para borrados (DELETE), el handler ya lee la fila para validar; se pasa `label`/`metadata` desde esa lectura y se loguea justo después del `.delete()` o `.update()` exitoso.
- En citas canceladas [DELETE /api/appointments/[id]] el label usará el snapshot que queda en `cancelled_appointments` (service_name, cliente) y `action: "cancel"`; la metadata incluirá `reason`.

## Instrumentación (superficie de integración)

Aquí se tocan ~45 rutas. En cada una se añade la llamada a `logActivity(...)` tras la mutación exitosa. Resumen por grupo (ruta → entity/action):

- **Citas/agenda:** `POST /api/appointments` (`create`), `PATCH /api/appointments/[id]` (`update`/`complete`), `DELETE /api/appointments/[id]` (`cancel`), `POST /api/appointments/[id]/final-photos` (`update`), `DELETE` del mismo (`update`), `POST /api/appointments/[id]/review` (`create` sobre reseña), `POST /api/course-sessions` (`create`), `POST/DELETE /api/course-sessions/[id]/enrollments` (`enroll`/`unenroll`), `POST /api/blockouts` (`create`), `DELETE /api/blockouts/[id]` (`delete`), `PUT /api/working-hours` (`update`).
- **Waitlist:** `POST /api/waitlist` (`create`), `PATCH /api/waitlist/[id]` (`update`), `DELETE` (`delete`).
- **Clientes/CRM:** `POST /api/clients` (`create`), `PATCH/DELETE /api/clients/[id]` (`update`/`delete`), `PATCH /api/profile` (`update`).
- **Compras (CXC):** `POST /api/purchases` (`create`), `PATCH/DELETE /api/purchases/[id]` (`update`/`delete`).
- **Pagos:** `POST /api/payments` (`create`), `DELETE /api/payments/[id]` (`delete`), `POST /api/payment-receipts` (`report`), `PATCH /api/payment-receipts/[id]` (`approve`/`reject`), `DELETE` (`delete`).
- **Servicios/muro:** `POST /api/services` (`create`), `PATCH/DELETE /api/services/[id]`, `POST /api/services/[id]/photos` (`create`), `DELETE …/photos/[photoId]` (`delete`), `PUT /api/service-products` (`update`), `POST /api/gallery-photos` (`create`), `DELETE /api/gallery-photos/[id]` (`delete`).
- **Compras/proveedores/CXP:** `POST/PATCH/DELETE` de `suppliers`, `expense-categories`, `bank-accounts`, `bills`, `supplier-payments`.
- **Inventario:** `POST /api/inventory/items` (`create`), `PATCH/DELETE /api/inventory/items/[id]`, `POST /api/inventory/items/[id]/movements` (`adjust`/`create`).
- **Admin/config:** `POST/PATCH/DELETE /api/admins`, `PUT /api/brand`, `PUT /api/admin/nav-items`, `PUT /api/admin/legal/*` (privacy + terms), `POST /api/exchange-rate` (`create`), `DELETE /api/exchange-rate/[id]` (`delete`).
- **Auth/usuarios:** `POST /api/auth/register` (`create`). Login/logout quedan fuera.
- **RISC:** `POST /api/risc/events` (evento entrante de Google, actor null; se registra `action: "update"` o `"delete"` según el tipo cuando afecta a un usuario: `sessions-revoked`/`tokens-revoked`/`account-disabled`).

Las acciones `complete` surgen al pasar una cita a `completed` vía `PATCH /api/appointments/[id]` (junto a `recordUsage`).

## API de consulta

`GET /api/activity-logs` — protegido con permiso `activityLog`.

Query params (todos opcionales):
- `entity` — filtrar por módulo (`activity_logs.entity`).
- `action` — filtrar por acción.
- `actor` — filtrar por `actor_id`.
- `from` / `to` — rango de `created_at` (unix seconds).
- `q` — texto libre que matchea `label` (LIKE case-insensitive).
- `limit` — default 50, máx 200.
- `offset` — default 0.

Respuesta:

```json
{
  "items": [{ "id", "actorId", "actorName", "entity", "action", "entityId", "label", "metadata", "createdAt" }],
  "total": 1234,
  "hasMore": true,
  "nextOffset": 50
}
```

- Autorización: `hasPermission(session, "activityLog")`.
- Sin auth → 401 `{ error: "No autorizado" }` (convención del repo).

## Permiso nuevo: `activityLog`

- Agregar `"activityLog"` a `PERMISSION_KEYS` y a `PERMISSION_LABELS` en `src/lib/permissions.ts`.
- Los admins con `permissions = null` (todos los módulos) lo obtienen automáticamente; el selector de AdminUsers ya replica claves, no requiere cambios extra.
- Guardas: página + API con `hasPermission(session, "activityLog")`.

## UI: `/dashboard/activity`

- `src/app/(admin)/dashboard/activity/page.tsx` — guard de servidor (patrón existente de `balances/page.tsx`), render de `ActivityLogContent`.
- `src/app/(admin)/dashboard/activity/ActivityLogContent.tsx` — `"use client"`.
  - Fetch a `/api/activity-logs` con filtros vía `useCallback` + `useEffect` (patrón de `BalancesContent`).
  - Escucha el evento `activity:refresh` para refrescar tras cambios.
  - Tabla: fecha (hora local), usuario (actor_name, o "—"/"Público" si null), acción con badge de color por tipo (create=verde, update=azul, delete/cancel=rojo, approve=verde oscuro, reject=rojo, demás=gris), entidad, label. Fila expandible para ver metadata JSON formateado.
  - Filtros: usuario (select alimentado por `/api/activity-logs/actors` — endpoint extra que devuelve `[{ actorId, actorName }]` distintos del log), entidad (select con `AUDIT_ENTITIES`), acción (select), desde/hasta (inputs date), búsqueda `q`.
  - Paginación: botón "Cargar más" (offset) + contador "total".
- Nav item en `src/app/(admin)/layout.tsx` (`NAV_ITEMS`) con `perm: "activityLog"`, icono consistente con el set existente.

## Endpoint extra

`GET /api/activity-logs/actors` — admin con permiso `activityLog`; devuelve actores distintos para el filtro de usuario:

```json
[{ "actorId": "…", "actorName": "Ana Martínez" }]
```

## Errores y robustez

- El insert del log va en try/catch: un fallo del log jamás rompe la mutación de negocio ya confirmada, ni cambia la respuesta al cliente.
- `metadata` se serializa a JSON string con `JSON.stringify`; si la serialización falla se guarda `null`.
- El `label` se construye desde datos ya leídos por el handler (nunca del body a ciegas) para evitar inyección de texto y dar contexto real.

## Migración

1. Editar `src/db/schema.ts` (tabla `activityLogs`).
2. `npm run db:generate` → revisar el SQL generado en `drizzle/`.
3. `npm run db:migrate`.

## Verificación

No existe test runner configurado (el repo tiene `vitest` instalado pero sin suite de la app; hay un `vitest.config.ts` no usado). La verificación definitiva es:

- `npx tsc --noEmit`
- `npm run lint`
- Prueba manual end-to-end: hacer varias mutaciones desde la UI (crear/cancelar cita, cargar factura, registrar pago, borrar un ítem) y confirmar que aparecen en `/dashboard/activity` con el actor correcto.

## Fuera del alcance

- Registro de logins/logouts.
- Backfill de acciones históricas (las citas canceladas ya viven en `cancelled_appointments`; no se duplican al log).
- Exportación CSV/Excel (se puede sumar después).
- Destrucción/rotación de logs (retención infinita).