import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const patch: Record<string, string | null> = {};
  for (const field of ["name", "phone", "email", "address", "notes"] as const) {
    if (body[field] !== undefined) {
      const v = typeof body[field] === "string" ? body[field].trim() : "";
      patch[field] = v || null;
    }
  }
  if (patch.name === null || patch.name === "") {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  db.update(schema.suppliers).set(patch).where(eq(schema.suppliers.id, id)).run();
  return NextResponse.json({ ...existing, ...patch });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const count =
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.bills)
      .where(eq(schema.bills.supplierId, id))
      .get()?.c ?? 0;
  if (count > 0) {
    return NextResponse.json(
      { error: "El proveedor tiene facturas asociadas; no se puede eliminar" },
      { status: 400 }
    );
  }
  db.delete(schema.suppliers).where(eq(schema.suppliers.id, id)).run();
  return NextResponse.json({ success: true });
}
