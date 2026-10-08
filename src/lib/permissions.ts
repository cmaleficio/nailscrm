export const PERMISSION_KEYS = [
  "appointments",
  "clients",
  "balances",
  "purchases",
  "accountsPayable",
  "inventory",
  "adjustInventory",
  "financials",
  "brandSettings",
  "workingHours",
  "exchangeRates",
  "legalSettings",
  "navigation",
  "services",
  "gallery",
  "adminUsers",
  "paymentApproval",
  "activityLog",
  "mergeClients",
  "backups",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const CONFIGURATION_PERMISSION_KEYS = [
  "brandSettings",
  "workingHours",
  "exchangeRates",
  "legalSettings",
  "navigation",
] as const satisfies readonly PermissionKey[];

export function expandLegacyPermissions(
  permissions: readonly string[]
): string[] {
  const expanded = new Set<string>();
  for (const permission of permissions) {
    if (permission === "settings") {
      for (const key of CONFIGURATION_PERMISSION_KEYS) expanded.add(key);
    } else {
      expanded.add(permission);
    }
  }
  return [...expanded];
}

export function parseStoredPermissions(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === "string")) return [];
  return expandLegacyPermissions(parsed);
}

export function isPermissionKey(value: unknown): value is PermissionKey | "settings" {
  return (
    typeof value === "string" &&
    (value === "settings" || (PERMISSION_KEYS as readonly string[]).includes(value))
  );
}

export const PERMISSION_LABELS: Record<string, string> = {
  appointments: "Agenda",
  clients: "Clientes",
  balances: "Cuentas por cobrar",
  purchases: "Compras",
  accountsPayable: "Cuentas por pagar",
  inventory: "Inventario",
  adjustInventory: "Inventario (ajustes)",
  financials: "Estados financieros",
  brandSettings: "Identidad",
  workingHours: "Horarios",
  exchangeRates: "Tasas",
  legalSettings: "Legal",
  navigation: "NavegaciÃ³n",
  services: "Servicios",
  gallery: "Muro de inspiraciÃ³n",
  adminUsers: "GestiÃ³n de admins",
  paymentApproval: "Aprobar pagos",
  activityLog: "Log de actividad",
  mergeClients: "Fusionar clientes",
  backups: "Respaldos y restauración",
};
