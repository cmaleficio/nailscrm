# Pestaña "Pagos cargados por admin" en Balances — Spec

**Ruta:** `/dashboard/balances` (pestaña adicional junto a "Pagos recibidos").
**Permiso:** `balances` (mismo que el endpoint existente).
**Fuente de datos:** `GET /api/payments` sin `userId` (ya devuelve todos los pagos cargados por admin con reparto + allocations).
**Acciones por fila:** Editar (`PATCH /api/payments/[id]`), Eliminar (`DELETE /api/payments/[id]`), Ver servicio asociado (vía `allocations` del reparto, que enlaza a `service_purchases`).
**Restricciones:** No crear nuevo endpoint de lectura; reutiliza `GET /api/payments`. El componente se monta en `BalancesContent`.
