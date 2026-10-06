import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { eq, and, sql, ne, inArray } from "drizzle-orm";
import { hasAnyPermission } from "@/lib/authz";
import { logActivity } from "@/lib/audit";
import { summarizePurchases } from "@/lib/appointment-purchases";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasAnyPermission(session, ["clients", "appointments"]))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  let email: string | undefined;
  if (body.email !== undefined) {
    email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Correo electrónico inválido" },
        { status: 400 }
      );
    }
    // PastelSalón nunca genera emails sintéticos @local para clientes normales;
    // pero si el cliente ya tiene uno, se sobrescribe al editar.
    const duplicate = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, email), ne(schema.users.id, id)))
      .get();
    if (duplicate) {
      return NextResponse.json(
        { error: "Ya existe otro cliente con ese correo" },
        { status: 409 }
      );
    }
  }

  const update: Partial<typeof schema.users.$inferSelect> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.address !== undefined) update.address = body.address;
  if (body.techNotes !== undefined) update.techNotes = body.techNotes;
  if (email !== undefined) update.email = email;

  if (Object.keys(update).length > 0) {
    db.update(schema.users).set(update).where(eq(schema.users.id, id)).run();
  }

  const client = db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  logActivity(db, {
    entity: "clients",
    action: "update",
    entityId: client?.id ?? id,
    label: `Cliente actualizado: ${client?.name ?? id}`,
    metadata: update,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ success: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasAnyPermission(session, ["clients", "appointments"]))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const client = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Deuda con la MISMA definición que /api/balances y /profile: todo servicio
  // no anulado, sin importar si la cita ya se completó. Antes aquí solo
  // contaban las citas terminadas, y el mismo cliente salía con dos saldos
  // distintos según el panel donde se mirara (y el reparto de un pago tenía
  // dos "deudas" posibles).
  const dueRow = db
    .select({
      due: sql<number>`coalesce(sum(${schema.servicePurchases.servicePrice}), 0)`,
    })
    .from(schema.servicePurchases)
    .where(
      and(
        eq(schema.servicePurchases.userId, id),
        ne(schema.servicePurchases.financialStatus, "void")
      )
    )
    .get();

  const paidRow = db
    .select({ paid: sql<number>`coalesce(sum(${schema.payments.amountUsd}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.userId, id))
    .get();

  const payments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.userId, id))
    .orderBy(sql`${schema.payments.paidAt} DESC`)
    .limit(10)
    .all();

  // Fotos de referencia agrupadas por cita. Así el CRM funciona igual abierto
  // desde la agenda (donde se sabe la cita) como desde /dashboard/clients
  // (donde el admin tiene que elegir de qué visita quiere ver los modelos).
  const photoRows = db
    .select({
      appointmentId: schema.appointmentPhotos.appointmentId,
      photoId: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      startTime: schema.appointments.startTime,
      serviceName: schema.services.name,
    })
    .from(schema.appointmentPhotos)
    .innerJoin(
      schema.appointments,
      eq(schema.appointmentPhotos.appointmentId, schema.appointments.id)
    )
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(
      and(
        eq(schema.appointments.clientId, id),
        eq(schema.appointmentPhotos.kind, "reference")
      )
    )
    .orderBy(sql`${schema.appointments.startTime} DESC`, schema.appointmentPhotos.position)
    .all();

  const photoGroups = new Map<
    string,
    { appointmentId: string; serviceName: string; startTime: number | null; photos: { id: string; url: string }[] }
  >();
  for (const row of photoRows) {
    const group = photoGroups.get(row.appointmentId) ?? {
      appointmentId: row.appointmentId,
      serviceName: row.serviceName,
      startTime: row.startTime,
      photos: [],
    };
    group.photos.push({ id: row.photoId, url: row.url });
    photoGroups.set(row.appointmentId, group);
  }

  // El pasaporte de la clienta: fotos finales de sus citas completadas. Usa
  // services.name y no el snapshot de service_purchases a propósito, porque
  // una sesión de curso tiene una fila de compra por alumno y el LEFT JOIN
  // multiplicaría cada foto tantas veces como alumnos tenga la cita.
  const passportRows = db
    .select({
      appointmentId: schema.appointmentPhotos.appointmentId,
      photoId: schema.appointmentPhotos.id,
      url: schema.appointmentPhotos.url,
      startTime: schema.appointments.startTime,
      serviceName: schema.services.name,
    })
    .from(schema.appointmentPhotos)
    .innerJoin(
      schema.appointments,
      eq(schema.appointmentPhotos.appointmentId, schema.appointments.id)
    )
    .innerJoin(
      schema.services,
      eq(schema.appointments.serviceId, schema.services.id)
    )
    .where(
      and(
        eq(schema.appointments.clientId, id),
        eq(schema.appointmentPhotos.kind, "final"),
        eq(schema.appointments.status, "completed")
      )
    )
    .orderBy(sql`${schema.appointments.startTime} DESC`, schema.appointmentPhotos.position)
    .all();

  const passportGroups = new Map<
    string,
    { appointmentId: string; serviceName: string; startTime: number | null; photos: { id: string; url: string }[] }
  >();
  for (const row of passportRows) {
    const group = passportGroups.get(row.appointmentId) ?? {
      appointmentId: row.appointmentId,
      serviceName: row.serviceName,
      startTime: row.startTime,
      photos: [],
    };
    group.photos.push({ id: row.photoId, url: row.url });
    passportGroups.set(row.appointmentId, group);
  }

  // Nombres de servicio de cada cita, fusionados con summarizePurchases para
  // que una cita con principal + complementarios muestre todos y no solo el
  // ancla. Se resuelve una vez por cita (no por foto) para no multiplicar filas.
  // El clientId se pasa como la cita misma porque aquí no importa a qué alumno
  // pertenece: solo se usan los nombres del snapshot de compras.
  const groupedAppointmentIds = [
    ...new Set([
      ...photoRows.map((r) => r.appointmentId),
      ...passportRows.map((r) => r.appointmentId),
    ]),
  ];

  if (groupedAppointmentIds.length > 0) {
    const purchaseRows = db
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
      .where(inArray(schema.servicePurchases.appointmentId, groupedAppointmentIds))
      .all();

    const names = summarizePurchases(
      groupedAppointmentIds.map((aid) => ({ id: aid, clientId: aid, serviceName: "" })),
      purchaseRows
    );

    for (const [aid, summary] of names) {
      if (!summary.serviceName) continue;
      const ref = photoGroups.get(aid);
      if (ref) ref.serviceName = summary.serviceName;
      const pass = passportGroups.get(aid);
      if (pass) pass.serviceName = summary.serviceName;
    }
  }

  return NextResponse.json({
    ...client,
    dueUsd: Math.round((dueRow?.due ?? 0) * 100) / 100,
    paidUsd: Math.round((paidRow?.paid ?? 0) * 100) / 100,
    balanceUsd: Math.round(((dueRow?.due ?? 0) - (paidRow?.paid ?? 0)) * 100) / 100,
    payments,
    photoGroups: [...photoGroups.values()],
    passportGroups: [...passportGroups.values()],
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await hasAnyPermission(session, ["clients", "appointments"]))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!user) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (user.role === "admin") {
    return NextResponse.json(
      { error: "No se puede eliminar a un usuario administrador" },
      { status: 403 }
    );
  }

  const appointmentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.appointments)
      .where(eq(schema.appointments.clientId, id))
      .get()?.count ?? 0;

  if (appointmentsCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene citas; no se puede eliminar" },
      { status: 400 }
    );
  }

  const paymentsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.payments)
      .where(eq(schema.payments.userId, id))
      .get()?.count ?? 0;

  if (paymentsCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene pagos o cuentas por cobrar; no se puede eliminar" },
      { status: 400 }
    );
  }

  const waitlistCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.clientId, id))
      .get()?.count ?? 0;

  if (waitlistCount > 0) {
    return NextResponse.json(
      { error: "El cliente está en la lista de espera; no se puede eliminar" },
      { status: 400 }
    );
  }

  const archivedCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.cancelledAppointments)
      .where(eq(schema.cancelledAppointments.clientId, id))
      .get()?.count ?? 0;

  if (archivedCount > 0) {
    return NextResponse.json(
      { error: "El cliente tiene citas canceladas archivadas; no se puede eliminar" },
      { status: 400 }
    );
  }

  db.delete(schema.users).where(eq(schema.users.id, id)).run();

  logActivity(db, {
    entity: "clients",
    action: "delete",
    entityId: user.id,
    label: `Cliente eliminado: ${user.name}`,
    actorId: session?.user?.id,
    actorName: session?.user?.name ?? null,
  });

  return NextResponse.json({ success: true });
}
