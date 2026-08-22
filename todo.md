# TODO - Nails MVP (6 Fases)

## FASE 1: Base de Datos y Seed ✅
- [x] Inicializar Next.js 15 con TypeScript + Tailwind
- [x] Configurar Drizzle ORM con SQLite (better-sqlite3)
- [x] Crear schema completo (users, services, appointments, waitlist, blockouts)
- [x] Generar migración inicial
- [x] Crear seed script con 3 servicios de ejemplo
- [x] Crear script de setup (npm run db:setup)

## FASE 2: Autenticación ✅
- [x] Instalar next-auth@beta y @auth/drizzle-adapter
- [x] Configurar auth.ts con Google Provider + Credentials + DrizzleAdapter
- [x] Crear ruta API /api/auth/[...nextauth]
- [x] Middleware/proxy protegiendo /dashboard/** y /profile/** (src/proxy.ts)
- [x] Componente GoogleSignInButton (+ LoginForm por correo/contraseña)
- [x] Variables de entorno AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, NEXTAUTH_SECRET (nombres v5; sin NEXTAUTH_URL: el host se detecta de la petición)

## FASE 3: Landing Pública y Muro de Inspiración ✅
- [x] Layout público con Header (salon name configurable + login)
- [x] Sección de catálogo de servicios (ServiceCards)
- [x] Sección de muro de inspiración (GalleryGrid)
- [x] FilterPills para filtrar galería
- [x] Paginación por cursor (10 items, "Cargar más")
- [x] Pre-llenado del muro por el admin (/dashboard/gallery, tabla gallery_photos)

## FASE 4: Wizard de Reserva ✅
- [x] Paso 1: Selección de servicio (con ?serviceId=X)
- [x] Lógica de slots pura en lib/slots.ts
- [x] Paso 2: Calendario mensual + grid de slots
- [x] Paso 3: Upload foto (+ modelos del muro) + resumen + confirmar
- [x] Insertar appointment + redirect a /success

## FASE 5: Dashboard Admin ✅
- [x] Layout protegido con sidebar filtrado por permisos
- [x] Vista "Agenda del día" (y semana/canceladas) con AppointmentCards
- [x] Acciones: Completar / Cancelar (hard delete con archivo en cancelled_appointments) / Reprogramar
- [x] ClientCRMPanel: tech_notes, stats, WhatsApp
- [x] Al completar: actualizar total_visits y total_revenue

## FASE 6: Portal de Cliente ✅
- [x] /profile protegido
- [x] StatsBanner (total_visits, total_revenue)
- [x] Timeline "Pasaporte de Uñas" (citas completed)
- [x] Estado vacío + CTA agendar

## En progreso
- [x] `/review/[id]` público: formulario de reseña post-cita (rating 1-5 + texto)
- [x] Waitlist básica: el cliente se une desde el wizard cuando no hay slots; admin la gestiona en la pestaña "Espera" de la agenda (WhatsApp, notificado, eliminar). La versión "inteligente" (asignación automática) sigue post-MVP.

## SIGUIENTE ETAPA: Sistema de Permisos ✅
- [x] Clave `gallery` en `PERMISSION_KEYS`; `/dashboard/gallery` + `/api/gallery-photos*` protegidos con `hasPermission(session, "gallery")`
- [x] Auditoría completa de guardas `hasPermission` en las 11 páginas del dashboard y todos los endpoints de API (corregidos: services*, purchases*, clients*, blockouts, waitlist, upload, payment-receipts DELETE)
- [x] `paymentApproval` verificado: PATCH/DELETE de capturas lo exigen; GET/POST quedan por cliente dueño o admin
- [x] UI de copiar plantilla de permisos entre admins (select "Copiar de…" en /dashboard/admin-users)
- [ ] Tests de autorización por módulo (no hay framework de tests instalado; pendiente decidir vitest/jest)

## Mejoras Post-MVP (Out of Scope)
- Pasarelas de pago
- Multi-empleado
- Sincronización bidireccional Google Calendar
- API oficial WhatsApp Business
- Recordatorios automáticos
- Lista de espera inteligente
