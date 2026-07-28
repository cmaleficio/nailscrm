import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, gte, lt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const dateObj = new Date(date + "T00:00:00-04:00");
  const dayStart = Math.floor(dateObj.getTime() / 1000);
  const dayEnd = dayStart + 24 * 3600;

  const appointments = db
    .select({
      id: schema.appointments.id,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
      referencePhotoUrl: schema.appointments.referencePhotoUrl,
      clientName: schema.users.name,
      clientId: schema.users.id,
      clientPhone: schema.users.phone,
      serviceName: schema.services.name,
      serviceId: schema.services.id,
    })
    .from(schema.appointments)
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(
      and(
        gte(schema.appointments.startTime, dayStart),
        lt(schema.appointments.startTime, dayEnd)
      )
    )
    .orderBy(sql`${schema.appointments.startTime} ASC`)
    .all();

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { serviceId, startTime, referencePhotoUrl } = body;

  if (!serviceId || !startTime) {
    return NextResponse.json(
      { error: "serviceId and startTime are required" },
      { status: 400 }
    );
  }

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, serviceId))
    .get();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const endTime = startTime + service.durationMins * 60;
  const now = Math.floor(Date.now() / 1000);

  const appointment = {
    id: crypto.randomUUID(),
    clientId: session.user.id,
    serviceId,
    startTime,
    endTime,
    status: "pending",
    referencePhotoUrl: referencePhotoUrl || null,
    createdAt: now,
  };

  db.insert(schema.appointments).values(appointment).run();

  return NextResponse.json({ id: appointment.id });
}
