import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { parseStoredPermissions } from "@/lib/permissions";

export function getSessionRole(session: Session | null): "client" | "admin" {
  return session?.user?.role === "admin" ? "admin" : "client";
}

type AuthRow = {
  role: string;
  permissions: string | null;
  lockedAt: number | null;
};

/**
 * Una sola lectura de la fila del usuario para todas las guardas. Traer
 * role + permissions + lockedAt juntos quita las tres consultas que antes hacía
 * `hasPermission` (isSuperAdmin → isAdmin → getPermissions) y, más importante,
 * hace imposible que una guarda se olvide de mirar `lockedAt`.
 */
function loadAuthRow(session: Session | null): AuthRow | undefined {
  if (!session?.user?.id) return undefined;
  return db
    .select({
      role: schema.users.role,
      permissions: schema.users.permissions,
      lockedAt: schema.users.lockedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();
}

/**
 * `lockedAt` lo escribe el receptor de RISC cuando Google reporta
 * `account-disabled` (una señal de que la cuenta fue secuestrada). Mientras no
 * se comprobara aquí, el bloqueo no revocaba nada: el usuario conservaba el
 * acceso admin durante toda la vida del JWT. Ahora la fila bloqueada no es
 * admin para ninguna guarda, y `account-enabled` lo vuelve a abrir limpiando
 * `lockedAt` en `risc/events`.
 */
function isActiveAdminRow(row: AuthRow | undefined): row is AuthRow {
  return row?.role === "admin" && row.lockedAt == null;
}

/**
 * Falla cerrado: sin `ADMIN_EMAIL` en el entorno nadie es superadmin. La
 * comparación directo con `process.env.ADMIN_EMAIL` haría que, si la variable
 * falta, `undefined === undefined` ascendiera de superadmin a cualquier admin.
 */
function isSuperAdminEmail(session: Session | null): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return session?.user?.email === adminEmail;
}

export async function isAdmin(session: Session | null): Promise<boolean> {
  return isActiveAdminRow(loadAuthRow(session));
}

export async function isSuperAdmin(session: Session | null): Promise<boolean> {
  if (!isSuperAdminEmail(session)) return false;
  return isAdmin(session);
}

export async function getPermissions(session: Session | null): Promise<string[] | null> {
  const row = loadAuthRow(session);
  // `null` significa "acceso a todos los módulos", así que solo un admin activo
  // puede devolverlo. Antes una clienta sin permisos almacenados también salía
  // `null` de aquí y por lo tanto le pintaba el sidebar completo del dashboard.
  if (!isActiveAdminRow(row)) return [];
  return parseStoredPermissions(row.permissions);
}

export async function hasAnyPermission(
  session: Session | null,
  perms: string[]
): Promise<boolean> {
  if (isSuperAdminEmail(session)) return isActiveAdminRow(loadAuthRow(session));
  const row = loadAuthRow(session);
  if (!isActiveAdminRow(row)) return false;
  const userPerms = parseStoredPermissions(row.permissions);
  if (userPerms === null) return true;
  return perms.some((p) => userPerms.includes(p));
}

export async function hasPermission(session: Session | null, perm: string): Promise<boolean> {
  if (isSuperAdminEmail(session)) return isActiveAdminRow(loadAuthRow(session));
  const row = loadAuthRow(session);
  if (!isActiveAdminRow(row)) return false;
  const perms = parseStoredPermissions(row.permissions);
  if (perms === null) return true;
  return perms.includes(perm);
}

export async function canAdjustInventory(session: Session | null): Promise<boolean> {
  return hasPermission(session, "adjustInventory");
}
