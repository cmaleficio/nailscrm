# TODO - Nails MVP (6 Fases)

## FASE 1: Base de Datos y Seed ✅
- [x] Inicializar Next.js 15 con TypeScript + Tailwind
- [x] Configurar Drizzle ORM con SQLite (better-sqlite3)
- [x] Crear schema completo (users, services, appointments, waitlist, blockouts)
- [x] Generar migración inicial
- [x] Crear seed script con 3 servicios de ejemplo
- [x] Crear script de setup (npm run db:setup)

## FASE 2: Autenticación con Google [ ]
- [ ] Instalar next-auth@beta y @auth/drizzle-adapter
- [ ] Configurar auth.ts con Google Provider + DrizzleAdapter
- [ ] Crear ruta API /api/auth/[...nextauth]
- [ ] Middleware protegiendo /dashboard/** y /profile/**
- [ ] Componente GoogleSignInButton
- [ ] Variables de entorno GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL

## FASE 3: Landing Pública y Muro de Inspiración [ ]
- [ ] Layout público con Header (salon name configurable + login)
- [ ] Sección de catálogo de servicios (ServiceCards)
- [ ] Sección de muro de inspiración (GalleryGrid)
- [ ] FilterPills para filtrar galería
- [ ] Paginación por cursor (10 items, "Cargar más")

## FASE 4: Wizard de Reserva [ ]
- [ ] Paso 1: Selección de servicio (con ?serviceId=X)
- [ ] Lógica de slots pura en lib/slots.ts
- [ ] Paso 2: Calendario mensual + grid de slots
- [ ] Paso 3: Upload foto + resumen + confirmar
- [ ] Insertar appointment + redirect a /success

## FASE 5: Dashboard Admin [ ]
- [ ] Layout protegido con sidebar (Agenda, Clientes, Servicios)
- [ ] Vista "Agenda del día" con AppointmentCards
- [ ] Acciones: Completar / Cancelar
- [ ] ClientCRMPanel: tech_notes, stats, WhatsApp
- [ ] Al completar: actualizar total_visits y total_revenue

## FASE 6: Portal de Cliente [ ]
- [ ] /profile protegido
- [ ] StatsBanner (total_visits, total_revenue)
- [ ] Timeline "Pasaporte de Uñas" (citas completed)
- [ ] Estado vacío + CTA agendar

## Mejoras Post-MVP (Out of Scope)
- Pasarelas de pago
- Multi-empleado
- Sincronización bidireccional Google Calendar
- API oficial WhatsApp Business
- Recordatorios automáticos
- Lista de espera inteligente
- Sistema de reseñas post-cita
