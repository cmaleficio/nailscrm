# Filtro por mes, servicios futuros y correcciones en Cuentas por cobrar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modificar `/dashboard/balances` para mostrar cuentas por mes límite, servicios futuros por cliente, corregir `unpaidAppointments` y establecer `pending` como filtro por defecto.

**Architecture:** Se extiende `GET /api/balances` con parámetros de mes límite y cálculo de servicios futuros. `BalancesContent` consume los nuevos datos sin cambiar la estructura general.

**Tech Stack:** Next.js 14, TypeScript, SQLite (better-sqlite3), Drizzle ORM, Tailwind CSS.

## Global Constraints

- No migraciones de BD nuevas; el filtro opera sobre datos existentes (`servicePurchases`, `appointments`).
- Las consultas deben seguir el patrón de Drizzle con `sql` puro para agregaciones.
- `publicFirstName()` sigue aplicándose; no se expone nombre completo en respuestas públicas.
- La fecha de referencia es siempre `start_time` (cita) para el filtro y el futuro.
- `CHANGELOG.md` y `AGENTS.md` deben actualizarse en el mismo commit.

---

## File Structure

- `src/app/api/balances/route.ts` — lógica del filtro y nuevos campos.
- `src/app/(admin)/dashboard/balances/BalancesContent.tsx` — UI de filtro, bloque futuro, orden de filtro, texto corregido.
- `docs/superpowers/plans/2026-10-31-balances-filter-future.md` — este plan.
- `CHANGELOG.md` — registro.
- `AGENTS.md` — actualización de modelo/comportamiento.

---

### Task 1: Extender `GET /api/balances` con filtro de mes límite y futuro

**Files:**
- Modify: `src/app/api/balances/route.ts`
- Test: `src/lib/balances-logic.test.ts` (si existe) o verificación manual con `curl`.

**Interfaces:**
- Consumes: `servicePurchases`, `appointments`, `payments`, `users`.
- Produces: `BalanceRow` con `futureItems: BalanceItem[]` y `monthFilter?: string`.

- [ ] **Step 1: Leer `month` del query param**

En `GET()`, extraer `const url = new URL(req.url); const month = url.searchParams.get("month")`.

- [ ] **Step 2: Calcular `endOfMonth` en segundos**

Si `month` es `YYYY-MM`, `endOfMonth = Date.UTC(año, mes-1+1, 1) / 1000 - 1` (último segundo del mes).

- [ ] **Step 3: Aplicar filtro en `itemsByUser` y `dueRows`**

En la query de `servicePurchases` agregar condición opcional: `startTime <= ?` cuando `month` esté presente. Usar `sql` con parámetro.

- [ ] **Step 4: Calcular `futureItems`**

Para cada `userId`, consultar compras donde `startTime > endOfMonth` (o `startTime > hoy` si no hay mes). Devolver como `futureItems` en la fila del cliente.

- [ ] **Step 5: Corregir `unpaidAppointments`**

Reemplazar `count(*)` por `count(DISTINCT servicePurchases.appointmentId)` con filtro `appointmentId IS NOT NULL`.

- [ ] **Step 6: Run manual test**

Llamar `/api/balances?month=2026-10` y verificar que `clients` tiene los datos correctos, `futureItems` está presente y `unpaidAppointments` es menor o igual al valor anterior cuando hay citas duplicadas.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/balances/route.ts
git commit -m "feat(balances): add month filter, future items and fix unpaidAppointments"
```

---

### Task 2: Actualizar `BalancesContent` con UI de filtro, bloque futuro y orden de filtro

**Files:**
- Modify: `src/app/(admin)/dashboard/balances/BalancesContent.tsx`

**Interfaces:**
- Consumes: `clients` con `futureItems`.
- Produce: `monthFilter` state, `statusFilter` default `"pending"`, orden `pending`, `all`, `partial`, `paid`.

- [ ] **Step 1: Agregar `monthFilter` state y `<select>`**

```tsx
const [monthFilter, setMonthFilter] = useState<string>("");
```

Select con opciones como `""` (Todos), `"2026-10"`, `"2026-09"`, `"2026-08"`, etc. Al cambiar, actualizar `loadBalances` con `?month=${monthFilter}`.

- [ ] **Step 2: Cambiar default de `statusFilter` a `"pending"`**

```tsx
const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid">("pending");
```

- [ ] **Step 3: Reordenar los botones**

En el array: `"pending"`, `"all"`, `"partial"`, `"paid"`.

- [ ] **Step 4: Agregar bloque de servicios futuros**

Dentro de cada tarjeta (`map((c) => ...)`), debajo del detalle de servicios actuales, agregar:

```tsx
{c.futureItems && c.futureItems.length > 0 && (
  <div className="mt-3 border-t border-dashed border-amber-200 pt-3">
    <p className="text-xs font-semibold text-amber-700">Servicios futuros</p>
    <div className="space-y-1">
      {c.futureItems.map(i => (
        <div key={i.id} className="flex justify-between text-xs text-gray-600">
          <span>{i.serviceName}</span>
          <span>{fmtDate(i.startTime)}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Corregir texto "Cita(s) sin pagar"**

El texto sigue siendo `{c.unpaidAppointments} cita(s) sin pagar`, pero como el valor ya viene corregido de la API, no requiere cambio en la UI más allá de confiar en el dato.

- [ ] **Step 6: Actualizar `loadBalances` para pasar `monthFilter`**

```tsx
const res = await fetch(`/api/balances?month=${encodeURIComponent(monthFilter)}`);
```

- [ ] **Step 7: Verificación visual**

Cargar `/dashboard/balances`, seleccionar un mes, confirmar que los servicios futuros aparecen separados, que el filtro por defecto es `Pendientes`, y que el texto de citas es coherente.

- [ ] **Step 8: Commit**

```bash
git add src/app/(admin)/dashboard/balances/BalancesContent.tsx
git commit -m "feat(balances): month filter, future items block, pending default"
```

---

### Task 3: Actualizar documentación (`AGENTS.md`, `CHANGELOG.md`)

**Files:**
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`

**Interfaces:** N/A.

- [ ] **Step 1: Agregar nota en `AGENTS.md`**

En la sección de `GET /api/balances`, agregar:

```
- `GET /api/balances` acepta `?month=YYYY-MM`. Filtra `servicePurchases` por `start_time <= fin_del_mes`.
- `futureItems` se calcula con `start_time > fin_del_mes`.
- `unpaidAppointments` usa `COUNT(DISTINCT appointmentId)` con `appointmentId IS NOT NULL`.
```

- [ ] **Step 2: Registrar en `CHANGELOG.md`**

Agregar línea en la parte superior (o sección de cambios recientes):

```
- Filtro por mes límite (`start_time`) y bloque de servicios futuros en `/dashboard/balances`. Corrección de `unpaidAppointments` con `DISTINCT`. Filtro por defecto `pending`.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md CHANGELOG.md docs/superpowers/specs/2026-10-31-balances-filter-future.md docs/superpowers/plans/2026-10-31-balances-filter-future.md
git commit -m "docs: spec and changelog for balances filter and future services"
```

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-10-31-balances-filter-future.md`.

**Options:**
1. Subagent-Driven (recommended) — dispatch per task.
2. Inline Execution — batch execution with checkpoints.

**Which approach?**
