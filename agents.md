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
- La tasa se obtiene SOLO de bcv.org.ve (fetch HTML → .txt en tmp → regex) y se cachea por día.

## 🗺️ Estructura de Rutas

### Públicas
- `/` → Landing con catálogo de servicios + muro de inspiración
- `/login` → Login/registro por correo y contraseña (además de botón Google)
- `/book` → Wizard de reserva (3 pasos)
- `/review/[id]` → Formulario de reseña post-cita

### Protegidas (requieren auth)
- `/dashboard` → Panel admin (agenda del día)
- `/dashboard/clients` → CRM de clientes (listado, búsqueda, alta manual, notas/stats)
- `/dashboard/balances` → Cuentas por cobrar (total adeudado, pagos por cliente)
- `/dashboard/settings` → Configuración (horario de trabajo por día de la semana)
- `/dashboard/services` → Gestión de servicios (+ fotos del servicio)
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

## 🚀 Comandos
- `npm run dev` → desarrollo
- `npm run db:setup` → genera y aplica migraciones + seed base
- `npm run db:seed:client` → regenera datos demo del cliente (clienta@email.com / Cliente123!)
- `npm run build && npm start` → producción local
- `npm run lint` → ESLint
- `npx tsc --noEmit` → typecheck

## 🧪 Datos Demo
- Cliente: `clienta@email.com` / `Cliente123!` (Ana Martínez). El seed `db:seed:client` lo crea/actualiza con dirección, notas técnicas, citas próximas y completadas, fotos de referencia/finales, reseñas, snapshots de compra, fotos de servicios para el home, horario de trabajo por defecto (si vacío) y pagos demo (PAGO-001 $35, PAGO-002 $10). Re-ejecutable (borra y regenera las citas del demo).
- Admin: el `ADMIN_EMAIL` configurado en `.env` se promueve a superadmin al iniciar sesión.

## 🚫 Fuera del Alcance (MVP)
- Pasarelas de pago (Stripe/MercadoPago)
- Multi-empleado (roles complejos)
- Lectura bidireccional de Google Calendar
- API oficial de WhatsApp Business
- Despliegue en la nube (solo local + Cloudflare Tunnel)
