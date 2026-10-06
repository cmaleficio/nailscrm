# Estado financiero por servicio (diseño) — 2026-10-06

**Estado: spec, NO implementado todavía.** Este documento es la especificación
de la fase C: repartir el estado financiero (`financial_status: pending | partial | paid`)
por servicio en lugar de contra la bolsa global de pagos de la clienta.

## Contexto y defecto actual

`src/lib/financial-status.ts` recalcula `service_purchases.financial_status` con
**una sola cifra**: el total pagado por la clienta contra **cada** precio por
separado (`computeFinancialStatus(totalPaid, price)`):

```ts
if (totalPaid >= price - 0.004) return "paid";
if (totalPaid > 0.004) return "partial";
return "pending";
```

No existe el concepto de "este servicio ya está pagado y este otro todavía no".
Un pago de $17 contra dos servicios de $10 (Karen Chinchilla) marca **ambos**
como "Pagado": los `complementary` de la cita se muestran al admin como pagados
cuando en realidad **falta $3**.

Del reparto derivado de pagos (fase B, `src/lib/payment-split.ts`) ya salen los
montos `appliedUsd` por pago en orden cronológico, pero `financial_status` **no
los usa**: sigue siendo la bolsa global.

## Comportamiento deseado

- Karen Chinchilla: 2×$10, pagó $17 → el servicio más antiguo consumido queda
  `paid` y el segundo queda `partial` (falta $3). El saldo total de la clienta
  **no cambia** (sigue debiendo $3).
- Fabiola Toussentt: 2×$18, pagó $18 → un servicio `paid`, el otro `pending`.
- Valentina: 2×$10 pagados contra 1×$10 → el pagado queda `paid`, el pendiente
  `pending` (hoy, con `totalPaid >= price`, ambos quedan `paid`).

### Orden de consumo

Los pagos se aplican al servicio **más antiguo primero** (mismo criterio
cronológico de `allocatePayments`). Con `completionDate` disponible se ordena
por `completion_date` y luego `created_at`; yarn fuera: `appointment_id IS NULL`
es "servicio realizado" con `created_at`.

### Reglas

- `void` se respeta tal cual (se salta).
- La suma de los precios de servicios no-void es exactamente `clientDueUsd()`
  (ya unificado en `src/lib/payment-split-db.ts`), así que el reparto por
  servicio **siempre suma exactamente** lo repartido por pago: no hay estado
  nuevo "anticipo/saldo a favor" a nivel de servicio (los anticipos siguen
  viviendo solo a nivel de pagos/saldo).
- Tolerancia `0.004` (la misma de la fase B).
- `recomputeFinancialStatus(userId)` se ejecuta en **todo** lugar donde cambian
  pagos, compras o inscripciones (ver abajo).

## Qué NO cambia

- **Saldo a favor / anticipo**: sigue siendo derivado (fase B), no tiene columna.
- **`users.total_revenue`**: sigue siendo `Σ payments.amount_usd` (`applyPaidToClient`),
  no depende del reparto por servicio.
- **P&L / `src/lib/financials.ts`**: los ingresos del mes son base de caja
  (pagos `paid_at`), no dependen de `financial_status`.
- **Muro / archivo de producción / agenda**: no leen `financial_status` de compra.
- El badge "Pendiente/Abonado/Pagado" de la pestaña de cuentas por cobrar pasa a
  ser correcto por fila (efecto visible del fix).

## Impacto en la BD

Ninguno: es una **recomputación de una columna existente**, sin migración.

### Backfill

Script `npm run db:recompute:status` (estilo `scripts/` existente) que recorre
todos los `users` con compras no-void y llama a `recomputeFinancialStatus(userId)`,
por si servicios quedaron con estados heredados del defecto. Idempotente.

## Implementación

`src/lib/financial-status.ts`:

1. `computeFinancialStatus` queda como está (función pura de un servicio).
2. `recomputeFinancialStatus(userId)`:
   - `totalPaid = sumClientPaid(userId)` (ya existe).
   - `purchases = getOpenPurchases(userId)` ordenadas por `completionDate`,
     `createdAt` (añadir columnas al `select`).
   - Recorrer con un contador `remaining = totalPaid`; por servicio:
     `applied = min(price, remaining)`; `status = applied >= price - 0.004 ? "paid" : (applied > 0.004 ? "partial" : "pending")`;
     `remaining -= applied`.
   - Si el estado cambió, `setPurchaseFinancialStatus`.
3. `applyPaidToClient` no se toca.

### Sitios que llaman a `recomputeFinancialStatus` (11, auditados)

- `src/app/api/payments/route.ts` (POST)
- `src/app/api/payments/[id]/route.ts` (PATCH y DELETE)
- `src/app/api/payment-receipts/[id]/route.ts` (aprobación de captura)
- `src/app/api/appointments/[id]/route.ts` (completar y cancelar)
- `src/app/api/appointments/[id]/services/route.ts` (quitar servicio)
- `src/app/api/purchases/route.ts` (servicio ya realizado)
- `src/app/api/purchases/[id]/route.ts` (borrar servicio realizado)
- `src/app/api/course-sessions/[id]/enrollments/route.ts` (inscribir/desinscribir)

`GET /api/balances` y `GET /api/clients/[id]` solo leen; no recalculan.

## Tests

- Unit en `src/lib/financial-status.test.ts` (nuevo): casos Karen/Fabiola/Valentina,
  orden de consumo, void ignorado, redondeo, sin pagos.
- Test de invariante: `Σ precios(no void) === Σ appliedUsd(pagos)` para datos
  de `dev.db` (script de verificación, no se commitea).

## Pendiente de decisión

- ¿El estado por servicio debe reflejar también los **anticipos**? Este diseño
  dice NO (anticipo solo vive a nivel de pago). Si más adelante se quiere
  "saldo a favor" visible por servicio, es trabajo aparte.
- `financial_status: partial` en una cita con complementarios: el desglose de
  cuentas ya muestra cada compra por separado, así que no se agrega UI nueva
  en esta fase; la corrección se nota sola en los badges.