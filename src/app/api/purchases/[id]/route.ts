import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";

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