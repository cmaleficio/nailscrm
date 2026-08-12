export const PERMISSION_KEYS = [
  "appointments",
  "clients",
  "balances",
  "purchases",
  "accountsPayable",
  "inventory",
  "adjustInventory",
  "financials",
  "settings",
  "services",
  "adminUsers",
  "paymentApproval",
] as const;

export const PERMISSION_LABELS: Record<string, string> = {
  appointments: "Agenda",
  clients: "Clientes",
  balances: "Cuentas por cobrar",
  purchases: "Compras",
  accountsPayable: "Cuentas por pagar",
  inventory: "Inventario",
  adjustInventory: "Inventario (ajustes)",
  financials: "Estados financieros",
  settings: "Configuración",
  services: "Servicios",
  adminUsers: "Gestión de admins",
  paymentApproval: "Aprobar pagos",
};
