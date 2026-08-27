import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, inArray, sql } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { validateSlot } from "@/lib/availability";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { serviceId, startTime, clientIds } = body;

  if (!serviceId || typeof startTime !== "number" || !Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json({ error: "serviceId, startTime y clientIds son requeridos" }, { status: 400 });
  }

  const service = db.select().from(schema.services).where(eq(schema.services.id, serviceId)).get();
  if (!service) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  if (service.isGroup !== 1) return NextResponse.json({ error: "El servicio no es de tipo grupo" }, { status: 400 });

  const endTime = startTime + service.durationMins * 60;
  const availError = validateSlot(startTime, endTime);
  if (availError) return NextResponse.json({ error: availError }, { status: 409 });

  const ids = Array.from(new Set<string>(clientIds));
  const clients = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.id, ids))
    .all();
  if (clients.length !== ids.length) {
    return NextResponse.json({ error: "Uno o más clientes no existen" }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const appointmentId = crypto.randomUUID();
  db.insert(schema.appointments).values({
    id: appointmentId,
    clientId: ids[0],
    serviceId,
    startTime,
    endTime,
    status: "pending",
    createdAt: now,
  }).run();

  for (const cid of ids) {
    db.insert(schema.courseEnrollments).values({
      id: crypto.randomUUID(),
      appointmentId,
      clientId: cid,
      createdAt: now,
    }).run();
    db.insert(schema.servicePurchases).values({
      id: crypto.randomUUID(),
      userId: cid,
      appointmentId,
      serviceId: service.id,
      serviceName: service.name,
      serviceDescription: service.description,
      servicePrice: service.price,
      serviceDurationMins: service.durationMins,
      financialStatus: "pending",
      createdAt: now,
    }).run();
  }

  return NextResponse.json({ id: appointmentId });
}

export async function GET() {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const rows = db
    .select({
      id: schema.appointments.id,
      serviceId: schema.appointments.serviceId,
      serviceName: schema.services.name,
      servicePrice: schema.services.price,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
    })
    .from(schema.appointments)
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .where(eq(schema.services.isGroup, 1))
    .orderBy(schema.appointments.startTime)
    .all();

  const enrollRows = db.select().from(schema.courseEnrollments).all();
  const pupilNames = new Map(
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).all().map((u) => [u.id, u.name])
  );
  const purchaseRows = db
    .select({
      appointmentId: schema.servicePurchases.appointmentId,
      userId: schema.servicePurchases.userId,
      servicePrice: schema.servicePurchases.servicePrice,
      financialStatus: schema.servicePurchases.financialStatus,
    })
    .from(schema.servicePurchases)
    .all();
  const paidVector = db
    .select({ userId: schema.payments.userId, total: sql<number>`sum(${schema.payments.amountUsd})` })
    .from(schema.payments)
    .groupBy(schema.payments.userId)
    .all();
  const paidMap = new Map(paidVector.map((p) => [p.userId, p.total ?? 0]));

  const data = rows.map((s) => {
    const enrolled = enrollRows.filter((e) => e.appointmentId === s.id);
    const pupils = enrolled.map((e) => {
      const pur = purchaseRows.find((p) => p.appointmentId === s.id && p.userId === e.clientId);
      const price = pur?.servicePrice ?? s.servicePrice;
      const paid = paidMap.get(e.clientId) ?? 0;
      return {
        clientId: e.clientId,
        name: pupilNames.get(e.clientId) ?? "Desconocido",
        price,
        paid,
        balance: Math.round((price - Math.min(paid, price)) * 100) / 100,
        financialStatus: pur?.financialStatus ?? "pending",
      };
    });
    return { ...s, pupils, studentCount: pupils.length };
  });

  return NextResponse.json(data);
}
