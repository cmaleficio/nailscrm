PRD FINAL: Sistema de Gestión y Experiencia para Salón de Nail Design (MVP v1.2)
1. Resumen Ejecutivo
Desarrollo de una Web App standalone (SaaS/CRM) para la gestión integral de un salón de nail design. A diferencia de los marketplaces, esta herramienta es de propiedad absoluta del salón, enfocada en la retención de clientes, la personalización del servicio, la creación de una comunidad visual, la sincronización nativa con calendarios y la comunicación directa y fluida vía WhatsApp.
Filosofía del MVP: "Local-First". 100% ejecutable en local, expuesto a internet de forma segura y gratuita, priorizando la validación de flujos sobre la infraestructura en la nube.
2. Objetivos del MVP
Digitalizar y optimizar la agenda, eliminando el "no-show" mediante recordatorios, lista de espera y sincronización con Google Calendar.
Centralizar la información de los clientes (CRM) para ofrecer un trato VIP, personalizado y con comunicación directa (WhatsApp).
Crear un ecosistema visual (Muro de Inspiración) que fomente la recurrencia y el marketing orgánico.
Validar la experiencia de usuario (UX) tanto para la manicurista como para la clienta final sin costos de servidor.
3. Actores del Sistema
Administradora / Manicurista (Admin): Dueña o empleada del salón. Gestiona la agenda, el catálogo, el CRM, sube resultados y contacta clientas.
Clienta (Usuario Final): Consumidora del servicio. Agenda citas, sube referencias, revisa su historial y participa en el muro social.
4. Arquitectura y Stack Tecnológico (MVP Local)
Frontend & Backend: Next.js (App Router).
Base de Datos: SQLite (Archivo local dev.db).
Gestor de DB / ORM: Drizzle ORM (Sintaxis SQL pura, tipagem TS, fácil migración a PostgreSQL).
Autenticación: NextAuth (Auth.js) con Google Provider.
Integraciones Externas: Google Calendar API (creación de eventos) y WhatsApp Deep Links (wa.me).
Exposición a Internet: Cloudflare Tunnel (cloudflared).
Acceso Público: Acortador de enlaces (Bitly/Short.io) para un link limpio.
Almacenamiento de Media: Sistema de archivos local (/public/uploads).
5. Funcionalidades Principales (Scope)
5.1. Autenticación y Perfiles
Login/Registro: Inicio de sesión único mediante cuenta de Google (con permisos para Google Calendar).
Perfil de Clienta: Datos básicos, foto de perfil y preferencias.
5.2. Catálogo y Motor de Reservas con Sincronización
Gestión de Servicios: Crear/editar servicios (Nombre, Descripción, Precio, Duración, Estado).
Configuración de Horarios: Definir días/horas de apertura. Bloquear días completos o franjas específicas.
Motor de Disponibilidad (Slots): Algoritmo que cruza horario, duración y citas existentes para mostrar huecos libres.
Reserva y Push a Calendarios: Al confirmar, el sistema genera automáticamente un evento en el Google Calendar de la Clienta y en el del Admin.
5.3. CRM, Gestión de Clientes y Comunicación (Panel Admin)
Ficha de Cliente: Vista detallada de cada clienta.
Notas Técnicas (tech_notes): Campo de texto libre para preferencias y alergias.
Métricas Automáticas: Contador de total_visitas y total_dinero_generado.
Acción Rápida de WhatsApp (¡Nuevo!): Botón destacado en la ficha del cliente y en la tarjeta de la cita en la agenda. Al hacer clic, abre WhatsApp (web o app) con el número de la clienta y un mensaje prellenado dinámico (ej. "Hola [Nombre], te recuerdo tu cita de [Servicio] mañana a las [Hora] en [Nombre del Salón]").
5.4. Experiencia de la Clienta (Portal del Cliente)
Pasaporte de Uñas (Historial): Timeline visual con fotos de resultados finales, fechas y servicios.
Muro de Inspiración (Feed Social): Feed infinito con filtros por tipo de servicio. Privacidad por defecto (solo nombre de pila, opt-in para compartir).
5.5. Multimedia y Reseñas
Foto de Referencia: La clienta sube al agendar; la manicurista la ve en su agenda.
Foto de Resultado Final: La manicurista sube al cerrar la cita.
Sistema de Reseñas: Link post-cita para calificar (1-5 estrellas) y comentar.
5.6. Automatizaciones y Retención
Recordatorios: Mensajes (vía el botón de WhatsApp o Email) 24h y 2h antes.
Lista de Espera Inteligente (Waitlist): Notificación automática si hay una cancelación.
6. Modelo de Datos Preliminar (Entidades)
users / clients: id, name, email, phone (crítico para el botón de WhatsApp), google_id, google_calendar_token, tech_notes, total_visits, total_revenue.
services: id, name, description, price, duration_mins, is_active.
appointments: id, client_id, service_id, start_time, end_time, status, reference_photo_url, final_photo_url, shared_to_gallery, review_rating, review_text, google_event_id_client, google_event_id_admin.
waitlist: id, client_id, preferred_date, notified.
blockouts: id, start_time, end_time, reason.
7. Consideraciones Técnicas y Fuera del Alcance
Sincronización Bidireccional (Lectura): La app escribe en los Google Calendars (Push). No lee el calendario del admin para bloquear horas automáticamente (se hace manualmente en la app).
Manejo de Timezones: Estrictamente en la zona horaria local del salón.
WhatsApp API Oficial vs Deep Links: Para el MVP, usaremos Deep Links (https://wa.me/...). No requiere configuración de servidores de Meta, es gratis y funciona perfecto para que la manicurista envíe el mensaje con un clic. (La API oficial de WhatsApp Business se deja para una V2 si se requiere automatización 100% sin intervención humana).
Pasarelas de Pagos y Multi-Empleado: Fuera del alcance para esta versión inicial.
8. Próximos Pasos (Fase de Ejecución)
Setup del Entorno: Inicializar Next.js, Drizzle, SQLite y configurar Google OAuth2.
Wireframing: Usar los prompts de IA (v0.dev) para generar las 4 pantallas clave.
Desarrollo del Núcleo: Base de datos, Auth y Motor de Reservas.
Exposición: Configurar Cloudflare Tunnel y probar el flujo completo desde el celular.