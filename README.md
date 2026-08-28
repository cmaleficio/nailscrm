# Nails App — Sistema de Gestión para Salón de Nail Design

Aplicación web (SaaS/CRM) para la gestión integral de un salón de nail design. Los clientes reservan citas desde su celular; la manicurista administra agenda, clientes y servicios desde un dashboard, con sincronización a Google Calendar y comunicación por WhatsApp.

## Stack

- **Framework:** Next.js 14+ (App Router, `src/`)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS + shadcn/ui (paleta rosa pastel)
- **Base de datos:** SQLite (`better-sqlite3`), tablas en `src/db/schema.ts`
- **ORM:** Drizzle ORM (queries SQL puras)
- **Autenticación:** NextAuth v5 (Auth.js) con Google, Facebook y Credentials (correo/contraseña)
- **Sincronización:** Google Calendar API (push one-way a calendarios de cliente y admin)
- **Comunicación:** Deep links de WhatsApp (`wa.me`)
- **Despliegue:** local + Cloudflare Tunnel

## Requisitos

- Node.js 18.17+ (probado con Node 24)
- Cliente OAuth de Google con scopes `openid email profile` y `https://www.googleapis.com/auth/calendar.events`
- Cuenta de desarrollador de Facebook para el provider (opcional)

## Configuración

Copiar `.env.template` a `.env` y completar:

| Variable | Descripción |
| --- | --- |
| `AUTH_GOOGLE_ID` | Client ID de Google OAuth (nombres v5 de Auth.js) |
| `AUTH_GOOGLE_SECRET` | Client Secret de Google OAuth |
| `AUTH_FACEBOOK_ID` | App ID de Facebook (opcional) |
| `AUTH_FACEBOOK_SECRET` | App Secret de Facebook (opcional) |
| `NEXTAUTH_SECRET` | Secreto para firmar sesiones |
| `ADMIN_EMAIL` | Email del admin principal (superadmin) |
| `CRON_SECRET` | Secreto para el refresh diario de la tasa BCV (cron-job.org) |
| `NEXT_PUBLIC_SALON_NAME` | Nombre mostrado del salón |

> **Nota:** Auth.js v5 lee las credenciales como `AUTH_<PROVIDER>_ID` / `AUTH_<PROVIDER>_SECRET`. No usar los nombres antiguos `GOOGLE_CLIENT_ID`.
> **Acceso multi-dispositivo:** no hace falta `NEXTAUTH_URL`; Auth.js v5 detecta el host desde la petición, así el login con Google funciona desde localhost, la IP del servidor o el túnel.

## Ejecución

```bash
npm install
npm run db:setup   # genera y aplica migraciones + datos de semilla
npm run dev        # desarrollo
```

Para producción local: `npm run build && npm start`.

## Comandos útiles

```bash
npm run db:generate   # genera migración desde src/db/schema.ts
npm run db:migrate    # aplica migraciones
npm run db:seed:client # regenera datos demo del cliente (clienta@email.com / Cliente123!)
npm run db:seed:finance # regenera datos demo de finanzas (proveedores, bancos, facturas, inventario)
npm run lint          # ESLint
npx tsc --noEmit      # typecheck
```

## Datos demo

- **Cliente:** `clienta@email.com` / `Cliente123!` (Ana Martínez). El seed `db:seed:client` crea o actualiza este usuario con dirección, notas técnicas, citas de ejemplo (próxima con foto de referencia + completadas con foto final, reseñas y snapshots de compra), fotos de servicios para el home, horario de trabajo por defecto y pagos demo (PAGO-001 $35, PAGO-002 $10). Es re-ejecutable: borra y regenera las citas del demo.
- **Admin:** el `ADMIN_EMAIL` configurado se promueve automáticamente a superadmin al iniciar sesión con Google.

## Funcionalidades principales

- **Reserva en 3 pasos:** elige servicio, horario y confirmas. En el último paso puedes subir fotos de referencia o elegir modelos del muro de inspiración. Si el día no tiene horarios disponibles, puedes unirte a la lista de espera con un clic.
- **Lista de espera:** los clientes que se unen aparecen en la pestaña "Espera" del dashboard; el admin los contacta por WhatsApp (queda marcado como notificado) o elimina la entrada.
- **Muro de inspiración:** fotos finales de citas compartidas y fotos destacadas subidas por el admin desde `/dashboard/gallery` (pre-llenado del muro sin necesidad de completar una cita), filtrables por servicio. Al hacer clic en una foto puedes agendar un servicio similar con ese modelo (si la foto tiene servicio asociado).
- **Dashboard admin:** agenda día/semana con carrusel de modelos de referencia al abrir una cita, botón "Completar" que sube varias fotos finales (publicadas en el muro) y registra pago del momento ($/Bs con tasa del día), "Nueva cita" para walk-ins (clientes no registrados), "Bloquear tiempo" para marcar horarios no disponibles y "Cancelar" con confirmación (elimina la cita definitivamente y queda archivada en la pestaña "Canceladas"). En `/dashboard/services` hay botón "Eliminar" (solo servicios sin citas ni compras), y en `/dashboard/clients` se pueden eliminar clientes sin movimientos (sin citas, pagos ni lista de espera), tanto desde la lista como desde el panel CRM.
- **Cuentas por cobrar** en `/dashboard/balances`: total adeudado por cliente (calculado en vivo), historial de pagos y registro/borrado de pagos en $ o Bs con la tasa del día del BCV (scrapeada de bcv.org.ve), abonos parciales y referencia obligatoria. Incluye la pestaña "Pagos recibidos": cuando el cliente reporta un pago en Bs con captura desde su perfil, el admin lo aprueba (descuenta el saldo) o lo rechaza con motivo. La tasa se refresca diariamente con el endpoint `GET /api/exchange-rate/refresh` (protegido por `CRON_SECRET`), que cron-job.org debe llamar a la URL pública del túnel.
- **Compras** en `/dashboard/purchases`: facturas a proveedores en un grid maestro-detalle (de inventario con líneas de producto que registran entradas de stock, o gastos fijos en $/Bs), proveedores y categorías de gasto. Las facturas se pueden **editar** desde el grid; al añadir un producto sin código de inventario, el código se **genera automáticamente**.
- **Cuentas por pagar** en `/dashboard/accounts-payable`: facturas pendientes con aviso de vencimiento, registro de pagos a proveedores en $/Bs con tasa BCV y captura de transferencia obligatoria (el estado de la factura se recalcula solo) y cuentas bancarias del salón.
- **Inventario** en `/dashboard/inventory`: productos con código (`ACR-001`…), código de barras y foto en un grid, existencias valorizadas (costo promedio ponderado), badge "Stock bajo", kardex de movimientos (salidas y ajustes con motivo) y uso de productos por servicio. Los ajustes requieren el permiso `adjustInventory`. Los esmaltes se organizan por **categoría** (ej: "Esmalte") y **subcategoría** (ej: "Max Glow"), con **máximo de usos** por producto; se muestra el badge "Agotado" (manual o automático al alcanzar el máximo) y los usos consumidos/restantes.
- **Uso por cita:** al completar una cita desde la agenda se eligen qué esmaltes se usaron (agrupados por categoría → subcategoría); el registro descuenta stock, genera un movimiento "Uso en cita" en el kardex y alimenta el contador de usos de cada producto.
- **Estados financieros** en `/dashboard/financials`: P&L mensual con dos vistas — **Recaudación** (ingresos por pagos cobrados en el mes) y **Producción** (ingresos por servicios completados en el mes), cada uno con desglose por servicio, además de gastos por categoría y utilidad.
- **Configuración de horario** en `/dashboard/settings`: horario de trabajo configurable por día de la semana.
- **CRM de clientes** en `/dashboard/clients`: listado con búsqueda, alta manual, notas técnicas, teléfono/dirección, stats de visitas e ingresos, saldo pendiente con registro de pagos y botón de WhatsApp.
- **Cursos y servicios grupales:** los servicios pueden marcarse como "curso/grupo" (`is_group`) y el admin crea sesiones de curso desde la agenda seleccionando fecha/hora y varios alumnos; cada alumno inscrito genera su propia compra/CXC individual, la sesión aparece como bloque en la agenda (badge "Curso · N alumnos") y en `/dashboard/balances` se ve el desglose por ítem con badge de estado financiero y filtro por estado.
- **Reseñas post-cita:** tras completar una cita, la clienta puede dejar su reseña (estrellas + comentario) desde `/review/[id]` o el botón "Dejar reseña" en su perfil.
- **Fotos de servicios:** gestor en `/dashboard/services` y carrusel en las tarjetas del home.
- **Muro del admin:** en `/dashboard/gallery` se suben fotos sueltas al muro (múltiples a la vez, con servicio asociado opcional y descripción).
- **Teléfono post-Google:** tras registrarse con Google se pide el teléfono en `/complete-registration`.
- **Permisos por admin:** en `/dashboard/admin-users` (solo superadmin) se asignan permisos por módulo (`users.permissions`); un admin con `null` tiene acceso a todo y el superadmin siempre accede a todo. Hay select "Copiar de…" para replicar los permisos de otro admin. También aparece "Mis pagos" en el perfil del cliente para reportar pagos en Bs con captura.

## Estructura

```
src/
  app/                 # rutas (public, (client), (admin))
    api/               # API routes (auth, appointments, admins, gallery, services, slots, upload, suppliers, bills, inventory, financials…)
  components/          # UI (BookingWizard, AppointmentCard, ClientCRMPanel, GalleryGrid, PhotoCarousel, NewAppointmentDialog, BlockoutDialog, RegisterPaymentDialog, ReportPaymentDialog, BillFormDialog, SupplierPaymentDialog, MovementDialog, …)
  db/                  # conexión SQLite + schema Drizzle
  lib/                 # auth, auth.config, authz, calendar, slots, workingHours, availability, time, bcv, upload
```

## Roles

- **Cliente:** reserva, próximas citas y pasaporte en `/profile`.
- **Admin:** agenda día/semana, completar citas con fotos y pago (opcional, la deuda queda pendiente si no se marca), crear sesiones de curso grupal, citas walk-in, bloques de tiempo, reprogramar (re-sincroniza Google Calendar), CRM (incluye saldo), cuentas por cobrar con desglose por ítem y filtro de estado, compras, cuentas por pagar, inventario, estados financieros (Recaudación + Producción), servicios y horario de trabajo. Los accesos a cada módulo se controlan por permisos asignados en `/dashboard/admin-users`.
- **Superadmin (`ADMIN_EMAIL`):** gestión de admins y sus permisos en `/dashboard/admin-users`.

## 📚 Base de Conocimiento

El proyecto incluye una base de conocimiento generada con [Graphify](https://github.com/graphify-labs/graphify):

- `graphify-out/graph.html` — Grafo interactivo (abrir en navegador)
- `graphify-out/graph.json` — Datos crudos del grafo
- `graphify-out/GRAPH_REPORT.md` — Reporte de comunidades y conexiones

Para actualizarla: `graphify . --code-only --html` (requiere `pip install graphifyy`).

## Mantenimiento

Cada cambio relevante (funcionalidad nueva/quitada o bug corregido) obliga a actualizar `AGENTS.md` (si aplica), `CHANGELOG.md` y `README.md` en el mismo commit.