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
- total_visits: integer, default 0
- total_revenue: real, default 0
- role: text, default 'client' (client | admin)
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

### Tabla: service_photos
- id: text, primary key
- service_id: text, foreign key → services.id (on delete cascade)
- url: text, not null
- position: integer, default 0
- created_at: integer (timestamp)

### Tabla: service_purchases (snapshot del servicio al comprar, inmutable)
- id: text, primary key
- user_id: text, foreign key → users.id
- appointment_id: text, foreign key → appointments.id (on delete cascade)
- service_id: text, foreign key → services.id
- service_name: text, not null
- service_description: text
- service_price: real, not null
- service_duration_mins: integer, not null
- created_at: integer (timestamp)

### Tabla: waitlist
- id: text, primary key
- client_id: text, foreign key → users.id
- preferred_date: integer (timestamp)
- notified: integer (boolean), default 0

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
- reference: text, not null (obligatorio)
- paid_at: integer (timestamp)
- notes: text
- created_by: text, foreign key → users.id
- created_at: integer (timestamp)
- El saldo se calcula en vivo: `Σ service_purchases.service_price de citas completed − Σ payments.amount_usd`.

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
- id: text, primary key
- name: text, not null
- unit: text, default 'unidad'
- stock: real, default 0
- avg_cost: real, default 0 (costo promedio ponderado, se recalcula en cada entrada)
- min_stock: real, default 0 (umbral para badge "Stock bajo")
- is_active: integer (boolean), default 1
- notes: text
- created_at: integer (timestamp)
- `stockValue` = `stock * avg_cost` (se calcula en el API).

### Tabla: inventory_movements (kardex)
- id: text, primary key
- inventory_item_id: text, foreign key → inventory_items.id
- kind: text, not null ('in' | 'out' | 'adjust')
- quantity: real, not null (positivo para in, negativo para out/adjust)
- unit_cost_usd: real (solo en entradas)
- ref_type: text, default 'manual' ('bill' | 'manual')
- ref_id: text (id de la factura si ref_type='bill')
- notes: text
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
- reference: text, not null (obligatorio)
- notes: text
- created_by: text, foreign key → users.id
- created_at: integer (timestamp)
- Al crear/borrar un pago se recalcula `bills.status` con `recomputeBillStatus()`.

### Tabla: service_products (uso de inventario por servicio)
- id: text, primary key
- service_id: text, foreign key → services.id (on delete cascade)
- inventory_item_id: text, foreign key → inventory_items.id
- quantity_per_service: real, not null
- unique index (service_id, inventory_item_id). `estUsos` del item = `stock / Σ quantity_per_service`.

## 🗺️ Estructura de Rutas

### Públicas
- `/` → Landing con catálogo de servicios + muro de inspiración
- `/login` → Login/registro por correo y contraseña (además de botón Google)
- `/book` → Wizard de reserva (3 pasos)
- `/review/[id]` → Formulario de reseña post-cita

### Protegidas (requieren auth)
- `/dashboard` → Panel admin (agenda del día/semana + pestaña "Canceladas" con el archivo de citas canceladas)
- `/dashboard/clients` → CRM de clientes (listado, búsqueda, alta manual, notas/stats)
- `/dashboard/balances` → Cuentas por cobrar (total adeudado, pagos por cliente)
- `/dashboard/purchases` → Compras (facturas, proveedores y categorías de gasto)
- `/dashboard/accounts-payable` → Cuentas por pagar (facturas pendientes, pagos a proveedores y bancos)
- `/dashboard/inventory` → Inventario (existencias, kardex y uso por servicio)
- `/dashboard/financials` → Estados financieros (P&L mensual)
- `/dashboard/settings` → Configuración (horario de trabajo por día de la semana)
- `/dashboard/services` → Gestión de servicios (+ fotos del servicio, eliminar si no tiene uso)
- `/dashboard/admin-users` → Gestión de admins (solo superadmin)
- `/profile` → Portal de cliente (pasaporte de uñas + historial)
- `/complete-registration` → Completar registro (pedir teléfono tras OAuth de Google)

## 🎨 Componentes UI Clave
- ServiceCard: card de servicio con carrusel de fotos, nombre, duración, precio, botón "Agendar"
- AppointmentCard: card de cita con hora, cliente, servicio, foto referencia
- ClientCRMPanel: panel lateral con notas técnicas, stats, botón WhatsApp y contactos editables
- PhotoCarousel: carrusel de fotos de referencia al abrir una cita en la agenda
- CompleteAppointmentDialog: diálogo para completar cita subiendo varias fotos finales (publicadas en el muro) y registrar pago del momento ($/Bs con tasa del día).
- GalleryGrid: grid masonry/pinterest para muro de inspiración con clic → agendar similar
- FilterPills: pills horizontales para filtrar galería (Todas, Acrílicas, Gel, etc)
- BookingWizard: wizard de 3 pasos para reserva (con selección de modelos del muro)
- CompleteRegistrationForm: formulario para pedir teléfono tras registrarse con Google
- StatsBanner: banner con total_visits y total_revenue del cliente
- LoginForm: formulario de login/registro por correo y contraseña
- NewAppointmentDialog: crea citas para walk-ins (clientes no registrados) desde la agenda
- BlockoutDialog: crea bloques "no disponible" desde la agenda
- RegisterPaymentDialog: registra pagos ($/Bs con tasa BCV) desde cuentas por cobrar o el CRM
- SettingsContent: editor del horario de trabajo por día de la semana
- BillFormDialog: crea/edita facturas (inventario con líneas de producto o gasto fijo $/Bs) desde Compras
- SupplierPaymentDialog: registra pagos a proveedores ($/Bs con tasa BCV) desde Cuentas por pagar
- MovementDialog: registra salidas/ajustes de stock (con motivo obligatorio en ajustes) desde Inventario
- PurchasesContent: pestañas de facturas, proveedores y categorías en /dashboard/purchases
- AccountsPayableContent: pestañas de por pagar, pagos realizados y bancos en /dashboard/accounts-payable
- InventoryContent: pestañas de productos, kardex y uso por servicio en /dashboard/inventory
- FinancialsContent: P&L mensual (ingresos, gastos, utilidad) en /dashboard/financials
- ConfirmDialog: modal de confirmación reutilizable (cancelar cita, eliminar cliente/servicio)

## 🚀 Comandos
- `npm run dev` → desarrollo
- `npm run db:setup` → genera y aplica migraciones + seed base
- `npm run db:seed:client` → regenera datos demo del cliente (clienta@email.com / Cliente123!)
- `npm run db:seed:finance` → regenera datos demo de finanzas (proveedores, bancos, facturas, inventario y uso por servicio)
- `npm run build && npm start` → producción local
- `npm run lint` → ESLint
- `npx tsc --noEmit` → typecheck

## 🧪 Datos Demo
- Cliente: `clienta@email.com` / `Cliente123!` (Ana Martínez). El seed `db:seed:client` lo crea/actualiza con dirección, notas técnicas, citas próximas y completadas, fotos de referencia/finales, reseñas, snapshots de compra, fotos de servicios para el home, horario de trabajo por defecto (si vacío) y pagos demo (PAGO-001 $35, PAGO-002 $10). Re-ejecutable (borra y regenera las citas del demo).
- Admin: el `ADMIN_EMAIL` configurado en `.env` se promueve a superadmin al iniciar sesión.
- Finanzas: el seed `db:seed:finance` genera proveedores, bancos ($/Bs), 4 items de inventario con entradas vía factura F-1001 (parcialmente pagada), factura de alquiler en Bs y uso de productos por servicio (Acrílicas Full y Gel Semipermanente). Re-ejecutable: borra y regenera los datos de finanzas.

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
