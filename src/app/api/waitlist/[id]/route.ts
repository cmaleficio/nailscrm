import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission, isAdmin } from "@/lib/authz";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  if (typeof body?.notified !== "boolean") {
    return NextResponse.json({ error: "notified es requerido" }, { status: 400 });
  }

  const row = db
    .select({ id: schema.waitlist.id })
    .from(schema.waitlist)
    .where(eq(schema.waitlist.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  }

  db.update(schema.waitlist)
    .set({ notified: body.notified ? 1 : 0 })
    .where(eq(schema.waitlist.id, id))
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const row = db
    .select({ clientId: schema.waitlist.clientId })
    .from(schema.waitlist)
    .where(eq(schema.waitlist.id, id))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  }

  const admin = await isAdmin(session);
  if (!admin && row.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  db.delete(schema.waitlist).where(eq(schema.waitlist.id, id)).run();
  return NextResponse.json({ success: true });
}
