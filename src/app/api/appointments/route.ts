import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, gte, lt, ne, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import { validateSlot } from "@/lib/availability";
import { createAppointmentClientEvent, createAppointmentAdminEvent } from "@/lib/calendar";
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const all = searchParams.get("all");

  const baseQuery = db
    .select({
      id: schema.appointments.id,
      startTime: schema.appointments.startTime,
      endTime: schema.appointments.endTime,
      status: schema.appointments.status,
      referencePhotoUrl: schema.appointments.referencePhotoUrl,
      clientName: schema.users.name,
      clientId: schema.users.id,
      clientPhone: schema.users.phone,
      serviceName: sql<string>`coalesce(${schema.servicePurchases.serviceName}, ${schema.services.name})`,
      servicePrice: schema.servicePurchases.servicePrice,
      serviceId: schema.services.id,
      isGroup: schema.services.isGroup,
    })
    .from(schema.appointments)
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .leftJoin(
      schema.servicePurchases,
      eq(schema.servicePurchases.appointmentId, schema.appointments.id)
    )
    .where(ne(schema.appointments.status, "cancelled"));

  let appointments;
  if (all === "1") {
    appointments = baseQuery.orderBy(sql`${schema.appointments.startTime} ASC`).all();
  } else if (!date) {
    return NextResponse.json({ error: "date is required (or use all=1)" }, { status: 400 });
  } else {
    const dateObj = new Date(date + "T00:00:00-04:00");
    const dayStart = Math.floor(dateObj.getTime() / 1000);
    const dayEnd = dayStart + 24 * 3600;
    const dayQuery = db
      .select({
        id: schema.appointments.id,
        startTime: schema.appointments.startTime,
        endTime: schema.appointments.endTime,
        status: schema.appointments.status,
        referencePhotoUrl: schema.appointments.referencePhotoUrl,
        clientName: schema.users.name,
        clientId: schema.users.id,
        clientPhone: schema.users.phone,
        serviceName: sql<string>`coalesce(${schema.servicePurchases.serviceName}, ${schema.services.name})`,
        servicePrice: schema.servicePurchases.servicePrice,
        serviceId: schema.services.id,
        isGroup: schema.services.isGroup,
      })
      .from(schema.appointments)
      .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id)
      )
      .leftJoin(
        schema.servicePurchases,
        eq(schema.servicePurchases.appointmentId, schema.appointments.id)
      )
      .where(
        and(
          ne(schema.appointments.status, "cancelled"),
          gte(schema.appointments.startTime, dayStart),
          lt(schema.appointments.startTime, dayEnd)
        )
      )
      .orderBy(sql`${schema.appointments.startTime} ASC`);
    appointments = dayQuery.all();
  }

  const enrollCounts = new Map(
    db
      .select({ appointmentId: schema.courseEnrollments.appointmentId, n: sql<number>`count(*)` })
      .from(schema.courseEnrollments)
      .groupBy(schema.courseEnrollments.appointmentId)
      .all()
      .map((r) => [r.appointmentId, r.n] as const)
  );

  return NextResponse.json(
    appointments.map((appt) => ({
      ...appt,
      studentCount: enrollCounts.get(appt.id) ?? (appt.isGroup === 1 ? 1 : 0),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const {
    serviceId,
    startTime,
    referencePhotoUrl,
    referencePhotoUrls,
    clientId,
  } = body;

  if (!serviceId || typeof startTime !== "number") {
    return NextResponse.json(
      { error: "serviceId and startTime are required" },
      { status: 400 }
    );
  }

  const targetClientId: string = clientId
    ? clientId
    : session.user.id;

  if (clientId && !(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (clientId) {
    const target = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, targetClientId))
      .get();
    if (!target) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
  }

  const urls: string[] = referencePhotoUrls?.length
    ? referencePhotoUrls
    : referencePhotoUrl
      ? [referencePhotoUrl]
      : [];

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

  const availabilityError = validateSlot(startTime, endTime);
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError }, { status: 409 });
  }

  const appointment = {
    id: crypto.randomUUID(),
    clientId: targetClientId,
    serviceId,
    startTime,
    endTime,
    status: "pending",
    referencePhotoUrl: urls[0] || null,
    createdAt: now,
  };

  db.insert(schema.appointments).values(appointment).run();

  urls.forEach((url, i) => {
    db.insert(schema.appointmentPhotos)
      .values({
        id: crypto.randomUUID(),
        appointmentId: appointment.id,
        url,
        position: i,
        createdAt: now,
      })
      .run();
  });

  db.insert(schema.servicePurchases)
    .values({
      id: crypto.randomUUID(),
      userId: targetClientId,
      appointmentId: appointment.id,
      serviceId: service.id,
      serviceName: service.name,
      serviceDescription: service.description,
      servicePrice: service.price,
      serviceDurationMins: service.durationMins,
      createdAt: now,
    })
    .run();

  if (process.env.GOOGLE_CALENDAR_ENABLED === "true") {
    await syncAppointmentToGoogleCalendars(appointment, service.name);
  }

  return NextResponse.json({ id: appointment.id });
}

async function syncAppointmentToGoogleCalendars(
  appointment: {
    id: string;
    clientId: string;
    startTime: number;
    endTime: number;
  },
  serviceName: string
) {
  const summary = `Cita: ${serviceName}`;
  const start = appointment.startTime;
  const end = appointment.endTime;

  try {
    const clientEventId = await createAppointmentClientEvent({
      clientId: appointment.clientId,
      startTime: start,
      endTime: end,
      summary,
    });
    const adminEventId = await createAppointmentAdminEvent({
      startTime: start,
      endTime: end,
      summary,
    });

    if (clientEventId || adminEventId) {
      db.update(schema.appointments)
        .set({
          googleEventIdClient: clientEventId,
          googleEventIdAdmin: adminEventId,
        })
        .where(eq(schema.appointments.id, appointment.id))
        .run();
    }
  } catch (e) {
    console.error("calendar sync failed (best effort)", e);
  }
}
