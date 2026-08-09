# Diseño: Compras, cuentas por pagar, inventario y estados financieros

**Fecha:** 2026-08-09
**Estado:** Borrador (en revisión)

## Contexto

El salón lleva ventas (servicios), citas, cuentas por cobrar de clientes y pagos de clientes ($/Bs con tasa BCV), pero **no registra lo que gasta**: insumos comprados, facturas de proveedores, gastos fijos (alquiler, luz, internet, nómina), inventario ni resultados del negocio. Este spec añade: (1) **módulo de compras** con facturas de proveedores y proveedores, (2) **cuentas por pagar** (facturas pendientes + gastos fijos, con registro de pagos a proveedores y cuentas bancarias para recibir/pagar), (3) **inventario** con kardex y costo promedio ponderado, y (4) **estados financieros** con estado de pérdidas y ganancias mensual.

## Decisiones acordadas

1. **Registrar una factura ≠ pagarla**: la factura crea la obligación (cuenta por pagar); un pago a proveedor la amortiza. El estado de la factura (`pending | partial | paid`) se calcula comparando pagos vs total.
2. **Cuentas por pagar = facturas de insumos + gastos fijos**. Una tabla única `bills` con `type: 'inventory' | 'fixed'`.
3. **Inventario nivel 2 (kardex + costo promedio ponderado)**: entradas por compra, salidas manuales (uso/baja), ajustes. `avgCost = (stock_ant * avgCost_ant + qty * unitCost) / (stock_ant + qty)`.
4. **NO se integran automáticamente citas/servicios con inventario**. Sí existe el mapeo informativo "qué productos se usan en cada servicio" (`service_products`) para estimar cuántos usos dura un producto (`usos ≈ stock / Σ qty_por_servicio`). No descuenta stock.
5. **Bancos**: apartado de cuentas bancarias (`bank_accounts`) usado como origen al registrar pagos a proveedores (y destino potencial de cobros; el registro es un catálogo, no conciliación).
6. **P&L del mes = servicios del mes − gastos del mes** (base devengo):
   - Ingresos: `Σ service_purchases.servicePrice` de citas `completed` con `startTime` dentro del mes.
   - Gastos: `Σ bills.totalUsd` con `billDate` dentro del mes (factura registrada, pagada o no).
   - Beneficio = ingresos − gastos. Desglose por categoría de gasto y por servicio.
7. **Multi-moneda en compras**: USD y VES con tasa BCV del día (mismo patrón que `payments`). `totalUsd = amountVes / rate` cuando se registra en Bs; se guardan `amountVes` y `rate` para auditoría. **Matiz**: las facturas de inventario se registran en USD (los costos unitarios en USD alimentan el costo promedio ponderado); las facturas de gasto fijo admiten USD o VES.
8. **Permisos**: todos los admins (`isAdmin`) pueden ver y editar los módulos financieros.
9. **Valoración de inventario**: `stock × avgCost` por producto; se muestra en inventario. El valor del inventario NO se resta en el P&L (es activo, no gasto); el gasto se reconoce en la factura al comprar.

## 1. Modelo de datos (nuevas tablas)

### `suppliers` (proveedores)
- `id`: text, primary key.
- `name`: text, not null.
- `phone`: text, nullable.
- `email`: text, nullable.
- `address`: text, nullable.
- `notes`: text, nullable.
- `created_at`: integer.

### `expense_categories` (categorías de gasto)
- `id`: text, primary key.
- `name`: text, not null.
- `is_active`: integer (boolean), default 1.
- `created_at`: integer.
- Seed por defecto: `Insumos y materiales`, `Alquiler`, `Servicios básicos (luz/agua/internet)`, `Nómina`, `Marketing y publicidad`, `Otros`.

### `bank_accounts` (cuentas bancarias)
- `id`: text, primary key.
- `bank_name`: text, not null.
- `account_type`: text, default `'savings'` (`'savings' | 'checking' | 'cash'`).
- `account_number`: text, nullable (máscara al mostrar, p.ej. últimos 4).
- `currency`: text, default `'USD'` (`'USD' | 'VES'`).
- `is_active`: integer (boolean), default 1.
- `notes`: text, nullable.
- `created_at`: integer.

### `bills` (facturas de compra / gastos)
- `id`: text, primary key.
- `supplier_id`: text, FK → `suppliers.id`, nullable.
- `category_id`: text, FK → `expense_categories.id`, nullable.
- `invoice_number`: text, nullable (número de factura del proveedor).
- `type`: text, not null, `'inventory' | 'fixed'`, default `'inventory'`.
- `bill_date`: integer (fecha de la factura; define el mes de gasto en el P&L).
- `due_date`: integer, nullable (vencimiento; usado en cuentas por pagar).
- `currency`: text, not null, `'USD' | 'VES'`, default `'USD'`.
- `amount_ves`: real, nullable.
- `rate`: real, nullable.
- `total_usd`: real, not null (equiv. en USD; si se registró en Bs es `amountVes / rate`).
- `status`: text, not null, `'pending' | 'partial' | 'paid'`, default `'pending'`. Se actualiza al registrar/eliminar pagos.
- `notes`: text, nullable.
- `created_by`: text, FK → `users.id`.
- `created_at`: integer.
- Índices: `bills_bill_date_idx` (billDate), `bills_status_idx` (status), `bills_supplier_idx` (supplierId).

### `bill_items` (detalle de factura, solo `type='inventory'`)
- `id`: text, primary key.
- `bill_id`: text, FK → `bills.id` ON DELETE CASCADE.
- `inventory_item_id`: text, FK → `inventory_items.id`, nullable.
- `description`: text, nullable (texto libre si no hay item de inventario).
- `quantity`: real, not null (> 0).
- `unit_cost_usd`: real, not null.
- `total_usd`: real, not null (`quantity × unitCostUsd`).
- Índice: `bill_items_bill_idx` (billId).

### `inventory_items` (catálogo de insumos)
- `id`: text, primary key.
- `name`: text, not null.
- `unit`: text, default `'unidad'` (unidad, ml, g, paquete, etc.).
- `stock`: real, default 0.
- `avg_cost`: real, default 0 (costo promedio ponderado por unidad).
- `min_stock`: real, default 0 (alerta de stock bajo).
- `is_active`: integer (boolean), default 1.
- `notes`: text, nullable.
- `created_at`: integer.

### `inventory_movements` (kardex)
- `id`: text, primary key.
- `inventory_item_id`: text, FK → `inventory_items.id`.
- `kind`: text, not null, `'in' | 'out' | 'adjust'`.
- `quantity`: real, not null (delta con signo: `in` positivo, `out` negativo, `adjust` delta con signo).
- `unit_cost_usd`: real, nullable (solo `in`; usado para recalcular promedio).
- `ref_type`: text, not null, `'bill' | 'manual'`.
- `ref_id`: text, nullable (id de `bills` si viene de una factura).
- `notes`: text, nullable.
- `created_by`: text, FK → `users.id`.
- `created_at`: integer.
- Índice: `inventory_movements_item_idx` (inventoryItemId).

### `supplier_payments` (pagos a proveedores)
- `id`: text, primary key.
- `bill_id`: text, FK → `bills.id` (una factura puede tener varios abonos).
- `bank_account_id`: text, FK → `bank_accounts.id`, nullable.
- `amount_usd`: real, not null.
- `currency`: text, not null, `'USD' | 'VES'`, default `'USD'`.
- `amount_ves`: real, nullable.
- `rate`: real, nullable.
- `payment_date`: integer (fecha del pago).
- `reference`: text, not null (referencia del pago/transferencia).
- `notes`: text, nullable.
- `created_by`: text, FK → `users.id`.
- `created_at`: integer.
- Índice: `supplier_payments_bill_idx` (billId).

### `service_products` (uso informativo de productos por servicio)
- `id`: text, primary key.
- `service_id`: text, FK → `services.id` ON DELETE CASCADE.
- `inventory_item_id`: text, FK → `inventory_items.id`.
- `quantity_per_service`: real, not null (> 0, en la unidad del producto).
- Índice único: `(service_id, inventory_item_id)`.

## 2. API

Todas las rutas nuevas exigen `isAdmin` (patrón: `const session = await auth(); if (!(await isAdmin(session))) return 401`).

### Proveedores
- `GET /api/suppliers` — lista todos (orden por nombre). Soporta `?q=` (like en nombre/teléfono).
- `POST /api/suppliers` — body `{ name, phone?, email?, address?, notes? }`. Valida `name`.
- `PATCH /api/suppliers/[id]` — actualiza campos opcionales.
- `DELETE /api/suppliers/[id]` — solo si no tiene `bills` (400 + sugerir desactivar nada; los proveedores no tienen flag activo, se permite borrar si sin facturas).

### Categorías de gasto
- `GET /api/expense-categories` — lista activas (y `?includeInactive=1`).
- `POST /api/expense-categories` — body `{ name }`.
- `PATCH /api/expense-categories/[id]` — rename / activar-desactivar.
- `DELETE /api/expense-categories/[id]` — solo si no tiene `bills` (400 en caso contrario; sugerir desactivar).

### Cuentas bancarias
- `GET /api/bank-accounts` — lista; `?includeInactive=1` para todas.
- `POST /api/bank-accounts` — body `{ bankName, accountType, accountNumber?, currency?, notes? }`.
- `PATCH /api/bank-accounts/[id]` — actualiza opcionales + `isActive`.
- `DELETE /api/bank-accounts/[id]` — solo si no tiene `supplier_payments` (400 en caso contrario; sugerir desactivar).

### Facturas / gastos (`bills`)
- `GET /api/bills` — lista con joins. Filtros opcionales: `?status=` (`pending|partial|paid`), `?supplierId=`, `?month=YYYY-MM` (por `billDate`), `?type=`. Cada factura incluye `supplierName`, `categoryName` y `items` (sus `bill_items` con `itemName`).
- `POST /api/bills` — body:
  ```json
  {
    "supplierId": "...",
    "categoryId": "...",
    "invoiceNumber": "...",
    "type": "inventory",
    "billDate": 1723224000,
    "dueDate": 1724000000,
    "currency": "USD",
    "amountVes": null,
    "rate": null,
    "totalUsd": 45.5,
    "notes": "...",
    "items": [{ "inventoryItemId": "...", "description": "...", "quantity": 5, "unitCostUsd": 9.1 }]
  }
  ```
  - Valida: `billDate` requerido, `totalUsd > 0` (o `amountVes` + `rate` si VES), `items` requeridos y con cantidad > 0 si `type='inventory'`.
  - Si `type='inventory'` → crea los `bill_items` y, para cada item con `inventoryItemId`, genera movimiento `in` con `unitCostUsd` y recalcula stock + promedio (ver §3). Si no hay `inventoryItemId`, solo guarda la línea descriptiva.
  - `status` inicial `'pending'`. Devuelve la factura creada con items.
- `GET /api/bills/[id]` — factura completa con items, pagos (supplier_payments con banco) y saldo pendiente (`totalUsd − Σ pagos`).
- `PATCH /api/bills/[id]` — edita campos maestros (proveedor, categoría, número, fechas, notas). **No permite** editar `type`, `currency`, `totalUsd` ni `items` si ya tiene pagos (400); para montos/items con factura sin pagos se implementa edición completa (borra items previos y regenera movimientos: revierte los `in` anteriores y aplica los nuevos).
- `DELETE /api/bills/[id]` — solo si no tiene `supplier_payments` (400 "tiene pagos asociados; elimina primero los pagos"). Si `type='inventory'`, revierte los movimientos `in` generados (decrementa stock; el promedio NO se revierte, limitación documentada).

### Pagos a proveedores
- `GET /api/supplier-payments` — lista; `?billId=` para los de una factura. Ordenados por `paymentDate` desc.
- `POST /api/supplier-payments` — body `{ billId, bankAccountId?, amountUsd?, currency, amountVes?, rate?, paymentDate, reference, notes? }`. Mismo patrón de moneda que `payments` de clientes. Al crear, recalcula `bills.status` (si `Σ pagos >= totalUsd` → `paid`; `> 0` → `partial`; si no → `pending`).
- `DELETE /api/supplier-payments/[id]` — elimina el pago y recalcula el estado de la factura.

### Inventario
- `GET /api/inventory/items` — lista items con `stock`, `avgCost`, `stockValue` (`stock × avgCost`), `estUsos` (si tiene `service_products`: `stock / Σ quantityPerService`). `?includeInactive=1` para todos.
- `POST /api/inventory/items` — body `{ name, unit?, minStock?, notes? }`. Valida `name`.
- `PATCH /api/inventory/items/[id]` — edita `name`, `unit`, `minStock`, `isActive`, `notes`.
- `DELETE /api/inventory/items/[id]` — solo si `stock` total en 0 y no tiene `bill_items`, `inventory_movements` ni filas en `service_products` (400 en caso contrario; sugerir desactivar).
- `GET /api/inventory/items/[id]/movements` — kardex del item (movimientos ordenados desc).
- `POST /api/inventory/items/[id]/movements` — body `{ kind: 'out' | 'adjust', quantity, notes? }`:
  - `'out'`: `quantity > 0`, valida `stock − quantity >= 0`. Decrementa stock, promedio sin cambio. Movimiento con `quantity: -quantity`.
  - `'adjust'`: `quantity` es el **stock objetivo** (real). Delta = objetivo − stock actual. Ajusta stock, promedio sin cambio. `notes` obligatorio describiendo el motivo.

### Uso de productos por servicio
- `GET /api/service-products` — `?serviceId=` devuelve el mapeo `[{ serviceId, inventoryItemId, quantityPerService, itemName }]`; sin filtro devuelve todos.
- `PUT /api/service-products` — body `{ serviceId, items: [{ inventoryItemId, quantityPerService }] }`. Reemplaza el mapeo del servicio (borra filas previas del servicio e inserta las nuevas).

### Estados financieros
- `GET /api/financials/pnl?month=YYYY-MM` — devuelve:
  ```json
  {
    "month": "2026-08",
    "income": 850.00,
    "expenses": 420.50,
    "profit": 429.50,
    "servicesCount": 12,
    "invoicesCount": 5,
    "incomeByService": [{ "serviceName": "Acrílicas Full", "amount": 350.00, "count": 3 }],
    "expensesByCategory": [{ "categoryName": "Insumos y materiales", "amount": 300.00 }, ...]
  }
  ```
  - Ingresos: `JOIN service_purchases ↔ appointments` con `appointments.status='completed'` y `appointments.startTime` en `[monthStart, monthEnd)`.
  - Gastos: `bills` con `billDate` en `[monthStart, monthEnd)`, agrupados por categoría.
  - `monthStart = dateTimeToTs(month + "-01", "00:00")`; `monthEnd` = inicio del mes siguiente.

## 3. Lógica compartida

### Nuevo `src/lib/inventory.ts`
- `createInventoryIn(itemId, qty, unitCostUsd, refType, refId, notes, createdBy)`:
  1. Lee item. `newAvg = (stock * avgCost + qty * unitCostUsd) / (stock + qty)` (si stock 0 → `unitCostUsd`). Redondea `avgCost` a 4 decimales.
  2. `stock += qty`.
  3. Inserta movimiento `'in'` con `quantity: qty`, `unitCostUsd`.
- `applyManualMovement(itemId, kind: 'out' | 'adjust', param, notes, createdBy)`:
  - `'out'`: valida stock; `stock -= qty`; movimiento `quantity: -qty`.
  - `'adjust'`: delta = target − stock; `stock = target`; movimiento `quantity: delta`.
- `reverseBillMovements(billId, itemId?)`: para cada `bill_items` de la factura con `inventoryItemId`, decrementa stock por su cantidad y crea movimiento `'out'` `ref_type='bill'` `ref_id=billId` con `notes: "Reversión de factura"`. Usado en `DELETE /api/bills/[id]` y al regenerar items en PATCH.

### Nuevo `src/lib/bills.ts`
- `recomputeBillStatus(billId)`: `Σ supplier_payments.amountUsd` vs `bills.totalUsd` → setea `status` (`paid` | `partial` | `pending`). Se llama tras crear/borrar un pago.

### Nuevo `src/lib/financials.ts`
- `getPnL(month: string): PnLResult` — implementa el cálculo de §2 (estados financieros) con queries SQL puras.

## 4. UI / Flujos

### Navegación (`src/app/(admin)/layout.tsx`)
- `NAV_ITEMS` añade (después de "Cuentas por cobrar"); hrefs en inglés como el resto del repo:
  - `{ href: "/dashboard/purchases", label: "Compras", icon: "🛒" }`
  - `{ href: "/dashboard/accounts-payable", label: "Cuentas por pagar", icon: "💳" }`
  - `{ href: "/dashboard/inventory", label: "Inventario", icon: "📦" }`
  - `{ href: "/dashboard/financials", label: "Estados financieros", icon: "📊" }`

### Página `/dashboard/purchases` → `PurchasesContent.tsx`
- **Pestañas**: `Facturas` | `Proveedores` | `Categorías`.
- **Facturas**: lista de `GET /api/bills` (filtros por estado y mes). Cada factura: proveedor, nº factura, tipo, fecha, moneda, total $, estado (pill), acciones (Ver/Editar, Eliminar si sin pagos). Botón "+ Nueva factura" abre `BillFormDialog`.
- **`BillFormDialog`**: tipo (`inventory`/`fixed`), proveedor (select desde `/api/suppliers` + "+ Nuevo proveedor" inline), categoría, nº factura, fecha, vencimiento (opcional), moneda $/Bs con tasa BCV (reutiliza patrón de `RegisterPaymentDialog`), total, notas. Si `type='inventory'`: editor de líneas (select de `/api/inventory/items` con nombre/cantidad/costo unitario; fila en blanco crea item nuevo vía `POST /api/inventory/items`).
- **Proveedores**: CRUD simple (lista + formulario inline + eliminar con `ConfirmDialog`).
- **Categorías**: CRUD simple (misma estructura).

### Página `/dashboard/accounts-payable` → `AccountsPayableContent.tsx`
- **Pestañas**: `Por pagar` | `Pagos realizados` | `Bancos`.
- **Por pagar**: facturas `status != 'paid'` (de `GET /api/bills`), ordenadas por `dueDate` asc; destacado visual para vencidas (rojo) y por vencer en ≤ 7 días (ámbar). Cada fila: proveedor, nº factura, vencimiento, total $, pagado $, pendiente $, botón "Registrar pago".
- **`SupplierPaymentDialog`**: factura fija, monto (default = pendiente), moneda $/Bs con tasa, banco (select de `/api/bank-accounts`), referencia, fecha, notas → `POST /api/supplier-payments`.
- **Pagos realizados**: lista de `GET /api/supplier-payments` (factura + proveedor, monto, moneda, banco, fecha, ref) con eliminar (recalcula estado).
- **Bancos**: CRUD simple (nombre del banco, tipo, nº de cuenta, moneda, activo, notas).

### Página `/dashboard/inventory` → `InventoryContent.tsx`
- **Pestañas**: `Existencias` | `Movimientos` | `Uso por servicio`.
- **Existencias**: cards de `GET /api/inventory/items` con nombre, unidad, stock, costo promedio, valor (`stock × avgCost`), alerta si `stock <= minStock` (rojo) o baja. Botón "Salida" y "Ajuste" (`MovementDialog`) y "+ Nuevo producto" (form inline). Eliminar solo si stock 0 y sin movimientos.
- **`MovementDialog`**: kind out/adjust, cantidad, motivo → `POST /api/inventory/items/[id]/movements`.
- **Movimientos**: select de producto → kardex (`GET /api/inventory/items/[id]/movements`): fecha, tipo (pill), cantidad, costo unitario, ref (factura/manual), notas.
- **Uso por servicio**: para cada servicio, editor de mapeo (selects de productos + cantidad por servicio) → `PUT /api/service-products`. Junto a cada producto se muestra su stock y usos estimados.

### Página `/dashboard/financials` → `FinancialsContent.tsx`
- Selector de mes (`<input type="month">`, default mes actual).
- Tarjetas resumen: **Ingresos**, **Gastos**, **Utilidad/Pérdida** (verde si >= 0, rojo si < 0), nº de servicios, nº de facturas.
- Tablas de desglose: **Ingresos por servicio** (servicio, cantidad, total) y **Gastos por categoría** (categoría, total).
- Todo de `GET /api/financials/pnl?month=...`.

## 5. Casos borde y reglas

- **Factura con pagos**: no se puede borrar ni editar `type`/`currency`/`totalUsd`/`items` (400). Los pagos se eliminan primero.
- **Eliminar factura `inventory`**: revierte stock (decrementa por cada item) pero el `avgCost` no se revierte (limitación documentada). Crear el movimiento de reversión con `ref_type='bill'` para trazabilidad.
- **Pago en Bs**: `amountUsd = round(amountVes / rate, 2)`; se guardan `amountVes` y `rate`.
- **Sobre-pago**: permitido (el estado queda `paid`); el pendiente mostrado nunca es negativo (max 0).
- **Salida de stock insuficiente**: 400 "Stock insuficiente".
- **Stock negativo**: nunca; validado en servidor.
- **Ajuste**: `quantity` es el objetivo; `notes` obligatorio.
- **P&L base devengo**: los gastos del mes son las facturas **registradas** ese mes (pagadas o no). Los ingresos son servicios **completados** ese mes (cobrados o no).
- **Categoría nula en P&L**: las facturas sin categoría agrupan en "Sin categoría".
- **`GET /api/purchases` existente no se toca**: sigue sirviendo `service_purchases` (snapshots de clientes). Las rutas nuevas de compras usan `/api/bills`.
- **Timezone**: fechas en `America/Caracas` (patrón existente).
- **Todos los montos** en USD equivalentes para cálculos agregados; se conservan `amountVes`/`rate` en filas individuales para auditoría.

## 6. Seeds y demo

- **Seed base (`src/db/seed.ts`)**: insertar las 6 `expense_categories` por defecto (solo si la tabla está vacía). Añadir script `db:seed:finance` (`tsx src/db/seed-finance-demo.ts`) re-ejecutable que crea/actualiza: 2 proveedores, 2 bancos (uno USD, uno VES), 4 items de inventario (Monómero 100 ml, Polvo acrílico 50 g, Esmaltes semipermanentes 15 ml, Tips pack 100), movimientos iniciales via facturas (1 factura de insumos con items + 1 factura gasto fijo "Alquiler" pendiente), 1 pago a proveedor (abono), mapeo `service_products` (Acrílicas Full → polvo acrílico 10 g, monómero 10 ml; Gel → esmalte 5 ml). Limpia los datos demo previos de estos módulos antes de regenerar (patrón de `seed-client-demo.ts`).

## 7. Documentación

- `AGENTS.md`: nuevas tablas (`suppliers`, `expense_categories`, `bank_accounts`, `bills`, `bill_items`, `inventory_items`, `inventory_movements`, `supplier_payments`, `service_products`), rutas nuevas (`/dashboard/purchases`, `/dashboard/accounts-payable`, `/dashboard/inventory`, `/dashboard/financials`), componentes clave nuevos y reglas de borrado.
- `CHANGELOG.md`: entradas bajo `## [Sin publicar]`.
- `README.md`: reflejar los 4 módulos nuevos y el comando `npm run db:seed:finance`.
