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