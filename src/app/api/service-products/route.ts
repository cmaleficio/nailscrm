import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  const q = db
    .select({
      id: schema.serviceProducts.id,
      serviceId: schema.serviceProducts.serviceId,
      inventoryItemId: schema.serviceProducts.inventoryItemId,
      itemName: schema.inventoryItems.name,
      unit: schema.inventoryItems.unit,
      quantityPerService: schema.serviceProducts.quantityPerService,
    })
    .from(schema.serviceProducts)
    .innerJoin(schema.inventoryItems, eq(schema.inventoryItems.id, schema.serviceProducts.inventoryItemId));
  const rows = serviceId
    ? q.where(eq(schema.serviceProducts.serviceId, serviceId)).all()
    : q.all();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const service = db.select({ id: schema.services.id }).from(schema.services).where(eq(schema.services.id, serviceId)).get();
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items es requerido" }, { status: 400 });
  }
  const clean: { inventoryItemId: string; quantityPerService: number }[] = [];
  for (const it of body.items) {
    const qty = Number(it.quantityPerService);
    if (typeof it.inventoryItemId !== "string" || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Cada uso requiere inventoryItemId y cantidad > 0" }, { status: 400 });
    }
    clean.push({ inventoryItemId: it.inventoryItemId, quantityPerService: qty });
  }
  db.delete(schema.serviceProducts).where(eq(schema.serviceProducts.serviceId, serviceId)).run();
  for (const it of clean) {
    db.insert(schema.serviceProducts)
      .values({
        id: crypto.randomUUID(),
        serviceId,
        inventoryItemId: it.inventoryItemId,
        quantityPerService: it.quantityPerService,
      })
      .run();
  }
  return NextResponse.json({ success: true });
}
