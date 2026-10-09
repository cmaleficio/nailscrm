# Asignación de pagos a servicios (diseño) — 2026-10-08

**Estado: spec, NO implementado todavía.** Este documento reemplaza a
`2026-10-06-payment-allocation-per-service-design.md` (enfoque derivado sin
tabla). Aquí el reparto por servicio se **materializa** en una tabla explícita
que relaciona cada pago con los servicios que cubre.

## Contexto y defecto actual

`recomputeFinancialStatus(userId)` (`src/lib/financial-status.ts`) recalcula
`service_purchases.financial_status` comparando **el total pagado por la clienta**
contra **cada precio por separado**:

```ts
const totalPaid = sumClientPaid(userId);
for (const p of getOpenPurchases(userId)) {
  const status = computeFinancialStatus(totalPaid, p.servicePrice); // totalPaid >= price
}
```

Consecuencia: con 2 compras de $18 y 2 pagos de $18, las 4 compras quedan
`paid`. Evidencia sobre `dev.db`:

- **Fabiola Toussentt**: 4 compras de $18 ($72), 2 pagos de $18 ($36). Hoy: 3
  compras `paid`, 1 `pending`. Deberían ser 2 `paid` y 2 `pending`, con saldo
  $36.
- **Wanda Sanchez**: 2 compras de $12, 1 pago de $12. Hoy: ambas `paid`.
  Debería ser 1 `paid` y 1 `pending`, con saldo $12.

El saldo agregado (`/api/balances`, `/api/clients/[id]`, `/profile`) ya es
correcto (`Σ precios no-void − Σ pagos`), porque no depende de
`financial_status`. Lo que está mal es el **estado por servicio**, y además no
existe forma de responder "qué pago cubrió qué servicio".

## Objetivo

Introducir la relación explícita pago↔servicio en una tabla propia
(`payment_allocations`), materializar cuánto de cada pago se aplicó a cada
compra, y derivar `financial_status` de esa relación. El saldo agregado no
cambia.

## Comportamiento deseado

- Fabiola: 4×$18, pagó $36 → las 2 compras más antiguas `paid`, las 2 restantes
  `pending`; saldo $36 sin cambios.
- Wanda: 2×$12, pagó $12 → la más antigua `paid`, la otra `pending`; saldo $12.
- Servicio con varios pagos: $18 con dos pagos de $9 → tras el primero
  `partial` ($9), tras el segundo `paid`.
- Pago que cubre varios servicios: $30 contra 2×$18 → $18 a la primera
  (`paid`) y $12 a la segunda (`partial`).
- Pago mayor que toda la deuda → cubre todo lo que puede; el excedente queda
  como anticipo (sin allocation) a nivel de pago.

### Regla de reparto (FIFO determinista)

- Compras no-void ordenadas por `completion_date` (las completadas primero; las
  sin completar al final), desempate `created_at`, luego `id`.
- Pagos ordenados por `paid_at`, desempate `created_at`, luego `id` (mismo
  criterio que `allocatePayments` en `src/lib/payment-split.ts`).
- Se recorre cada pago y se aplica al servicio con deuda pendiente en ese orden
  hasta agotar el monto del pago o la deuda.
- **Afinidad por cita**: si el pago tiene `appointment_id`, sus compras de esa
  cita se consumen primero (dentro del mismo orden), y lo que sobre sigue el
  FIFO global. Motivo: el flujo "Completar cita" registra el pago ligado a la
  cita recién terminada y el admin espera que ese pago cubra esa cita. La
  afinidad **no cambia cuánto cubre cada pago** (`appliedUsd` depende solo de
  la deuda total, no de qué servicio se elige), solo a qué servicio se asigna.
- Tolerancia monetaria `PAYMENT_EPS = 0.004` (la misma de `payment-split`).
- `void` se salta siempre.

## Modelo de datos

### Tabla `payment_allocations`
- `id`: text, PK
- `payment_id`: text, FK → `payments.id` (on delete cascade)
- `purchase_id`: text, FK → `service_purchases.id` (on delete cascade)
- `amount_usd`: real, not null, > 0 (cuánto de ese pago se aplicó a esa compra)
- `created_at`: integer (unix seconds)
- unique index `(payment_id, purchase_id)`
- index `(purchase_id)`

Es la única fuente de verdad de "qué pago pagó qué servicio".
`service_purchases.financial_status` pasa a ser una columna derivada de ella.

### Invariantes
- `Σ payment_allocations.amount_usd` de las compras no-void de una clienta
  `= min(Σ pagos, Σ precios no-void)`.
- Para cada pago, `Σ amount_usd` de sus allocations `= appliedUsd` de
  `allocatePayments`; `creditUsd = amountUsd − appliedUsd`.
- Ninguna allocation apunta a una compra `void`.

## Arquitectura

### 1. Motor puro: `src/lib/payment-allocation.ts`
`allocateToPurchases(purchases, payments)` → `{ allocations, byPayment }`.
Funciones puras, sin BD, con tests. Ordena internamente y devuelve allocations
con `amountUsd > 0`. `byPayment` entrega `{ appliedUsd, creditUsd }` por pago.

Tipos:

```ts
export type AllocationPurchase = {
  id: string;
  priceUsd: number;
  completionDate: number | null;
  createdAt: number | null;
  appointmentId: string | null;
};

export type AllocationPayment = {
  id: string;
  amountUsd: number;
  paidAt: number | null;
  createdAt: number | null;
  appointmentId: string | null;
};

export type PurchaseAllocation = {
  paymentId: string;
  purchaseId: string;
  amountUsd: number;
};

export function allocateToPurchases(
  purchases: AllocationPurchase[],
  payments: AllocationPayment[]
): {
  allocations: PurchaseAllocation[];
  byPayment: Map<string, { appliedUsd: number; creditUsd: number }>;
};
```

### 2. Sincronización: `recomputeFinancialStatus(userId)` (se reescribe)
1. Carga compras no-void (`id`, `servicePrice`, `completionDate`, `createdAt`,
   `appointmentId`).
2. Carga pagos (`id`, `amountUsd`, `paidAt`, `createdAt`, `appointmentId`).
3. `allocateToPurchases(...)`.
4. En una transacción: borra las allocations de las compras de la clienta,
   inserta las nuevas y setea el `financial_status` de cada compra según
   `Σ allocations.amount_usd` (`statusFromAllocated`).
5. `applyPaidToClient(userId)` sin cambios.

`computeFinancialStatus(totalPaid, price)` deja de usarse para el cálculo real.
Se agrega `statusFromAllocated(allocatedUsd, priceUsd)` en
`src/lib/payment-allocation.ts` (puro, para que sus tests no carguen la BD).

Los call sites actuales (12 llamadas en 8 rutas) **no cambian**: siguen
llamando a `recomputeFinancialStatus(userId)`.

### 3. Migración
Nueva migración drizzle (`npm run db:generate` → `drizzle/0027_*.sql`) que crea
`payment_allocations`.

### 4. Backfill
`src/db/backfill-allocations.ts` (`npm run db:backfill:allocations`): recorre
los users con compras no-void o pagos y llama a `recomputeFinancialStatus`.
Idempotente. Es lo que corrige los datos existentes (Fabiola, Wanda).

### 5. API
- `GET /api/payments`: cada pago incluye
  `allocations: [{ purchaseId, serviceName, amountUsd }]`.
- Sin cambios en `POST/PATCH/DELETE` de pagos (recompute ya sincroniza).
- `POST /api/identity/claim` y `POST /api/admin/merge-clients`: llamar a
  `recomputeFinancialStatus(survivingId)` después del merge (las allocations
  sobreviven por id, pero los estados pueden quedar viejos).

### 6. UI (`BalancesContent`)
- Los badges `Pendiente/Abonado/Pagado` pasan a ser correctos automáticamente.
- En el historial de pagos de cada clienta, mostrar debajo del pago a qué
  servicios se aplicó ("Cubre: Acrílicas Full $18.00 · …") cuando existan
  allocations.

## Qué NO cambia
- `clientDueUsd`, `/api/balances`, `users.totalRevenue`, P&L base caja.
- `src/lib/payment-split.ts` (reparto anticipo/abono) y su API.
- Anticipos: siguen viviendo a nivel de pago; no hay saldo a favor por
  servicio.
- Selección manual de servicios por pago: fuera de esta fase (el reparto es
  automático FIFO).

## Tests
- `src/lib/payment-allocation.test.ts`: Fabiola, Wanda, pago multi-servicio,
  servicio multi-pago, pago > deuda, void, afinidad por cita, empates
  deterministas, redondeo, y `statusFromAllocated`.
- Invariante: `Σ allocations por pago === allocatePayments().appliedUsd` (test
  puro que cruza ambos módulos).
- Verificación sobre `dev.db` tras el backfill (Fabiola y Wanda).

## Riesgos
- Doble fuente de verdad (tabla + status derivado): mitigado porque
  `recomputeFinancialStatus` reconstruye la tabla desde
  `payments` + `purchases` en cada mutación (delete + insert). No hay edición
  manual de allocations en esta fase.
- Merge de clientes: las allocations referencian ids de compra/pago, que no
  cambian al mover `user_id`; aun así se recomputa el sobreviviente.

## Pendientes de decisión (fuera de esta fase)
- UI de selección/reasignación manual de servicios por pago.
- Mostrar el desglose de allocations en `/profile` del cliente.
