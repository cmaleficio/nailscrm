# Mejoras Compras/Inventario — Código automático, edición de facturas, usos por cita y agotado

**Fecha:** 2026-08-27

## Contexto

Cuatro mejoras solicitadas alrededor de compras e inventario:

1. Al añadir un producto desde Compras no deja crear uno nuevo porque falta el espacio para el código de producto; debe generarse automáticamente en forma de números ascendentes.
2. No permite editar facturas en Compras aunque se tenga permiso de administrador.
3. Los productos tipo esmalte deben agruparse en una **categoría** y el tipo exacto (ej: Max Glow, Emerald) es la **subcategoría**. Además, al **completar una cita** (en el servicio de la clienta, no en el servicio general), se debe indicar qué productos de esmalte se usaron, organizado por categoría principal mostrando las subcategorías, para conocer realmente cuánto duran los productos.
4. Debe existir forma de **marcar un producto como agotado** y de **setear un máximo de usos** para un producto en específico. El agotado se relaciona con alcanzar el máximo de usos.

## Decisiones tomadas (brainstorming)

- **Usos reales por cita + máx usos**: se registran los productos concretos usados en cada cita al completarla; cada producto de esmalte tiene un `maxUses` configurable. Así se conocen usos consumidos/restantes reales (no solo estimados).
- Las categorías/subcategorías aplican **solo a productos tipo esmalte**.
- Al registrar uso en una cita: **se descuenta stock y se genera un movimiento de salida "uso en cita"** en el kardex, además de incrementar `usesConsumed`.
- El agotado es **automático + manual**: automático cuando `usesConsumed >= maxUses`, y manual con botón "Marcar agotado".

## Diseño

### Feature 1 — Código de producto automático

- `POST /api/inventory/items`: si `code` viene vacío, se genera automáticamente el siguiente código numérico ascendente.
- `nextAutoCode()`: consulta los `id` existentes, extrae el mayor sufijo numérico y devuelve ese número + 1 (con prefijo `PRD-`). Si no hay ninguno numérico, empieza en `PRD-1`.
- UI `InventoryContent`: el campo código deja de ser obligatorio (basta el nombre); el botón "+ Producto" se habilita con solo el nombre. Muestra pista "Se genera automáticamente si lo dejas vacío".
- `BillFormDialog.addItem()` ya envía solo `name`/`unit` → funciona de inmediato con el cambio de API.

### Feature 2 — Editar facturas

- Bug: `PurchasesContent.openEdit()` setea `editingBill` pero no `setShowForm(true)`, por lo que el diálogo de edición nunca abre. Se corrige añadiendo `setShowForm(true)`.

### Feature 3 y 4 — Esmaltes: categoría/subcategoría, uso por cita, máx usos y agotado

**Schema (`src/db/schema.ts`):**

Campos nuevos en `inventory_items`:
- `category` (text, nullable) — categoría principal (ej: "Esmalte").
- `subcategory` (text, nullable) — tipo exacto (ej: "Max Glow", "Emerald").
- `maxUses` (integer, nullable) — máximo de usos configurable.
- `usesConsumed` (integer, default 0) — usos consumidos reales en citas.
- `isExhausted` (integer, default 0) — bandera agotado.

Nueva tabla **`appointment_usage`**:
- `id` (text, PK)
- `appointmentId` (text, FK → appointments.id, on delete cascade)
- `inventoryItemId` (text, FK → inventory_items.id)
- `quantity` (real, default 1)
- unique index (`appointmentId`, `inventoryItemId`)

**API:**

- `PATCH /api/inventory/items/[id]`: acepta `category`, `subcategory`, `maxUses`. Nuevo: permite marcar agotado removiendo la bandera, no permite "des-eliminar".
- `POST /api/inventory/items/[id]/exhaust` (administrador, `hasPermission 'inventory'`): marca `isExhausted=1` y pone `stock=0` con movimiento de ajuste; borra el flag cuando se pide `exhausted:false` (reabrir).
- `PATCH /api/appointments/[id]` (completar): acepta `usage: { inventoryItemId, quantity }[]`. Para cada uno: inserta en `appointment_usage` (upsert), incrementa `usesConsumed`, descuenta stock (movimiento kind `out`, refType `usage`, refId = appointmentId), y si `maxUses` está definido y `usesConsumed >= maxUses` marca `isExhausted=1`.

**UI:**

- `CompleteAppointmentDialog`: nueva sección "Productos usados (esmaltes)" que carga `/api/inventory/items?esmaller=1` (o todos con categoría), agrupa por categoría mostrando subcategorías, con stepper/input de cantidad por producto. Al confirmar envía `usage`.
- `InventoryContent`: la tabla muestra categoría/subcategoría, máx usos, "usos usados/restantes" y badge "Agotado"; el formulario de edición incluye `category`, `subcategory`, `maxUses` y botón "Marcar agotado"/"Reabrir".

## Fuera de alcance

- Jerarquía de categorías para productos que no sean esmalte.
- Cambiar el cálculo `estUsos` por stock (se mantiene como complemento).
- Lectura bidireccional de inventario con proveedores.
