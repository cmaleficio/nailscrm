import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, gte, lt, ne, sql, inArray } from "drizzle-orm";
import { isAdmin, hasPermission } from "@/lib/authz";
import { validateSlot } from "@/lib/availability";
import { createAppointmentClientEvent, createAppointmentAdminEvent } from "@/lib/calendar";
import { todayStr, dateToDayStartTs } from "@/lib/time";
import { logActivity } from "@/lib/audit";
import {
  parseComplementaryIds,
  resolveBookingServices,
  formatServiceNames,
} from "@/lib/booking-combos";
import { summarizePurchases } from "@/lib/appointment-purchases";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const all = searchParams.get("all");
  const pendingOnly = searchParams.get("pendingOnly");

  if (pendingOnly === "1" && !(await hasPermission(session, "appointments"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
      serviceName: schema.services.name,
      serviceId: schema.services.id,
      isGroup: schema.services.isGroup,
    })
    .from(schema.appointments)
    .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(ne(schema.appointments.status, "cancelled"));

  let appointments;
  if (pendingOnly === "1") {
    const dayStart = dateToDayStartTs(todayStr());
    const pendingQuery = db
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
        isGroup: schema.services.isGroup,
        isOverdue: sql<number>`CASE WHEN ${schema.appointments.startTime} < ${dayStart} THEN 1 ELSE 0 END`,
      })
      .from(schema.appointments)
      .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id)
      )
      .where(
        and(
          sql`${schema.appointments.status} IN ('pending', 'confirmed')`,
          gte(schema.appointments.startTime, dayStart - 60 * 86400),
          lt(schema.appointments.startTime, dayStart + 30 * 86400)
        )
      )
      .orderBy(sql`${schema.appointments.startTime} ASC`);
    appointments = pendingQuery.all();
  } else if (all === "1") {
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
        serviceName: schema.services.name,
        serviceId: schema.services.id,
        isGroup: schema.services.isGroup,
      })
      .from(schema.appointments)
      .innerJoin(schema.users, eq(schema.appointments.clientId, schema.users.id))
      .innerJoin(
        schema.services,
        eq(schema.appointments.serviceId, schema.services.id)
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

  // Las compras se cargan aparte y se fusionan en memoria. El LEFT JOIN que
  // existía antes multiplicaba la cita por cada fila de service_purchases, así
  // que una cita con 3 servicios salía 3 veces y una sesión de curso, N veces.
  const purchaseRows = appointments.length
    ? db
        .select({
          id: schema.servicePurchases.id,
          appointmentId: schema.servicePurchases.appointmentId,
          userId: schema.servicePurchases.userId,
          serviceName: schema.servicePurchases.serviceName,
          servicePrice: schema.servicePurchases.servicePrice,
          serviceDurationMins: schema.servicePurchases.serviceDurationMins,
          isPrimary: schema.servicePurchases.isPrimary,
        })
        .from(schema.servicePurchases)
        .where(
          inArray(
            schema.servicePurchases.appointmentId,
            appointments.map((a) => a.id)
          )
        )
        .all()
    : [];

  const summaries = summarizePurchases(appointments, purchaseRows);

  return NextResponse.json(
    appointments.map((appt) => {
      const summary = summaries.get(appt.id);
      return {
        ...appt,
        serviceName: summary?.serviceName ?? appt.serviceName,
        servicePrice: summary?.servicePrice ?? 0,
        serviceItems: summary?.serviceNames ?? [],
        isComplementaryOnly: summary?.isComplementaryOnly ?? false,
        studentCount: enrollCounts.get(appt.id) ?? (appt.isGroup === 1 ? 1 : 0),
      };
    })
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
    addServiceIds: addServiceIdsRaw,
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

  const addServiceIds = parseComplementaryIds(addServiceIdsRaw);

  // Una sola consulta trae el principal y los complementarios; resolveBookingServices
  // es la única fuente de reglas de combinación (rol, curso, tope, activo).
  const comboRows = db
    .select()
    .from(schema.services)
    .where(inArray(schema.services.id, [serviceId, ...addServiceIds]))
    .all();

  if (!comboRows.some((s) => s.id === serviceId)) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const combo = resolveBookingServices(comboRows, serviceId, addServiceIds);
  if (combo.error) {
    return NextResponse.json({ error: combo.error }, { status: 400 });
  }

  const endTime = startTime + combo.totalDurationMins * 60;
  const now = Math.floor(Date.now() / 1000);

  const availabilityError = validateSlot(startTime, endTime);
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError }, { status: 409 });
  }

  // Sin await entre validateSlot y los inserts: la disponibilidad no puede
  // quedar obsoleta entre la validación y la escritura.
  const appointment = {
    id: crypto.randomUUID(),
    clientId: targetClientId,
    serviceId: combo.anchorServiceId,
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

  for (const s of combo.services) {
    db.insert(schema.servicePurchases)
      .values({
        id: crypto.randomUUID(),
        userId: targetClientId,
        appointmentId: appointment.id,
        serviceId: s.id,
        serviceName: s.name,
        serviceDescription: s.description ?? null,
        servicePrice: s.price,
        serviceDurationMins: s.durationMins,
        isPrimary: combo.principal && s.id === combo.principal.id ? 1 : 0,
        createdAt: now,
      })
      .run();
  }

  const comboLabel = formatServiceNames(combo.services.map((s) => s.name));

  if (process.env.GOOGLE_CALENDAR_ENABLED === "true") {
    await syncAppointmentToGoogleCalendars(appointment, comboLabel);
  }

  {
    const clientRow = db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, targetClientId))
      .get();
    logActivity(db, {
      entity: "appointments",
      action: "create",
      entityId: appointment.id,
      label: `Cita creada: ${clientRow?.name ?? "Cliente"} – ${comboLabel}`,
      metadata: {
        startTime,
        endTime,
        serviceId: combo.anchorServiceId,
        serviceIds: combo.services.map((s) => s.id),
        servicePrice: combo.totalPrice,
        createdByAdmin: Boolean(clientId),
      },
      actorId: session.user.id,
      actorName: session?.user?.name ?? null,
    });
  }

  return NextResponse.json({
    id: appointment.id,
    serviceIds: combo.services.map((s) => s.id),
    totalPrice: combo.totalPrice,
    totalDurationMins: combo.totalDurationMins,
  });
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
