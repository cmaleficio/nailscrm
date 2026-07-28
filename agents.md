# Nails App - Sistema de Gestión para Salón de Nail Design

## 🎯 Visión del Producto
Web App standalone (SaaS/CRM) para gestión integral de un salón de nail design. Diferenciadores vs marketplaces (Fresha/Booksy):
- Propiedad absoluta de datos por parte del salón
- CRM con notas técnicas personalizadas
- Muro social de inspiración (comunidad visual)
- Sincronización con Google Calendar
- Comunicación directa vía WhatsApp

## 🛠 Stack Tecnológico
- **Framework:** Next.js 14+ (App Router, src/)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS + shadcn/ui
- **Base de Datos:** SQLite (better-sqlite3)
- **ORM:** Drizzle ORM (sintaxis SQL pura, NO Prisma)
- **Autenticación:** NextAuth v5 (Auth.js) con Google Provider
- **Integraciones:** Google Calendar API (push), WhatsApp Deep Links (wa.me)
- **Exposición:** Cloudflare Tunnel (localhost → internet)

## 📐 Reglas de Desarrollo
- Mobile-first en todas las vistas de cliente
- Paleta de colores: rosa pastel (#FFE5EC, #FFC2D1), blanco, gris suave (#F5F5F5)
- Bordes redondeados (rounded-xl), sombras suaves
- Drizzle con queries SQL puras, evitar abstracciones complejas
- Imágenes en /public/uploads (MVP local)
- Timezone local del salón para TODAS las fechas
- Privacidad por defecto: solo nombre de pila en muro público
- Google Calendar: solo escritura (push), no lectura bidireccional
- WhatsApp: deep links (wa.me), no API oficial

## 🗄 Modelo de Datos (Drizzle Schema)

### Tabla: users
- id: text, primary key
- name: text, not null
- email: text, unique, not null
- phone: text (para WhatsApp)
- google_id: text (para OAuth)
- tech_notes: text (notas de la manicurista sobre el cliente)
- total_visits: integer, default 0
- total_revenue: real, default 0
- created_at: integer (timestamp)

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

## 🗺 Estructura de Rutas

### Públicas
- `/` → Landing con catálogo de servicios + muro de inspiración
- `/book` → Wizard de reserva (3 pasos)
- `/review/[id]` → Formulario de reseña post-cita

### Protegidas (requieren auth)
- `/dashboard` → Panel admin (agenda del día)
- `/dashboard/clients` → CRM de clientes
- `/dashboard/services` → Gestión de servicios
- `/profile` → Portal de cliente (pasaporte de uñas + historial)

## 🎨 Componentes UI Clave
- ServiceCard: card de servicio con nombre, duración, precio, botón "Agendar"
- AppointmentCard: card de cita con hora, cliente, servicio, foto referencia
- ClientCRMPanel: panel lateral con notas técnicas, stats, botón WhatsApp
- GalleryGrid: grid masonry/pinterest para muro de inspiración
- FilterPills: pills horizontales para filtrar galería (Todas, Acrílicas, Gel, etc)
- BookingWizard: wizard de 3 pasos para reserva
- StatsBanner: banner con total_visits y total_revenue del cliente

## 🚫 Fuera del Alcance (MVP)
- Pasarelas de pago (Stripe/MercadoPago)
- Multi-empleado (roles complejos)
- Lectura bidireccional de Google Calendar
- API oficial de WhatsApp Business
- Despliegue en la nube (solo local + Cloudflare Tunnel)