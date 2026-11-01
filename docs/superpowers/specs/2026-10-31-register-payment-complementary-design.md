# Diseño: Vinculación de pagos a servicios (principal + complementarios) y selección múltiple

Fecha: 2026-10-31
Estado: Propuesta (pendiente revisión usuario)
Ruta spec: `docs/superpowers/specs/2026-10-31-register-payment-complementary-design.md`

## 1. Contexto

- `RegisterPaymentDialog` (actual, commit `d013001`) permite asociar un pago a una **única cita** (`payments.appointment_id`) mediante un `<select>`.
- El selector se construye a partir de `service_purchases` (`items` de `/api/balances`) y excluye citas que ya tienen pagos vinculados (`/api/payments`).
- `services` tiene los flags `is_group` e `is_complementary`. Una cita puede tener:
  - 1 servicio principal (`is_complementary = 0`, `is_group = 0`).
  - 1 servicio grupal (`is_group = 1`).
  - 1 o más servicios complementarios (`is_complementary = 1`), que se suman a otra cita (duración + precio).

## 2. Problema

- El selector actual muestra solo la cita como bloque (`appointmentId` único). No expone los servicios internos (principal vs complementarios) ni permite elegir cuáles cubre el pago.
- El usuario reporta que "no permite asociar los servicios complementarios" y que es necesaria "la capacidad de poder vincular un pago a varios servicios".
- El pago debe poder cubrir la cita completa (principal + complementarios) o, cuando sea necesario, cubrir servicios específicos de la cita (ej. abono al gel complementario sin cubrir el acrílico principal), siempre que el monto sea suficiente.

## 3. Objetivos

1. El selector debe listar **todas las compras (`service_purchases`)** vinculadas a la clienta, incluyendo las de servicios complementarios (`is_complementary = 1`).
2. El usuario debe poder elegir **uno o varios servicios/compras** dentro de una cita, no solo la cita entera.
3. El sistema debe registrar qué compras cubre cada pago (`covered_purchase_ids`), para que `recomputeFinancialStatus` y `allocateToPurchases` reflejen correctamente el reparto.
4. El cambio debe ser compatible con la definición de deuda existente (`clientDueUsd` en `src/lib/payment-split-db.ts`): `Σ service_price` de compras `financial_status != 'void'`.

## 4. Enfoque recomendado (Enfoque C — Híbrido)

Combina la selección de cita con la sub-selección de servicios internos:

- **UI:** Un paso de dos niveles:
  1. Selector de cita (`appointment_id`) — igual que hoy, pero incluyendo citas con servicios complementarios (el filtro actual que excluye por `appointmentId` ya funciona; el cambio es que `items` debe incluir compras de complementarios).
  2. Lista de checkboxes con los `service_purchase` internos de esa cita (principal + complementarios). El usuario marca cuáles cubre este pago.
- **Datos:** Nueva tabla `payment_covered_purchases` (1:N, `payment_id` → `purchase_id`, con `amount_usd` parcial opcional). Alternativa más ligera: columna `covered_purchase_ids` (JSON array de strings) en `payments`, ya que el reparto (`allocateToPurchases`) ya resuelve cuánto cubre cada pago por orden FIFO. Si el pago cubre todos, se guarda el array completo; si cubre parcial, se guarda solo los cubiertos.

### Decisión: usar columna JSON `covered_purchase_ids` en `payments`

Razón: evita una nueva migración de tabla y mantiene la fuente de verdad del reparto (`payment_allocations`) intacta. `payment_allocations` sigue siendo la relación materializada pago↔compra. La columna `covered_purchase_ids` es una **selección explícita** del usuario (qué servicios cubre el pago), no un cálculo derivado.

Si el usuario no marca ninguno, el comportamiento es igual al actual (`appointment_id` solo, cubre todos los servicios de la cita por el reparto FIFO existente).

## 5. Diseño de datos

### 5.1 Schema existente (referencia)

```
service_purchases:
- id (PK)
- user_id (FK users)
- appointment_id (FK appointments, nullable)
- service_id (FK services)
- service_name
- service_price
- is_primary (bool: 1=principal, 0=complementario)
- financial_status (pending | partial | paid | void)

payments:
- id (PK)
- user_id (FK users)
- appointment_id (FK appointments, nullable)
- amount_usd
- ... (ver AGENTS.md)
```

### 5.2 Cambio propuesto

**Opción A (recomendada): columna JSON en `payments`**

```sql
ALTER TABLE payments ADD COLUMN covered_purchase_ids TEXT DEFAULT NULL;
```
- Tipo: `TEXT` (JSON array de strings, ej. `["sp_001", "sp_002"]`).
- `NULL` = comportamiento legado (el reparto FIFO cubre automáticamente los servicios de `appointment_id`).
- Array vacío `[]` = pago sin servicios vinculados (solo crédito general).
- Array con IDs = los servicios que el usuario seleccionó explícitamente.

**Nota:** Esta columna es una **declaración de intención** del usuario. El reparto real (`allocateToPurchases`) sigue operando sobre `amount_usd` y los precios de las compras no-void, sin importar esta columna. La columna sirve para:
- Mostrar en la UI qué servicios cubre cada pago (historial de pagos en `BalancesContent` y `ProfileContent`).
- Filtrar el selector en `RegisterPaymentDialog`: excluir compras que ya estén cubiertas (`paid` o `partial`) si el usuario quiere evitar duplicados, aunque hoy el filtro solo excluye por cita completa.

### 5.3 Migración (si se elige esta opción)

Archivo: `drizzle/XXXX_payment_covered_purchase_ids.sql`

```sql
ALTER TABLE payments ADD COLUMN covered_purchase_ids TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS payments_covered_purchase_ids_idx ON payments(covered_purchase_ids);
```

Nota: SQLite no tiene tipo `JSON` nativo; se usa `TEXT` con validación en la aplicación.

## 6. Diseño de API

### 6.1 `POST /api/payments`

Body existente + campo opcional:

```typescript
{
  userId: string,
  appointmentId: string | null,
  coveredPurchaseIds?: string[] | null,  // NUEVO
  amountVes: number,
  rate: number,
  reference?: string,
  paidAt: number,
  notes?: string,
  photoUrl?: string,
}
```

Validación en el endpoint:
- Si `coveredPurchaseIds` está presente, debe ser un array de strings.
- Cada `purchase_id` debe pertenecer al `user_id` del pago y debe tener `financial_status != 'void'`.
- Si `coveredPurchaseIds` es un array vacío (`[]`), `appointmentId` debe ser `null` (pago sin servicios vinculados).
- Si `appointmentId` es `null` y `coveredPurchaseIds` es `null`, comportamiento legado (pago general, sin servicios específicos).

### 6.2 `GET /api/payments?userId=...`

Respuesta existente + campo `coveredPurchaseIds` en cada fila:

```typescript
{
  payments: [{
    id: string,
    userId: string,
    appointmentId: string | null,
    coveredPurchaseIds: string[] | null,
    amountUsd: number,
    ...
  }],
  allocations: [...]
}
```

### 6.3 `GET /api/payments` (historial en balances)

No requiere cambio (el campo `coveredPurchaseIds` se devuelve automáticamente si está en la fila).

## 7. Diseño de UI (`RegisterPaymentDialog`)

### 7.1 Estado actual (post-fix `d013001`)

- `appointmentId`: string (única cita).
- `appointments`: `{ id: string; label: string }[]` (filtrado por `/api/payments`).

### 7.2 Cambio propuesto

**Estado:**

```typescript
const [appointmentId, setAppointmentId] = useState("");
// Lista de compras disponibles para esta cita (incluye complementarios)
const [purchaseOptions, setPurchaseOptions] = useState<{ id: string; label: string; isPrimary: boolean }[]>([]);
// IDs seleccionados por el usuario
const [coveredPurchaseIds, setCoveredPurchaseIds] = useState<string[]>([]);
```

**Flujo:**

1. Al cargar (`useEffect` con `[clientId]`):
   - Cargar `/api/balances`.
   - Encontrar la fila del cliente.
   - De `row.items`, construir `appointments` (como hoy) **sin excluir complementarios**. El filtro actual (`unlinked`) ya incluye todo; no hay filtro por `is_primary`. Esto confirma que los complementarios ya deberían aparecer si están en `service_purchases`. Si no aparecen, el bug está en cómo `items` se construye en `/api/balances` (quizás `summarizePurchases` solo trae `is_primary`).

2. Al seleccionar una cita (`appointmentId` cambia):
   - Hacer `fetch("/api/purchases?")` o usar los datos locales de `/api/balances` para obtener los `service_purchase` internos de esa cita.
   - Llenar `purchaseOptions` con `{ id: purchase.id, label: purchase.serviceName + (purchase.isPrimary ? " (principal)" : " (complementario)"), isPrimary: purchase.isPrimary }`.
   - Reiniciar `coveredPurchaseIds` a todos los IDs (por defecto, el pago cubre todos los servicios de la cita) o a `[]` (según preferencia del usuario; recomendamos `[...todos los ids]` para mantener compatibilidad con comportamiento actual).

3. UI del formulario (después del selector de cita):

```tsx
{purchaseOptions.length > 0 && (
  <div className="mt-3 rounded-xl border border-gray-200 p-3">
    <p className="mb-2 text-xs font-medium text-gray-600">Servicios cubiertos por este pago</p>
    <div className="space-y-1">
      {purchaseOptions.map((p) => (
        <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={coveredPurchaseIds.includes(p.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setCoveredPurchaseIds([...coveredPurchaseIds, p.id]);
              } else {
                setCoveredPurchaseIds(coveredPurchaseIds.filter((id) => id !== p.id));
              }
            }}
          />
          <span className="font-medium">{p.label}</span>
          <span className="ml-auto text-xs text-gray-400">
            {p.isPrimary ? "Principal" : "Complementario"}
          </span>
        </label>
      ))}
    </div>
  </div>
)}
```

4. En `submit()`:

```typescript
const body: Record<string, unknown> = {
  userId: clientId,
  appointmentId: appointmentId || null,
  coveredPurchaseIds: coveredPurchaseIds.length > 0 ? coveredPurchaseIds : null,
  // ... resto
};
```

**Nota:** Si `coveredPurchaseIds` es `null`, el endpoint debe interpretar que no hay restricción de servicios (comportamiento legado). Esto mantiene la compatibilidad hacia atrás con los pagos registrados antes de esta migración.

## 8. Diseño del reparto (`allocateToPurchases`)

No cambia la lógica matemática (`FIFO` por `completion_date` y luego por `id`). El cambio es que `recomputeFinancialStatus` debe considerar `payments.covered_purchase_ids` como una **restricción de cobertura** opcional:

- Si `covered_purchase_ids` es `null` o vacío: el pago cubre los servicios según el reparto FIFO existente (como hoy).
- Si `covered_purchase_ids` es un array: el pago solo cubre los servicios en esa lista. El reparto debe limitarse a esos `purchase_id` (el pago no puede asignarse a servicios fuera de la lista).

Esto implica que `allocateToPurchases` debe recibir opcionalmente `coveredIds?: string[]` y filtrar el conjunto de compras disponibles antes de hacer el reparto.

## 9. Diseño de la UI existente afectada

### `BalancesContent.tsx`

- El desglose por ítem (`row.items`) debe seguir funcionando. No requiere cambio (el reparto sigue funcionando igual).
- El historial de pagos de cada clienta debe mostrar `coveredPurchaseIds` si existe (para que el usuario entienda qué servicios cubrió el pago).

### `ProfileContent.tsx`

- La sección "Mis pagos" debe reflejar `coveredPurchaseIds` (mostrar los servicios cubiertos por cada pago).

### `ClientCRMPanel.tsx`

- El bloque "Servicio adquirido" (que hoy muestra `summarizePurchases`) ya lista los servicios de la cita. El cambio en `RegisterPaymentDialog` no lo afecta directamente, salvo que el usuario quiera ver los pagos vinculados a cada servicio.

## 10. Diseño de pruebas

- **Unit tests (`src/lib/payment-allocation.ts`):** Agregar casos donde `coveredIds` limita el reparto. Confirmar que el reparto FIFO no asigna a compras fuera de `coveredIds`.
- **Unit tests (`RegisterPaymentDialog`):** Verificar que al seleccionar una cita, `purchaseOptions` incluye los servicios complementarios y que `coveredPurchaseIds` se envía correctamente en `submit()`.
- **Integration (`/api/payments`):** Verificar que `POST` con `coveredPurchaseIds` guarda la columna correctamente y que `GET` la devuelve.
- **Backfill (`npm run db:backfill:allocations`):** Si se migra `payments`, el backfill debe ignorar `coveredPurchaseIds` (tratarlos como `null`) para que el reparto existente no se rompa.

## 11. Plan de implementación (referencia)

Ver `docs/superpowers/plans/` para el plan detallado paso a paso. Este spec cubre el diseño; la ejecución se divide en tareas:

1. Migración de BD (`drizzle/` SQL) — columna `covered_purchase_ids`.
2. Actualizar `POST /api/payments` y `GET /api/payments`.
3. Actualizar `RegisterPaymentDialog` (selector + checkboxes + `submit`).
4. Actualizar `BalancesContent` y `ProfileContent` para mostrar `coveredPurchaseIds`.
5. Actualizar `recomputeFinancialStatus` y `allocateToPurchases` para respetar `coveredIds`.
6. Tests.

## 12. Riesgos y notas

- **Compatibilidad hacia atrás:** Los pagos existentes (`covered_purchase_ids = NULL`) deben seguir funcionando exactamente igual. El reparto FIFO debe tratar `NULL` como "sin restricción".
- **No modificar `service_purchases`:** La relación `appointment_id` en `service_purchases` sigue siendo opcional (compras huérfanas por "Servicio ya realizado" tienen `appointment_id = null`). El cambio no afecta eso.
- **No modificar `cancelled_appointments`:** El archivo de cancelaciones no necesita cambios.
- **No modificar `activity_logs`:** El registro de actividad debe incluir `coveredPurchaseIds` en el `metadata` cuando se registre un pago.

## 13. Auto-revisión del spec (checklist)

- [x] No hay placeholders `TBD` ni `TODO` sin resolver.
- [x] Consistencia interna: `covered_purchase_ids` se describe igual en schema, API y UI.
- [x] Alcance: el cambio está enfocado en la relación pago↔servicio; no propone refactoring general del sistema de balances.
- [x] Ambigüedad: se define explícitamente que `NULL` = legado, `[]` = sin servicios, `["..."]` = servicios seleccionados.
- [x] No se propone modificar `users` ni `appointments` (salvo la lectura de `service_purchases`).
- [x] Se menciona la migración correspondiente (`drizzle/` SQL).

## 14. Aprobación necesaria

- [ ] Usuario confirma que el diseño (Enfoque C — selector híbrido con `covered_purchase_ids` en `payments`) cubre "las 2 vertientes" que solicita.
- [ ] Usuario confirma si prefiere que el selector de servicios sea obligatorio o opcional (por defecto todos los servicios de la cita).
- [ ] Usuario confirma si es aceptable la migración de BD (`ALTER TABLE payments ADD COLUMN ...`).

Una vez aprobado este spec, se procede a `docs/superpowers/plans/` con la ejecución paso a paso.
