import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus, applyPaidToClient } from "@/lib/financial-status";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const appointmentId = searchParams.get("appointmentId");
  const userId = searchParams.get("userId");

  if (appointmentId) {
    const purchase = db
      .select()
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.appointmentId, appointmentId))
      .get();
    return NextResponse.json(purchase ?? null);
  }

  if (userId) {
    const purchases = db
      .select()
      .from(schema.servicePurchases)
      .where(eq(schema.servicePurchases.userId, userId))
      .orderBy(schema.servicePurchases.createdAt)
      .all();
    return NextResponse.json(purchases);
  }

  return NextResponse.json(
    { error: "appointmentId or userId is required" },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "balances"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
    const { userId, serviceId, completionDate, price, notes } = body;
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }
  if (!serviceId || typeof serviceId !== "string" || !serviceId.trim()) {
    return NextResponse.json({ error: "serviceId es requerido" }, { status: 400 });
  }
  if (typeof completionDate !== "number" || completionDate <= 0) {
    return NextResponse.json({ error: "completionDate es requerido y debe ser un timestamp válido" }, { status: 400 });
  }
  const client = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  if (client.role === "admin") {
    return NextResponse.json({ error: "No se puede registrar un servicio para un administrador" }, { status: 400 });
  }
  const service = db.select().from(schema.services).where(eq(schema.services.id, serviceId)).get();
  if (!service || !service.isActive) {
    return NextResponse.json({ error: "Servicio no encontrado o inactivo" }, { status: 404 });
  }
  let finalPrice = service.price;
  if (typeof price === "number" && price > 0 && price <= service.price * 1.5) {
    finalPrice = Math.round(price * 100) / 100;
  }
  const now = Math.floor(Date.now() / 1000);
  const purchaseId = crypto.randomUUID();
  db.insert(schema.servicePurchases).values({
    id: purchaseId,
    userId,
    appointmentId: null,
    serviceId,
      serviceName: service.name,
      serviceDescription: (typeof notes === "string" && notes.trim() ? notes.trim() : service.description ?? null),
    servicePrice: finalPrice,
    serviceDurationMins: service.durationMins,
    financialStatus: "pending",
    completionDate,
    createdAt: now,
  }).run();
  recomputeFinancialStatus(userId);
  applyPaidToClient(userId);
  db.update(schema.users)
    .set({ totalVisits: (client.totalVisits ?? 0) + 1 })
    .where(eq(schema.users.id, userId))
    .run();
  return NextResponse.json({ success: true, id: purchaseId }, { status: 201 });
}
