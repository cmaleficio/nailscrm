# Cuentas por Cobrar - Tabla de Movimientos Cronológicos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la vista de `/dashboard/balances` (tarjetas por cliente con detalle oculto) por una tabla cronológica combinada que muestre servicios, pagos y abonos con `tipo movimiento` (`Servicio`, `pago`, `abono`), ordenable y filtrable.

**Architecture:** Un solo endpoint `/api/balances` devuelve movimientos combinados (`service_purchases` + `payments` + `payment_allocations`) agrupados por cliente y ordenados por fecha descendente. El componente `BalancesContent.tsx` renderiza una tabla HTML (`table`) en vez de tarjetas (`div` por cliente), preservando los diálogos existentes (`RegisterPaymentDialog`, `EditPaymentDialog`, `AddServiceDialog`).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Drizzle ORM (SQLite), shadcn/ui patterns.

---

## Global Constraints

- El esquema existente NO se modifica: `service_purchases`, `payments`, `payment_allocations` y `users` se leen tal cual.
- La definición de deuda es `clientDueUsd()` (`sum(service_price)` de `service_purchases` con `financial_status != 'void'`), consistente con `/api/balances`, `/api/payments` y `GET /api/clients/[id]`.
- El orden de clientes es: deudores (mayor `balanceUsd`) → al día (`|balance| <= 0.004`) → saldo a favor (`creditUsd` desc).
- Dentro de cada cliente los movimientos van ordenados por fecha descendente (más reciente primero).
- `kind` es presentado al usuario: `Servicio` (cargo por servicio), `pago` (crédito completo), `abono` (crédito parcial). Se deriva de `allocatePayments` / `payment_allocations` para pagos, y de `service_purchases.financial_status` para servicios.
- La paleta de colores es rosa pastel (#FFE5EC, #FFC2D1) + blanco + gris suave (#F5F5F5). Bordes redondeados, sombras suaves.
- No se altera `AGENTS.md` ni `CHANGELOG.md` ni `README.md` en esta tarea (solo se modifica la vista de balances; que sea notado en CHANGELOG como "Mejora de visualización de cuentas por cobrar").

---

## File Structure

- `src/app/api/balances/route.ts` — ya modificado para devolver `{ clients: [{ movements: [...] }] }`; se completa y corrige si hay errores de tipo / compilación.
- `src/app/(admin)/dashboard/balances/BalancesContent.tsx` — reemplazar el render de tarjetas por tabla; preservar diálogos, filtros, búsqueda y eventos.
- `src/lib/payment-split.ts` (lectura, no modificación) — usado para derivar `kind` (`abono`/`completo`) y reparto.
- `src/lib/appointment-purchases.ts` (lectura) — confirma que `service_purchases` requiere `id` y `serviceDurationMins`; el endpoint debe incluir `serviceDurationMins` si luego se requiere, aunque la vista de tabla no lo muestra.

---

## Task 1: Completar y validar el endpoint `/api/balances`

**Files:**
- Modify: `src/app/api/balances/route.ts`

**Interfaces:**
- Consumes: `db` (`better-sqlite3` vía Drizzle), `auth()`, `hasPermission(session, "balances")`
- Produces: `NextResponse.json({ totalUsd: number, totalCreditUsd: number, clients: Array<{clientId, name, phone, dueUsd, paidUsd, balanceUsd, creditUsd, movements: Array<Movement>} })`

- [ ] **Step 1:** Revisar que el archivo actual (`route.ts`) compile sin errores (`npx tsc --noEmit`). Corregir cualquier referencia rotas a `round2` o tipos faltantes (`Movement`).
- [ ] **Step 2:** Confirmar que `Movements` incluyen `serviceName`, `date`, `amountUsd`, `currency`, `rate`, `status`, `ref`, `kind`, `notes`. Si falta `serviceDurationMins` en `service_purchases`, agregar la selección para que `PurchaseSummaryRow` siga funcionando si se usa en otro lugar (no necesario para la tabla, pero no romper).
- [ ] **Step 3:** Ejecutar `npm run dev:default` (o `npm run dev`), hacer `GET /api/balances` con usuario admin y validar que `clients` tiene `movements` con datos reales (servicios y pagos de los datos demo `clienta@email.com`).
- [ ] **Step 4:** Commit: `feat(api): balances endpoint returns combined movements by client`

---

## Task 2: Reemplazar render por tabla cronológica en `BalancesContent`

**Files:**
- Modify: `src/app/(admin)/dashboard/balances/BalancesContent.tsx`

**Interfaces:**
- Consume: `loadBalances` (fetched `/api/balances`), `clients` con `.movements`
- Produce: componente React con `<table>` que muestra todas las filas de `movements` de todos los clientes, agrupadas visualmente por cliente con encabezado sticky/fijo o separado.

- [ ] **Step 1 (escribir el test de vista):** En `BalancesContent.tsx`, agregar un `console.log` temporal que imprima `clients.length` y `clients[0]?.movements?.length`; correr `npm run dev`, abrir `/dashboard/balances`, confirmar que llega >0 movimientos.

- [ ] **Step 2 (tabla base):** Reemplazar el bloque `searchedClients.map(...)` (líneas 378-519) por una estructura de tabla. Ejemplo de estructura a escribir (no placeholder):

```tsx
<div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
  <table className="w-full text-sm">
    <thead className="bg-pink-50 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
      <tr>
        <th className="px-3 py-2">#Servicio</th>
        <th className="px-3 py-2">Fecha</th>
        <th className="px-3 py-2">Cliente</th>
        <th className="px-3 py-2">Servicio / Concepto</th>
        <th className="px-3 py-2">Monto</th>
        <th className="px-3 py-2">Tasa</th>
        <th className="px-3 py-2">Monto USD</th>
        <th className="px-3 py-2">Estado</th>
        <th className="px-3 py-2">Ref</th>
        <th className="px-3 py-2">Contacto</th>
        <th className="px-3 py-2">Tipo movimiento</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {searchedClients.flatMap(c => c.movements.map(m => (
        <tr key={`${c.clientId}-${m.id}`} className="hover:bg-pink-50/40">
          <td className="px-3 py-2 text-xs text-gray-500">{m.id.slice(0,8)}</td>
          <td className="px-3 py-2">{m.date}</td>
          <td className="px-3 py-2 font-medium">{c.name}</td>
          <td className="px-3 py-2 truncate max-w-xs">{m.serviceName ?? "—"}</td>
          <td className="px-3 py-2">{m.currency === "VES" ? `${m.amountVes?.toFixed(2) ?? "—"} Bs` : `$${m.amountUsd.toFixed(2)}`}</td>
          <td className="px-3 py-2">{m.rate ? m.rate.toFixed(2) : "—"}</td>
          <td className="px-3 py-2">${m.amountUsd.toFixed(2)}</td>
          <td className="px-3 py-2"><span className={statusBadgeClass(m.status)}>{statusLabel(m.status)}</span></td>
          <td className="px-3 py-2 text-xs">{m.ref ? m.ref.slice(0,8) : "—"}</td>
          <td className="px-3 py-2 text-xs">{c.phone ?? "—"}</td>
          <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.kind === "Servicio" ? "bg-pink-100 text-pink-700" : m.kind === "abono" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{m.kind ?? "—"}</span></td>
        </tr>
      )))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 3:** Ajustar los filtros de búsqueda (`searchTerm`) y filtro por estado (`statusFilter`) para que operen sobre `movements` (no sobre `items` de cliente). El filtro de estado debe comparar `m.status`; la búsqueda debe comparar `c.name`, `c.phone`, `m.serviceName`.
- [ ] **Step 4:** Preservar los botones de acción (`Registrar pago`, `Servicio realizado`) ahora accesibles por fila o por cliente. Como es una tabla plana, se recomienda agregar un botón en la columna derecha de cada fila (o un menú contextual) que abra `RegisterPaymentDialog` con `clientId = c.clientId`. El `EditPaymentDialog` debe seguir funcionando para filas de tipo `payment`; el `AddServiceDialog` para cualquier cliente.
- [ ] **Step 5:** Probar con datos demo (`clienta@email.com`): verificar que aparecen filas de servicio (`Servicio`) y filas de pago (`pago` / `abono`) ordenadas por fecha descendente.
- [ ] **Step 6:** Commit: `feat(ui): balances table with combined movements`

---

## Task 3: Ajustar filtros y eventos de actualización

**Files:**
- Modify: `src/app/(admin)/dashboard/balances/BalancesContent.tsx` (líneas de eventos, filtros)

- [ ] **Step 1:** Asegurar que `loadBalances` sigue llamándose tras guardar un pago (`onSaved` de `RegisterPaymentDialog`) y tras eliminar/editar un pago (`onSaved` de `EditPaymentDialog`) y tras agregar servicio (`AddServiceDialog`).
- [ ] **Step 2:** Actualizar el filtro `statusFilter` para que funcione sobre `m.status` (`pending` | `partial` | `paid`). No debe filtrar `items` del cliente, sino `movements`.
- [ ] **Step 3:** Actualizar `searchTerm` para que compare `normalize(c.name)`, `normalize(c.phone)`, `normalize(m.serviceName ?? "")` sobre `movements`.
- [ ] **Step 4:** Verificar que los eventos `balances:refresh` siguen funcionando y que `expanded` y `payments` del estado anterior no rompen la renderización de la tabla (eliminar referencias a `expanded` si ya no se usan, o conservarlas solo si se requiere un modo de detalle opcional).
- [ ] **Step 5:** Commit: `fix(balances): filters and refresh events for table view`

---

## Verification Checklist (antes de declarar completo)

- [ ] `GET /api/balances` devuelve `clients` con `movements` que incluyen `serviceName`, `date`, `amountUsd`, `kind`.
- [ ] `/dashboard/balances` muestra una tabla con encabezados `#Servicio | Fecha | Cliente | Servicio | Monto | Tasa | Monto USD | Estado | Ref | Contacto | Tipo movimiento`.
- [ ] Se pueden ordenar/filter por fecha (implícito por orden cronológico en el endpoint), por cliente (grupo visual), por servicio (texto) y por estado (`pending`/`partial`/`paid`).
- [ ] Los diálogos (`Registrar pago`, `Servicio realizado`, `Editar pago`, `Eliminar pago`) siguen funcionando sin errores de tipado.
- [ ] No hay `leftJoin` en `service_purchases` en la nueva consulta de movimientos (evita fan-out, consistente con `appointment-fanout.test.ts`).
- [ ] El archivo `CHANGELOG.md` tiene una línea: "Mejora de visualización de cuentas por cobrar: tabla cronológica combinada de servicios, pagos y abonos".
- [ ] `AGENTS.md` no requiere cambio (la estructura de datos y reglas no se alteraron; solo la vista).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-26-balances-tabla-movimientos.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch fresh subagent per task (Task 1: endpoint validation, Task 2: table render, Task 3: filters/events), review between tasks.

**2. Inline Execution** - Execute tasks in this session using `executing-plans` skill.

Which approach? (Recomendado: subagent para Task 1 y Task 2 de forma independiente, luego review en este hilo.)
