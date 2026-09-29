import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db/index";
import { and, eq, isNull } from "drizzle-orm";
import { isAdmin } from "@/lib/authz";
import {
  updateAppointmentEvent,
  getAdminUserId,
  deleteEventOnPrimaryCalendar,
} from "@/lib/calendar";
import { recordUsage } from "@/lib/inventory";
import { recomputeFinancialStatus } from "@/lib/financial-status";
import { logActivity } from "@/lib/audit";
import { validateSlot } from "@/lib/availability";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(await isAdmin(session))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, startTime } = body;
  const shareToGallery = body.shareToGallery;

  if (
    !status &&
    typeof startTime !== "number" &&
    typeof shareToGallery !== "boolean"
  ) {
    return NextResponse.json(
      { error: "status, startTime or shareToGallery is required" },
      { status: 400 }
    );
  }

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (status === "cancelled") {
    return NextResponse.json(
      { error: "Usa el método DELETE para cancelar citas" },
      { status: 400 }
    );
  }

  if (typeof startTime === "number" && startTime !== appointment.startTime) {
    // Se preserva la duración ya reservada (end_time - start_time) en vez de
    // recalcularla desde services.duration_mins: una cita con principal +
    // complementarios dura la suma de todos, y una de curso dura lo que el
    // curso dura, no lo que diga hoy el catálogo.
    const currentDurationMins =
      appointment.endTime !== null && appointment.startTime !== null
        ? Math.round((appointment.endTime - appointment.startTime) / 60)
        : 60;

    const endTime = startTime + currentDurationMins * 60;

    const availabilityError = validateSlot(startTime, endTime, id);
    if (availabilityError) {
      return NextResponse.json({ error: availabilityError }, { status: 409 });
    }

    db.update(schema.appointments)
      .set({ startTime, endTime })
      .where(eq(schema.appointments.id, id))
      .run();

    if (process.env.GOOGLE_CALENDAR_ENABLED === "true") {
      if (appointment.googleEventIdClient) {
        await updateAppointmentEvent(
          appointment.clientId,
          appointment.googleEventIdClient,
          startTime,
          endTime
        );
      }
      if (appointment.googleEventIdAdmin) {
        const adminUserId = await getAdminUserId();
        if (adminUserId) {
          await updateAppointmentEvent(
            adminUserId,
            appointment.googleEventIdAdmin,
            startTime,
            endTime
          );
        }
      }
    }
  }

  if (status === "completed" && appointment.status !== "completed") {
    const client = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, appointment.clientId))
      .get();

    if (client) {
      db.update(schema.users)
        .set({
          totalVisits: (client.totalVisits ?? 0) + 1,
        })
        .where(eq(schema.users.id, client.id))
        .run();
    }

    const now = Math.floor(Date.now() / 1000);
    db.update(schema.servicePurchases)
      .set({ completionDate: now })
      .where(and(eq(schema.servicePurchases.appointmentId, id), isNull(schema.servicePurchases.completionDate)))
      .run();
    if (client) {
      recomputeFinancialStatus(client.id);
    }

    const finalPhotos: string[] = Array.isArray(body.finalPhotos)
      ? body.finalPhotos.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
      : [];

    if (finalPhotos.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      finalPhotos.forEach((url, i) => {
        db.insert(schema.appointmentPhotos)
          .values({
            id: crypto.randomUUID(),
            appointmentId: id,
            url,
            position: i,
            createdAt: now,
            kind: "final",
          })
          .run();
      });
      db.update(schema.appointments)
        .set({
          finalPhotoUrl: finalPhotos[0],
          sharedToGallery: shareToGallery === false ? 0 : 1,
        })
        .where(eq(schema.appointments.id, id))
        .run();
    }

    const usage: { inventoryItemId: string; quantity: number }[] = Array.isArray(body.usage)
      ? body.usage
          .filter((x: unknown) => x && typeof (x as { inventoryItemId?: unknown }).inventoryItemId === "string")
          .map((x: unknown) => ({
            inventoryItemId: (x as { inventoryItemId: string }).inventoryItemId,
            quantity: Number((x as { quantity?: unknown }).quantity) || 1,
          }))
      : [];
    if (usage.length > 0) {
      recordUsage(id, usage, session?.user?.id ?? "");
    }
  }

  if (status) {
    db.update(schema.appointments)
      .set({ status })
      .where(eq(schema.appointments.id, id))
      .run();
  }

  if (typeof shareToGallery === "boolean") {
    db.update(schema.appointments)
      .set({ sharedToGallery: shareToGallery ? 1 : 0 })
      .where(eq(schema.appointments.id, id))
      .run();
  }

  {
    if (status === "completed" && appointment.status !== "completed") {
      logActivity(db, {
        entity: "appointments",
        action: "complete",
        entityId: appointment.id,
        label: `Cita completada`,
        metadata: { appointmentId: appointment.id },
        actorId: session?.user?.id,
        actorName: session?.user?.name ?? null,
      });
    } else {
      logActivity(db, {
        entity: "appointments",
        action: "update",
        entityId: appointment.id,
        label: `Cita actualizada`,
        metadata: { status, startTime, shareToGallery },
        actorId: session?.user?.id,
        actorName: session?.user?.name ?? null,
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const appointment = db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, id))
    .get();

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const admin = await isAdmin(session);
  if (!admin && appointment.clientId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (appointment.status === "completed") {
    return NextResponse.json(
      { error: "No se puede cancelar una cita completada" },
      { status: 400 }
    );
  }

  // Se leen TODAS las compras: una cita puede tener varias (principal +
  // complementarios). Antes se tomaba solo la primera con .get(), así que el
  // archivo de cancelaciones nunca reflejaba la combinación completa.
  const purchaseRowsFull = db
    .select({
      id: schema.servicePurchases.id,
      userId: schema.servicePurchases.userId,
      serviceName: schema.servicePurchases.serviceName,
      servicePrice: schema.servicePurchases.servicePrice,
      isPrimary: schema.servicePurchases.isPrimary,
    })
    .from(schema.servicePurchases)
    .where(eq(schema.servicePurchases.appointmentId, id))
    .all();

  const photos = db
    .select({ url: schema.appointmentPhotos.url })
    .from(schema.appointmentPhotos)
    .where(eq(schema.appointmentPhotos.appointmentId, id))
    .all();

  const service = db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, appointment.serviceId))
    .get();

  // Snapshot de la combinación: las compras van primero (son el precio realmente
  // cobrado) y el catálogo completa si la cita no dejó compras (walk-in viejo).
  const items = purchaseRowsFull.length
    ? [...purchaseRowsFull]
        .sort((a, b) => (b.isPrimary ?? 0) - (a.isPrimary ?? 0))
        .map((p) => ({ name: p.serviceName, price: p.servicePrice }))
    : service
      ? [{ name: service.name, price: service.price }]
      : [];

  const archivedServiceName =
    items.map((i) => i.name).join(" + ") || service?.name || "";
  const archivedServicePrice =
    items.reduce((acc, i) => acc + (i.price || 0), 0) || service?.price || 0;

  db.transaction((tx) => {
    tx.insert(schema.cancelledAppointments)
      .values({
        id: crypto.randomUUID(),
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        serviceName: archivedServiceName,
        servicePrice: archivedServicePrice,
        serviceItems: items.length ? JSON.stringify(items) : null,
        startTime: appointment.startTime ?? null,
        endTime: appointment.endTime ?? null,
        referencePhotoUrls: photos.length
          ? JSON.stringify(photos.map((p) => p.url))
          : null,
        cancelledBy: session.user.id,
        cancelledAt: Math.floor(Date.now() / 1000),
        reason: null,
      })
      .run();

    tx.update(schema.servicePurchases)
      .set({ financialStatus: "void" })
      .where(eq(schema.servicePurchases.appointmentId, id))
      .run();

    tx.delete(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .run();
  });

  if (process.env.GOOGLE_CALENDAR_ENABLED === "true") {
    if (appointment.googleEventIdClient) {
      await deleteEventOnPrimaryCalendar(
        appointment.clientId,
        appointment.googleEventIdClient
      );
    }
    if (appointment.googleEventIdAdmin) {
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        await deleteEventOnPrimaryCalendar(
          adminUserId,
          appointment.googleEventIdAdmin
        );
      }
    }
  }

  for (const p of purchaseRowsFull) recomputeFinancialStatus(p.userId);

  {
    const clientRow = db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, appointment.clientId))
      .get();
    logActivity(db, {
      entity: "appointments",
      action: "cancel",
      entityId: appointment.id,
      label: `Cita cancelada: ${clientRow?.name ?? "Cliente"} – ${archivedServiceName || "Servicio"}`,
      metadata: { startTime: appointment.startTime, servicePrice: archivedServicePrice, cancelledBy: session.user.id },
      actorId: session.user.id,
      actorName: session?.user?.name ?? null,
    });
  }

  return NextResponse.json({ success: true, deleted: true });
}
