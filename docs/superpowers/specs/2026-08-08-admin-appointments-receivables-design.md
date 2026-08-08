# Diseño: Citas del admin para walk-ins, horario de trabajo, cuentas por cobrar y pagos

**Fecha:** 2026-08-08
**Estado:** Aprobado

## Contexto

El MVP permite reservas solo por clientes autenticados (el `clientId` se fuerza a `session.user.id` en `POST /api/appointments`). No existe forma de que el admin cree una cita para un cliente no registrado (walk-in), ni gestión de bloques "no disponible", ni manejo de dinero. El horario de trabajo está fijo en `src/lib/slots.ts` (9:00–18:00). Este spec añade: (1) citas creadas por el admin para cualquier cliente (incluidos walk-ins creados al vuelo), (2) bloques no-disponibles gestionables, (3) horario de trabajo configurable por día de la semana, (4) cuentas por cobrar con registro de pagos (en $ o Bs con la tasa del día del BCV) y abonos parciales.

## Decisiones acordadas

1. **Tasa del día automática (BCV)**, con respaldo manual editable si la API falla o el admin quiere corregirla.
2. **Pagos en $ y en Bs**, con **abonos parciales** permitidos.
3. La deuda nace **al completar la cita**: si el admin marca "pagó", se crea un pago; si no, queda como cuenta por cobrar automática.
4. **Saldo calculado en vivo**: `saldo = Σ(precio snapshot de citas completadas) − Σ(pagos)`. Sin ledger contable separado.
5. **Horario de trabajo por día de la semana** (Lun–Sáb 9:00–18:00, Dom cerrado por defecto), editable por el admin.
6. **Citas + bloques no disponibles**: el admin crea citas para walk-ins y también bloques "no disponible" desde el dashboard.
7. **Lugar de gestión**: sección global "Cuentas por cobrar" en el dashboard + saldo de cada cliente en su panel CRM.

## 1. Modelo de datos

### Nueva tabla `working_hours`
- `day_of_week`: integer, primary key (0=Domingo … 6=Sábado).
- `is_open`: integer (boolean), default 1.
- `start_time`: text, "HH:MM" (24h), default "09:00".
- `end_time`: text, "HH:MM", default "18:00".

Seed inicial: Lun–Sáb abiertos 09:00–18:00, Dom cerrado. Si no existe fila para un día, se interpreta como cerrado (para no regalar slots si la tabla está vacía).

### Nueva tabla `payments`
- `id`: text, primary key.
- `user_id`: text, FK → `users.id` (el cliente que paga).
- `appointment_id`: text, FK → `appointments.id` **ON DELETE SET NULL**, nullable (opcional, si el pago es de una cita concreta; si la cita se elimina, el pago se conserva sin enlace).
- `amount_usd`: real, not null (cuántos $ cubre este pago; si pagó en Bs es `amountVes / rate` redondeado a 2 decimales).
- `currency`: text, not null, `'USD' | 'VES'`.
- `amount_ves`: real, nullable (monto en Bs si pagó en Bs).
- `rate`: real, nullable (tasa usada si pagó en Bs).
- `reference`: text, not null (número de referencia del pago; obligatorio en todos los casos).
- `paid_at`: integer (timestamp), fecha del pago (puede ser distinta de hoy, ej. pagos atrasados).
- `notes`: text, nullable.
- `created_by`: text, FK → `users.id` (el admin que registró).
- `created_at`: integer (timestamp).

### Nueva tabla `exchange_rates`
- `id`: text, primary key.
- `date`: text, único, "YYYY-MM-DD".
- `rate`: real, not null.
- `source`: text, not null, `'bcv' | 'manual'`.
- `created_at`: integer (timestamp).

### Sin cambios en `appointments` / `service_purchases`
- La "cuenta por cobrar" no es una fila: es el conjunto de citas `completed` sin cubrir por pagos.
- La base del monto adeudado por cita es **`service_purchases.servicePrice`** (snapshot, el que el admin puede editar en el CRM). No se usa `services.price` para el saldo.

## 2. API

### `POST /api/appointments` (modificar)
- Acepta campo opcional `clientId`.
- Si viene `clientId` → requiere `isAdmin`. Si no viene → se conserva el flujo público (cliente = sesión).
- **Validación de disponibilidad en el servidor** (nueva): antes de insertar, verificar que `[startTime, endTime)` no solape ninguna cita `pending`/`confirmed` ni ningún `blockouts`, que esté dentro del horario de trabajo del día y que no sea en el pasado. Comparte la misma lógica que `/api/slots`.
- Conserva: snapshot `service_purchases`, fotos de referencia, push a Google Calendar (best-effort).
- Status inicial de las citas creadas por admin: `'pending'`.

### `GET /api/working-hours` (nuevo, admin)
- Devuelve las 7 filas (`dayOfWeek`, `isOpen`, `startTime`, `endTime`), completando con defaults las que no existan.

### `PUT /api/working-hours` (nuevo, admin)
- Body: `{ hours: [{ dayOfWeek, isOpen, startTime, endTime }, ...] }` (puede enviarse el array completo de 7).
- Upsert de cada fila. Valida: `startTime < endTime`, formato "HH:MM", `0 <= dayOfWeek <= 6`.

### `GET /api/blockouts` (nuevo, admin)
- Lista todos los bloques. Soporta `?from=&to=` (timestamps) opcional para rango.

### `POST /api/blockouts` (nuevo, admin)
- Body: `{ startTime, endTime, reason? }`. Valida `startTime < endTime`.
- Devuelve el bloque creado.

### `DELETE /api/blockouts/[id]` (nuevo, admin)
- Elimina el bloque.

### `GET /api/exchange-rate` (nuevo, admin)
- Devuelve `{ date: "YYYY-MM-DD", rate, source }`:
  - Si existe fila de hoy en `exchange_rates` → la devuelve (cache).
  - Si no, intenta `fetchBcvRate()`; si ok → la guarda con `source='bcv'` y la devuelve.
  - Si falla → `{ date, rate: null, source: null }` (el frontend pedirá la tasa manual).
- Nota: la tasa manual que el admin escribe al registrar un pago se guarda **solo en la fila `payments`** (`rate`), no se persiste en `exchange_rates`. `source='manual'` queda reservado para uso futuro (p.ej. fijar la tasa del día desde configuración); por ahora la caché solo se escribe con `source='bcv'`.

### `POST /api/payments` (nuevo, admin)
- Body: `{ userId, appointmentId?, amountUsd?, currency, amountVes?, rate?, reference, paidAt, notes? }`.
- Reglas:
  - `currency === 'VES'` → requiere `amountVes` y `rate` > 0; `amountUsd = round(amountVes / rate, 2)`.
  - `currency === 'USD'` → requiere `amountUsd` > 0.
  - `reference` obligatorio. `paidAt` default hoy (timestamp). `createdBy = session.user.id`.
  - Si viene `appointmentId`, verifica que la cita sea del `userId`.
- Devuelve el pago creado.

### `GET /api/payments` (nuevo, admin)
- Soporta `?userId=` para el historial de un cliente. Ordenados por `paidAt` desc.
- Campos: `id`, `amountUsd`, `currency`, `amountVes`, `rate`, `reference`, `paidAt`, `notes`, `appointmentId`.

### `DELETE /api/payments/[id]` (nuevo, admin)
- Elimina un pago (para corregir errores). El saldo se recalcula solo.

### `GET /api/balances` (nuevo, admin)
- Resumen global: `{ totalUsd, clients: [{ clientId, name, phone, balanceUsd, unpaidAppointments }] }`.
- `clients` = usuarios con `role='client'` que tengan `balanceUsd > 0` (redondeado a 2 decimales), ordenados por deuda desc.
- `totalUsd` = suma de todas las deudas.

### `GET /api/clients/[id]` (modificar, admin)
- Añade a la respuesta `balanceUsd` y `payments: [...]` (los últimos 10 pagos, del endpoint de pagos).

### `GET /api/slots` (modificar, público)
- Usa `working_hours` del día en lugar de 9:00–18:00 fijos. Si el día está cerrado → `slots: []`.
- Respuesta añade `{ openTime, closeTime }` informativo (opcional).

## 3. Lógica compartida

### `src/lib/slots.ts` (modificar)
- `generateSlots` recibe `openTime`/`closeTime` (minutos desde 0:00 o string "HH:MM") en vez de las constantes `OPEN`/`CLOSE`.
- Se añade `getWorkingHoursForDate(dateStr): { openMin, closeMin, isOpen }` que lee `working_hours` del día de la semana de la fecha.
- Se mantiene el comportamiento de slots a horas en punto y el cierre según duración.

### Nuevo `src/lib/availability.ts`
- `isSlotAvailable(dateStr, startTime, endTime): boolean` (o función que recibe el rango y consulta citas `pending`/`confirmed` + `blockouts` + horario).
- Usada por `POST /api/appointments` (validación servidor) y por `/api/slots` (misma fuente de verdad).

### Nuevo `src/lib/bcv.ts`
- `fetchBcvRate(): Promise<number | null>`: obtiene la tasa oficial del BCV scrapeando **directamente la página de bcv.org.ve** (la única fuente; NO usar APIs JSON de terceros como dolarapi/otros):
  1. `fetch("https://www.bcv.org.ve/tasas-informativas-sistema-bancario")` con `Accept-Language: es` y `User-Agent` de navegador (el BCV puede rechazar peticiones sin UA). `timeout` corto (p.ej. 10s).
  2. Guarda el HTML recibido en un `.txt` en `os.tmpdir()` (p.ej. `bcv-tasa-<YYYY-MM-DD>.txt`) con `node:fs/promises`. Sobrescribe el del día si ya existe.
  3. Lee ese `.txt` y scrapea la tasa con regex (la tabla usa formato venezolano: miles con `.` y decimales con `,`, p.ej. `36,55`). Se busca el bloque `USD` del "Tasa de Cambio Referencial" dentro del HTML de la tabla. Ej. patrón de referencia: `USD\s*\|?\s*([\d.,]+)`.
  4. Normaliza a número (`"36,55" → 36.55`, eliminando separadores de miles) y lo devuelve. Si no encuentra la tasa o falla el fetch → `null`.
- `getTodayRate(): { date, rate, source }`: filtra por caché de `exchange_rates` de hoy; si no, intenta `fetchBcvRate()` y guarda (`source='bcv'`); si falla, devuelve `rate: null`.

## 4. UI / Flujos

### `DashboardContent.tsx` (modificar)
- Botones "**Nueva cita**" y "**Bloquear tiempo**" en el header de la agenda (visibles en día y semana).
- Nuevo `NewAppointmentDialog`:
  - **Cliente**: buscador (`GET /api/clients?q=`) + opción "+ Crear nuevo" (mini-formulario nombre/telefono → `POST /api/clients`, y selecciona el creado).
  - **Servicio**: select desde `GET /api/services`.
  - **Fecha**: input date (timezone local).
  - **Hora**: pills con los slots de `GET /api/slots?date=&serviceId=`. Solo disponibles.
  - Submit → `POST /api/appointments { clientId, serviceId, startTime }`. Recarga la agenda y muestra error inline si el servidor rechaza por disponibilidad.
- Nuevo `BlockoutDialog`:
  - Fecha, hora inicio, hora fin (inputs de hora), motivo opcional.
  - Submit → `POST /api/blockouts`.
- Render de blockouts en la vista día (bloque gris con motivo y botón "×" para eliminar → `DELETE /api/blockouts/[id]`). En la vista semana se marcan como no disponibles.

### `CompleteAppointmentDialog.tsx` (modificar)
- Añade sección de pago: "¿Pagó en el momento?" (toggle).
  - Si **no** paga → se cierra con `PATCH { status: 'completed', finalPhotos }` (la deuda nace sola).
  - Si **sí** paga → además de la PATCH, un mini-formulario: monto (default = precio del servicio), moneda `$`/`Bs`, tasa (auto desde `/api/exchange-rate`, editable si falla), referencia (obligatoria), fecha (default hoy). Al confirmar: PATCH completar + `POST /api/payments`.
- Recibe prop `servicePrice` (del `service` que ya trae la cita en el dashboard).

### Nueva página `/dashboard/balances` → `BalancesContent.tsx`
- Header: total adeudado (en $) y tasa del día.
- Lista de clientes con deuda: nombre, teléfono, saldo, nº de citas sin pagar. Clic → expande historial de pagos + botón "**Registrar pago**".
- `RegisterPaymentDialog`: cliente (fijo si se abre desde la lista, o selector), monto, moneda, tasa (auto/editable), referencia, fecha, notas. Submit → `POST /api/payments`. Recarga balances.
- Poder eliminar un pago erróneo (botón "×" con confirmación) → `DELETE /api/payments/[id]`.

### `ClientCRMPanel.tsx` (modificar)
- Sección nueva "Saldo / Pagos": saldo actual del cliente (en $), últimos pagos y botón "Registrar pago" (reutiliza `RegisterPaymentDialog`).

### `src/app/(admin)/layout.tsx` (modificar)
- `NAV_ITEMS` añade:
  - `{ href: "/dashboard/balances", label: "Cuentas por cobrar", icon: "💰" }`
  - `{ href: "/dashboard/settings", label: "Configuración", icon: "⏰" }`

### Nueva página `/dashboard/settings` → `SettingsContent.tsx` + `WorkingHoursEditor`
- Grid con 7 días de la semana: toggle abierto/cerrado + selects de hora inicio y fin (en incrementos de 30 min). Botón "Guardar" → `PUT /api/working-hours`.
- Solo accesible por admin (el layout admin ya protege; la página valida `isAdmin`).

## 5. Casos borde y reglas

- **Doble agendado**: se valida en el servidor (`POST /api/appointments` y `POST /api/blockouts` no validan solapamiento entre bloques entre sí; se asume que los bloqueos no se solapan con citas: la validación de citas sí los respeta).
- **Día cerrado**: sin slots; no se pueden crear citas en ese día (el wizard y el diálogo admin muestran "Cerrado").
- **Pago en Bs**: `amountUsd = round(amountVes / rate, 2)`. Se guarda también `amountVes` y `rate` para auditoría.
- **Borrar pago**: no altera nada salvo el saldo, que se recalcula.
- **Saldo negativo**: no ocurre; si un cliente paga más de lo adeudado (abono a cuenta), el excedente no se muestra como deuda negativa (los clientes de la lista global son solo con saldo > 0). El saldo del cliente en el CRM puede salir 0.
- **Pagos sin cita asociada**: permitidos (abono general a cuenta del cliente).
- **Timezone**: fechas en `America/Caracas` (el patrón ya existente en el repo).
- **Walk-in sin Google**: el evento del calendario del cliente se omite (best-effort, como ya ocurre); el evento del admin se crea.

## 6. Seeds y demo

- `seed-demo.ts` y `seed-client-demo.ts`: sembrar `working_hours` (Lun–Sáb 9:00–18:00, Dom cerrado) si la tabla está vacía.
- `seed-client-demo.ts`: añadir un par de pagos de ejemplo (uno completo, uno abono parcial) para la clienta, y dejar una cita completada sin pagar para que la sección de cuentas por cobrar muestre datos.

## 7. Documentación

- `AGENTS.md`: nuevas tablas (`working_hours`, `payments`, `exchange_rates`), rutas nuevas (`/dashboard/balances`, `/dashboard/settings`) y componentes clave nuevos.
- `CHANGELOG.md`: entradas bajo `## [Sin publicar]`.
- `README.md`: reflejar citas para walk-ins, horario de trabajo, cuentas por cobrar y pagos con tasa BCV.
