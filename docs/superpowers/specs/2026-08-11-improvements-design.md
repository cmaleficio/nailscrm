# Diseño: Mejoras en compras, inventario, pagos recibidos y permisos

**Fecha:** 2026-08-11
**Estado:** Borrador (en revisión)

## Contexto

El salón ya cuenta con: citas (con cancelación por hard delete + archivo en `cancelled_appointments`, **ya implementado**), CRM de clientes, cuentas por cobrar con pagos `$`/`Bs` a tasa BCV, compras con facturas de proveedores (tabs de facturas/proveedores/categorías ya existentes), cuentas por pagar, inventario con kardex y estados financieros.

Este spec cubre las **mejoras pendientes**:

1. **Compras en formato grid (tabla maestro-detalle)**: reemplazar la lista de tarjetas de facturas por una tabla con `# factura / proveedor / fecha / vence / monto / estado` y detalle expandible al seleccionar una fila. Mantener el botón "+ Nueva factura" y las tabs de proveedores y categorías.
2. **Inventario en formato grid**: reemplazar las tarjetas de productos por una tabla con **código de producto (PK)**, **código de barras**, **foto del producto**, stock, costo y acciones. Los **ajustes** de stock solo con permiso.
3. **Pagos con capturas (evidencia)**: capturas (foto) para pagos enviados (a proveedores) y recibidos (de clientes). Nueva sección de **pagos recibidos**: el cliente reporta desde su perfil un pago a la tasa del día con captura; el **admin aprueba/rechaza manualmente**; al aprobar se registra el pago y descuenta automáticamente la cuenta por cobrar.
4. **Sistema de permisos por usuario**: permisos personalizables (JSON array) por usuario admin; cada módulo del dashboard se protege con `hasPermission`.

## Decisiones acordadas

1. **El bug de cancelación YA está resuelto** (hard delete + `cancelled_appointments` + pestaña "Canceladas"). Fuera de este spec.
2. **Compras e inventario se muestran como grid** (tabla), no como tarjetas. Es el formato que más se ajusta a la cantidad de columnas de datos de ambos módulos.
3. **Inventario**: el **código de producto es el identificador (PK)** y es **diferente del código de barras**. Se añaden `barcode` y `photo_url` a `inventory_items`. El campo `id` existente (uuid) pasa a contener el código de producto (ej. `ACR-001`), respetando que `bill_items.inventory_item_id`, `inventory_movements.inventory_item_id` y `service_products.inventory_item_id` son FKs textuales que seguirán funcionando con el código.
4. **Pagos recibidos**: aprobación **manual** por el admin (la auto-aprobación queda descartada para el MVP). El cliente reporta monto en `Bs` + captura; la tasa del día se toma del servidor (`exchange_rates`). Al aprobar → se inserta en `payments` (descuenta balance) y la captura queda ligada.
5. **Permisos**: columna `users.permissions` como **JSON array** de strings. `null`/vacío en un usuario `admin` = acceso a **todos** los módulos (compatible con admins existentes). El superadmin (`ADMIN_EMAIL`) siempre tiene todo.
6. **Capturas de pago**: foto obligatoria para pagos recibidos reportados por el cliente y para pagos a proveedores; opcional en pagos registrados por el admin en `payments`.

## 1. Modelo de datos (cambios)

### `inventory_items` (modificar)
- `id`: text, primary key → **código de producto** (ej. `ACR-001`). Los items existentes reciben un código generado en la migración (`INV-001`, `INV-002`, …).
- `barcode`: text, nullable (código de barras; distinto del código de producto).
- `photo_url`: text, nullable (foto del producto; opcional, subida con `/api/upload`).
- Resto sin cambios (`name`, `unit`, `stock`, `avg_cost`, `min_stock`, `is_active`, `notes`, `created_at`).

### `payments` (modificar)
- `photo_url`: text, nullable (captura/evidencia del pago del cliente; opcional para pagos admin, la ligada a un `payment_receipts` aprobado).

### `supplier_payments` (modificar)
- `photo_url`: text, nullable (captura del pago enviado al proveedor; **obligatoria**).

### `payment_receipts` (nueva tabla — capturas de pago reportadas por clientes)
- `id`: text, primary key.
- `client_id`: text, FK → `users.id`, not null.
- `appointment_id`: text, FK → `appointments.id`, nullable (opcional; ayuda a contextualizar).
- `amount_ves`: real, not null (monto reportado en Bs; el cliente solo paga en Bs).
- `rate`: real, not null (tasa BCV del día tomada del servidor).
- `amount_usd`: real, not null (equiv. `amountVes / rate`, redondeado a 2).
- `photo_url`: text, not null (captura de la transferencia).
- `status`: text, not null, `'pending' | 'approved' | 'rejected'`, default `'pending'`.
- `reviewed_by`: text, FK → `users.id`, nullable (admin que aprobó/rechazó).
- `reviewed_at`: integer, nullable.
- `review_notes`: text, nullable (motivo de rechazo o nota del admin).
- `payment_id`: text, FK → `payments.id`, nullable (se llena al aprobar).
- `created_at`: integer.
- Índice: `payment_receipts_client_idx` (clientId), `payment_receipts_status_idx` (status).

### `users` (modificar)
- `permissions`: text, nullable (JSON array, ej. `["purchases","inventory","financials"]`; `null` = todos los módulos).

## 2. Sistema de permisos

### Claves de permiso (una por módulo del dashboard)
- `appointments` (agenda), `clients` (CRM), `balances` (cuentas por cobrar), `purchases` (compras), `accountsPayable` (cuentas por pagar), `inventory` (inventario), `financials` (estados financieros), `settings` (configuración), `services` (servicios), `adminUsers` (gestión de admins), `paymentApproval` (aprobar/rechazar capturas de pago).

### `src/lib/authz.ts` (ampliar)
- `getPermissions(session): string[] | null` — lee `users.permissions` de la DB (mismo patrón que `isAdmin`); `null` = todos.
- `hasPermission(session, perm): Promise<boolean>`:
  - Si `isSuperAdmin(session)` → `true`.
  - Si `!isAdmin(session)` → `false`.
  - Si `permissions === null` → `true`.
  - Si no → `permissions.includes(perm)`.
- `getSessionRole` y `isAdmin` sin cambios.

### `src/lib/auth.ts` (ampliar)
- El callback `jwt`/`session` NO mete permisos en el token (son pesados y cambian); las guardas usan `hasPermission()` que consulta la DB por request (igual que `isAdmin`).

### Aplicación
- **Layout admin** (`src/app/(admin)/layout.tsx`): los ítems del `NAV_ITEMS` se filtran según `permissions` del usuario logueado (vía función server que llama a `getPermissions`). Si el usuario no tiene acceso a ningún módulo, no se le muestra la navegación.
- **APIs**: cada ruta protegida añade `if (!(await hasPermission(session, "x"))) return 401`. Los módulos financieros (bills, supplier-payments, inventory, financials, bank-accounts, suppliers, expense-categories, service-products) usan sus claves respectivas; los endpoints de citas/clientes/pagos usan `appointments`/`clients`/`balances`. `GET /api/admins` y sus mutaciones usan `adminUsers`. `PATCH /api/payment-receipts/[id]` (aprobar/rechazar) usa `paymentApproval`.
- **UI**: los botones de acciones sensibles (Ajuste de inventario, Registrar pago, Nueva factura, etc.) se ocultan/deshabilitan si falta el permiso.

### Gestión de admins (`/dashboard/admin-users`, `AdminUsersContent.tsx`)
- Se amplía la tarjeta de cada admin con un editor de permisos (checkboxes por módulo + botón "Todos"/"Ninguno").
- `PATCH /api/admins` (nuevo método) guarda `permissions` del admin seleccionado.
- La sección de añadir admin se mantiene igual (por email).

## 3. API

Todas las rutas nuevas/mutadas exigen `isAdmin` + `hasPermission` de la clave correspondiente.

### Inventario (`/api/inventory/items*`)
- `GET /api/inventory/items` — incluye en cada item: `code` (= `id`), `barcode`, `photoUrl`, `stockValue`, `estUsos`.
- `POST /api/inventory/items` — body `{ code, name, unit?, minStock?, barcode?, photoUrl?, notes? }`. Valida `code` (obligatorio, único, patrón alfanumérico con `-`/`_`). `id` del item = `code`.
- `PATCH /api/inventory/items/[id]` — edita `name`, `unit`, `minStock`, `barcode`, `photoUrl`, `isActive`, `notes`. **No permite** cambiar `code`.
- `DELETE /api/inventory/items/[id]` — sin cambios en las reglas actuales (solo si sin stock, facturas, movimientos ni usos).
- `POST /api/inventory/items/[id]/movements` — body `{ kind: 'out' | 'adjust', quantity, notes? }`. Exige `hasPermission(session, "inventory")` y además, para `kind='adjust'`, exige el permiso adicional (ver §Permisos UI): se valida en el API con `canAdjustInventory(session)` = superadmin o `permissions` contiene `"inventory.adjust"` o permisos `null`.

### Pagos de clientes (`/api/payments*`)
- `POST /api/payments` — acepta `photoUrl` opcional.
- `GET /api/payments` — incluye `photoUrl` en cada fila.

### Pagos a proveedores (`/api/supplier-payments*`)
- `POST /api/supplier-payments` — `photoUrl` **obligatorio** (400 si falta). Acepta `photoUrl` string.
- `GET /api/supplier-payments` — incluye `photoUrl`.

### Capturas de pago de clientes (`/api/payment-receipts*`, nueva)
- `POST /api/payment-receipts` — **cliente autenticado** (no solo admin). Body `{ appointmentId?, amountVes, photoUrl }`. Valida: `amountVes > 0`, `photoUrl` presente. `rate` se toma de `exchange_rates` del día (si no existe la del día, usa la última; 400 si no hay ninguna). Calcula `amountUsd`. Inserta con `status='pending'`, `createdBy=cliente`. La tasa queda congelada en la fila.
- `GET /api/payment-receipts` — admin: lista todos (filtro `?status=`). Cliente: solo los suyos (`?mine=1` o por sesión).
- `PATCH /api/payment-receipts/[id]` — **solo admin** con `paymentApproval`. Body `{ action: 'approve' | 'reject', notes? }`:
  - `approve`: si `status` ya es `approved` → 400. Inserta en `payments` (`amountUsd`, `currency='VES'`, `amountVes`, `rate`, `reference='Captura aprobada'`, `paidAt=now`, `createdBy=admin`, `photoUrl`) → descuenta balance. Actualiza el receipt a `approved` con `reviewedBy`, `reviewedAt`, `paymentId`. Todo en transacción.
  - `reject`: actualiza a `rejected` con `reviewNotes`.
- `DELETE /api/payment-receipts/[id]` — solo si `status='pending'` (admin). Si estaba `approved`, eliminar también el `payments.payment_id` ligado.

### Facturas (`/api/bills*`) y proveedores/categorías/bancos
- Sin cambios de schema/API, solo permiso `purchases`/`accountsPayable` en las guardas. `GET /api/bills` ya devuelve `items` (para el detalle del grid).

## 4. UI / Flujos

### `/dashboard/purchases` → `PurchasesContent.tsx` (rediseño a grid)
- **Tabs**: `Facturas` | `Proveedores` | `Categorías` (se mantienen). Botón "+ Nueva factura" se mantiene (solo con permiso `purchases`).
- **Tab Facturas = tabla maestro-detalle**:
  - Cabecera con filtros (estado, mes) + tabla: `# Factura` | `Proveedor` | `Fecha` | `Vence` | `Tipo` | `Total $` | `Estado` | `Acciones (Ver/Editar/Eliminar)`.
  - Clic en una fila o botón "Ver" → se expande el **detalle debajo de la tabla** (panel maestro-detalle): líneas de la factura (descripción/cantidad/costo/total), pagos asociados (fecha/monto/banco/ref), y resumen (total, pagado, pendiente).
  - Estados con pills (Pendiente/En progreso/Pagada) y resaltado visual de vencidas.
- **Tabs Proveedores y Categorías**: se mantienen como están (CRUD simple).

### `/dashboard/inventory` → `InventoryContent.tsx` (rediseño a grid)
- **Tabs**: `Productos` | `Movimientos` | `Uso por servicio` (se mantienen).
- **Tab Productos = tabla (grid)**:
  - Columnas: `Foto` (thumb, opcional) | `Código` (el PK) | `Nombre` | `Código barras` | `Unidad` | `Stock` | `Stock mín` | `Costo avg` | `Valor` | `Acciones (Salida/Ajuste/Editar/Eliminar)`.
  - Badge "Stock bajo" si `stock <= minStock`. Items inactivos atenuados.
  - Formulario de nuevo producto ampliado: `Código` (obligatorio, único), `Nombre`, `Unidad`, `Código de barras` (opcional), `Foto` (upload), `Stock mín`.
  - Botón **Ajuste** visible solo con permiso `inventory` + habilidad de ajuste (`canAdjustInventory`); si no, se oculta. Salida sigue disponible.
- **Movimientos / Uso por servicio**: se mantienen (la tabla de movimientos ya es un grid).

### Perfil del cliente (`/profile`, `ProfileContent.tsx`) — nuevo bloque "Mis pagos"
- Lista de citas completadas con saldo pendiente (o resumen de deuda si está disponible vía API ligera).
- Botón **"Reportar pago"** en la cita seleccionada → diálogo: monto en Bs, subir captura (`/api/upload`), (opcional) nota. Muestra la tasa BCV del día (fetch a `/api/exchange-rate`).
- Al enviar → `POST /api/payment-receipts`, queda en `pending` con aviso "El salón debe aprobar tu pago".
- Historial de capturas propias con estado (Pendiente/Aprobado/Rechazado + motivo).

### `/dashboard/balances` → `BalancesContent.tsx` — nueva pestaña "Pagos recibidos"
- Tabs: `Cuentas por cobrar` | `Pagos recibidos`.
- **Pagos recibidos**: lista de `GET /api/payment-receipts` (filtro por estado, default `pending`). Cada fila: cliente, monto Bs + equiv. USD, tasa, fecha, captura (thumb clicable), estado. Acciones:
  - `pending` → botones **Aprobar** / **Rechazar** (con motivo). Aprobar abre `ConfirmDialog` mostrando el detalle.
  - `approved` → muestra `paymentId` y botón "Ver en historial". `rejected` → muestra motivo.
- Badge con nº de capturas pendientes en la tab.

### Diálogos de pago (capturas)
- `RegisterPaymentDialog` (cliente): campo opcional "Captura (foto)".
- `SupplierPaymentDialog` (proveedor): campo **obligatorio** "Captura (foto)".
- Ambos reutilizan `/api/upload`.

## 5. Migración y seeds

### Migración (`drizzle-kit generate` / manual)
1. `users`: añadir `permissions` (text, nullable).
2. `payments`: añadir `photo_url` (text, nullable).
3. `supplier_payments`: añadir `photo_url` (text, nullable).
4. `inventory_items`: añadir `barcode` y `photo_url` (text, nullable). Asignar códigos a items existentes (`INV-001`, `INV-002`, …) y actualizar `bill_items`/`inventory_movements`/`service_products` que referencien esos ids (el id pasa a ser el código). **Nota**: SQLite no permite cambiar el PK con `ALTER`; la migración debe recrear la tabla (tabla nueva `inventory_items` con `id`=código + columnas nuevas, copia de datos, `INSERT INTO ... SELECT`, drop de la vieja, rename) respetando las FK textuales.
5. Nueva tabla `payment_receipts` + índices.

### Seeds
- `db:seed:finance`: items de inventario con códigos (`ACR-001` Monómero, `ACR-002` Polvo acrílico, `GEL-001` Esmaltes semipermanentes, `TIP-001` Tips pack) y `barcode` opcional. Añadir 1-2 `payment_receipts` demo (uno pending, uno approved ligado a un pago).
- `db:seed:client`: opcionalmente un `payment_receipts` demo de la clienta.

## 6. Casos borde y reglas

- **Código de producto**: único, no editable tras crear; patrón `[A-Za-z0-9-_]+`. 400 si duplicado.
- **Aprobación de captura**: no se puede aprobar dos veces; no se puede editar una aprobada; rechazar solo desde `pending`.
- **Captura aprobada + eliminar pago**: al borrar el `payment_receipts` aprobado se borra también el `payments` ligado (vía `paymentId`).
- **Tasa**: si no hay `exchange_rates` registrada, `POST /api/payment-receipts` devuelve 400 pidiendo refrescar la tasa BCV.
- **Cliente sin rol admin** que intente `GET /api/payment-receipts` sin `mine` → 401 (solo ve las suyas).
- **Ajuste de inventario sin permiso**: 403 en API y botón oculto en UI.
- **Permisos `null` = todos**: evita bloquear admins existentes al migrar.
- **Grid responsive**: en móvil las tablas usan `overflow-x-auto` (patrón ya usado en movimientos).

## 7. Documentación

- `AGENTS.md`: columna `permissions` en `users`, tabla `payment_receipts`, columnas nuevas en `inventory_items`/`payments`/`supplier_payments`, claves de permiso, rutas nuevas (`/api/payment-receipts`), componentes actualizados y regla "código de producto = PK".
- `CHANGELOG.md`: entrada bajo `## [Sin publicar]`.
- `README.md`: breve mención a permisos y pagos con capturas.
