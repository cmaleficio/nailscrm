# Pestaña "Pagos cargados por admin" en Balances — Plan

> **Required sub-skill:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Añadir una pestaña en `/dashboard/balances` que liste todos los `payments` cargados por admin (`GET /api/payments` sin `userId`), con acciones editar/eliminar/ver servicio asociado.

**Architecture:** Se reutiliza `GET /api/payments` (ya devuelve reparto + allocations). Se modifica `BalancesContent` para una tercera pestaña que renderiza una tabla de pagos con edición (`EditPaymentDialog`), eliminación (`DELETE /api/payments/[id]`) y enlace al servicio cubierto (`allocations`).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind, Drizzle ORM, shadcn/ui (diálogos existentes).

## Global Constraints
- Permiso: `balances` (sin cambio).
- No crear nuevo endpoint de lectura; usar `GET /api/payments` existente.
- Reutilizar `EditPaymentDialog`, `ConfirmDialog` y `PhotoLightbox` existentes.
- El reparto (`appliedUsd`, `creditUsd`, `kind`, `allocations`) ya llega en la respuesta.

---

## File Map
- Modify: `src/app/(admin)/dashboard/balances/page.tsx` o componente `BalancesContent`
- Modify: `src/components/BalancesContent.tsx` (o el componente que renderiza las pestañas)
- Create: `docs/superpowers/plans/2026-10-31-balances-admin-payments-tab.md` (este archivo)

---

### Task 1: Añadir pestaña en BalancesContent

**Files:**
- Modify: `src/components/BalancesContent.tsx` (o componente equivalente en balances)

**Interfaces:**
- Consume: `GET /api/payments` (respuesta existente con `appliedUsd`, `creditUsd`, `kind`, `allocations`)
- Produce: Nueva pestaña renderizada con tabla de pagos admin

- [ ] **Step 1:** Leer archivo del componente balances para ver estructura de pestañas actuales.
- [ ] **Step 2:** Añadir pestaña "Pagos cargados por admin" que llame `GET /api/payments` (sin `userId`).
- [ ] **Step 3:** Renderizar tabla con columnas: cliente (`userId` resuelto), monto USD, moneda, fecha (`paidAt`), reparto (`kind`), acciones (Editar / Eliminar / Ver servicio).
- [ ] **Step 4:** Verificar que `EditPaymentDialog` recibe el pago y su contexto (`balance`, `clients`, `appointments`).
- [ ] **Step 5:** Verificar eliminación con `ConfirmDialog` y llamada a `DELETE /api/payments/[id]`.
- [ ] **Step 6:** Mostrar servicio asociado (de `allocations`) como enlace o etiqueta por fila.
- [ ] **Step 7:** Commit.

### Task 2: Actualizar documentación

- [ ] **Step 1:** Actualizar `AGENTS.md` y `CHANGELOG.md` con el cambio.
- [ ] **Step 2:** Commit.
