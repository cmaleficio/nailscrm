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
  const existing = db
    .select()
    .from(schema.expenseCategories)
    .where(eq(schema.expenseCategories.id, id))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const name =
    body.name !== undefined && typeof body.name === "string"
      ? body.name.trim()
      : existing.name;
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const isActive =
    body.isActive !== undefined
      ? body.isActive
        ? 1
        : 0
      : existing.isActive;
  db.update(schema.expenseCategories)
    .set({ name, isActive })
    .where(eq(schema.expenseCategories.id, id))
    .run();
  return NextResponse.json({ ...existing, name, isActive });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const count =
    db.select({ c: sql<number>`count(*)` }).from(schema.bills).where(eq(schema.bills.categoryId, id)).get()?.c ?? 0;
  if (count > 0) {
    return NextResponse.json(
      { error: "La categoría tiene facturas asociadas; desactívala en su lugar" },
      { status: 400 }
    );
  }
  db.delete(schema.expenseCategories).where(eq(schema.expenseCategories.id, id)).run();
  return NextResponse.json({ success: true });
}
