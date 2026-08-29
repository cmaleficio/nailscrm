import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = db
    .select()
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  const syncFromCatalog =
    body.syncFromCatalog === true && existing.serviceId
      ? db
          .select()
          .from(schema.services)
          .where(eq(schema.services.id, existing.serviceId))
          .get()
      : null;

  const next = {
    serviceName:
      body.serviceName !== undefined
        ? String(body.serviceName).trim()
        : syncFromCatalog
          ? syncFromCatalog.name
          : existing.serviceName,
    serviceDescription:
      body.serviceDescription !== undefined
        ? body.serviceDescription === null
          ? null
          : String(body.serviceDescription).trim()
        : syncFromCatalog
          ? syncFromCatalog.description
          : existing.serviceDescription,
    servicePrice:
      body.servicePrice !== undefined
        ? Number(body.servicePrice)
        : syncFromCatalog
          ? syncFromCatalog.price
          : existing.servicePrice,
    serviceDurationMins:
      body.serviceDurationMins !== undefined
        ? Number(body.serviceDurationMins)
        : syncFromCatalog
          ? syncFromCatalog.durationMins
          : existing.serviceDurationMins,
  };

  if (!next.serviceName) {
    return NextResponse.json(
      { error: "El nombre del servicio es requerido" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(next.servicePrice) || next.servicePrice < 0) {
    return NextResponse.json(
      { error: "El precio es inválido" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(next.serviceDurationMins) || next.serviceDurationMins <= 0) {
    return NextResponse.json(
      { error: "La duración debe ser un número entero en minutos" },
      { status: 400 }
    );
  }

  db.update(schema.servicePurchases)
    .set(next)
    .where(eq(schema.servicePurchases.id, id))
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const purchase = db
    .select()
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.id, id))
    .get();

  if (!purchase) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (purchase.appointmentId !== null) {
    return NextResponse.json(
      { error: "No se puede eliminar un servicio con cita asociada desde aquí" },
      { status: 400 }
    );
  }

  db.delete(schema.servicePurchases)
    .where(eq(schema.servicePurchases.id, id))
    .run();

  const client = db
    .select({ totalVisits: schema.users.totalVisits })
    .from(schema.users)
    .where(eq(schema.users.id, purchase.userId))
    .get();

  if (client && (client.totalVisits ?? 0) > 0) {
    db.update(schema.users)
      .set({ totalVisits: (client.totalVisits ?? 0) - 1 })
      .where(eq(schema.users.id, purchase.userId))
      .run();
  }

  recomputeFinancialStatus(purchase.userId);

  return NextResponse.json({ success: true });
}