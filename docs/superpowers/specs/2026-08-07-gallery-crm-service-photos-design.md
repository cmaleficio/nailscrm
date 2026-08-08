# Diseño: Muro con fotos finales, modelos en reserva, CRM de clientes y fotos de servicios

**Fecha:** 2026-08-07
**Estado:** Aprobado

## Contexto

El MVP ya tiene: reserva con subida multi-foto de referencia (`appointment_photos`), cita completada con `finalPhotoUrl` única + `sharedToGallery`, muro de inspiración que muestra citas compartidas, panel CRM lateral básico, y servicios sin fotos. Este spec amplía el flujo de fotos y completa el CRM.

## Decisiones acordadas

1. Implementar todo el alcance, incluido el cambio de mediano plazo (clic en foto del muro → agendar servicio similar).
2. Al completar una cita con fotos, **todas se publican automáticamente** en el muro de inspiración.
3. En el home, las fotos de cada servicio se muestran en un **carrusel dentro de cada tarjeta**.
4. El teléfono de quien entra con Google se pide en una **página dedicada** `/complete-registration`.

## 1. Modelo de datos

### `appointment_photos` (modificar)
- Nueva columna `kind`: `text` con valores `'reference' | 'final'`, default `'reference'`.
- Las fotos de referencia son las que sube o elige el cliente al reservar.
- Las fotos `final` son las que sube el admin al completar la cita.

### Nueva tabla `service_photos`
- `id` text PK
- `service_id` text FK → `services.id` (on delete cascade)
- `url` text not null
- `position` integer default 0
- `created_at` integer

### Campos conservados
- `appointments.finalPhotoUrl`: se rellena con la primera foto final.
- `appointments.sharedToGallery`: se pone a `1` al completar con fotos.

## 2. API

### `GET /api/gallery` (modificar)
- Devuelve **fotos**, no citas. Un item por fila de `appointment_photos` con `kind='final'` JOIN `appointments` (donde `shared_to_gallery=1`).
- Campos por item: `id` (id de la foto), `url`, `clientName`, `serviceName`, `serviceId`, `appointmentId`, `createdAt`.
- Mantiene paginación por cursor y filtro por nombre de servicio.

### `PATCH /api/appointments/[id]` (modificar)
- Acepta `{ status, finalPhotos?: string[] }`.
- Si `status === 'completed'` y `finalPhotos` no vacío:
  - Inserta filas en `appointment_photos` con `kind='final'` y posición secuencial.
  - Actualiza `finalPhotoUrl` con la primera foto y `sharedToGallery=1`.
- Conserva la lógica existente: incremento de `totalVisits`/`totalRevenue`, cancelación de eventos de Google Calendar.

### `GET /api/appointments/[id]/photos` (nuevo)
- Devuelve las fotos de referencia (`kind='reference'`) de la cita ordenadas por posición. Requiere admin.

### `POST /api/appointments` (sin cambios de contrato)
- Ya acepta `referencePhotoUrls` como lista de URLs (subidas o elegidas del muro).

### `GET /api/clients` (nuevo)
- Listado para admin de usuarios con `role='client'`.
- Soporta `?q=` para búsqueda por nombre, email o teléfono.
- Campos: `id`, `name`, `email`, `phone`, `address`, `totalVisits`, `totalRevenue`, `techNotes`, `createdAt`.

### `POST /api/clients` (nuevo)
- Admin crea un cliente manualmente: `{ name, email?, phone, address }`.
- Si no viene `email`, se genera uno con UUID (dominio `local`) para cumplir unicidad; se asigna contraseña aleatoria hasheada (el cliente podrá entrar con Google o restablecer).

### `PATCH /api/clients/[id]` (modificar)
- Ampliar para aceptar `name`, `phone`, `address`, `techNotes`.

### `PATCH /api/profile` (nuevo, self)
- El usuario autenticado actualiza su propio `phone` y `address`.

### Fotos de servicio
- `POST /api/services/[id]/photos`: body `{ urls: string[] }` → inserta filas en `service_photos`. Requiere admin.
- `DELETE /api/services/[id]/photos/[photoId]`: elimina una foto. Requiere admin.
- `GET /api/services`: incluir las fotos de cada servicio (JOIN o query anexa). Tanto la respuesta pública como la admin.

## 3. UI / Flujos

### Completar cita (dashboard, vista día y semana)
- El botón "Completar" de `AppointmentCard` abre un diálogo nuevo `CompleteAppointmentDialog`:
  - Carga multi-foto con vista previa (reutiliza `/api/upload`).
  - Botón "Confirmar completado" → `PATCH` con `{ status: 'completed', finalPhotos }`.
  - Al confirmar, las fotos aparecen automáticamente en el muro.
- Tras el PATCH se refresca la agenda.

### Wizard de reserva (paso 3: Confirmar reserva)
- Nueva sección "Modelos de inspiración" debajo de la subida de fotos:
  - Mini-galería que consume `GET /api/gallery`.
  - Cada foto es seleccionable (overlay de check).
  - Las seleccionadas se agregan a `referencePhotoUrls` junto con las subidas.
  - Si se llega con `?referencePhotoUrl=` (desde el muro), se preselecciona como modelo.

### Agenda (día y semana)
- `ClientCRMPanel` recibe un carrusel nuevo `PhotoCarousel` que muestra las fotos de referencia de la cita (consume `GET /api/appointments/[id]/photos`).
- El panel se enriquece con teléfono y dirección editables (PATCH /api/clients/[id]) y mantiene notas técnicas, visitas/ingresos, servicio adquirido y WhatsApp.
- La vista semana ya abre el mismo panel vía "Ver".

### `/dashboard/clients` (nuevo contenido)
- `ClientsContent`: listado con buscador, cards/tabla con nombre, email, teléfono, dirección, visitas e ingresos.
- Clic en cliente → abre `ClientCRMPanel` (reusando el panel lateral) para editar notas y datos de contacto.
- Botón "Nuevo cliente": form mínimo (nombre, email, teléfono, dirección) que crea el usuario con contraseña aleatoria (el cliente podrá entrar con Google o restablecer después).

### Servicios
- `ServicesContent`: gestor de fotos por servicio (subir varias, grid de miniaturas, eliminar).
- Home: `ServiceCard` muestra un carrusel con `service.photos` (flechas manuales, sin auto-play).

### Muro de inspiración (mediano plazo)
- `GalleryGrid`: cada foto es clicable → modal "¿Agendar un servicio similar con este modelo?".
- Botón "Agendar" → `/book?serviceId=X&referencePhotoUrl=Y`. El wizard preselecciona servicio y modelo.

## 4. Autenticación / teléfono

- Añadir `phone` al token JWT y a la sesión (leer de `users.phone` en el callback `jwt`).
- Nueva página `/complete-registration` (protegida, grupo client):
  - Form con teléfono (obligatorio) y dirección (opcional).
  - Guarda vía `PATCH /api/profile` y redirige a `/profile`.
- En `/profile` (server) y `/book` (server): si el usuario autenticado no tiene `phone`, redirigir a `/complete-registration`.

## 5. Verificación

- Generar y aplicar migración Drizzle.
- Actualizar `src/db/seed-client-demo.ts` para el nuevo formato del muro (fotos finales múltiples con `kind='final'`).
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Prueba manual: completar cita con fotos → aparecen en muro; reserva eligiendo modelos; carrusel en agenda; CRM de clientes; fotos de servicios en home.

## Fuera de alcance

- Promociones/tickets de descuento (solo se dejan los datos de visitas listos).
- Multi-foto con ordenación arrastrable.
- Edición de reseñas desde el muro.
