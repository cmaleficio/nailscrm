import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  const name =
    body.name !== undefined && typeof body.name === "string"
      ? body.name.trim()
      : existing.name;
  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const price =
    body.price !== undefined ? Number(body.price) : existing.price;
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "El precio es inválido" },
      { status: 400 }
    );
  }

  const durationMins =
    body.durationMins !== undefined
      ? Number(body.durationMins)
      : existing.durationMins;
  if (!Number.isInteger(durationMins) || durationMins <= 0) {
    return NextResponse.json(
      { error: "La duración debe ser un número entero en minutos" },
      { status: 400 }
    );
  }

  const description =
    body.description !== undefined
      ? typeof body.description === "string"
        ? body.description.trim()
        : null
      : existing.description;

  const isActive =
    body.isActive !== undefined
      ? body.isActive
        ? 1
        : 0
      : existing.isActive;

  db.update(schema.services)
    .set({ name, price, durationMins, description, isActive })
    .where(eq(schema.services.id, id))
    .run();

  return NextResponse.json({
    id,
    name,
    price,
    durationMins,
    description,
    isActive,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .get();

  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const appointmentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.appointments)
      .where(eq(schema.appointments.serviceId, id))
      .get()?.count ?? 0;

  if (appointmentsCount > 0) {
    return NextResponse.json(
      { error: "El servicio tiene citas asociadas; desactívalo en su lugar" },
      { status: 400 }
    );
  }

  const purchasesCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.serviceId, id))
      .get()?.count ?? 0;

  if (purchasesCount > 0) {
    return NextResponse.json(
      { error: "El servicio tiene compras asociadas; desactívalo en su lugar" },
      { status: 400 }
    );
  }

  db.delete(schema.services).where(eq(schema.services.id, id)).run();

  return NextResponse.json({ success: true });
}