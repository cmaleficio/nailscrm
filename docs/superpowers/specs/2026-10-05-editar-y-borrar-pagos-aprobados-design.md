# Editar y borrar pagos ya aprobados

**Fecha:** 2026-10-05

## Contexto

Hoy `payments` es de solo append: se crea con `POST /api/payments` o al aprobar una captura
(`PATCH /api/payment-receipts/[id]`), y no existe **ningún** `PATCH` que lo corrija. No se puede
cambiar el monto, la tasa, la fecha ni la cita de un pago que ya está registrado. Si el admin
aprueba mal, la única salida es borrar y volver a registrar — y eso tampoco funciona.

### El defecto: borrar un pago con captura aprobada revienta

`payment_receipts.payment_id` referencia `payments.id` **sin `onDelete`**
(`src/db/schema.ts:367`), es decir `ON DELETE NO ACTION`, y la conexión tiene las FK prendidas
(`src/db/index.ts:8`, `sqlite.pragma("foreign_keys = ON")`). Por lo tanto:

```sql
DELETE FROM payments WHERE id = ?;  -- SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed
```

`DELETE /api/payments/[id]` (`src/app/api/payments/[id]/route.ts:20`) no captura la excepción, así
que el botón "Eliminar" de `/dashboard/balances` responde **500** para cualquier pago que venga de
una captura aprobada, y el pago se queda en pantalla (`BalancesContent.tsx:131-139` ignora
`res.ok`). Reproducido sobre una copia de `dev.db`: 9 capturas aprobadas, todas con `payment_id`, y
el `DELETE` falla en todas.

Esto no es un caso de borde. **Toda** aprobación de captura deja un pago indestructible, que es
justo el tipo de pago que más se quiere poder corregir.

### La falta de edición agrava dos cosas más

- `PATCH /api/payment-receipts/[id]` copia `amount_ves`, `rate` y `amount_usd` **verbatim** de la
  captura: al aprobar no hay forma de corregir una cifra mal reportada.
- Ese mismo handler sella `paidAt = now` (la hora de la aprobación), no la fecha en que la clienta
  pagó. Una captura reportada el 30 y aprobada el 2 del mes siguiente entra en el mes equivocado del
  P&L de `/dashboard/financials`, que agrupa por mes de `paid_at`.

## Decisiones tomadas

| Decisión | Valor | Por qué |
| --- | --- | --- |
| Alcance | **Todos** los pagos, no solo los que vienen de captura | Es el mismo endpoint y el mismo formulario; restringirlo sería una regla artificial |
| Captura vinculada | **Se deja intacta** al editar el pago | La captura es la evidencia de lo que la clienta reportó; el pago corregido es la verdad contable. Editar la captura destruiría el reclamo original |
| Campos editables | Monto en Bs, tasa, monto en USD, fecha del pago, cita vinculada | Lo pidió el usuario explícitamente. **No** se editan `reference`, `notes` ni `photo_url` |
| Permiso | `balances` | El mismo que ya protege `POST` y `DELETE` de pagos: quien puede registrar un pago puede corregirlo |
| Moneda | Inmutable | Cambiarla obligaría a tirar la procedencia (`amount_ves`/`rate`) o a inventarla. Se corrige el monto, no la moneda |
| Modelo de la mutación | `PATCH` in-place + diff en el log | Ver estrategias |

## Estrategias evaluadas para la mutación

### A) `PATCH` in-place + diff en `activity_logs` — **elegida**

Se actualiza la fila y se registra `before`/`after` en el log. Es exactamente lo que ya hace
`PATCH /api/purchases/[id]` con los snapshots de compra, y el log de actividad es el mecanismo de
auditoría que ya usa todo el proyecto (regla de `AGENTS.md`). Un solo `id`: `/api/balances`,
`users.total_revenue` y el P&L se mueven atómicamente con el mismo `recomputeFinancialStatus`.

### B) Anular + recrear el pago

Preserva la fila original como historia, pero `payments` no tiene estado `void` (habría que agregar
una migración), cambia el `id` —rompiendo cualquier referencia— y obliga a re-apuntar el
`payment_id` de la captura. El log de actividad ya da el historial. No vale la pena.

### C) Asiento de reversión (pago negativo)

Es lo correcto en contabilidad, pero `sum(payments.amount_usd)` es la base del saldo de CXC, de
`users.total_revenue` y del P&L de `/api/financials`. Habría que hacer que **todos** esos
consumidores filtren las reversas. Demasiado invasivo para el beneficio.

## API: `PATCH /api/payments/[id]`

Guarda `hasPermission(session, "balances")`, igual que `POST` y `DELETE`. Todos los campos son
opcionales; **el parche se aplica sobre la fila actual y se valida el resultado**, así que un parche
parcial nunca deja datos inconsistentes.

```jsonc
{
  "amountVes": 912.5,        // solo si currency === "VES"
  "rate": 36.5,              // solo si currency === "VES"
  "amountUsd": 25,           // override explícito
  "paidAt": 1759000000,      // solo si la fecha cambió
  "appointmentId": "uuid",   // ausente = no tocar · null = desvincular
}
```

Respuesta `200` con la fila actualizada completa. Errores: `401` sin permiso, `404` si el pago no
existe, `400` por montos/tasas no positivos o `paidAt` no finito, `400` si la cita no existe o no es
de la misma clienta (mismo criterio que `POST /api/payments/route.ts:63`).

### Precedencia del monto

Lo único con reglas no obvias. `amount_usd` es la fuente de verdad del saldo:

| Body | `amount_usd` resultante |
| --- | --- |
| trae `amountUsd` | **ese valor gana** (override explícito: "son $25 exactos aunque la tasa dé $24.66") |
| no, pero trae `amountVes` o `rate` (y es VES) | `round2(amountVes / rate)` |
| no | queda igual |

En un pago USD, mandar `amountVes` o `rate` se ignora y ambos quedan en `null`. Cualquier monto o
tasa `<= 0`, o no numérico, es `400`.

`paidAt` solo viaja si la fecha cambió, para que corregir el monto no aplane la hora de un pago
aprobado. El diálogo manda `dateToDayStartTs(fecha)`, igual que `RegisterPaymentDialog`.

`appointmentId` es tri-estado y se detecta con `"appointmentId" in body` (no con `!= null`):
ausente = no tocar, `null` = desvincular, string = vincular tras validar.

Después del `UPDATE`: un solo `recomputeFinancialStatus(payment.userId)` y un `logActivity` con
`entity: "payments"`, `action: "update"` y `metadata: { before, after }`. **No** se toca
`payment_receipts` para nada.

## API: `DELETE /api/payments/[id]` (fix)

El borrado tiene que funcionar, así que en vez de bloquearlo se **deshace la aprobación**:

1. `404` si el pago no existe.
2. Buscar las capturas con `payment_id = id` y `status = 'approved'` (en la práctica 0 o 1; el
   approve crea un pago nuevo cada vez, pero la query no lo asume).
3. En **una** `db.transaction`: restaurar esas capturas a `status = 'pending'` con `payment_id = null`
   (conservando `reviewed_by`, `reviewed_at` y `review_notes` como rastro del review anterior, que
   se sobrescriben si la captura se aprueba otra vez), y borrar el pago.
4. `recomputeFinancialStatus(payment.userId)`.
5. `logActivity` del borrado con `metadata` incluyendo los ids de las capturas devueltas a
   pendientes, más un `logActivity` por captura restaurada (`entity: "payment_receipts"`,
   `action: "update"`) para que quede claro en `/dashboard/activity` por qué una captura "Aprobada"
   volvió a "Pendiente".

Devolver la captura a `pending` y no dejarla `approved` es lo coherente: si el pago ya no existe, la
aprobación tampoco. La evidencia de la clienta (monto, tasa, foto) queda intacta y la captura vuelve
a la cola de revisión, donde se puede volver a aprobar.

## El helper puro: `src/lib/payment-edit.ts`

```ts
resolvePaymentAmount(current, patch)
  -> { ok: true;  value: { amountUsd, currency, amountVes, rate } }
  | { ok: false; error: string }
```

Función pura (sin `db`, sin fechas) que aplica la tabla de precedencia y valida. Vive aparte
porque es la parte con reglas y es la que hay que testear; el route handler solo lee la fila, llama
al helper y hace el `UPDATE`. El mismo `round2` de siempre.

`payment-edit.test.ts` (node, sin jsdom) cubre: override explícito de USD, recálculo por
`amountVes`, recálculo por `rate`, redondeo (`900 / 36.5 → 24.66`), montos en cero y negativos,
tasa en cero, parche vacío sin cambios, y que mandar `amountVes` en un pago USD se ignore y se
forcen los `null`.

## UI

### `src/components/EditPaymentDialog.tsx` (nuevo)

```ts
type Props = {
  payment: {
    id: string;
    amountUsd: number;
    currency: string;
    amountVes: number | null;
    rate: number | null;
    paidAt: number | null;
    appointmentId: string | null;
  };
  clientName: string;
  appointmentOptions: { appointmentId: string | null; label: string }[];
  onClose: () => void;
  onSaved: () => void; // recarga saldos + pagos + capturas
};
```

Campos: fecha del pago, monto en Bs, tasa, monto en US$ y cita vinculada.

- La tasa se auto-consulta a `/api/exchange-rate/by-date?date=` cuando cambia la fecha, con el
  fallback manual de `RegisterPaymentDialog` si no hay tasa BCV registrada.
- El monto en US$ se auto-calcula desde Bs/tasa y **es editable** (es el override).
- El `select` de cita se arma con los ítems de `/api/balances` (`serviceName` + fecha). Si el
  `appointmentId` actual del pago no está entre esas opciones, se antepone una opción
  "Cita vinculada actual" para no mentir en el select ni desvincular en silencio al guardar.
- Abajo, una línea en vivo con el saldo resultante:
  `nuevoSaldo = balanceUsd − (nuevoUsd − usdActual)`, para que bajar el monto y ver a la clienta
  volver a CXC sea obvio antes de guardar. Es información, no un bloqueo: pagar de más se permite.
- Errores del server en línea (mismo patrón que `RegisterPaymentDialog`), no `alert`.

### Puntos de entrada (los dos pedidos)

1. **Historial de pagos de la clienta** en `/dashboard/balances`: botón "Editar" junto al "Eliminar"
   de cada fila.
2. **Pestaña "Pagos recibidos"**: botón "Editar pago" en las capturas con estado Aprobada, más una
   línea de divergencia — *"reportó 900 Bs ≈ $26.44 → acreditado $25.00"* — que es la promesa de la
   decisión "la captura se deja intacta": el admin ve que el pago fue corregido.

### Cambios de soporte

- `GET /api/balances`: agregar `appointmentId` a la proyección de `items` (1 línea), que es de
  donde el diálogo saca las opciones de cita.
- `GET /api/payment-receipts`: `leftJoin(payments)` y seleccionar `paymentAmountUsd`,
  `paymentAmountVes`, `paymentRate`, `paymentPaidAt` y `paymentAppointmentId` — con esto el diálogo
  de la pestaña "Pagos recibidos" se abre con el pago ya cargado, sin un fetch extra. La clienta
  también los recibe, pero son sus propios pagos y el portal no los renderiza.
- `BalancesContent`: `type Payment` gana `appointmentId: string | null` y `reference` pasa a
  `string | null` (la API puede devolver `null` desde la migración `0015` y el tipo miente);
  `deletePayment` pasa a revisar `res.ok` y avisar el error, y el `confirm` menciona que una captura
  aprobada volverá a pendientes.

## Fuera de alcance (decidido)

- **`updated_at` / `updated_by` en `payments`.** El `activity_logs` ya guarda quién y cuándo cambió
  cada pago; agregar columnas sería una migración sin valor real acá.
- **Overrides en el aprobar.** Con `PATCH` el admin corrige después de aprobar; no hace falta meter
  overrides en `PATCH /api/payment-receipts/[id]`.
- **Editar `reference`, `notes` o `photo_url`.** No pedidos. (`reference` sigue siendo el
  autogenerado `Captura aprobada xxxxxxxx` en los pagos de captura; el motivo del ajuste queda en el
  log de actividad.)
- **Botón de editar en el panel CRM.** El usuario pidió dos puntos de entrada, no tres.
- **Cambiar de moneda.** No.

## Invariantes de regresión

> **Editar un pago nunca toca `payment_receipts`.** La captura es la evidencia de lo que la clienta
> reportó; el pago es la verdad contable. Si divergen, la UI muestra la divergencia.
>
> **Borrar un pago nunca deja una captura aprobada apuntando a una fila que no existe.** O bien se
> devuelve la captura a `pending`, o bien el borrado falla — pero no puede quedar el estado
> intermedio.

Anclar el primero con un test de fuente (el repo ya tiene esa técnica en
`src/lib/appointment-fanout.test.ts` y `src/lib/api-authz-audit.test.ts`): el `PATCH` de
`src/app/api/payments/[id]/route.ts` no debe mencionar `schema.paymentReceipts`, y el `DELETE` solo
lo puede escribir con `status: "pending"` y `paymentId: null`. El segundo queda cubierto por el
`DELETE` transaccional (si la restauración de la captura fallara, el pago tampoco se borraría) y por
el `DELETE` de la propia captura.

`src/lib/api-authz-audit.test.ts` ya incluye `payments` y `paymentReceipts` en
`ADMIN_ONLY_TABLES`, así que el `PATCH` queda cubierto por la guarda de permisos sin tocarlo.

## Docs y verificación

- `AGENTS.md`: la API nueva en la lista de `payments`/`payment-receipts` + la regla de la captura
  intacta y la del borrado que deshace la aprobación.
- `CHANGELOG.md` y `README.md`: mismo commit (regla del proyecto).
- `npm run lint`, `npx tsc --noEmit`, `npx vitest run`.
- Manual: aprobar una captura mal, corregirla desde la pestaña "Pagos recibidos", verificar que el
  saldo de CXC y el P&L se mueven, que la captura sigue "Aprobada" con su monto original, que el
  log de actividad tiene el diff, y que borrar el pago devuelve la captura a "Pendientes" sin 500.
