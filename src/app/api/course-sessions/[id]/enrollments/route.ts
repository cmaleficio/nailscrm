import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and } from "drizzle-orm";
import { hasPermission } from "@/lib/authz";
import { recomputeFinancialStatus } from "@/lib/financial-status";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const appt = db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
  if (!appt) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (appt.status === "completed") return NextResponse.json({ error: "No se puede modificar una sesión completada" }, { status: 400 });

  const service = db.select().from(schema.services).where(eq(schema.services.id, appt.serviceId)).get();
  if (!service || service.isGroup !== 1) return NextResponse.json({ error: "No es una sesión de grupo" }, { status: 400 });

  const exists = db.select().from(schema.courseEnrollments)
    .where(and(eq(schema.courseEnrollments.appointmentId, id), eq(schema.courseEnrollments.clientId, clientId))).get();
  if (exists) return NextResponse.json({ error: "El cliente ya está inscrito" }, { status: 409 });

  const client = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, clientId)).get();
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  db.insert(schema.courseEnrollments).values({ id: crypto.randomUUID(), appointmentId: id, clientId, createdAt: now }).run();
  db.insert(schema.servicePurchases).values({
    id: crypto.randomUUID(),
    userId: clientId,
    appointmentId: id,
    serviceId: service.id,
    serviceName: service.name,
    serviceDescription: service.description,
    servicePrice: service.price,
    serviceDurationMins: service.durationMins,
    financialStatus: "pending",
    createdAt: now,
  }).run();
  recomputeFinancialStatus(clientId);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const appt = db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
  if (!appt) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (appt.status === "completed") return NextResponse.json({ error: "No se puede modificar una sesión completada" }, { status: 400 });

  db.delete(schema.courseEnrollments)
    .where(and(eq(schema.courseEnrollments.appointmentId, id), eq(schema.courseEnrollments.clientId, clientId)))
    .run();
  db.delete(schema.servicePurchases)
    .where(and(eq(schema.servicePurchases.appointmentId, id), eq(schema.servicePurchases.userId, clientId)))
    .run();
  recomputeFinancialStatus(clientId);
  return NextResponse.json({ success: true });
}
