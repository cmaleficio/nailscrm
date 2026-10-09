# Nails App - Sistema de Gestión para Salón de Nail Design

## 🎯 Visión del Producto
Web App standalone (SaaS/CRM) para gestión integral de un salón de nail design. Diferenciadores vs marketplaces (Fresha/Booksy):
- Propiedad absoluta de datos por parte del salón
- CRM con notas técnicas personalizadas
- Muro social de inspiración (comunidad visual)
- Sincronización con Google Calendar
- Comunicación directa vía WhatsApp

## 🛠️ Stack Tecnológico
- **Framework:** Next.js 14+ (App Router, src/)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS + shadcn/ui
- **Base de Datos:** SQLite (better-sqlite3)
- **ORM:** Drizzle ORM (sintaxis SQL pura, NO Prisma)
- **Autenticación:** NextAuth v5 (Auth.js) con Google Provider + Credentials (correo/contraseña)
- **Integraciones:** Google Calendar API (push), WhatsApp Deep Links (wa.me)
- **Exposición:** Cloudflare Tunnel (localhost → internet)

## 🪟 Entorno de Desarrollo (Windows)

Este proyecto se desarrolla en **Windows** con PowerShell y CMD.

**Shell:** PowerShell 5.1 (predeterminado)
**Comandos:** Usar cmdlets de PowerShell (ej: `Get-ChildItem`, `Test-Path`, `Remove-Item`) y CMD cuando sea necesario.
**Skills instalados:**
- `powershell-master` — PowerShell advanced (`.agents\skills\powershell-master\`)
- `powershell-windows` — PowerShell on Windows (`.agents\skills\powershell-windows\`)

**Reglas de ejecución:**
- Encadenar comandos: `cmd1; if ($?) { cmd2 }` (NO usar `&&`)
- Usar comillas dobles para rutas con espacios
- Encerrar rutas entre comillas en cmdlets que lo requieran
- Preferir `& "ruta\a\ejecutable"` para ejecutar binarios con espacios

## 📚 Base de Conocimiento (Graphify)

Antes de hacer cambios en el código o revisar funcionalidades, **consultar la base de conocimiento en `graphify-out/`** para optimizar el uso de tokens y mejorar la calidad de las respuestas.

- `graphify-out/graph.html` — Grafo interactivo (abrir en navegador)
- `graphify-out/graph.json` — Datos crudos del grafo
- `graphify-out/GRAPH_REPORT.md` — Reporte de comunidades y conexiones

**Comandos útiles:**
- `/graphify query "<pregunta>"` — Consultar el grafo (responde desde la base de conocimiento)
- `/graphify path <nodo1> <nodo2>` — Camino más corto entre dos conceptos
- `/graphify explain <nodo>` — Explicación en lenguaje natural de un nodo

### Cómo se genera y se actualiza el grafo

El grafo se reconstruye con un pipeline determinista + subagentes para la capa semántica de documentos. No use `graphify update .` (degradaría la capa semántica de los .md). En cambio:

```powershell
$py = Get-Content graphify-out\.graphify_python
& $py scripts\graphify_rebuild.py        # detect + AST + cache semántico + build + cluster
& $py scripts\graphify_rebuild.py --finish  # reetiqueta comunidades, graph.html, manifest, cost.json
```

Según lo que haya cambiado, la primera corrida puede imprimir `FALTAN EXTRACCIÓN SEMANTICA` con la lista de documentos sin cachear. En ese caso:

1. Despache subagentes, uno por documento pendiente, con la spec `extraction-spec.md` del paquete graphify instalado (ver `spec_path()` en `scripts/graphify_rebuild.py` si cambia de lugar). Cada subagente escribe `graphify-out/.graphify_chunk_NN.json` con los nodos/aristas/hyperedges extraídos.
2. Vuelva a correr `scripts/graphify_rebuild.py` (ahora los chunks se cachean, el grafo se construye y el diff se imprime).
3. Cierre con `scripts/graphify_rebuild.py --finish`.

Detalles que no se deben romper:
- `scripts/graphify_rebuild.py` corre cada paso en un subproceso con `parallel=False`: en Windows el multiprocessing estándar revienta con `OSError: [Errno 22] <stdin>`. No cambie eso a `parallel=True` sin meterse a arreglar el guard de `__main__`.
- Las labels de comunidad se transfieren **por solapamiento de nodos** contra el grafo anterior (`.graphify_prev_graph.json`), nunca por id de comunidad, porque los ids cambian entre corridas. El `--finish` regenera `graph.json` con `community_labels=` vía `to_json`.
- `scripts/graphify_external_deps.py` se ejecuta en el pipeline antes del build: crea nodos para dependencias externas (`ref_*`) y repara los endpoint colgantes del AST. El grafo final queda con ~2.280 nodos, ~4.615 aristas y 148 comunidades.
- El health check del pipeline imprime `dangling_endpoint_edges` (aliases de AST como `src_db_index_schema`, `src_lib_auth_auth`) — son benignos, no bloquear por ellos.
- Cuando un cambio obliga a actualizar `AGENTS.md` y se agrega o cambia documentación, el pipeline vuelve a narrar el grafo; el `--finish` no cambia las labels ya etiquetadas a mano salvo que la comunidad se parta o fusione. Si una comunidad nueva queda como `Community N`, reetiquétela y vuelva a correr `--finish`.

## 📏 Reglas de Desarrollo
- Mobile-first en todas las vistas de cliente
- Paleta de colores: rosa pastel (#FFE5EC, #FFC2D1), blanco, gris suave (#F5F5F5)
- Bordes redondeados (rounded-xl), sombras suaves
- Drizzle con queries SQL puras, evitar abstracciones complejas
- Imágenes en /public/uploads (MVP local)
- Timezone local del salón para TODAS las fechas
- Privacidad por defecto: solo nombre de pila en muro público. El truncado va **en el servidor**, con `publicFirstName()` en `src/lib/public-name.ts`, no en el componente: `GET /api/gallery` y `/review/[id]` son públicos y sin sesión, así que si se truncara al pintar, el nombre completo ya habría salido en la respuesta y bastaría con abrir las devtools.
- Google Calendar: solo escritura (push), no lectura bidireccional
- WhatsApp: deep links (wa.me), no API oficial
- Mantenimiento: cada cambio relevante (funcionalidad nueva/quitada o bug corregido) obliga a actualizar AGENTS.md (si aplica), CHANGELOG.md y README.md en el mismo commit.

## 📦 Modelo de Datos (Drizzle Schema)

### Tabla: users
- id: text, primary key
- name: text, not null
- email: text, unique, not null
- email_verified: timestamp
- image: text
- phone: text (para WhatsApp)
- address: text
- password_hash: text (login por correo/contraseña)
- google_id: text (para OAuth)
- tech_notes: text (notas de la manicurista sobre el cliente)
- total_visits: integer, default 0 (servicios completados)
- total_revenue: real, default 0 (recaudado = suma de pagos; lo recalcula `applyPaidToClient`)
- role: text, default 'client' (client | admin)
- permissions: text (JSON array de permisos de módulos; null = acceso a todos)
- locked_at: integer (timestamp; lo setea RISC `account-disabled` cuando Google detecta compromiso de la cuenta)
- locked_reason: text (motivo del bloqueo, ej: 'hijacking', 'bulk-account')
- created_at: integer (timestamp)

### Tablas de Auth.js: account, session, verificationToken
- Estructura estándar de NextAuth v5 (schema.sqlite de Auth.js).

### Tabla: services
- id: text, primary key
- name: text, not null
- description: text
- price: real, not null
- duration_mins: integer, not null
- is_active: integer (boolean), default 1
- is_group: integer (boolean), default 0 (1 = curso/servicio grupal; las sesiones de curso se detectan por esta flag, NUNCA por el nombre)
- is_complementary: integer (boolean), default 0 (1 = servicio complementario: se agrega a OTRA cita y suma duración y precio). Es un flag por servicio, no una matriz de compatibilidad. `is_group` e `is_complementary` son **excluyentes** y la API de servicios lo rechaza con 400; un curso no se combina.

### Tabla: appointments
- id: text, primary key
- client_id: text, foreign key → users.id
- service_id: text, foreign key → services.id
- start_time: integer (timestamp)
- end_time: integer (timestamp)
- status: text, default 'pending' (pending, confirmed, completed, cancelled)
- reference_photo_url: text (foto de referencia subida por cliente)
- final_photo_url: text (foto del resultado final subida por admin)
- shared_to_gallery: integer (boolean), default 0
- review_rating: integer (1-5)
- review_text: text
- google_event_id_client: text
- google_event_id_admin: text
- created_at: integer (timestamp)
- Cancelar una cita la **elimina definitivamente** (hard delete, `DELETE /api/appointments/[id]`) tras archivar un snapshot en `cancelled_appointments`; el status `cancelled` ya no se genera para citas nuevas.

### Tabla: cancelled_appointments (archivo de citas canceladas)
- id: text, primary key
- appointment_id: text (id original de la cita)
- client_id: text, foreign key → users.id
- service_id: text, foreign key → services.id
- service_name: text, not null (snapshot de service_purchases)
- service_price: real, not null (snapshot de service_purchases)
- service_items: text (JSON array de `{ name, price }`, uno por servicio de la cita; null en cancelaciones antiguas)
- start_time: integer (timestamp)
- end_time: integer (timestamp)
- reference_photo_urls: text (JSON array de urls de appointment_photos)
- cancelled_by: text, foreign key → users.id (quién canceló: cliente o admin)
- cancelled_at: integer (timestamp)
- reason: text
- Se llena al cancelar (admin o propietario); visible en la pestaña "Canceladas" de la agenda.

### Tabla: appointment_photos
- id: text, primary key
- appointment_id: text, foreign key → appointments.id (on delete cascade)
- url: text, not null
- position: integer, default 0
- kind: text, default 'reference' ('reference' | 'final'): las fotos 'final' alimentan el muro de inspiración
- created_at: integer (timestamp)

### Tabla: course_enrollments (alumnos de una sesión de curso)
- id: text, primary key
- appointment_id: text, foreign key → appointments.id (on delete cascade)
- client_id: text, foreign key → users.id (solo clientes registrados, no walk-ins)
- created_at: integer (timestamp)
- unique index (appointment_id, client_id). Cada alumno genera su propia `service_purchases` (mismo `appointment_id`) con su CXC individual.

### Tabla: service_photos
- id: text, primary key
- service_id: text, foreign key → services.id (on delete cascade)
- url: text, not null
- position: integer, default 0
- created_at: integer (timestamp)

### Tabla: gallery_photos (fotos sueltas del muro, subidas por admin sin cita)
- id: text, primary key
- url: text, not null (archivo en /public/uploads/gallery)
- service_id: text, foreign key → services.id (opcional; si existe, la foto permite "agendar similar")
- caption: text (descripción opcional)
- position: integer, default 0
- created_by: text, foreign key → users.id (admin que la subió)
- created_at: integer (timestamp)
- Se fusionan con las fotos finales de citas en `GET /api/gallery` (ordenadas por fecha desc).

### Tabla: service_purchases (snapshot del servicio al comprar, inmutable)
- id: text, primary key
- user_id: text, foreign key → users.id
- appointment_id: text, foreign key → appointments.id (on delete cascade; al cancelar se marca `void` pero la columna vuelve a borrarse por CASCADE — el archivo de la cancelación vive en `cancelled_appointments`; **opcional** — las compras huérfanas generadas por "Servicio ya realizado" tienen `appointment_id = null`; el índice `service_purchases_appointment_idx` sigue funcionando con valores no nulos)
- service_id: text, foreign key → services.id
- service_name: text, not null
- service_description: text
- service_price: real, not null
- service_duration_mins: integer, not null
- is_primary: integer (boolean), default 1 (1 = la compra del servicio principal de la cita; 0 = complementario). Una cita con N servicios genera N compras, todas con el mismo `appointment_id` y el mismo `user_id`; el `is_primary = 0` las ordena y las marca en la UI. En una cita de curso todas son `is_primary = 1` (una por alumno) y lo que las distingue es el `user_id`.
- financial_status: text, default 'pending' (pending | partial | paid | void) — **derivado**, no se calcula comparando el total pagado por la clienta contra cada precio. `recomputeFinancialStatus(userId)` reconstruye `payment_allocations` (pago↔servicio) y marca cada compra `paid`/`partial`/`pending` según lo que sus asignaciones la cubren (`statusFromAllocated`).
- completion_date: integer (timestamp, fecha de producción; se setea al completar la cita)
- created_at: integer (timestamp)
- `PurchaseSummaryRow` (`src/lib/appointment-purchases.ts`) exige `id` y `serviceDurationMins`: los 5 llamadores de `summarizePurchases` (`/api/appointments`, `/api/gallery`, `/api/production-photos`, `/api/clients/[id]` y el perfil del cliente) **deben** seleccionar esas columnas aunque no las lean todavía. El fan-out de compras se resuelve **sin JOIN**: se cargan aparte y se fusionan en memoria con `summarizePurchases`, que además distingue el grupo de compras de la clienta del de los otros alumnos en una sesión de curso. Hay un test de fuente en `src/lib/appointment-fanout.test.ts` que falla si alguien reintroduce un `leftJoin(schema.servicePurchases)`.

### Tabla: waitlist
- id: text, primary key
- client_id: text, foreign key → users.id
- preferred_date: integer (timestamp, inicio del día preferido)
- notified: integer (boolean), default 0
- created_at: integer (timestamp)

### Tabla: blockouts
- id: text, primary key
- start_time: integer (timestamp)
- end_time: integer (timestamp)
- reason: text

### Tabla: working_hours (horario de trabajo por día de la semana)
- day_of_week: integer, primary key (0=Domingo … 6=Sábado)
- is_open: integer (boolean), default 1
- start_time: text, default "09:00" ("HH:MM")
- end_time: text, default "18:00" ("HH:MM")
- Si falta una fila se usa el default (Lun–Sáb 09:00–18:00, Dom cerrado).

### Tabla: payments (cuentas por cobrar)
- id: text, primary key
- user_id: text, foreign key → users.id
- appointment_id: text, foreign key → appointments.id (on delete set null)
- amount_usd: real, not null (equiv. en USD; para VES se calcula `amount_ves / rate`)
- currency: text, default 'USD' (USD | VES)
- amount_ves: real
- rate: real (tasa Bs/US$ usada para pagos en Bs)
- reference: text (opcional para admins; obligatorio solo en la práctica para admins que pagan con transferencia; null cuando no se provee)
- paid_at: integer (timestamp) integer (timestamp)
- notes: text
- created_by: text, foreign key → users.id
- created_at: integer (timestamp)
- El saldo se calcula en vivo: `Σ service_purchases.service_price de purchases no-void − Σ payments.amount_usd`.
- **Reparto derivado al leer (sin migración):** cada pago se etiqueta como `abono`, `anticipo` o `completo` (`appliedUsd`/`creditUsd`/`kind`) con `allocatePayments`/`previewPayment` en `src/lib/payment-split.ts` (funciones puras, 19 tests). Regla acordada sin tope duro: `P ≤ saldo` → abono (o completo si lo salda); `P > saldo` → el excedente es anticipo; `deuda = 0` → todo anticipo. Se reparte cronológicamente (el pago más viejo cubre primero) contra la deuda actual. **Nada de esto cambia el saldo**; es presentación pura.
- **La deuda (due) tiene UNA definición** en `clientDueUsd()` (`src/lib/payment-split-db.ts`): `Σ service_price` de purchases `financial_status != 'void'`, sin importar si la cita ya se completó. La usan `/api/balances`, `/api/payments`, el reparto y (desde esta fase) también `GET /api/clients/[id]` y `/profile`. Si una pantalla muestra "cuánto debe" con un criterio distinto, es un bug.
- `GET /api/payments` adjunta el reparto a cada fila (`appliedUsd`, `creditUsd`, `kind`) **y** las asignaciones `allocations: [{ purchaseId, serviceName, amountUsd }]` (los servicios que ese pago cubre, materializados en `payment_allocations`); `POST`/`PATCH /api/payments` y aprobar una captura también devuelven el reparto y lo guardan en `metadata` de `logActivity` (queda en auditoría qué se acreditó como anticipo).
- `photo_url` (opcional): captura de la transferencia al registrar un pago de cliente. Es **media privada**: su valor es `/api/media/payment/<uuid>.<ext>`, no `/uploads/...` (ver "Media privada").

### Tabla: payment_allocations (qué pago cubrió qué servicio)
- id: text, primary key
- payment_id: text, foreign key → payments.id (on delete cascade)
- purchase_id: text, foreign key → service_purchases.id (on delete cascade)
- amount_usd: real, not null, > 0 (cuánto de ese pago se aplicó a esa compra)
- created_at: integer (timestamp)
- unique index (payment_id, purchase_id); index (purchase_id).
- Es la **relación materializada** pago↔servicio y la fuente de verdad de "qué pago pagó qué". `service_purchases.financial_status` se deriva de ella. Se reconstruye entera por clienta en cada `recomputeFinancialStatus` (delete+insert), así que no hay edición manual ni drift. **No** cambia el saldo: `Σ amount_usd` de las compras no-void `= min(Σ pagos, Σ precios no-void)`.
- El reparto es **FIFO determinista** (`allocateToPurchases` en `src/lib/payment-allocation.ts`, funciones puras): compras no-void por `completion_date` (nulls al final), desempate `created_at`, luego `id`; pagos por `paid_at ?? 0`, desempate `created_at`, luego `id` (mismo orden que `allocatePayments`). Si el pago tiene `appointment_id`, sus compras de esa cita se consumen primero y lo que sobre sigue el FIFO global; eso **no cambia** cuánto cubre el pago, solo a qué servicio va.
- Backfill: `npm run db:backfill:allocations` (idempotente) reconstruye allocations y estados de todas las clientas con compras o pagos. Fue lo que corrigió los casos Fabiola (4×$18 con 2 pagos de $18 → 2 `paid`/2 `pending`) y Wanda (2×$12 con 1 pago de $12 → 1 `paid`/1 `pending`).
- Al fusionar clientas (`POST /api/identity/claim` y `POST /api/admin/merge-clients`) se recomputa la sobreviviente tras mover compras y pagos.

### Tabla: payment_receipts (capturas de pago reportadas por el cliente)
- id: text, primary key
- client_id: text, foreign key → users.id
- appointment_id: text, foreign key → appointments.id (opcional)
- amount_ves: real, not null
- rate: real, not null (tasa Bs/US$ del día al reportar)
- amount_usd: real, not null (equiv. en USD)
- photo_url: text, not null (captura obligatoria)
- status: text, default 'pending' (pending | approved | rejected)
- reviewed_by: text, foreign key → users.id (admin que revisó)
- reviewed_at: integer (timestamp)
- review_notes: text (motivo del rechazo)
- payment_id: text, foreign key → payments.id (se llena al aprobar)
- created_at: integer (timestamp)
- Flujo: el cliente reporta un pago en Bs con captura → queda `pending` → el admin aprueba (inserta en `payments` con currency `VES` y liga `paymentId`) o rechaza (con `review_notes`). Solo `paymentApproval` puede revisar.

### Tabla: exchange_rates (tasa del día)
- id: text, primary key
- date: text, unique, not null ("YYYY-MM-DD")
- rate: real, not null
- source: text, default 'bcv' (bcv | manual)
- created_at: integer (timestamp)
- La tasa se obtiene SOLO de bcv.org.ve (fetch HTML de la home → .txt en tmp → regex) y se cachea por día.
- El fetch usa `node:https` con `rejectUnauthorized: false` (el certificado del BCV no lo valida el trust store de Node; equivale a `curl -sk` del script original). Timeout 10s y sigue redirects.
- La extracción ancla en `<div id="dolar">` (independiente del orden de monedas): regex `id="dolar"[\s\S]*?<strong class="strong-tb">([\d.,]+)<\/strong>` + `normalizeBcvNumber` (quita puntos de miles y cambia coma a punto). La fecha valor se extrae de `date-display-single` `content="YYYY-MM-DDTHH:mm:ss-04:00"`.
- Refresh diario vía cron externo: `GET /api/exchange-rate/refresh` (admin con sesión o `CRON_SECRET` en el header `Authorization: Bearer`) fuerza `refreshTodayRate()` (inserta o actualiza la fila de hoy con `onConflictDoUpdate`). cron-job.org debe llamar la URL pública del túnel a diario. **`CRON_SECRET` solo se acepta por ese header**, nunca por `?secret=`: una URL con query acaba en los access logs del túnel, en el `Referer` y en el historial del navegador. La comparación pasa por `isValidCronSecret()` (`src/lib/cron-secret.ts`), que hasheá SHA-256 los dos lados porque `timingSafeEqual` exige buffers del mismo tamaño.
- Backfill de gaps: `GET /api/exchange-rate/backfill` (misma auth que refresh) o `npm run db:backfill:rates` ejecuta `backfillMissingRates()`: scrapea la serie histórica de `https://www.bcv.org.ve/estadisticas/indice-de-inversion` (34 páginas del Drupal views `nuevo_indicador`, filas `<tr class="... letra-pequeña ...">`), extrae de cada fila la fecha (`content="YYYY-MM-DD"` de `date-display-single`) y la columna 2 "Tipo de Cambio de Venta (Bs / USD)" (celda `views-field views-field-views-conditional` sin el sufijo `-1`, formato coma decimal `853,49930000`), y hace `INSERT` solo de las fechas que faltan en `exchange_rates` (`onConflictDoNothing`, no pisa tasas `manual`). Devuelve `{ scanned, inserted, alreadyPresent, failed }`; 502 si el scrape falla. En `/dashboard/exchange-rates` hay un botón "Rellenar tasas faltantes" que lo invoca desde la UI y recarga la tabla.

### Tabla: suppliers (proveedores)
- id: text, primary key
- name: text, not null
- phone: text
- email: text
- address: text
- notes: text
- created_at: integer (timestamp)

### Tabla: expense_categories (categorías de gasto)
- id: text, primary key
- name: text, not null
- is_active: integer (boolean), default 1
- created_at: integer (timestamp)

### Tabla: bank_accounts (cuentas del salón)
- id: text, primary key
- bank_name: text, not null
- account_type: text, default 'savings' (savings | checking | cash)
- account_number: text
- currency: text, default 'USD' (USD | VES)
- is_active: integer (boolean), default 1
- notes: text
- created_at: integer (timestamp)

### Tabla: inventory_items (inventario)
- id: text, primary key (**código de producto**, ej: `ACR-001`, `GEL-001` o `PRD-001` autogenerado si se crea sin código)
- name: text, not null
- unit: text, default 'unidad'
- stock: real, default 0
- avg_cost: real, default 0 (costo promedio ponderado, se recalcula en cada entrada)
- min_stock: real, default 0 (umbral para badge "Stock bajo")
- is_active: integer (boolean), default 1
- barcode: text (código de barras EAN, opcional)
- photo_url: text (foto del producto, opcional)
- category: text (categoría principal del producto, ej: "Esmalte"; los productos sin categoría no cuentan como esmalte)
- subcategory: text (subcategoría/tipo exacto, ej: "Max Glow", "Emerald")
- max_uses: integer (máximo de usos configurable por producto; al alcanzarlo se marca agotado)
- uses_consumed: integer, default 0 (usos reales consumidos en citas)
- is_exhausted: integer (boolean), default 0 (agotado manual o automático; al marcar se pone stock en 0)
- notes: text
- created_at: integer (timestamp)
- `stockValue` = `stock * avg_cost` (se calcula en el API).
- `usosRestantes` = `max_uses − uses_consumed` (badge "Agotado" si `uses_consumed >= max_uses` o `is_exhausted=1`).
- Si se crea un producto sin `code` (desde inventario o desde el diálogo de compras), `POST /api/inventory/items` genera el siguiente código ascendente `PRD-<n>`.

### Tabla: appointment_usage (uso de productos por cita)
- id: text, primary key
- appointment_id: text, foreign key → appointments.id (on delete cascade)
- inventory_item_id: text, foreign key → inventory_items.id
- quantity: real, not null, default 1
- unique index (appointment_id, inventory_item_id).
- Se llena al completar una cita con `recordUsage(...)`: descuenta stock, crea un `inventory_movements` kind 'out' con `ref_type='usage'`/`ref_id=appointment_id` e incrementa `inventory_items.uses_consumed` (agotando si supera `max_uses`).

### Tabla: inventory_movements (kardex)
- id: text, primary key
- inventory_item_id: text, foreign key → inventory_items.id
- kind: text, not null ('in' | 'out' | 'adjust' | 'cost_adjust')
- quantity: real, not null (positivo para in, negativo para out/adjust; 0 para cost_adjust)
- unit_cost_usd: real (entradas y ajustes de costo; null para out/adjust de stock)
- ref_type: text, default 'manual' ('bill' | 'usage' | 'manual')
- ref_id: text (id de la factura si ref_type='bill', id de la cita si ref_type='usage')
- notes: text (obligatorio para 'adjust' y 'cost_adjust')
- created_by: text, foreign key → users.id
- created_at: integer (timestamp)

### Tabla: bills (facturas a proveedores / cuentas por pagar)
- id: text, primary key
- supplier_id: text, foreign key → suppliers.id
- category_id: text, foreign key → expense_categories.id
- invoice_number: text
- type: text, default 'inventory' ('inventory' | 'fixed')
- bill_date: integer (timestamp)
- due_date: integer (timestamp)
- currency: text, default 'USD' (USD | VES)
- amount_ves: real
- rate: real (tasa Bs/US$ para facturas en Bs)
- total_usd: real, not null (para VES se calcula `amount_ves / rate`)
- status: text, default 'pending' (pending | partial | paid)
- notes: text
- created_by: text, foreign key → users.id
- created_at: integer (timestamp)

### Tabla: bill_items (líneas de factura de inventario)
- id: text, primary key
- bill_id: text, foreign key → bills.id (on delete cascade)
- inventory_item_id: text, foreign key → inventory_items.id
- description: text
- quantity: real, not null
- unit_cost_usd: real, not null
- total_usd: real, not null

### Tabla: supplier_payments (pagos a proveedores)
- id: text, primary key
- bill_id: text, foreign key → bills.id
- bank_account_id: text, foreign key → bank_accounts.id
- amount_usd: real, not null (equiv. en USD; para VES se calcula `amount_ves / rate`)
- currency: text, default 'USD' (USD | VES)
- amount_ves: real
- rate: real
- payment_date: integer (timestamp)
- reference: text (opcional para admins que registran pagos a proveedores; null cuando no se provee)
- notes: text
- created_by: text, foreign key → users.id
- created_at: integer (timestamp)
- Al crear/borrar un pago se recalcula `bills.status` con `recomputeBillStatus()`.
- `photo_url` (obligatoria): captura de la transferencia; el API y el diálogo la exigen (400 si falta).

### Tabla: service_products (uso de inventario por servicio)
- id: text, primary key
- service_id: text, foreign key → services.id (on delete cascade)
- inventory_item_id: text, foreign key → inventory_items.id
- quantity_per_service: real, not null
- unique index (service_id, inventory_item_id). `estUsos` del item = `stock / Σ quantity_per_service`.

### Tabla: legal_settings (singleton para documentos legales)
- key: text, primary key (ej: "privacy_policy"; el módulo puede crecer a más documentos legales en el futuro)
- company_name: text, not null
- site_url: text, not null
- effective_date: text, not null (ISO "YYYY-MM-DD")
- country: text, not null
- governing_law: text, not null
- contact_email: text, not null
- contact_phone: text (opcional)
- contact_url: text (opcional)
- contact_address: text, not null
- updated_at: integer (timestamp seconds)
- updated_by: text, foreign key → users.id

### Tabla: tracking_tags (snippet de etiquetas de analítica, singleton)
- key: text, primary key (siempre `"head"`)
- snippet: text, not null, default '' (el código que pega el superadmin: GA4, GTM, un pixel…)
- is_enabled: integer (boolean), default 1 (apagado sin borrar el código)
- updated_at: integer (timestamp seconds)
- updated_by: text, foreign key → users.id
- El snippet es **JS arbitrario que se ejecuta en el navegador de cada visitante**, por eso solo lo edita el superadmin (`isSuperAdmin`) y **no** existe clave en `PERMISSION_KEYS`: delegarlo a un sub-admin sería XSS almacenado.

### Tabla: app_settings (ajustes globales, clave/valor)
- key: text, primary key (whitelist en `APP_SETTING_KEYS`, `src/lib/app-settings.ts`)
- value: text, not null
- updated_at: integer (timestamp seconds)
- updated_by: text, foreign key → users.id
- Singleton por clave, editable desde el dashboard. Hoy solo `detectDuplicateClients` ("1"/"0", default "0"): activa el prompt "¿Ya eres cliente?" en el registro con Google y la unión auto-gestionada de expedientes. Lectura/escritura con permiso `clients` (`GET/PUT /api/app-settings`, sección en `/dashboard/settings`). Helper: `isDuplicateDetectionEnabled(dbc)` (recibe la db, estilo `audit.ts`).

## 🗺️ Estructura de Rutas

### Públicas
- `/` → Landing con catálogo de servicios + muro de inspiración
- `/login` → Login/registro por correo y contraseña (además de botón Google)
- `/book` → Wizard de reserva (3 pasos)
- `/review/[id]` → Formulario de reseña post-cita
- `/politicas` → Política de privacidad (documento legal)
- `/condiciones` → Condiciones de servicio (documento legal). **La ruta es `/condiciones`, no `/terminos`.**
- `/success` → Confirmación de cita reservada

### 🔍 SEO: `robots.txt` y `sitemap.xml`
- `src/app/robots.ts` y `src/app/sitemap.ts` (convención de metadata route de Next) son archivos **una línea**: delegan en `src/lib/seo.ts`, que es la **única fuente de verdad** para qué rutas son públicas. No hardcodear listas de rutas en los metadata routes ni en las páginas.
- `src/lib/seo.ts` exporta `PUBLIC_INDEXABLE_ROUTES` (las 4 del sitemap), `ROBOTS_DISALLOWED_PATHS`, `ROBOTS_ALWAYS_ALLOWED_PATHS` (lo que **no** se puede bloquear), `NOINDEX_METADATA`, y los builders `buildSitemap`/`buildRobots`/`isDisallowedByPrefix`.
- **Las 4 rutas del sitemap:** `/` (prio 1.0, weekly), `/book` (0.9, weekly), `/condiciones` (0.3, yearly), `/politicas` (0.3, yearly). La lista es **cerrada y estática**: el muro vive dentro de `/` (no hay `/gallery` público) y los servicios son un modal sobre `/` (no hay `/services/[id]`), así que no hay nada dinámico que enumerar. `/review/[id]` queda fuera porque su id es un UUID y la URL es un token, no contenido.
- **Bloqueos:** `/api/`, `/dashboard`, `/profile`, `/complete-registration`, `/login`, `/success`, `/review/`. `/dashboard` cubre las 17 páginas del admin por prefijo. `Disallow: /api/` es defensivo: Googlebot no pide los XHR que dispara el cliente, así que no rompe nada.
- **`/uploads/` NO se bloquea, a propósito:** las fotos del muro son el mayor activo SEO del salón (Google Images) y viven en `/public/uploads`. Las fotos de la pestaña "Producción" que no se publicaron al muro comparten ese directorio; su URL solo es adivinable por el hash del nombre, no por listado. **`_next/` tampoco**: bloquearlo impide que Google lea el CSS/JS y no renderice la página.
- **Sin `lastModified`:** Google lo ignora en la práctica y sellarlo con `new Date()` en un archivo generado en build convertiría cada despliegue en un cambio de contenido inventado. `changefreq` cubre la señal. No lo "arregles" sin motivo.
- `src/lib/site-url.ts` resuelve el origen: `NEXT_PUBLIC_SITE_URL` → `AUTH_URL` → `http://localhost:3001`. **Sin `NEXT_PUBLIC_SITE_URL` en producción el sitemap publicaría URLs de `localhost`**, que es peor que no tener sitemap. Como es estático, cambiarla exige rebuild. `next.config.ts` corre en build y no lee `.env`, así que el dominio canónico va literal ahí (junto a `allowedDevOrigins`).
- `metadataBase` vive en el layout raíz (`src/app/layout.tsx`) para que los canonical y las URLs de OG salgan absolutas. **No** declarar `alternates.canonical` global: en el layout raíz haría que `/dashboard` y `/profile` declararan `/` como su versión canónica.
- `NOINDEX_METADATA` va en las 3 públicas que no entran al sitemap (`/login`, `/success`, `/review/[id]`). Es redundante con el `Disallow` (Google no descarga una URL bloqueada, así que nunca ve el `noindex`), pero cubre a Bing y el caso de un enlace externo a una reseña.
- `www` se redirige al apex con un `redirects()` por header `host` en `next.config.ts`, porque ambos hosts sirven el mismo contenido y eso es contenido duplicado.
- **`robots.txt` y `sitemap.xml` están fuera del matcher de `src/proxy.ts`** (vía `PROXY_EXCLUDED_SEGMENTS` en `src/lib/tracking-scope.ts`): son los dos archivos más pedidos del sitio, los piden los rastreadores, no renderizan `<head>`, y con ellos dentro el proxy corría `auth()` en cada visita. Next exige strings estáticos en `config.matcher`, así que el lookahead está escrito a mano en el proxy y `tracking-scope.test.ts` **falla si deja de coincidir** con `proxyPathExclusionPattern()`.
- **Lo que robots.txt NO protege:** el grafo de enlaces. `Header.tsx` emite hrefs a `/profile` y `/dashboard` en el HTML para visitors autenticados (Googlebot nunca lo está). La protección real de esas páginas es el `auth()` + `redirect()` de cada una.

### Protegidas (requieren auth)
- `/dashboard` → Panel admin (agenda del día/semana con sesiones de curso grupal, pestaña **"Pendientes"** con citas sin completar (vencidas y futuras), pestaña "Espera" con la lista de espera y pestaña "Canceladas" con el archivo de citas canceladas)
- `/dashboard/clients` → CRM de clientes (listado, búsqueda, alta manual, notas/stats)
- `/dashboard/balances` → Cuentas por cobrar (total adeudado **y** total de saldos a favor, desglose por ítem con estado financiero, pagos por cliente con etiqueta de reparto abono/anticipo/completo)
- `/dashboard/purchases` → Compras (facturas, proveedores y categorías de gasto)
- `/dashboard/accounts-payable` → Cuentas por pagar (facturas pendientes, pagos a proveedores y bancos)
- `/dashboard/inventory` → Inventario (existencias, kardex y uso por servicio)
- `/dashboard/financials` → Estados financieros (P&L mensual base de caja + producción)
- `/dashboard/brand` → Identidad del salón (nombre y logo)
- `/dashboard/settings` → Horario de trabajo por día de la semana + toggle "Detección de clientes duplicados" (permiso `clients`)
- `/dashboard/settings/navigation` → Menú de navegación público editable
- `/dashboard/exchange-rates` → Tasas BCV (alta manual, eliminación y backfill)
- `/dashboard/services` → Gestión de servicios (flags "Es curso/grupo" y "Es complementario", excluyentes entre sí, con badge; fotos del servicio, eliminar si no tiene uso)
- `/dashboard/gallery` → Fotos, con dos pestañas: "Muro de inspiración" (subida independiente de fotos por el admin para pre-llenar el muro, sin cita asociada) y **"Producción"** (archivo de solo lectura con todas las fotos finales de citas completadas, agrupado por día)
- `/dashboard/admin-users` → Gestión de admins (solo superadmin) + al pie la sección **"Etiquetas de analítica"** (snippet de GA/GTM inyectado en las páginas públicas, solo superadmin)
- `/dashboard/legal` → Datos legales del salón (campos variables de las políticas de privacidad)
- `/dashboard/legal/terms` → Condiciones de servicio editables
- `/profile` → Portal de cliente (pasaporte de uñas + historial + estado de cuenta + "Mis pagos" con reporte de capturas + "¿No es tu expediente?" para unir duplicados)
- `/complete-registration` → Completar registro (pedir teléfono tras OAuth de Google; con `detectDuplicateClients` activo muestra "¿Ya eres cliente?" con candidatas de nombre similar)

### APIs nuevas de permisos y pagos
- `GET/PUT /api/admin/tracking-tags` (**solo superadmin**, sin clave de permiso) → lee y guarda el singleton `tracking_tags`. El PUT valida `MAX_SNIPPET_LENGTH` (20 000) y rechaza con 400 un snippet que no contenga ningún `<script>` (casi siempre es un pegado truncado). **Nunca** registra el snippet en el log: solo `{ bytes, tags, isEnabled }`, porque el código puede llevar IDs o claves de terceros.
- `GET /api/my-permissions` (admin autenticado) → permisos del admin actual.
- `GET /api/exchange-rate/current` (público) → tasa del día (usa `getTodayRate`).
- `GET/POST /api/exchange-rate` y `DELETE /api/exchange-rate/[id]` (permiso `exchangeRates`) → gestión de tasas BCV; `GET /api/exchange-rate/refresh` y `GET /api/exchange-rate/backfill` aceptan el mismo permiso o `CRON_SECRET` **solo por header `Authorization: Bearer`** (nunca por query).
- `GET /api/payment-receipts` → admin: todas (filtro `?status=`); cliente: solo las suyas. Hace `leftJoin(payments)` para devolver las cifras **del pago acreditado** (`paymentAmountUsd`, `paymentAmountVes`, `paymentRate`, `paymentPaidAt`, `paymentAppointmentId`, `paymentCurrency`), que no coinciden con lo que reportó la clienta si el admin editó el pago. Las dos UIs las comparan y avisan cuando difieren (tolera `0.004` por el redondeo a 2 decimales).
- `POST /api/payment-receipts` (cliente) → reporta pago en Bs con captura; valida cita propia.
- `PATCH/DELETE /api/payment-receipts/[id]` → solo permiso `paymentApproval`; `approve` inserta en `payments` y liga `paymentId`, y devuelve el reparto del pago (`appliedUsd`, `creditUsd`, `kind`) para que la UI confirme antes si deja un anticipo.
- `PATCH/DELETE /api/payments/[id]` (permiso `balances`) → **editar y borrar un pago ya acreditado**. El `PATCH` acepta solo `amountUsd`, `amountVes`, `rate`, `paidAt` ("YYYY-MM-DD", se guarda a inicio del día con `dateToDayStartTs`) y `appointmentId`; **cada campo ausente es "no lo toques"**. `appointmentId` es tricestado: ausente = no tocar, `null` = desvincular, string = vincular a una cita de la misma clienta (400 si no). La moneda **no** se edita (convertir un pago cambiaría el saldo histórico) ni `reference`, `notes` ni `photoUrl`, que son el registro de origen. Después recalcula con `recomputeFinancialStatus`, registra `logActivity` con `before`/`after`, y devuelve el reparto del pago con la cifra nueva (`appliedUsd`/`creditUsd`/`kind` en la respuesta y en el `metadata`).
- **La aritmética de las cifras está en `resolvePaymentAmount()`** (`src/lib/payment-edit.ts`, funciones puras + tests), no en la ruta: `amountUsd` explícito gana (el total real que entró), si no y cambian `amountVes`/`rate` en un pago en Bs se recalcula `round2(amountVes / rate)`, y si no viene nada se conservan. Un pago en USD ignora `amountVes`/`rate` (se quedan en `null`, como los creó `POST`).
- **El `DELETE` des-hace la aprobación antes de borrar**: `payment_receipts.payment_id` es `ON DELETE NO ACTION` y SQLite tiene `foreign_keys = ON`, así que borrar un pago con captura reventaba con `SQLITE_CONSTRAINT_FOREIGNKEY` y no había forma de deshacer una aprobación equivocada. Ahora, en una transacción, cada captura ligada vuelve a `status: 'pending'` con `paymentId: null` **conservando la evidencia y los campos del review anterior** (`reviewedBy`, `reviewedAt`, `reviewNotes`), y luego se borra el pago. Un `logActivity` por la fila devuelta deja claro que la aprobación se deshizo, no que solo se borró un pago suelto.
- `GET /api/balances` (permiso `balances`) **no filtra por saldo**: también devuelve a las clientas al día y a las que tienen saldo a favor, porque el historial de pagos (con sus botones Editar/Eliminar) vive dentro de cada fila. Devuelve `dueUsd`/`paidUsd`/`balanceUsd`/`creditUsd` por clienta, `totalUsd` (total adeudado) y `totalCreditUsd` (saldos a favor); el orden agrupa deudores desc → al día → saldo a favor por crédito desc. `GET /api/clients/[id]` expone `dueUsd`/`paidUsd`/`balanceUsd` con la **misma** definición de deuda (`clientDueUsd`), para que el CRM, la agenda y los previews de pago muestren el mismo número.
- `GET/POST /api/gallery-photos` (admin) → lista/sube fotos sueltas del muro (`gallery_photos`, archivos en `/public/uploads/gallery`; POST acepta `serviceId` y `caption` opcionales).
- `DELETE /api/gallery-photos/[id]` (admin) → borra la fila y el archivo.
- `GET /api/gallery` (público) ahora fusiona fotos finales de citas compartidas + fotos sueltas de `gallery_photos` (orden por fecha desc, cursor).
- `GET /api/production-photos` (permiso `gallery`) → **archivo de producción** para la pestaña "Producción" de `/dashboard/gallery`. Solo fotos `kind = 'final'` de citas `status = 'completed'` (el trabajo real del salón), de citas **compartidas o no**: el muro filtra por `shared_to_gallery` y este archivo no. Filtros `from`/`to`/`serviceId`/`q` + cursor `before`. **Pagina por DÍA, no por foto**: devuelve `{ days: [{ date, label, count, photos }], nextCursor, hasMore }` con días completos, para que los encabezados de fecha sean exactos y ninguna cita quede partida entre páginas; el cursor es **exclusivo** (`dayKey < before`) y se compara como `YYYY-MM-DD`. La clave del día se calcula en SQL con `strftime('%Y-%m-%d', appointments.start_time, 'unixepoch', '-4 hours')` y tiene que coincidir con `dayKeyFromTimestamp` de `src/lib/production-photos.ts` (Venezuela es UTC-4 fijo desde 2016, sin horario de verano). Es de solo lectura: **no** registra `logActivity` y no expone borrado ni publicación al muro.
- `GET/POST /api/appointments/[id]/review` (público por id de cita): GET devuelve datos mínimos (servicio, fecha, nombre de pila, reseña existente); POST guarda `review_rating` (1-5 obligatorio) + `review_text` (opcional, máx 500) solo en citas `completed`; 409 si ya tiene reseña.
- `GET /api/waitlist` (admin) → lista la lista de espera con nombre/teléfono del cliente.
- `POST /api/waitlist` (usuario autenticado) → se une con `preferredDate` (timestamp inicio de día); dedupe por cliente+fecha (409); rechaza fechas pasadas (400).
- `PATCH /api/waitlist/[id]` (admin) → marca `notified`.
- `DELETE /api/waitlist/[id]` → dueño de la entrada o admin.
- `POST/GET /api/course-sessions` (admin, `appointments`): crea una sesión de curso grupal (1 `appointments` + N `course_enrollments` + N `service_purchases` pending, validando `services.is_group=1` y disponibilidad) y lista las sesiones con alumnos y saldo por alumno. Rechaza `addServiceIds` con 400: una sesión cobra un precio por alumno y no admite complementarios.
- `POST/DELETE /api/course-sessions/[id]/enrollments` (admin, `appointments`): inscribe/desinscribe un alumno registrado pre-completar (crea/borra su enrollment + `service_purchases`; 409 si ya está inscrito; 400 si la sesión está completada).
- `DELETE /api/appointments/[id]/services?purchaseId=` (admin con permiso `appointments` **o** la clienta propietaria): quita **un** servicio suelto de una cita sin cancelar la cita entera. **Borra la fila** de `service_purchases` en duro (igual que al desinscribir un alumno de curso), recalcula `appointments.end_time` y `appointments.service_id` con `remainingCombination(...)`, recomputa el estado financiero de la clienta **y** del admin, actualiza horario y título de los dos eventos de Google, y escribe `logActivity` (`entity: "purchases"`, `action: "delete"`). **Rechaza** con 400 si la cita está `completed`, si es una sesión de curso (sus alumnos se manejan en `/api/course-sessions/[id]/enrollments`) o si es la última compra de la cita, porque para eso está `DELETE /api/appointments/[id]`, que además archiva el snapshot. **No** llama `validateSlot`: quitar un servicio acorta el bloque y no puede crear un solape; `validateSlot` además rechazaría las citas que ya empezaron. Quitar el principal **se permite** y deja la cita en el estado "solo complementarios", que `/api/appointments` ya acepta.
- `GET /api/appointments?pendingOnly=1` (admin, permiso `appointments`): lista citas con `status IN ('pending','confirmed')` en la ventana `[hoy-60d, hoy+30d]`, ordenadas ascendente por `start_time`, con un campo derivado `isOverdue` (`start_time < hoy`). Alimenta la pestaña "Pendientes" del dashboard y permite al admin completar o cancelar citas de días anteriores sin tener que navegar el calendario.
- `POST /api/risc/events` (público, sin auth, solo accesible vía HTTPS en dominio autorizado) → receptor de eventos RISC (Cross-Account Protection) de Google. Valida JWT con `google-auth-library`, deduplica por `jti` en `risc_events`, y en `sessions-revoked` / `tokens-revoked` borra las filas de `session` + `account` del usuario afectado, y en `account-disabled` bloquea al usuario (`users.locked_at` + `users.locked_reason`).
- `POST /api/identity/claim` (clienta autenticada; exige `detectDuplicateClients` activo) → **unión auto-gestionada de expedientes**: la fila de la sesión **sobrevive** y absorbe la clienta elegida (`targetUserId`). El servidor recalcula la similitud de nombres (`src/lib/name-match.ts`, umbral 0.75): no se puede reclamar una clienta arbitraria adivinando su id. Rechaza admins, bloqueadas, la misma fila y correo idéntico (400 `MergeClientsError`).
- `POST /api/admin/merge-clients` (**permiso propio `mergeClients`**) → fusión de clientes del admin: body `{absorbedId, survivingId}`. Mueve TODO el estado de la absorbida a la que sobrevive y elimina la fila. **Sin** requisito de similitud (elección explícita del admin); ambas deben ser `role='client'` y no estar bloqueadas.
- `GET/PUT /api/app-settings` (permiso `clients`) → ajustes globales (`app_settings`). Claves en whitelist (`APP_SETTING_KEYS`); `detectDuplicateClients` solo acepta "0"/"1". Cada PUT escribe `logActivity` (`entity: "app_settings"`).

### Tabla: risc_events (de-duplicación de eventos RISC)
- jti: text, primary key (id único del JWT de Google)
- event_type: text, not null (URI del evento, ej: `.../risc/event-type/sessions-revoked`)
- subject_sub: text (Google `sub` del usuario afectado; null para `verification`)
- received_at: integer (timestamp)

### Tabla: activity_logs (auditoría)
- id: text, primary key
- actor_id: text, foreign key → users.id (nullable; null = acción pública/anónima, ej: eventos RISC de Google)
- actor_name: text (snapshot del nombre; sobrevive a cambios/borrados)
- entity: text (módulo: appointments, bills, payments, inventory_items, …)
- action: text (create | update | delete | cancel | complete | approve | reject | report | adjust | enroll | unenroll | void)
- entity_id: text (id de la fila afectada)
- label: text (resumen humano de la acción)
- metadata: text (JSON con detalles: montos, tasas, diffs)
- created_at: integer (unix seconds)
- Se llena desde `logActivity(db, ...)` (src/lib/audit.ts), llamada en cada endpoint mutante tras la mutación exitosa. Es best-effort: si falla, no rompe la operación de negocio. `GET /api/activity-logs` y `GET /api/activity-logs/actors` lo exponen (solo permiso `activityLog`). UI en `/dashboard/activity`.

### Fusión de clientes (`mergeClientInto` en `src/lib/merge-clients.ts`)
- Núcleo compartido por la unión auto-gestionada (`POST /api/identity/claim`) y la fusión del admin (`POST /api/admin/merge-clients`). En una transacción SQLite: **copia** a la fila sobreviviente los campos que le faltan (`phone`, `address`, `password_hash`, `google_id`; `tech_notes` se **concatenan** con separador fechado `[Fusionado YYYY-MM-DD desde <nombre>]`), **suma** `total_visits`/`total_revenue` y conserva el `created_at` más antiguo; **mueve** las FK de propiedad (`appointments.client_id`, `cancelled_appointments.client_id`, `waitlist.client_id`, `service_purchases.user_id`, `payments.user_id`, `payment_receipts.client_id`, `session.user_id`, `account.user_id`, `course_enrollments.client_id` — si ambas están inscritas en el mismo curso, el índice único (appointment_id, client_id) hace que se descarte la inscripción de la absorbida); y **borra** la fila absorbida.
- **Las columnas de actor** (`created_by`, `cancelled_by`, `reviewed_by`, `actor_id`, `updated_by`) **NO se mueven**: registran quién hizo la operación original, no de quién es el expediente.
- El `logActivity` (`entity: "clients"`, `action: "merge"`, con conteos y emails en metadata) va **después** del commit: el objeto de transacción de Drizzle no expone `$client` que exige el tipo `AuditDb`, y el log es best-effort de todos modos.
- En auto-servicio la fila que sobrevive es la de la sesión, así la sesión JWT **no se invalida** (por eso la absorbida es la clienta existente y no al revés). Las sesiones y el vínculo OAuth de la absorbida se mueven a la sobreviviente: quien entre con ese Google sigue entrando, ahora a la fila correcta.
- El prompt "¿Ya eres cliente?" vive en `/complete-registration` (candidatas calculadas en el servidor; a la otra clienta solo se le muestra teléfono enmascarado `****1234` y nº de visitas, nunca su email ni nombre completo en la respuesta del cliente) y la reasignación tardía en `/profile` ("¿No es tu expediente?", con aviso si ya tiene historial). Facebook entra por el mismo landing y queda cubierto sin costo extra.
- Búsqueda de nombres en `src/lib/name-match.ts` (funciones puras + tests): normaliza con `foldSearchText` (tildes, mayúsculas, puntuación, espacios) y puntúa — exacto 1.0, tokens reordenados 0.9, subconjunto de tokens 0.85, typo (Levenshtein ≤ 20% de la longitud mayor) ≥0.8, mismo primer nombre + inicial de apellido 0.75. Umbral `NAME_MATCH_THRESHOLD = 0.75`, máximo `MAX_NAME_CANDIDATES = 5`.
- Migración: `drizzle/0024_oval_mentor.sql` (CREATE TABLE `app_settings`). Tests: `name-match.test.ts` (14), `merge-clients.test.ts` (10, BD de memoria con `merge-clients.test-helpers.ts`), `app-settings.test.ts` (2).

## 🔐 Permisos de admins
- `users.permissions`: JSON array de claves; **null = acceso a todos los módulos** (no rompe admins existentes).
- Superadmin (`ADMIN_EMAIL`) siempre tiene acceso total.
- Claves (`PERMISSION_KEYS` en `src/lib/permissions.ts`): `appointments`, `clients`, `balances`, `purchases`, `accountsPayable`, `inventory`, `adjustInventory`, `financials`, `brandSettings`, `workingHours`, `exchangeRates`, `legalSettings`, `navigation`, `services`, `gallery`, `adminUsers`, `paymentApproval`, `activityLog`, `mergeClients`.
- El permiso legacy `settings` se expande automáticamente a `brandSettings`, `workingHours`, `exchangeRates`, `legalSettings` y `navigation` al leer permisos en `authz.ts` y `/api/admins`; no se muestra en el editor ni se guarda como clave nueva.
- Lectura del valor almacenado: `parseStoredPermissions(raw)` en `src/lib/permissions.ts` es la única fuente de verdad. `null`/vacío = **acceso total**; JSON con `settings` = expandido; **JSON corrupto o que no sea un array de strings = `[]` (sin permisos), nunca acceso total**. `getPermissions(session)` sin sesión devuelve `[]` (no `null`), para que el layout no renderice el nav completo a un anónimo. Cubierto por `src/lib/permissions.test.ts` y `src/lib/authz.test.ts`.
- `hasPermission(session, key)` en `src/lib/authz.ts` bloquea a no-admins y a admins sin el permiso. `hasAnyPermission(session, keys)` acepta varios módulos. `adjustInventory` controla salidas/ajustes de stock; `paymentApproval` controla aprobar/rechazar/eliminar capturas de pago; `activityLog` (Log de actividad): ver `/dashboard/activity`; `mergeClients` (Fusionar clientes): botón "Fusionar cliente…" en el panel CRM (`/dashboard/clients` y agenda).
- **`users.locked_at` es una guarda, no un dato**: lo escribe el receptor de RISC con `account-disabled`, y mientras no se leyera el bloqueo no revocaba nada (el admin conservaba acceso total durante toda la vida del JWT). Ahora `isAdmin()`, `getPermissions()`, `hasPermission()` y `hasAnyPermission()` leen `role`, `permissions` y `locked_at` en **una sola query** (`loadAuthRow` en `src/lib/authz.ts`) y una fila bloqueada no es admin para ninguna de ellas. El `authorize()` de credenciales y el callback `signIn` de `src/lib/auth.ts` también rechazan la cuenta bloqueada, y el evento `account-enabled` la reabre limpiando el campo. Ojo: la estrategia de sesión sigue siendo `jwt` sin `maxAge`, así que la parte de RISC que borra filas de `session`/`account` **sigue siendo un no-op** — lo que revoca es el campo.
- `isSuperAdmin()` **falla cerrado** si `ADMIN_EMAIL` no está en el entorno: comparar `session.user.email === process.env.ADMIN_EMAIL` daba `undefined === undefined` y ascendía a superadmin a cualquier admin. Además exige no estar bloqueado.
- La navegación lateral del dashboard se filtra **en el servidor**: `src/app/(admin)/layout.tsx` (Server Component) resuelve `auth()` + `getPermissions(session)` y pasa el resultado a `AdminShell` (`src/components/AdminShell.tsx`), que renderiza el nav ya filtrado. No hay `fetch` cliente-side de permisos (evita mismatch de hidratación entre el HTML del servidor y el primer render del cliente). `GET /api/my-permissions` sigue existiendo como utilidad.
- Si aparece "Hydration failed" en el sidebar tras un cambio de permisos, casi siempre es **caché de desarrollo de Next**, no el código: el HTML y el payload RSC deben nascer del mismo build. El dev server guarda compilaciones viejas en `.next/dev/static/chunks` (p. ej. un chunk con el mapping legacy `perm: "settings"` convive con el nuevo) y las pestañas abiertas desde antes del cambio siguen hidratando contra el código anterior. Procedimiento: detener el dev server → `Remove-Item -LiteralPath ".next" -Recurse -Force` → `npm run dev:default` → recargar la pestaña afectada. Verificar que el chunk viejo desapareció en `.next/dev/static/chunks`.
- Guardas auditadas por endpoint: servicios (`services*` → `services`), snapshot de compras por cita (`/api/purchases*` → `appointments`), clientes (`/api/clients*` → `clients` **o** `appointments` **o** `mergeClients` porque el CRM panel y walk-ins viven en la agenda y el diálogo de fusión busca clientas), blockouts y waitlist admin (`appointments`), muro (`gallery`), facturas/proveedores/categorías (`purchases`), pagos proveedor/bancos (`accountsPayable`), balances/pagos de clientes (`balances`), P&L (`financials`), identidad (`brandSettings`), horario (`workingHours`), tasas (`exchangeRates`), legal (`legalSettings`), navegación (`navigation`), admins (`adminUsers`), inventario y usos (`inventory`), ajustes globales (`/api/app-settings` → `clients`), fusión de clientes (`/api/admin/merge-clients` → `mergeClients`). `/api/upload` exige sesión. Públicos por diseño: catálogo activo, slots, galería, tasa actual, registro, auth, reseñas por id. **`GET /api/services?id=<uuid>` también es público, pero respeta `is_active`**: sin el permiso `services` responde 404 para un servicio desactivado, porque pedir el id a mano no puede saltarse el filtro del listado.
- `PATCH /api/admins` rechaza editar permisos del admin principal (`ADMIN_EMAIL`) con 403.
- **Los guards están auditados por un test de fuente** (`src/lib/api-authz-audit.test.ts`, 90 tests): recorre `src/app/api/**` y falla si una ruta que lee la BD y no está en su lista corta `PUBLIC_ROUTES` no llama a `auth()`, o si toca una de las `ADMIN_ONLY_TABLES` (financieras, inventario y auditoría) sin consultar `hasPermission`/`hasAnyPermission`/`canAdjustInventory`/`isAdmin`/`isSuperAdmin`. **Añadir un endpoint obliga a pasar por ahí**: si es público, a editar `PUBLIC_ROUTES`; si es de un módulo, a tener el permiso de verdad.
- En `/dashboard/admin-users` hay select "Copiar de…" para replicar permisos de otro admin (se aplican al guardar).

## 🎨 Componentes UI Clave
- AdminShell: shell del dashboard que recibe `permissions` (string[] | null) desde el layout de servidor y renderiza el sidebar con la navegación filtrada, el header móvil y `{children}`. Sin `fetch` de permisos (el HTML y la hidratación nacen del mismo snapshot).
- TrackingTags: Server Component que renderiza el snippet de analítica con `<script>` **nativos**, no con `next/script`. Se monta **solo** en el `<head>` de `src/app/layout.tsx` (el layout raíz), nunca en los layouts anidados. La lectura de BD es `getTrackingSettings()` en `src/lib/tracking-settings.ts` (a parte de `src/lib/tracking-tags.ts` porque ese es puro y se testea en node).
- **Por qué el tag va en el layout raíz y no en `(public)`/`(client)`**: el layout raíz es el **único** que puede escribir en `<head>`; uno anidado renderiza dentro de `<body>`, y React 19 solo sube a `<head>` los `<script async src>`, **nunca los inline**. Es decir, desde los layouts anidados el externo acababa en `<head>` y el `gtag('config')` inline en `<body>` — medio tag, que es justo lo que Google pide evitar. Con el tag en el raíz, **externo e inline van juntos y en orden en `<head>`**, manteniendo el orden que pegó el admin (el snippet oficial de GA4 ya trae `async src` → inline).
- **El gating lo decide `src/proxy.ts` vía header, no una allowlist**: el layout raíz no sabe en qué ruta está, así que el proxy marca el alcance con `x-tracking-scope: public` (`NextResponse.next({ request: { headers } })`) y el layout solo monta si `shouldRenderTracking()` (en `src/lib/tracking-scope.ts`) ve ese valor. El portal del cliente (`/profile`, `/complete-registration`) **sí** lleva etiquetas: es experiencia pública. El `matcher` del proxy se amplió a las páginas (excluyendo `api`, `_next`, `uploads`, `robots.txt`, `sitemap.xml`, `favicon.ico`, donde no hay `<head>` que renderizar y `auth()` no debe correr por archivo), pero **el guard de auth de `/dashboard` y `/profile` es seguridad y no se toca**: `requiresAuth()` reproduce exactamente el comportamiento anterior. `isAdminPath()` compara **con frontera** (`=== "/dashboard" || startsWith("/dashboard/")`) y no con `startsWith("/dashboard")` pelado, para que una futura `/dashboard-preview` no se quede sin tracking por un bug de prefijo. `shouldRenderTracking()` **falla cerrado**: cualquier valor distinto de `public` (incluido `null`, que es lo que llega al dashboard) no monta nada. En el dashboard tampoco se lee SQLite, porque la llamada va detrás del `&&`.
- **Por qué `<script>` nativos y NO `next/script`**: Google(tag) no detectaba la etiqueta con `strategy="afterInteractive"` porque Next solo emitía `<link rel="preload" as="script">` y el script real se insertaba tras la hidratación; el crawler ve el HTML inicial y no encuentra el tag. Con `<script src async>` nativo el `src` va en el HTML inicial y Google lo detecta, sin necesidad de `afterInteractive`.
- **El inline necesita `type="text/javascript"` o React 19 lo destruye**: en `react-dom-client`, el `case "script"` de `createElement` hace `didWarnScriptTags || isScriptDataBlock(newProps) || console.error("Encountered a script tag while rendering React component...")` y acto seguido **sustituye el nodo por un `<div>` vacío** (`nextResource.innerHTML = "<script></script>"; removeChild(firstChild)`). Es decir, el inline sí salía en el HTML del servidor (por eso Google lo detectaba) pero en el cliente React lo reemplaza por un div inerte: el `gtag('config')` nunca corría y no había pageview en navegaciones suaves. La **única** exención es `isScriptDataBlock`, que devuelve `true` cuando el `type` es un MIME de JavaScript válido (`application/javascript`, `text/javascript`, `text/jscript`, `text/x-javascript`, etc., pero **no** `module`/`importmap`/`speculationrules`). Por eso `renderTag()` pone `type="text/javascript"` en cada bloque inline: es lo correcto semánticamente y además lo que evita el warning y el descarte. El `<script src>` externo **no** lleva `type` a propósito, porque un `type` no-JS lo metería en el mismo `case` destructivo. Cubierto por 4 tests en `src/components/TrackingTags.test.tsx` (uno replica la lista de `isScriptDataBlock` para que el `type` no se rompa en una actualización de React). Nota: `next/script` con `beforeInteractive` solo es válido en el layout raíz, que es justamente el layout que **no** debe llevar el tag, así que no es una opción aquí.
- **Por qué el snippet se parsea y no se inyecta crudo**: `parseTrackingSnippet()` (`src/lib/tracking-tags.ts`, 19 tests) descompone el texto en `<script src>` y bloques inline reales. Un `<div dangerouslySetInnerHTML>` **no ejecuta** los scripts que se insertan (spec HTML) y `next/script` con `dangerouslySetInlineScript` los volvería texto inerte. El parser descarta comentarios y etiquetas que no sean script, tolera `>` dentro de atributos entrecomillados, cierra en el primer `</script>` y acepta scripts sin cerrar.
- ServiceCard: card de servicio con carrusel de fotos, nombre, duración, precio, botón "Agendar". El frame es un botón que abre el `PhotoLightbox` con todas las fotos del servicio; cada card monta su propio visor.
- AppointmentCard: card de cita con hora, cliente, servicio, foto referencia. La referencia se renderiza con `PhotoThumb` solo si llega `onOpenPhoto` (el `PhotoLightbox` vive una sola vez en `DashboardContent`, que pasa `openPhoto` tanto en la vista Día como en la de Pendientes).
- ClientCRMPanel: panel lateral con notas técnicas, stats, botón WhatsApp y contactos editables (nombre, teléfono, dirección y **email** — el email editable ayuda a unificar duplicados de Google)
- ClientCRMPanel: el bloque "Contacto" permite editar también el **email** del cliente; el `PATCH /api/clients/[id]` lo valida (400 formato inválido) y rechaza duplicados con 409, para que al iniciar sesión con Google el `linkGoogleAccount` enlace al usuario existente en vez de crear uno duplicado
- ClientCRMPanel: el bloque "Servicio adquirido" (renombrado a "Servicios adquiridos" cuando hay más de uno) lista las N compras de la cita con `isPrimary` para marcar la principal, y el selector elige cuál edita el `PATCH /api/purchases/[id]`. Antes hacía `if (data.id)` sobre una respuesta que ahora es un **array**: sin este cambio el bloque desaparecía entero en las citas con complementarios.
- ClientCRMPanel: el carrusel de referencias usa `client.photoGroups` (nuevo campo de `GET /api/clients/[id]`, fotos `reference` agrupadas por cita) en vez del fetch a `/api/appointments/[id]/photos`. Al abrirse desde la agenda prioriza la cita del `appointmentId` recibido; con más de un grupo muestra el selector "Modelos de otra visita" (pills de fecha) para cambiar de cita.
- ClientCRMPanel: **pasaporte de uñas** en el mismo drawer, debajo de las referencias. Segundo carrusel "Trabajos finalizados" alimentado por `client.passportGroups` (fotos `kind = 'final'` de citas `status = 'completed'`, agrupadas por cita). Lleva **su propio** estado `passportAppointmentId` y su propio selector "Trabajo de otra visita": referencias y trabajos finalizados son juegos de citas distintos (una cita completada puede no tener fotos de referencia y una pendiente no tiene fotos finales), así que un selector único los mezclaría. `passportGroups` usa `services.name` y **no** el snapshot de `service_purchases`, porque una sesión de curso tiene una fila de compra por alumno y el `LEFT JOIN` multiplicaría cada foto tantas veces como alumnos tenga la cita (mismo fan-out latente en `src/app/(client)/profile/page.tsx:70-73`).
- ClientCRMPanel: botón **"Fusionar cliente…"** (visible con el permiso `mergeClients`, pasado como `canMergeClients` desde `/dashboard/clients` y la agenda) que abre `MergeClientsDialog`: busca la clienta que **sobrevive** (`/api/clients?q=`), muestra un recuadro de resumen con quién se elimina (A) y quién sobrevive (B) —visitas, ingresos y qué se mueve— y confirma la fusión (`POST /api/admin/merge-clients`). Dirección fija: todo de A pasa a B y A se elimina.
- MergeClientsDialog: diálogo de fusión de clientes del admin (permiso `mergeClients`). Búsqueda con debounce de 300ms, excluye la clienta abierta, y el recuadro de confirmación explica explícitamente "Se ELIMINA (clienta A)" vs "SOBREVIVE (clienta B)" antes de confirmar.
- PhotoLightbox: **visor de fotos compartido** a pantalla completa (`z-[70]`, sobre los diálogos `z-50` del admin). Pellizco, rueda del ratón, arrastre con anclaje al punto tocado, doble toque/clic, teclado (`Esc`, flechas, `+`/`-`/`0`), contador `n / total`, porcentaje de zoom, botones Alejar/Acercar/Restablecer, pie de foto y prop `footer` (el muro público lo usa para el CTA "Agendar"). La descarga baja el **original a resolución completa** con nombre slugificado (`src/lib/download-name.ts`); si la URL es de otro origen, el botón pasa a "Abrir" con `target="_blank"`. La matemática de zoom/pan está en `src/lib/zoom.ts` (funciones puras, 23 tests). Los efectos del visor tienen cobertura de render en `src/components/PhotoLightbox.test.tsx` (6 tests) vía `jsdom` con dobles de `ResizeObserver`, `clientWidth/clientHeight` y `naturalWidth/naturalHeight`, porque jsdom no tiene motor de layout ni implementa `ResizeObserver`; ese archivo atrapa exactamente la regresión de medir el viewport con `[]`.
- Tests: los tests de componentes usan `.test.tsx` y declaran `// @vitest-environment jsdom` en la cabecera; `vitest.config.ts` los incluye en `include` y fuerza el runtime JSX automático. El resto son funciones puras en `.test.ts` con `environment: "node"`.
- PhotoLightbox: **el overlay se monta siempre pero solo se activa con fotos**. Todos los hooks corren antes del `return null`, así que los efectos con efectos secundarios (scroll lock, teclado y **medición del viewport**) deben preguntar por `active`; si no, el `ResizeObserver` se aborta en el montaje (cuando aún no hay superficie) y la imagen se renderiza en 0x0. El scroll lock usa un **contador de módulo** porque el visor se abre encima del drawer del CRM (`z-50`) y no puede restaurar el scroll antes de tiempo.
- usePhotoLightbox: hook que devuelve `{ photos, index, onIndexChange, onClose, open(fotos, i) }`. Patrón obligatorio en pantallas con varios puntos de entrada: **un solo** `<PhotoLightbox {...lightbox} />` por pantalla y cada miniatura llama `open(fotos, i)`.
- PhotoThumb: miniatura clickeable (`next/image`) que abre el visor con el grupo que recibe. Props: `photos`, `index`, `onOpen`, `width`, `height`, `className`.
- PhotoCarousel: carrusel de fotos con flechas y dots (ampliables vía `onOpen`). Props: `photos` (`{ id, url, caption? }[]`), `title`, `frameClassName`, `onOpen`. Lo usan el CRM del admin y la sección "Tus uñas" del portal de cliente.
- CompleteAppointmentDialog: diálogo para completar cita subiendo varias fotos finales (publicadas en el muro), registrar pago del momento ($/Bs con tasa del día) y marcar qué **esmaltes** (productos con categoría) se usaron en la cita, agrupados por categoría → subcategoría. Al confirmar envía `usage` que llaman a `recordUsage()`. El bloque de pago muestra el pagado total y la deuda real de la clienta (servicios no anulados) y, igual que `RegisterPaymentDialog`, un preview de qué hace el pago (`previewPayment`): si deja saldo a favor, exige marcar la casilla de confirmación antes de poder completar.
- GalleryGrid: grid masonry/pinterest para muro de inspiración; cada foto abre el `PhotoLightbox` con un snapshot de lo cargado (para que el scroll infinito no altere la lista mientras se navega) y el CTA "Agendar similar" va en el `footer` del visor (soporta fotos de citas y fotos sueltas del admin)
- FilterPills: pills horizontales para filtrar galería (Todas, Acrílicas, Gel, etc)
- BookingWizard: wizard de 3 pasos para reserva (con selección de modelos del muro y CTA "Unirme a la lista de espera" cuando el día no tiene slots disponibles). Con `?serviceId=` el paso 1 **siempre** se ve, sin salto automático al paso 2. Si lo preseleccionado es un principal, no se ofrece la lista de principales (la cita ya lo tiene) y queda el botón "Cambiar" en el resumen; si es un complementario, se marca como elegido y se ofrece **solo** la lista de complementarios restantes. El reparto del catálogo y la decisión de qué hacer con el id pedido son funciones puras en `src/lib/booking-combos.ts` (`partitionBookingServices`, `classifyBookingEntry`, `clearPreselected`).
- **Servicios principales + complementarios** (`services.is_complementary`): el paso 1 del wizard lista los servicios normales (elegibles como principal) y, en una sección aparte, los servicios con `is_complementary = 1` (los únicos que se pueden añadir con "+ Agregar"), con tope `MAX_COMPLEMENTARY_SERVICES = 4` de `src/lib/booking-combos.ts`. Un complementario nunca puede ser principal, así que un enlace `?serviceId=` directo a uno se resuelve como **cita solo de complementarios**: `resolveBookingServices()` pliega el id del slot de `serviceId` a la lista de complementarios en vez de fallar, y pasa por las mismas validaciones que cualquier otro (activo, marcado, no curso) y cuenta para el tope. Eso es lo que permite que ambas UIs anclen con el primer complementario elegido cuando no hay principal. El total de precio y duración se muestra en vivo y se repite en el paso 3.
- **Refresco de slots al cambiar la combinación**: `fetchSlots(date, ids)` recibe los ids por parámetro (no del closure) y `toggleComplementary`/`choosePrimary` la vuelven a llamar si ya había fecha elegida; si no, los slots en pantalla quedarían calculados para otra duración. En `NewAppointmentDialog` la combinación se elige antes de la fecha, así que alcanza con invalidar el slot.
- **Distinción "no cabe" vs "día lleno"**: `GET /api/slots` devuelve `maxContiguousMins` (el mayor bloque corrido libre) además de `hasAvailability`. Cuando `0 < maxContiguousMins < totalDurationMins` la UI **no** ofrece lista de espera (esperar no sirve: quitar un servicio es lo que desbloquea) y bloquea "Continuar" con un mensaje que lleva a quitar servicios. La lista de espera se reserva para `maxContiguousMins === 0` (día lleno de verdad).
- ProfileContent: "Mis próximas citas" pinta **una tarjeta por cita** con **una línea por servicio** (precio, duración y "Quitar" con confirmación en línea cuando hay más de uno). La miniatura de referencia, el estado y el botón "Cancelar cita" siguen a nivel de tarjeta porque pertenecen a la visita, no a un servicio.
- CompleteRegistrationForm: formulario para pedir teléfono tras registrarse con Google. Con `detectDuplicateClients` activo, arriba del formulario muestra la tarjeta "¿Ya eres cliente?" con las candidatas de nombre similar (teléfono enmascarado y visitas) y botones "Soy yo" (`POST /api/identity/claim`) + "No soy ninguna de estas, soy cliente nueva".
- ProfileContent: sección "¿No es tu expediente?" con la misma lista de candidatas para unir expedientes tarde (con aviso de confirmación si la cuenta ya tiene visitas).
- ProfileContent: "Mis pagos" compara lo que reportó la clienta con lo que el salón acreditó (`paymentAmountUsd` del join a `payments`) y, si difieren más de `0.004`, lo dice con las cifras reales. **La clienta ve la divergencia**: es su dinero y ya lo reportó, así que ocultarle que el salón acreditó otra cosa sería esconderle el estado de su cuenta. El estado de cuenta muestra "Saldo a favor $X" (ámbar) cuando la clienta pagó de más.
- StatsBanner: banner con total_visits y total_revenue del cliente
- LoginForm: formulario de login/registro por correo y contraseña
- NewAppointmentDialog: crea citas para walk-ins (clientes no registrados) desde la agenda. Admite los mismos complementarios que el wizard (multi-selección, total en vivo, y bloqueo con `maxContiguousMins` cuando la combinación no cabe).
- AddServiceDialog: diálogo "Servicio realizado" para registrar un servicio ya hecho sin cita previa (walk-in retrospectivo o ajuste manual de CXC) — campos: cliente, servicio, fecha/hora (default hoy, permite pasado), precio (default `service.price`, editable hasta 150%) y notas. Llama `POST /api/purchases` con `appointmentId: null`. Disponible desde la agenda (`+ Servicio realizado`), `/dashboard/balances` (por cliente) y el panel CRM.
- EditCostDialog: mini-diálogo para corregir manualmente el `avg_cost` de un producto de inventario. Pide nuevo costo (USD) y motivo obligatorio (≥3 chars). Visible en la fila de cada producto de la tabla de inventario solo si el admin tiene el permiso `adjustInventory`. Crea una fila en el kardex con `kind: "cost_adjust"`, `quantity: 0` y `unit_cost_usd: nuevo valor`.
- CourseSessionDialog: crea sesiones de curso grupal desde la agenda (elige servicio `is_group`, fecha/hora con slots y multi-selección de alumnos de `/api/clients`; muestra precio por alumno y total; llama `POST /api/course-sessions`)
- BlockoutDialog: crea bloques "no disponible" desde la agenda
- RegisterPaymentDialog: registra pagos ($/Bs con tasa BCV) desde cuentas por cobrar o el CRM. Antes de guardar muestra "Qué va a hacer este pago" con el reparto (deuda actual, cuánto cubre, cuánto queda de anticipo) calculado con `previewPayment` contra la deuda **real** de la clienta (la saca de `GET /api/balances`, el mismo permiso que registrar). Si el pago deja saldo a favor, exige marcar la casilla de confirmación para habilitar "Guardar".
- ReportPaymentDialog: reporta pago en Bs con captura desde "Mis pagos" del perfil de cliente. Con saldo a favor muestra "Saldo a favor $X" en vez de "Saldo pendiente".
- BalancesContent: en `/dashboard/balances` muestra el total adeudado **y** el total de saldos a favor, y lista **todas** las clientas (deudoras con badge `$X`, al día con «Al día», con sobrepago con «Saldo a favor $X») porque el historial de pagos y sus botones Editar/Eliminar viven en cada fila. Desglose por ítem con estado financiero y filtro por estado; buscador cliente-side (case-insensitive, ignora acentos) que matchea contra nombre, teléfono o servicio en sus items; el total adeudado refleja el saldo real, no el filtrado. El historial de cada clienta marca cada pago con su reparto (Abono / Completo / Anticipo $X) y, debajo, los servicios que ese pago cubre ("Cubre: Servicio $X · …") según `payment_allocations`. Pestaña "Pagos recibidos" para aprobar/rechazar capturas; al aprobar una que excede la deuda pide confirmación con el anticipo resultante; cada `photoUrl` abre el `PhotoLightbox`; las capturas aprobadas tienen además botón **"Eliminar pago"** (des-hace la aprobación, ver API).
- EditPaymentDialog: edita un pago acreditado (Bs, tasa, USD, fecha y cita). **Los tres campos numéricos arrancan vacíos y el valor actual va en el `placeholder`**: es la forma de que "no lo toques" sea el default en la ruta (si el admin no escribe, el body no lleva la clave y se conserva la cifra) en vez de tener que adivinar si el valor en pantalla es el que quiere dejar. El preview del nuevo total replica la precedencia de `resolvePaymentAmount` (el USD explícito gana) y muestra el delta y el balance resultante (saldo a favor en ámbar si queda negativo, "sin deuda" en verde si queda en cero). Aviso ámbar cuando `lockAmount` (el pago viene de una captura), porque cambiar el monto rompe la coincidencia con lo que reportó la clienta, y otro aviso ámbar si la edición deja un saldo a favor (anticipo).
- BalancesContent: **EditPaymentDialog se monta una sola vez**, abierto desde dos puntos de entrada — "Editar" en el historial de pagos de una clienta y "Editar pago" en las capturas aprobadas. `editing` guarda el pago y `editingContext` el contexto (clienta, balance, citas, `lockAmount`); desde la pestaña de capturas la clienta puede no estar en `clients`, así que balance y citas son mejores-esfuerzo: el diálogo funciona igual, solo pierde el preview y el selector. Las citas salen de `appointmentsFromItems()`, que deduplica por `appointmentId` porque una cita con complementarios tiene N compras. El `DELETE` avisa antes qué pasa con la captura ligada y refresca las dos pestañas.
- SettingsContent: editor del horario de trabajo por día de la semana y enlace al editor de navegación cuando el admin tiene `navigation`.
- BillFormDialog: crea/edita facturas (inventario con líneas de producto o gasto fijo $/Bs) desde Compras. Al crear un producto sin código, `POST /api/inventory/items` genera el código automáticamente.
- SupplierPaymentDialog: registra pagos a proveedores ($/Bs con tasa BCV) desde Cuentas por pagar (captura obligatoria)
- MovementDialog: registra salidas/ajustes de stock (con motivo obligatorio en ajustes) desde Inventario
- PurchasesContent: pestañas de facturas (grid maestro-detalle editable), proveedores y categorías en /dashboard/purchases
- AccountsPayableContent: pestañas de por pagar, pagos realizados y bancos en /dashboard/accounts-payable. Cada pago de proveedor muestra la miniatura de su captura (`supplier_payments.photoUrl`, obligatoria) con acceso al `PhotoLightbox`.
- InventoryContent: pestañas de productos (grid con foto/código/barras/categoría/subcategoría, máx usos y badge "Agotado"), kardex y uso por servicio en /dashboard/inventory. La pestaña de productos incluye buscador por nombre, código, código de barras, categoría y subcategoría, con coincidencia sin distinguir mayúsculas ni acentos. La edición permite `category`/`subcategory`/`max_uses` y botón "Marcar agotado"/"Reabrir" (`setExhausted`). Cada producto tiene botón "Editar costo" (`EditCostDialog`, requiere `adjustInventory`) que crea una fila `kind: "cost_adjust"` en el kardex con motivo obligatorio; el kardex muestra la fila con badge púrpura "Costo" y el valor `unit_cost_usd`.
- FinancialsContent: P&L mensual (ingresos, gastos, utilidad) en /dashboard/financials
- GalleryContent: `/dashboard/gallery` tiene dos pestañas. **"Muro de inspiración"** (`WallTab`): subida múltiple, servicio asociado opcional y descripción; eliminar con confirmación. **"Producción"** (`ProductionTab`): archivo de solo lectura de todas las fotos finales de citas completadas, agrupado por día con encabezados `sticky` y paginado con "Cargar días anteriores". Filtros de rango de fechas, servicio y búsqueda por clienta con separación draft/aplicado (botón "Filtrar", como `/dashboard/activity`). Ambas pestañas montan **su propio** `PhotoLightbox` porque solo una está montada a la vez; ambas usan el mismo grid masonry `columns-2 sm:columns-3` con `break-inside-avoid` que ya usan `GalleryGrid` y el muro. El pie de cada foto (`caption`) lo arma el endpoint con `buildProductionCaption` y alimenta el pie del visor **y** el nombre de la descarga.
- **Búsqueda sin acentos en SQL**: `src/db/index.ts` registra la función `fold` en la conexión SQLite (`sqlite.function("fold", { deterministic: true }, foldSearchText)`), que pliega diacríticos y baja a minúsculas. Hace falta porque el `LIKE` de SQLite no ignora tildes y el filtro de clientas del archivo de producción va en SQL (un filtro client-side rompería la paginación por día). El texto buscado se escapa con `escapeLikePattern` + `ESCAPE '\'` para que `%` y `_` sean literales. **Ojo al escribir ese `ESCAPE` dentro de un template literal de JS**: en el código hay que escribir `'\\'` (barra invertida real), porque escribir `'\ '` a mano colapsa a `''` y SQLite rechaza la consulta con "ESCAPE expression must be a single character". El resto de los buscadores del proyecto (`/dashboard/balances`, `/dashboard/inventory`) siguen siendo client-side.
- `LightboxPhoto` acepta un `date?: string | null` opcional ("YYYY-MM-DD") que solo afecta el nombre del archivo descargado (`photoDownloadName` ya lo soportaba pero nadie lo pasaba; `PhotoLightbox` ahora lo reenvía). Las pantallas que no lo pasan se comportan igual que antes.
- ConfirmDialog: modal de confirmación reutilizable (cancelar cita, eliminar cliente/servicio)

## 🚀 Comandos
- `npm run dev` → desarrollo
- `npm run db:setup` → genera y aplica migraciones + seed base
- `npm run db:seed:client` → regenera datos demo del cliente (clienta@email.com / Cliente123!)
- `npm run db:seed:finance` → regenera datos demo de finanzas (proveedores, bancos, facturas, inventario y uso por servicio)
- `npm run db:seed:privacy` → inserta/actualiza la fila `legal_settings` con los 9 campos de la política de privacidad (placeholders editables luego en `/dashboard/legal`)
- `npm run db:backfill:rates` → scrapea la serie histórica del BCV e inserta las fechas que falten en `exchange_rates` (idempotente)
- `npm run db:backfill:media` → mueve a `private-uploads/` las capturas de pago y fotos de inventario que estaban en `public/uploads` y reescribe la `photo_url` de cada fila a `/api/media/<kind>/<file>` (idempotente)
- `npm run db:backfill:allocations` → reconstruye `payment_allocations` y el `financial_status` derivado de todas las clientas con compras o pagos (idempotente)
- `npm run risc:register` → registra el endpoint `/api/risc/events` en el stream de Google RISC (requiere `RISC_SERVICE_ACCOUNT_JSON_PATH` y `RISC_RECEIVER_URL`); usar una vez al configurar el proyecto y re-registrar si cambia la URL
- `npm run build && npm start` → producción local
- `npm run lint` → ESLint
- `npx tsc --noEmit` → typecheck

## 🧪 Datos Demo
- Cliente: `clienta@email.com` / `Cliente123!` (Ana Martínez). El seed `db:seed:client` lo crea/actualiza con dirección, notas técnicas, citas próximas y completadas, fotos de referencia/finales, reseñas, snapshots de compra, fotos de servicios para el home, horario de trabajo por defecto (si vacío), pagos demo (PAGO-001 $35, PAGO-002 $10) y una captura de pago pendiente de aprobar (900 Bs). Re-ejecutable (borra y regenera las citas del demo).
- Admin: el `ADMIN_EMAIL` configurado en `.env` se promueve a superadmin al iniciar sesión.
- Finanzas: el seed `db:seed:finance` genera proveedores, bancos ($/Bs), 4 items de inventario con códigos (`ACR-001`, `ACR-002`, `GEL-001`, `TIP-001`) y códigos de barras, entradas vía factura F-1001 (parcialmente pagada), factura de alquiler en Bs, uso de productos por servicio (Acrílicas Full y Gel Semipermanente) y una captura de pago pendiente. Re-ejecutable: borra y regenera los datos de finanzas.

## 🛡️ Seguridad de dependencias
- `next` y `eslint-config-next` están pineados a la **versión exacta** y deben moverse **siempre juntos**. Si subes uno solo, el otro queda desalineado con el runtime.
- **No uses `npm audit fix` a secas.** El árbol tiene avisos sin arreglo oficial en la rama 0.x, así que npm propone un *downgrade* de `drizzle-kit` que deja el proyecto peor. Cambia las dependencias a mano.
- Para verificar el estado real de producción usa `npm audit --omit=dev` (el árbol dev arrastra avisos que no se explotan en runtime) y `npm ls <paquete>` para confirmar en qué versión resolvió cada copia transitiva.
- Riesgos aceptados a propósito (revisar en cada actualización mayor):
  - `vitest` 2.1.9: crítico solo si el **UI server** está escuchando; el proyecto usa `vitest run`, que nunca lo levanta. Fix oficial = salto major a `vitest@5`.
  - `drizzle-kit` 0.31.11 arrastrando `esbuild` 0.18.20: requiere el dev server de esbuild sirviendo, y drizzle-kit es un CLI local. La rama 0.x no tiene fix; la salida es migrar a `drizzle-kit@1.0.0-beta.24`+.
- Al subir `next` o `sharp`, recuerda que la app decodifica **todo lo que hay en `/public/uploads`** vía `/_next/image` sobre peticiones no autenticadas. Ese par (uploads + optimizador) es la superficie de RCE más sensible del despliegue, y el despliegue real es Windows detrás de Cloudflare Tunnel.

## 🔐 Uploads de imágenes
- `POST /api/upload` (exige sesión) es la **única** vía de subida de imágenes del sistema (fotos de citas, del muro, del catálogo, capturas de pago de clientes y de proveedores).
- `/public/uploads` se sirve en el **mismo origen** que la app. Por eso un archivo con contenido HTML o SVG es XSS con acceso a la cookie de sesión: nunca confíes en la extensión que manda el cliente.
- La extensión la decide el **servidor** a partir de los magic bytes del contenido, con `validateImageUpload()` en `src/lib/image-upload.ts` (funciones puras + tests). `file.name` no determina cómo se guarda el archivo.
- Formatos aceptados: **JPG, PNG, WebP, GIF, HEIC**. HEIC está porque `accept="image/*"` lo genera iOS y existe al menos un archivo real así en el repo: si agregas un formato, verifica contra `public/uploads/**` con `detectImageType` antes de darlo por bueno.
- **AVIF y SVG están excluidos a propósito.** AVIF es el vector de entrega del RCE de la API de optimización de imágenes de Next (los `<Image>` decodifican lo que hay en `/uploads` a través de `/_next/image`, y `sharp` arrastra los CVE de libheif/libvips), y SVG es XSS directo. No los re-añadas sin actualizar `next`/`sharp` primero.
- Hay un tope de 25 MB (`MAX_UPLOAD_BYTES`).
- `next.config.ts` sirve `/uploads/:path*` con `X-Content-Type-Options: nosniff` como defensa en profundidad. Si añades otra ruta estática con archivos subidos por usuarios, aplícale el mismo header.
- Al cambiar la validación, corre los tests de `src/lib/image-upload.test.ts` **y** la comprobación contra los archivos reales del repo (ver `CHANGELOG.md`); los fixtures sintéticos no detectan un offset mal calculado en la caja ISO BMFF de HEIC.

### Media privada: `private-uploads/` y `/api/media/[kind]/[file]`
- **Dos destinos, y la diferencia es deliberada.** `POST /api/upload` decide por el campo `kind` del `FormData`: sin `kind` (o con uno desconocido) el archivo va a `public/uploads/`; con un `kind` de `PRIVATE_MEDIA_KINDS` va a `private-uploads/`, que está **fuera de `public/`** y por tanto no lo sirve el servidor de estáticos.
- **Por qué el split**: `public/uploads` es público y sin sesión, y `/uploads/` está a propósito **fuera** del `Disallow` de robots.txt por el SEO de Google Images. Eso sirve para las fotos del muro, del catálogo y del logo (el activo de SEO del salón) y **no** para una captura de transferencia bancaria, donde van el nombre, el alias y a veces el teléfono de la clienta.
- **Columnas que son media privada**: `payment_receipts.photo_url`, `payments.photo_url`, `supplier_payments.photo_url` e `inventory_items.photo_url`. Su valor es `/api/media/<kind>/<uuid>.<ext>`, no `/uploads/...`.
- **`GET /api/media/[kind]/[file]` autoriza por la FILA, no por la URL**: busca la fila cuyo `photo_url` sea exactamente esa URL y exige sesión + (clienta dueña o admin con el permiso del módulo, según `PRIVATE_MEDIA_RULES`). Un archivo huérfano —subido y nunca ligado a una fila— da 404, y por eso no se sirve solo porque alguien se sepa la URL. `Cache-Control: private, no-store` y `nosniff`: no debe quedar en el caché del túnel, del navegador ni del back-forward cache.
- El nombre del archivo lo pone el servidor (`${crypto.randomUUID()}.${ext}`), así que `parsePrivateMediaFile()` acepta **solo** un UUID con extensión de la lista cerrada y nada más: un `../../` no llega a construirse. El path en disco se arma con ese UUID, nunca con la URL.
- Las reglas `kind → tabla / permiso / columna de dueño` viven en `PRIVATE_MEDIA_RULES` (`src/lib/private-media.ts`). **Un kind nuevo obliga a:** añadirlo a `PRIVATE_MEDIA_KINDS`, darle su regla, pasar `kind` en el `FormData` del diálogo que lo sube, y decidir quién lo ve.
- **Migración de lo que ya estaba en `public/uploads`**: `npm run db:backfill:media` (idempotente, se puede correr las veces que haga falta). **Copia** a un UUID distinto por fila en vez de mover, porque el mismo archivo puede estar en varias filas y de varios kinds (en los datos demo una captura aparece a la vez como `receipt` y como `payment`), y el original de `public/uploads` solo se borra cuando ninguna fila lo apunta.

### Cabeceras de seguridad (`next.config.ts`)
- Global (`source: "/(.*)"`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` con cámara, micrófono y geolocalización cerrados (el salón no usa ninguno: la agenda pide por texto y las fotos se suben como archivo).
- **Sin CSP a propósito.** `tracking_tags` es JavaScript arbitrario que pega el superadmin (GA4, GTM, un pixel) y se renderiza con `<script>` nativos en el `<head>` del layout raíz. Una `script-src` cerrada rompería el tag, y aflojar la CSP para que quepa código de terceros no aporta seguridad.
- **Sin HSTS.** `next.config.ts` corre también en dev, donde el dominio se sirve por http y fijarlo dejaría al navegador reescribiendo a https contra un servidor que no habla https. HSTS lo emite Cloudflare en el borde, que es donde corresponde.

## 🚫 Fuera del Alcance (MVP)
- Pasarelas de pago (Stripe/MercadoPago)
- Multi-empleado (roles complejos)
- Lectura bidireccional de Google Calendar
- API oficial de WhatsApp Business
- Despliegue en la nube (solo local + Cloudflare Tunnel)

## 🗑️ Reglas de borrado
- Eliminar cliente (`DELETE /api/clients/[id]`, admin): solo si NO tiene citas (`appointments.client_id`), pagos/cuentas por cobrar (`payments.user_id`), filas en `waitlist` ni citas canceladas archivadas (`cancelled_appointments.client_id`). Los usuarios con `role='admin'` no se eliminan (403). Las filas de Auth.js (`account`, `session`) se borran por CASCADE.
- Eliminar servicio (`DELETE /api/services/[id]`, admin): solo si NO tiene citas (`appointments.service_id`), `service_purchases` ni filas en `cancelled_appointments.service_id` (400 + sugerir desactivar). Las fotos (`service_photos`) se borran por CASCADE.
- Cancelar cita (`DELETE /api/appointments/[id]`, admin o propietario): borra la cita **definitivamente** tras archivar el snapshot en `cancelled_appointments` y borrar los eventos de Google Calendar. Las citas `completed` no se pueden cancelar (400). El `PATCH` con `status:'cancelled'` devuelve 400 ("usa DELETE"). En la agenda, cancelar pide confirmación (`ConfirmDialog`); las canceladas se ven en la pestaña "Canceladas" de la agenda.
- Eliminar proveedor (`DELETE /api/suppliers/[id]`, admin): solo si NO tiene facturas (`bills.supplier_id`).
- Eliminar categoría (`DELETE /api/expense-categories/[id]`, admin): solo si NO tiene facturas (`bills.category_id`).
- Eliminar banco (`DELETE /api/bank-accounts/[id]`, admin): solo si NO tiene pagos (`supplier_payments.bank_account_id`); si los tiene se sugiere desactivarlo.
- Eliminar factura (`DELETE /api/bills/[id]`, admin): solo si NO tiene pagos (`supplier_payments.bill_id`, 400); revierte el stock de los items con `reverseBillMovements()`. Las `bill_items` se borran por CASCADE.
- Eliminar item de inventario (`DELETE /api/inventory/items/[id]`, admin): solo si NO tiene stock, facturas (`bill_items`), movimientos ni usos en servicios; si los tiene se sugiere desactivarlo.
- Eliminar servicio realizado sin cita (`DELETE /api/purchases/[id]`, permiso `balances`): solo si la fila de `service_purchases` tiene `appointment_id = null` (los creados por "Servicio realizado" desde la agenda, Balances o el CRM). Decrementa `users.total_visits` en 1 y llama a `recomputeFinancialStatus`. Las compras con cita asociada no se eliminan desde aquí; se cancelan vía `DELETE /api/appointments/[id]`.
