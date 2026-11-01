# Diseño: Filtro por mes, servicios futuros y correcciones en Cuentas por cobrar

Fecha: 2026-10-31
Estado: Aprobado por usuario
Ruta: `/dashboard/balances`

## 1. Objetivo
Modificar la vista `/dashboard/balances` para:
- Filtrar cuentas por mes límite (`start_time`).
- Separar servicios futuros dentro de cada cliente.
- Corregir el conteo de citas sin pagar (`DISTINCT appointment_id`).
- Establecer `pending` como filtro por defecto y reordenar los botones.

## 2. Arquitectura
- `GET /api/balances` recibe `?month=` (formato `YYYY-MM`).
- El filtro aplica `start_time <= fin_del_mes` al calcular `items` y `unpaidAppointments`.
- `futureItems`: compras del mismo usuario con `start_time > fin_del_mes`.
- `unpaidAppointments`: `count(DISTINCT servicePurchases.appointmentId)` donde `appointmentId IS NOT NULL`.
- `BalancesContent`: `statusFilter` inicia en `"pending"`; orden de botones: `pending`, `all`, `partial`, `paid`.

## 3. Cambios por archivo
- `src/app/api/balances/route.ts`: agregar `monthFilter`, `futureItems`, corregir `unpaid`.
- `src/app/(admin)/dashboard/balances/BalancesContent.tsx`: agregar `monthFilter` UI, `futureItems` block, orden de filtro, texto corregido.
- `AGENTS.md`: documentar cambio.
- `CHANGELOG.md`: registrar.

## 4. Datos y flujo
El filtro se aplica en SQL: `startTime <= endOfMonth(<param>)`. El mes límite se pasa desde un `<select>` en la UI.

## 5. Pruebas
- `unpaidAppointments` debe reflejar citas únicas con `appointment_id`.
- `futureItems` debe ser vacío cuando no hay servicios posteriores al mes seleccionado.
- `statusFilter` por defecto debe ser `pending`.

## 6. Riesgos y mitigación
- Riesgo: cambiar la definición de `unpaid` podría alterar el orden visual. Mitigación: mantener el orden existente (`rank`).
