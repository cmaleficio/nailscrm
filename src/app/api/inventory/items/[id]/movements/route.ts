import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, desc } from "drizzle-orm";
import { hasPermission, canAdjustInventory } from "@/lib/authz";
import { applyManualMovement } from "@/lib/inventory";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const rows = db
    .select()
    .from(schema.inventoryMovements)
    .where(eq(schema.inventoryMovements.inventoryItemId, id))
    .orderBy(desc(schema.inventoryMovements.createdAt))
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId || !(await hasPermission(session, "inventory"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : "";
  const kind: "out" | "adjust" = body.kind === "adjust" ? "adjust" : "out";
  if (kind === "adjust" && !(await canAdjustInventory(session))) {
    return NextResponse.json({ error: "No autorizado para ajustar stock" }, { status: 403 });
  }
  if (kind === "adjust" && !notes) {
    return NextResponse.json({ error: "El motivo es obligatorio en ajustes" }, { status: 400 });
  }
  const param = Number(body.quantity);
  if (!Number.isFinite(param)) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }
  try {
    const result = applyManualMovement(id, kind, param, notes, adminId);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error inesperado" },
      { status: 400 }
    );
  }
}
