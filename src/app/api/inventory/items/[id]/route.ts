import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const existing = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const name = body.name !== undefined && typeof body.name === "string" ? body.name.trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }
  const unit = body.unit !== undefined && typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : existing.unit;
  const minStock = body.minStock !== undefined && typeof body.minStock === "number" && body.minStock >= 0 ? body.minStock : existing.minStock;
  const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive;
  const notes = body.notes !== undefined ? (typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null) : existing.notes;
  db.update(schema.inventoryItems)
    .set({ name, unit, minStock, isActive, notes })
    .where(eq(schema.inventoryItems.id, id))
    .run();
  return NextResponse.json({ ...existing, name, unit, minStock, isActive, notes });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const item = db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, id)).get();
  if (!item) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  if (item.stock > 0.004) {
    return NextResponse.json({ error: "El producto tiene stock; no se puede eliminar" }, { status: 400 });
  }
  const billItems =
    db.select({ c: sql<number>`count(*)` }).from(schema.billItems).where(eq(schema.billItems.inventoryItemId, id)).get()?.c ?? 0;
  const movements =
    db.select({ c: sql<number>`count(*)` }).from(schema.inventoryMovements).where(eq(schema.inventoryMovements.inventoryItemId, id)).get()?.c ?? 0;
  const serviceUses =
    db.select({ c: sql<number>`count(*)` }).from(schema.serviceProducts).where(eq(schema.serviceProducts.inventoryItemId, id)).get()?.c ?? 0;
  if (billItems > 0 || movements > 0 || serviceUses > 0) {
    return NextResponse.json(
      { error: "El producto tiene facturas, movimientos o usos en servicios; desactívalo en su lugar" },
      { status: 400 }
    );
  }
  db.delete(schema.inventoryItems).where(eq(schema.inventoryItems.id, id)).run();
  return NextResponse.json({ success: true });
}
