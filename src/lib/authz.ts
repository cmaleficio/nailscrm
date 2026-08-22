import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

export function getSessionRole(session: Session | null): "client" | "admin" {
  return session?.user?.role === "admin" ? "admin" : "client";
}

export async function isAdmin(session: Session | null): Promise<boolean> {
  if (!session?.user?.id) return false;
  const user = db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();
  return user?.role === "admin";
}

export async function isSuperAdmin(session: Session | null): Promise<boolean> {
  return session?.user?.email === process.env.ADMIN_EMAIL;
}

function parsePermissions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.every((p) => typeof p === "string") ? arr : null;
  } catch {
    return null;
  }
}

export async function getPermissions(session: Session | null): Promise<string[] | null> {
  if (!session?.user?.id) return null;
  const user = db
    .select({ permissions: schema.users.permissions })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();
  return parsePermissions(user?.permissions ?? null);
}

export async function hasAnyPermission(
  session: Session | null,
  perms: string[]
): Promise<boolean> {
  if (await isSuperAdmin(session)) return true;
  if (!(await isAdmin(session))) return false;
  const userPerms = await getPermissions(session);
  if (userPerms === null) return true;
  return perms.some((p) => userPerms.includes(p));
}

export async function hasPermission(session: Session | null, perm: string): Promise<boolean> {
  if (await isSuperAdmin(session)) return true;
  if (!(await isAdmin(session))) return false;
  const perms = await getPermissions(session);
  if (perms === null) return true;
  return perms.includes(perm);
}

export async function canAdjustInventory(session: Session | null): Promise<boolean> {
  if (await isSuperAdmin(session)) return true;
  if (!(await isAdmin(session))) return false;
  const perms = await getPermissions(session);
  if (perms === null) return true;
  return perms.includes("adjustInventory");
}