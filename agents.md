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

## 📏 Reglas de Desarrollo
- Mobile-first en todas las vistas de cliente
- Paleta de colores: rosa pastel (#FFE5EC, #FFC2D1), blanco, gris suave (#F5F5F5)
- Bordes redondeados (rounded-xl), sombras suaves
- Drizzle con queries SQL puras, evitar abstracciones complejas
- Imágenes en /public/uploads (MVP local)
- Timezone local del salón para TODAS las fechas
- Privacidad por defecto: solo nombre de pila en muro público
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
- financial_status: text, default 'pending' (pending | partial | paid | void) — lo recalcula `recomputeFinancialStatus` según los pagos del cliente
- completion_date: integer (timestamp, fecha de producción; se setea al completar la cita)
- created_at: integer (timestamp)

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
- `photo_url` (opcional): captura de la transferencia al registrar un pago de cliente.

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
- Refresh diario vía cron externo: `GET /api/exchange-rate/refresh` (admin con sesión o `CRON_SECRET` en header `Authorization: Bearer` o query `?secret=`) fuerza `refreshTodayRate()` (inserta o actualiza la fila de hoy con `onConflictDoUpdate`). cron-job.org debe llamar la URL pública del túnel a diario.

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

## 🗺️ Estructura de Rutas

### Públicas
- `/` → Landing con catálogo de servicios + muro de inspiración
- `/login` → Login/registro por correo y contraseña (además de botón Google)
- `/book` → Wizard de reserva (3 pasos)
- `/review/[id]` → Formulario de reseña post-cita
- `/politicas` → Política de privacidad (documento legal)

### Protegidas (requieren auth)
- `/dashboard` → Panel admin (agenda del día/semana con sesiones de curso grupal, pestaña "Espera" con la lista de espera y pestaña "Canceladas" con el archivo de citas canceladas)
- `/dashboard/clients` → CRM de clientes (listado, búsqueda, alta manual, notas/stats)
- `/dashboard/balances` → Cuentas por cobrar (total adeudado, desglose por ítem con estado financiero, pagos por cliente)
- `/dashboard/purchases` → Compras (facturas, proveedores y categorías de gasto)
- `/dashboard/accounts-payable` → Cuentas por pagar (facturas pendientes, pagos a proveedores y bancos)
- `/dashboard/inventory` → Inventario (existencias, kardex y uso por servicio)
- `/dashboard/financials` → Estados financieros (P&L mensual base de caja + producción)
- `/dashboard/settings` → Configuración (horario de trabajo por día de la semana)
- `/dashboard/services` → Gestión de servicios (flag "Es curso/grupo", fotos del servicio, eliminar si no tiene uso)
- `/dashboard/gallery` → Muro de inspiración (subida independiente de fotos por el admin para pre-llenar el muro, sin cita asociada)
- `/dashboard/admin-users` → Gestión de admins (solo superadmin)
- `/dashboard/legal` → Datos legales del salón (campos variables de las políticas de privacidad)
- `/profile` → Portal de cliente (pasaporte de uñas + historial + estado de cuenta + "Mis pagos" con reporte de capturas)
- `/complete-registration` → Completar registro (pedir teléfono tras OAuth de Google)

### APIs nuevas de permisos y pagos
- `GET /api/my-permissions` (admin autenticado) → permisos del admin actual.
- `GET /api/exchange-rate/current` (público) → tasa del día (usa `getTodayRate`).
- `GET /api/payment-receipts` → admin: todas (filtro `?status=`); cliente: solo las suyas.
- `POST /api/payment-receipts` (cliente) → reporta pago en Bs con captura; valida cita propia.
- `PATCH/DELETE /api/payment-receipts/[id]` → solo permiso `paymentApproval`; `approve` inserta en `payments` y liga `paymentId`.
- `GET/POST /api/gallery-photos` (admin) → lista/sube fotos sueltas del muro (`gallery_photos`, archivos en `/public/uploads/gallery`; POST acepta `serviceId` y `caption` opcionales).
- `DELETE /api/gallery-photos/[id]` (admin) → borra la fila y el archivo.
- `GET /api/gallery` (público) ahora fusiona fotos finales de citas compartidas + fotos sueltas de `gallery_photos` (orden por fecha desc, cursor).
- `GET/POST /api/appointments/[id]/review` (público por id de cita): GET devuelve datos mínimos (servicio, fecha, nombre de pila, reseña existente); POST guarda `review_rating` (1-5 obligatorio) + `review_text` (opcional, máx 500) solo en citas `completed`; 409 si ya tiene reseña.
- `GET /api/waitlist` (admin) → lista la lista de espera con nombre/teléfono del cliente.
- `POST /api/waitlist` (usuario autenticado) → se une con `preferredDate` (timestamp inicio de día); dedupe por cliente+fecha (409); rechaza fechas pasadas (400).
- `PATCH /api/waitlist/[id]` (admin) → marca `notified`.
- `DELETE /api/waitlist/[id]` → dueño de la entrada o admin.
- `POST/GET /api/course-sessions` (admin, `appointments`): crea una sesión de curso grupal (1 `appointments` + N `course_enrollments` + N `service_purchases` pending, validando `services.is_group=1` y disponibilidad) y lista las sesiones con alumnos y saldo por alumno.
- `POST/DELETE /api/course-sessions/[id]/enrollments` (admin, `appointments`): inscribe/desinscribe un alumno registrado pre-completar (crea/borra su enrollment + `service_purchases`; 409 si ya está inscrito; 400 si la sesión está completada).
- `POST /api/risc/events` (público, sin auth, solo accesible vía HTTPS en dominio autorizado) → receptor de eventos RISC (Cross-Account Protection) de Google. Valida JWT con `google-auth-library`, deduplica por `jti` en `risc_events`, y en `sessions-revoked` / `tokens-revoked` borra las filas de `session` + `account` del usuario afectado, y en `account-disabled` bloquea al usuario (`users.locked_at` + `users.locked_reason`).

### Tabla: risc_events (de-duplicación de eventos RISC)
- jti: text, primary key (id único del JWT de Google)
- event_type: text, not null (URI del evento, ej: `.../risc/event-type/sessions-revoked`)
- subject_sub: text (Google `sub` del usuario afectado; null para `verification`)
- received_at: integer (timestamp)

## 🔐 Permisos de admins
- `users.permissions`: JSON array de claves; **null = acceso a todos los módulos** (no rompe admins existentes).
- Superadmin (`ADMIN_EMAIL`) siempre tiene acceso total.
- Claves (`PERMISSION_KEYS` en `src/lib/permissions.ts`): `appointments`, `clients`, `balances`, `purchases`, `accountsPayable`, `inventory`, `adjustInventory`, `financials`, `settings`, `services`, `gallery`, `adminUsers`, `paymentApproval`.
- `hasPermission(session, key)` en `src/lib/authz.ts` bloquea a no-admins y a admins sin el permiso. `hasAnyPermission(session, keys)` acepta varios módulos. `adjustInventory` controla salidas/ajustes de stock; `paymentApproval` controla aprobar/rechazar/eliminar capturas de pago.
- Guardas auditadas por endpoint: servicios (`services*` → `services`), snapshot de compras por cita (`/api/purchases*` → `appointments`), clientes (`/api/clients*` → `clients` **o** `appointments` porque el CRM panel y walk-ins viven en la agenda), blockouts y waitlist admin (`appointments`), muro (`gallery`), facturas/proveedores/categorías (`purchases`), pagos proveedor/bancos (`accountsPayable`), balances/pagos de clientes (`balances`), P&L (`financials`), horario (`settings`), admins (`adminUsers`), inventario y usos (`inventory`). `/api/upload` exige sesión. Públicos por diseño: catálogo activo, slots, galería, tasa actual, registro, auth, reseñas por id.
- `PATCH /api/admins` rechaza editar permisos del admin principal (`ADMIN_EMAIL`) con 403.
- En `/dashboard/admin-users` hay select "Copiar de…" para replicar permisos de otro admin (se aplican al guardar).

## 🎨 Componentes UI Clave
- ServiceCard: card de servicio con carrusel de fotos, nombre, duración, precio, botón "Agendar"
- AppointmentCard: card de cita con hora, cliente, servicio, foto referencia
- ClientCRMPanel: panel lateral con notas técnicas, stats, botón WhatsApp y contactos editables
- PhotoCarousel: carrusel de fotos de referencia al abrir una cita en la agenda
- CompleteAppointmentDialog: diálogo para completar cita subiendo varias fotos finales (publicadas en el muro), registrar pago del momento ($/Bs con tasa del día) y marcar qué **esmaltes** (productos con categoría) se usaron en la cita, agrupados por categoría → subcategoría. Al confirmar envía `usage` que llaman a `recordUsage()`.
- GalleryGrid: grid masonry/pinterest para muro de inspiración con clic → agendar similar (soporta fotos de citas y fotos sueltas del admin)
- FilterPills: pills horizontales para filtrar galería (Todas, Acrílicas, Gel, etc)
- BookingWizard: wizard de 3 pasos para reserva (con selección de modelos del muro y CTA "Unirme a la lista de espera" cuando el día no tiene slots disponibles)
- CompleteRegistrationForm: formulario para pedir teléfono tras registrarse con Google
- StatsBanner: banner con total_visits y total_revenue del cliente
- LoginForm: formulario de login/registro por correo y contraseña
- NewAppointmentDialog: crea citas para walk-ins (clientes no registrados) desde la agenda
- AddServiceDialog: diálogo "Servicio realizado" para registrar un servicio ya hecho sin cita previa (walk-in retrospectivo o ajuste manual de CXC) — campos: cliente, servicio, fecha/hora (default hoy, permite pasado), precio (default `service.price`, editable hasta 150%) y notas. Llama `POST /api/purchases` con `appointmentId: null`. Disponible desde la agenda (`+ Servicio realizado`), `/dashboard/balances` (por cliente) y el panel CRM.
- EditCostDialog: mini-diálogo para corregir manualmente el `avg_cost` de un producto de inventario. Pide nuevo costo (USD) y motivo obligatorio (≥3 chars). Visible en la fila de cada producto de la tabla de inventario solo si el admin tiene el permiso `adjustInventory`. Crea una fila en el kardex con `kind: "cost_adjust"`, `quantity: 0` y `unit_cost_usd: nuevo valor`.
- CourseSessionDialog: crea sesiones de curso grupal desde la agenda (elige servicio `is_group`, fecha/hora con slots y multi-selección de alumnos de `/api/clients`; muestra precio por alumno y total; llama `POST /api/course-sessions`)
- BlockoutDialog: crea bloques "no disponible" desde la agenda
- RegisterPaymentDialog: registra pagos ($/Bs con tasa BCV) desde cuentas por cobrar o el CRM
- ReportPaymentDialog: reporta pago en Bs con captura desde "Mis pagos" del perfil de cliente
- SettingsContent: editor del horario de trabajo por día de la semana
- BillFormDialog: crea/edita facturas (inventario con líneas de producto o gasto fijo $/Bs) desde Compras. Al crear un producto sin código, `POST /api/inventory/items` genera el código automáticamente.
- SupplierPaymentDialog: registra pagos a proveedores ($/Bs con tasa BCV) desde Cuentas por pagar (captura obligatoria)
- MovementDialog: registra salidas/ajustes de stock (con motivo obligatorio en ajustes) desde Inventario
- PurchasesContent: pestañas de facturas (grid maestro-detalle editable), proveedores y categorías en /dashboard/purchases
- AccountsPayableContent: pestañas de por pagar, pagos realizados y bancos en /dashboard/accounts-payable
- InventoryContent: pestañas de productos (grid con foto/código/barras/categoría/subcategoría, máx usos y badge "Agotado"), kardex y uso por servicio en /dashboard/inventory. La edición permite `category`/`subcategory`/`max_uses` y botón "Marcar agotado"/"Reabrir" (`setExhausted`). Cada producto tiene botón "Editar costo" (`EditCostDialog`, requiere `adjustInventory`) que crea una fila `kind: "cost_adjust"` en el kardex con motivo obligatorio; el kardex muestra la fila con badge púrpura "Costo" y el valor `unit_cost_usd`.
- FinancialsContent: P&L mensual (ingresos, gastos, utilidad) en /dashboard/financials
- GalleryContent: gestor del muro de inspiración en /dashboard/gallery (subida múltiple, servicio asociado opcional y descripción; eliminar con confirmación)
- ConfirmDialog: modal de confirmación reutilizable (cancelar cita, eliminar cliente/servicio)

## 🚀 Comandos
- `npm run dev` → desarrollo
- `npm run db:setup` → genera y aplica migraciones + seed base
- `npm run db:seed:client` → regenera datos demo del cliente (clienta@email.com / Cliente123!)
- `npm run db:seed:finance` → regenera datos demo de finanzas (proveedores, bancos, facturas, inventario y uso por servicio)
- `npm run db:seed:privacy` → inserta/actualiza la fila `legal_settings` con los 9 campos de la política de privacidad (placeholders editables luego en `/dashboard/legal`)
- `npm run risc:register` → registra el endpoint `/api/risc/events` en el stream de Google RISC (requiere `RISC_SERVICE_ACCOUNT_JSON_PATH` y `RISC_RECEIVER_URL`); usar una vez al configurar el proyecto y re-registrar si cambia la URL
- `npm run build && npm start` → producción local
- `npm run lint` → ESLint
- `npx tsc --noEmit` → typecheck

## 🧪 Datos Demo
- Cliente: `clienta@email.com` / `Cliente123!` (Ana Martínez). El seed `db:seed:client` lo crea/actualiza con dirección, notas técnicas, citas próximas y completadas, fotos de referencia/finales, reseñas, snapshots de compra, fotos de servicios para el home, horario de trabajo por defecto (si vacío), pagos demo (PAGO-001 $35, PAGO-002 $10) y una captura de pago pendiente de aprobar (900 Bs). Re-ejecutable (borra y regenera las citas del demo).
- Admin: el `ADMIN_EMAIL` configurado en `.env` se promueve a superadmin al iniciar sesión.
- Finanzas: el seed `db:seed:finance` genera proveedores, bancos ($/Bs), 4 items de inventario con códigos (`ACR-001`, `ACR-002`, `GEL-001`, `TIP-001`) y códigos de barras, entradas vía factura F-1001 (parcialmente pagada), factura de alquiler en Bs, uso de productos por servicio (Acrílicas Full y Gel Semipermanente) y una captura de pago pendiente. Re-ejecutable: borra y regenera los datos de finanzas.

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
