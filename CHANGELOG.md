# Changelog

Todas las cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Usos reales por cita: al completar una cita se puede marcar qué esmaltes (productos con categoría) se usaron, agrupados por categoría principal mostrando las subcategorías. Cada producto de esmalte admite una `category` (ej: "Esmalte") y una `subcategory` (ej: "Max Glow", "Emerald"). El registro descuenta stock, genera un movimiento de salida "Uso en cita" en el kardex e incrementa `uses_consumed`.
- Máximo de usos por producto: nuevo campo `max_uses` configurable. `usos_restantes = max_uses − usos_consumidos` y se muestra en la tabla de inventario. Al alcanzar (o superar) el máximo se marca el producto como "Agotado" automáticamente.
- Marcar producto agotado manualmente: botón "Marcar agotado"/"Reabrir" en la edición de un producto de inventario (pone `is_exhausted=1` y stock a 0 con movimiento de ajuste; "Reabrir" lo revierte).
- Código de producto automático: al crear un producto sin código, se genera solo el siguiente código ascendente (`PRD-<n>`), también desde el diálogo de compras ("Nuevo producto" ya no pide el código).
- Nueva tabla `appointment_usage` (`appointment_id`, `inventory_item_id`, `quantity`) para registrar qué productos se usaron en cada cita. Campos nuevos en `inventory_items`: `category`, `subcategory`, `max_uses`, `uses_consumed`, `is_exhausted`; `inventory_movements.ref_type` admite `usage`.
- Sistema de permisos completo: nueva clave `gallery` (Muro de inspiración); auditoría y corrección de guardas en todos los endpoints (`services*`, snapshot `/api/purchases*` → agenda, `clients*` → clients o appointments, blockouts/waitlist → appointments, `upload` ahora exige sesión, DELETE de capturas → `paymentApproval`). Nuevo helper `hasAnyPermission`. En `/dashboard/admin-users`, select "Copiar de…" para replicar permisos de otro admin.
- Lista de espera: cuando el día elegido en el wizard no tiene horarios disponibles aparece "Unirme a la lista de espera" (dedupe por cliente+fecha, rechaza fechas pasadas). El admin la gestiona en la nueva pestaña "Espera" de la agenda: contacto directo por WhatsApp (marca la entrada como notificada) y eliminar. APIs `GET/POST /api/waitlist` y `PATCH/DELETE /api/waitlist/[id]`.
- Reseñas post-cita: página pública `/review/[id]` con formulario de estrellas (1-5) y comentario opcional (máx 500), APIs `GET/POST /api/appointments/[id]/review` (solo citas `completed`, 409 si ya tiene reseña) y botón "Dejar reseña" en el pasaporte de uñas para citas completadas sin reseña.
- Pre-llenado del muro de inspiración: nueva tabla `gallery_photos` para fotos sueltas subidas por el admin sin cita asociada. Página `/dashboard/gallery` con subida múltiple, servicio asociado opcional (habilita "Agendar similar" desde la foto) y descripción; eliminar con confirmación (borra fila y archivo).
- APIs del muro: `GET/POST /api/gallery-photos` y `DELETE /api/gallery-photos/[id]` (solo rol admin; archivos en `/public/uploads/gallery`). `GET /api/gallery` (público) ahora fusiona fotos finales de citas compartidas con las fotos sueltas del admin (orden por fecha desc, paginación por cursor).
- Login por correo/contraseña (Credentials provider de Auth.js) además de Google: página `/login` con `LoginForm`, registro en `/api/auth/register` y columna `password_hash` en `users`.
- Enlace "Entrar" en el `Header` y "Entrar o crear cuenta con correo" en el wizard de reserva para usuarios sin sesión (además del botón Google).
- Seed regenerable del cliente demo (`npm run db:seed:client`): crea/actualiza `clienta@email.com` (contraseña `Cliente123!`) con dirección, notas técnicas, citas próximas y completadas, fotos de referencia/finales, reseñas y snapshots de compra. Re-ejecutable: borra y regenera las citas del demo.
- Roles de usuario: columna `role` (`client` | `admin`) y promoción automática del propietario (`ADMIN_EMAIL`) como admin al iniciar sesión.
- Gestión de administradores: API `/api/admins` y página `/dashboard/admin-users` (solo superadmin) para añadir/quitar admins por email.
- Subida múltiple de fotos de referencia en el booking wizard; tabla `appointment_photos` (1:N).
- Sincronización con Google Calendar: al crear una cita se crean eventos en el calendario del cliente y del admin (`google_event_id_client` / `google_event_id_admin`) con refresh de token.
- Vista de semana y botón "Reprogramar" (con `ReschedulePicker`) en el dashboard; el PATCH de citas re-sincroniza los eventos en Google Calendar.
- Sección "Próximas citas" en /profile.
- Completar una cita con subida de varias fotos finales que se publican automáticamente en el muro de inspiración (`appointment_photos.kind = 'final'`).
- Selección de modelos del muro de inspiración al confirmar una reserva (fotos de referencia junto a las subidas).
- Carrusel de modelos de referencia al abrir una cita en la agenda (vista día y semana).
- CRM de clientes en `/dashboard/clients`: listado con búsqueda, alta manual, edición de teléfono/dirección/notas y stats de visitas/ingresos.
- Página `/complete-registration` que pide el teléfono tras registrarse con Google.
- Fotos de servicios: tabla `service_photos`, gestor en `/dashboard/services` y carrusel en las tarjetas del home.
- Muro de inspiración: clic en una foto para agendar un servicio similar con ese modelo.
- Citas creadas por el admin para clientes no registrados (walk-ins) desde la agenda, con validación de disponibilidad en el servidor.
- Bloques "no disponible" gestionables desde el dashboard (crear y eliminar).
- Horario de trabajo configurable por día de la semana en `/dashboard/settings`.
- Cuentas por cobrar: sección `/dashboard/balances` con total adeudado, historial de pagos y registro/borrado de pagos.
- Pagos en $ o Bs con la tasa del día del BCV (scrapeada de bcv.org.ve), abonos parciales y referencia obligatoria.
- Saldo de cada cliente visible en el panel CRM con registro de pagos.
- Tasa BCV más robusta: la extracción ahora ancla en `<div id="dolar">` de la home de bcv.org.ve (independiente del orden de monedas) y también captura la fecha valor. Nuevo endpoint `GET /api/exchange-rate/refresh` (protegido por `CRON_SECRET` en header `Authorization: Bearer` o `?secret=`) que fuerza `refreshTodayRate()` (inserta/actualiza la fila de hoy) para que cron-job.org lo llame a diario vía túnel.
- Botón "Cancelar" con confirmación para las citas en la agenda (vistas día y semana); las citas completadas ya no se pueden cancelar (400).
- Eliminar clientes desde la lista y desde el panel CRM (`DELETE /api/clients/[id]`): solo si no tienen citas, pagos/cuentas por cobrar ni lista de espera; los usuarios con rol admin están protegidos (403).
- Eliminar servicios (`DELETE /api/services/[id]`) además de desactivarlos: solo si no tienen citas ni compras asociadas (de lo contrario se sugiere desactivar).
- Módulo de compras en `/dashboard/purchases`: facturas a proveedores (de inventario con líneas de producto o gastos fijos en $/Bs), proveedores y categorías de gasto. Las facturas de inventario registran entradas de stock con costo promedio ponderado.
- Cuentas por pagar en `/dashboard/accounts-payable`: facturas pendientes (badges de vencida/por vencer), registro y borrado de pagos a proveedores en $/Bs con tasa BCV (el estado de la factura se recalcula automáticamente) y gestión de cuentas bancarias del salón.
- Inventario en `/dashboard/inventory`: existencias con valorización, badge "Stock bajo", kardex de movimientos (entradas/salidas/ajustes con motivo obligatorio) y uso de productos por servicio (las salidas de stock se sugieren según el consumo por servicio).
- Estados financieros en `/dashboard/financials`: P&L mensual (ingresos, gastos, utilidad/pérdida, servicios y facturas) con desglose de ingresos por servicio y gastos por categoría.
- Seed regenerable de finanzas (`npm run db:seed:finance`): proveedores, bancos ($/Bs), 4 items de inventario con entradas vía factura F-1001 (parcialmente pagada), factura de alquiler en Bs y uso de productos por servicio. Re-ejecutable: borra y regenera los datos de finanzas.
- Sistema de permisos por admin (`users.permissions`, JSON array; `null` = acceso a todos): `hasPermission` en `src/lib/authz.ts`, endpoint `GET /api/my-permissions`, editor de permisos en `/dashboard/admin-users` y guardas por módulo en las páginas/APIs del dashboard. Claves en `PERMISSION_KEYS` (`appointments`, `clients`, `balances`, `purchases`, `accountsPayable`, `inventory`, `adjustInventory`, `financials`, `settings`, `services`, `adminUsers`, `paymentApproval`). El superadmin (`ADMIN_EMAIL`) siempre tiene acceso total.
- Pagos con capturas de transferencia: opcional al registrar pagos de clientes y **obligatoria** en pagos a proveedores (400 si falta).
- Reporte de pagos por el cliente desde "Mis pagos" en `/profile` (`ReportPaymentDialog`): reporta pago en Bs con captura y la tasa del día; queda `pending` hasta que el admin aprueba/rechaza desde la nueva pestaña "Pagos recibidos" en `/dashboard/balances`. Tabla `payment_receipts` y APIs `GET/POST /api/payment-receipts` y `PATCH/DELETE /api/payment-receipts/[id]` (solo permiso `paymentApproval`).
- Tasa pública del día: `GET /api/exchange-rate/current`.
- Inventario con código de producto como PK (`ACR-001`…), código de barras y foto: grid de productos en tabla (foto/código/barras/stock/costo/valor) y botón de ajuste condicionado al permiso `adjustInventory`.
- Cursos/servicios grupales: un servicio puede marcarse como curso ("Es curso/grupo", columna `services.is_group`) y el admin crea **sesiones de curso** (una fecha/hora, varios alumnos juntos) desde la agenda con `CourseSessionDialog`. Cada alumno inscripto genera su propia compra/CXC y la sesión aparece como bloque en la agenda (badge "Curso · N alumnos"). Tabla `course_enrollments` y APIs `POST/GET /api/course-sessions` y `POST/DELETE /api/course-sessions/[id]/enrollments` (solo clientes registrados; no se puede modificar una sesión completada).
- CXC/deuda desde el agendado: la cuenta por cobrar nace en el momento de reservar (toda `service_purchases` no-`void` cuenta para el saldo, sin esperar a que la cita se complete). `/dashboard/balances` muestra el desglose por ítem con badge de estado financiero y filtro por estado.
- Estados financieros de la compra: nueva columna `service_purchases.financial_status` (`pending`/`partial`/`paid`/`void`, auto-recalculada según los pagos del cliente) y doble registro de fechas: `completion_date` (producción) y `payments.paid_at` (cobro/caja).
- P&L base de caja + producción: `/dashboard/financials` muestra dos paneles — **Recaudación** (ingresos por pagos cobrados en el mes) y **Producción** (ingresos por servicios completados en el mes), cada uno con su utilidad y desglose por servicio.
- `users.total_revenue` ahora = recaudado (suma de pagos) y `users.total_visits` = servicios completados; la librería `src/lib/financial-status.ts` recalcula ambos.
- Cobro flexible al completar: al completar una cita se setea `completion_date` y los alumnos/adelantos no pagados permanecen `pending` en CXC (el diálogo de completar muestra el total pagado por el cliente).
- Estado de cuenta del cliente en `/profile`: sección "Mi estado de cuenta" que lista servicios pendientes/abonados/pagados con su estado financiero, además del saldo y "Mis pagos".

### Cambiado
- Autenticación Google multi-dispositivo: se eliminó `NEXTAUTH_URL` de `.env.template`; NextAuth v5 detecta el host automáticamente desde la cabecera `Host` de la petición, así el login funciona desde localhost, la IP del servidor o el túnel de Cloudflare sin cambiar configuración.
- El muro público (`GalleryGrid`) muestra fotos sin cliente (subidas por el admin): muestra servicio/descripción en lugar del nombre de la clienta y solo ofrece "Agendar" si la foto tiene servicio asociado.
- Cancelar una cita ahora la elimina definitivamente (hard delete, `DELETE /api/appointments/[id]` desde el dashboard y el perfil del cliente) y archiva un snapshot en la nueva tabla `cancelled_appointments`, visible en la pestaña "Canceladas" de la agenda. El `PATCH` con `status: 'cancelled'` y el endpoint `/api/appointments/[id]/cancel` quedan obsoletos.
- Al cancelar una cita, su `service_purchases` pasa a `void` (desaparece de CXC) pero se conserva como archivo; al completar una cita se setea `completion_date` en sus compras.
- Compras en `/dashboard/purchases`: la pestaña de facturas ahora es un grid maestro-detalle (nº factura/proveedor/fechas/tipo/total/estado con detalle expandible de pagado/pendiente/líneas).
- Los items de inventario pasan de UUID a códigos de producto legibles (migración 0009 con remapeo de referencias en `bill_items`, `inventory_movements` y `service_products`).

### Corregido
- Edición de facturas en `/dashboard/purchases`: el botón "Editar" cargaba los datos pero nunca abría el diálogo (faltaba `setShowForm(true)`), por lo que no se podía editar ninguna factura aunque se tuviera permiso de administrador.
- Avatar de Google en el `Header`: `next/image` fallaba con 500 porque el host `lh3.googleusercontent.com` no estaba configurado en `next.config.ts`. Se añadió el `remotePatterns` correspondiente.
- Fotos de los seeds (`picsum.photos`) en las tarjetas de servicio: `next/image` fallaba con 500 porque el host no estaba en `images.remotePatterns` de `next.config.ts`. Se añadió el patrón correspondiente.
- Lint: eliminados los 21 warnings pre-existentes (variables sin usar, dependencia faltante en un `useEffect` y migración de todas las etiquetas `<img>` a `next/image` con `fill`). Nota visual: el muro de inspiración y los modelos del booking ahora muestran imágenes en celdas cuadradas uniformes (`aspect-square`).
- Configuración de Auth.js v5: `.env` usa `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (nombres v5) en lugar de `GOOGLE_CLIENT_ID`. Uso de Google ahora inicia sesión correctamente.
- Sesión que se cerraba y 401 en `POST /api/appointments`: errores de configuración de.env.
- Botón "Reservar" que se quedaba en estado de carga: now `submitting` se resetea en `finally` y se muestran errores inline.
- "Ver mis citas" / próxima citas ahora navegan a `/profile`.
- Lint: regla `react-hooks/set-state-in-effect` desactivada en config (patrón de fetch-en-effect del proyecto).
- `agents.md` migrado de UTF-16 (con caracteres corruptos, git lo veía como binario) a UTF-8.

### Reglas de mantenimiento
- Cada cambio relevante obliga a actualizar `AGENTS.md` (si aplica), `CHANGELOG.md` y `README.md` en el mismo commit.